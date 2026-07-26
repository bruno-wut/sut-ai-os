"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isApprovedRoomImageSource, r2ImageUrl, R2_IMAGE_PREFIX } from "@/lib/media";
import { MAX_ROOM_GALLERY_IMAGES, ROOM_AMENITY_IDS } from "@/lib/room-details";
import { getCurrentStaffRole } from "@/lib/staff-access";
import { canManageHotelSetup } from "@/lib/staff-roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_ROOM_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ROOM_IMAGE_TYPES = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);

const galleryItemSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("existing"), url: z.string().trim().refine(isApprovedRoomImageSource) }),
  z.object({ kind: z.literal("upload"), token: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/) }),
]);

const configurationSchema = z.object({
  amenities: z.array(z.enum(ROOM_AMENITY_IDS)).min(1).max(ROOM_AMENITY_IDS.length),
  bedConfiguration: z.string().trim().min(1).max(160),
  bedConfigurationTh: z.string().trim().max(160),
  description: z.string().trim().min(20).max(1_500),
  descriptionTh: z.string().trim().max(1_500),
  extraBedPolicy: z.enum(["available", "not-available", "on-request"]),
  gallery: z.array(galleryItemSchema).min(1).max(MAX_ROOM_GALLERY_IMAGES),
  maxAdults: z.coerce.number().int().min(1).max(20),
  roomTypeId: z.string().uuid(),
  sizeSqm: z.coerce.number().min(1).max(1_000),
  websiteRoomNumbers: z.array(z.string().trim().min(1).max(50)).max(500),
});

type MediaBucket = {
  delete(key: string): Promise<unknown>;
  put(
    key: string,
    value: ReadableStream<Uint8Array>,
    options: { httpMetadata: { cacheControl: string; contentType: string } },
  ): Promise<unknown>;
};

function safeImageFilename(filename: string) {
  const extension = filename.toLowerCase().match(/\.(avif|jpe?g|png|webp)$/)?.[0] ?? "";
  const basename = filename
    .slice(0, extension ? -extension.length : undefined)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 70) || "room-image";
  return `${basename}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${extension || ".jpg"}`;
}

function validateImageFile(value: FormDataEntryValue | null) {
  if (!(value instanceof File)) throw new Error("A queued room image is missing. Choose it again and retry.");
  if (!ALLOWED_ROOM_IMAGE_TYPES.has(value.type)) throw new Error("Use AVIF, JPEG, PNG, or WebP room images.");
  if (value.size <= 0 || value.size > MAX_ROOM_IMAGE_BYTES) throw new Error("Each room image must be between 1 byte and 5 MB.");
  return value;
}

export async function saveRoomTypeConfiguration(formData: FormData) {
  const role = await getCurrentStaffRole();
  if (!role || !canManageHotelSetup(role)) {
    return { error: "Only an administrator or manager can publish room details.", ok: false as const };
  }

  const rawConfiguration = formData.get("configuration");
  if (typeof rawConfiguration !== "string") {
    return { error: "Room configuration is missing.", ok: false as const };
  }

  let input: unknown;
  try {
    input = JSON.parse(rawConfiguration);
  } catch {
    return { error: "Room configuration could not be read.", ok: false as const };
  }

  const parsed = configurationSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Review the room details.", ok: false as const };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Supabase is not configured.", ok: false as const };

  const pendingUploads = parsed.data.gallery.filter((item) => item.kind === "upload");
  let bucket: MediaBucket | null = null;
  const uploadedKeys: string[] = [];

  try {
    if (pendingUploads.length) {
      const { env } = await getCloudflareContext({ async: true });
      bucket = (env as unknown as { MEDIA_BUCKET?: MediaBucket }).MEDIA_BUCKET ?? null;
      if (!bucket) throw new Error("R2 media storage is not configured.");
    }

    const galleryImageUrls: string[] = [];
    for (const item of parsed.data.gallery) {
      if (item.kind === "existing") {
        galleryImageUrls.push(item.url);
        continue;
      }

      const file = validateImageFile(formData.get(`upload:${item.token}`));
      const objectKey = `${R2_IMAGE_PREFIX}rooms/${safeImageFilename(file.name)}`;
      await bucket!.put(objectKey, file.stream(), {
        httpMetadata: {
          cacheControl: "public, max-age=31536000, immutable",
          contentType: file.type,
        },
      });
      uploadedKeys.push(objectKey);
      galleryImageUrls.push(r2ImageUrl(objectKey));
    }

    const { data, error } = await supabase.rpc("update_room_type_guest_configuration", {
      p_configuration: {
        amenities: parsed.data.amenities,
        bed_configuration: parsed.data.bedConfiguration,
        bed_configuration_th: parsed.data.bedConfigurationTh,
        extra_bed_policy: parsed.data.extraBedPolicy,
        full_description: parsed.data.description,
        full_description_th: parsed.data.descriptionTh,
        gallery_image_urls: galleryImageUrls,
        max_adults: parsed.data.maxAdults,
        room_size_sqm: parsed.data.sizeSqm,
      },
      p_room_type_id: parsed.data.roomTypeId,
      p_website_room_numbers: parsed.data.websiteRoomNumbers,
    });

    const result = data as { ok?: boolean } | null;
    if (error || !result?.ok) {
      const message = error?.message ?? "Room details were not published.";
      if (message.includes("holds and group blocks")) {
        throw new Error("Clear active checkout holds and group blocks before changing this website allocation.");
      }
      throw new Error("Room details were not published. No active configuration was changed.");
    }

    revalidatePath("/en/book");
    revalidatePath("/th/book");
    revalidatePath("/en/staff/room-types");
    revalidatePath("/th/staff/room-types");

    return { data: { galleryImageUrls }, ok: true as const };
  } catch (error) {
    if (bucket && uploadedKeys.length) {
      await Promise.allSettled(uploadedKeys.map((key) => bucket!.delete(key)));
    }
    return {
      error: error instanceof Error ? error.message : "Room details were not published.",
      ok: false as const,
    };
  }
}
