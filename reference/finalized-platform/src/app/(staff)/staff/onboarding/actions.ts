"use server";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

import { isApprovedRoomImageSource, r2ImageUrl, R2_IMAGE_PREFIX } from "@/lib/media";
import { getCurrentStaffRole } from "@/lib/staff-access";
import { canManageHotelSetup } from "@/lib/staff-roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MAX_ROOM_GALLERY_IMAGES, ROOM_AMENITY_IDS } from "@/lib/room-details";

const roomTypeSchema = z.object({
  amenities: z.array(z.enum(ROOM_AMENITY_IDS)).min(1).max(ROOM_AMENITY_IDS.length),
  bedConfiguration: z.string().trim().min(1).max(160),
  bedConfigurationTh: z.string().trim().max(160),
  description: z.string().trim().min(20).max(1_500),
  descriptionTh: z.string().trim().max(1_500),
  extraBedPolicy: z.enum(["available", "not-available", "on-request"]),
  galleryImageUrls: z
    .array(
      z.string().trim().refine(
        (value) => isApprovedRoomImageSource(value),
        "Use only approved R2 room image URLs in galleries.",
      ),
    )
    .min(1, "Every room type needs at least one gallery image.")
    .max(MAX_ROOM_GALLERY_IMAGES, `Room galleries support up to ${MAX_ROOM_GALLERY_IMAGES} images.`),
  imageUrl: z
    .string()
    .trim()
    .refine(
      (value) => isApprovedRoomImageSource(value),
      "Use an approved R2 room image URL.",
    ),
  name: z.string().trim().min(1, "Every room type needs a name.").max(120),
  maxAdults: z.coerce.number().int().min(1).max(20),
  rate: z.coerce.number().min(0).max(1_000_000),
  roomNumbers: z
    .array(z.string().trim().min(1).max(50))
    .min(1, "Every room type needs at least one physical room."),
  websiteRoomNumbers: z.array(z.string().trim().min(1).max(50)),
  sizeSqm: z.coerce.number().min(1).max(1_000),
});

const inventorySchema = z
  .array(roomTypeSchema)
  .min(1)
  .max(50)
  .superRefine((roomTypes, context) => {
    const names = roomTypes.map((roomType) => roomType.name.toLowerCase());
    const roomNumbers = roomTypes.flatMap((roomType) =>
      roomType.roomNumbers.map((roomNumber) => roomNumber.toLowerCase()),
    );

    if (new Set(names).size !== names.length) {
      context.addIssue({ code: "custom", message: "Room type names must be unique." });
    }

    if (new Set(roomNumbers).size !== roomNumbers.length) {
      context.addIssue({ code: "custom", message: "Physical room numbers must be unique." });
    }

    for (const roomType of roomTypes) {
      const physicalRooms = new Set(roomType.roomNumbers);
      if (roomType.websiteRoomNumbers.some((roomNumber) => !physicalRooms.has(roomNumber))) {
        context.addIssue({
          code: "custom",
          message: `${roomType.name}'s website allocation must use its physical rooms.`,
        });
      }
    }
  });

function roomTypeCode(name: string) {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 50);
}

export async function initializeHotelInventory(input: unknown) {
  const parsed = inventorySchema.safeParse(input);

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please review the room setup.",
      ok: false as const,
    };
  }

  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return { error: "Supabase is not configured.", ok: false as const };
  }

  const payload = parsed.data.map((roomType) => ({
    amenities: roomType.amenities,
    base_nightly_rate: roomType.rate,
    bed_configuration: roomType.bedConfiguration,
    bed_configuration_th: roomType.bedConfigurationTh,
    code: roomTypeCode(roomType.name),
    extra_bed_policy: roomType.extraBedPolicy,
    full_description: roomType.description,
    full_description_th: roomType.descriptionTh,
    gallery_image_urls: roomType.galleryImageUrls,
    image_url: roomType.imageUrl,
    max_adults: roomType.maxAdults,
    name: roomType.name,
    room_size_sqm: roomType.sizeSqm,
    room_numbers: roomType.roomNumbers,
  }));

  if (payload.some((roomType) => !roomType.code)) {
    return { error: "Every room type needs a name containing letters or numbers.", ok: false as const };
  }

  if (new Set(payload.map((roomType) => roomType.code)).size !== payload.length) {
    return { error: "Room type names must produce unique codes.", ok: false as const };
  }

  const { data, error } = await supabase.rpc("initialize_hotel_inventory", {
    p_room_types: payload,
  });

  if (error) {
    const safeMessage =
      error.message.includes("active staff profile")
        ? "Your account is not yet linked to an active hotel staff profile."
        : error.message.includes("admin or manager")
          ? "Only a hotel administrator or manager can initialize inventory."
          : error.message.includes("already been initialized")
            ? "Hotel inventory has already been initialized."
            : "Inventory setup could not be completed. Please review the room details or contact an administrator.";

    return { error: safeMessage, ok: false as const };
  }

  const result = data as { error?: string; ok?: boolean } | null;

  if (!result?.ok) {
    return {
      error: result?.error
        ? "Inventory generation stopped safely. Please review the room plan and try again."
        : "Inventory setup did not complete. No partial room plan was accepted.",
      ok: false as const,
    };
  }

  const websiteRoomNumbers = parsed.data.flatMap(
    (roomType) => roomType.websiteRoomNumbers,
  );
  const { data: allocationData, error: allocationError } = await supabase.rpc(
    "publish_initial_web_allocation",
    { p_room_numbers: websiteRoomNumbers },
  );

  const allocationResult = allocationData as { ok?: boolean } | null;
  if (allocationError || !allocationResult?.ok) {
    return {
      error: "Physical inventory was created safely with web sales closed, but the opening website allocation could not be applied. Please contact an administrator.",
      ok: false as const,
    };
  }

  return { data: { ...result, website_allocation: allocationData }, ok: true as const };
}

const MAX_ROOM_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_ROOM_IMAGE_TYPES = new Set(["image/avif", "image/jpeg", "image/png", "image/webp"]);
type MediaBucket = {
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
    .slice(0, 80) || "room-image";
  return `${basename}-${Date.now()}${extension || ".jpg"}`;
}

export async function uploadRoomImageToR2(formData: FormData) {
  const role = await getCurrentStaffRole();
  if (!role || !canManageHotelSetup(role)) {
    return { error: "Only an administrator or manager can upload room images.", ok: false as const };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Choose an image file.", ok: false as const };
  if (!ALLOWED_ROOM_IMAGE_TYPES.has(file.type)) {
    return { error: "Use an AVIF, JPEG, PNG, or WebP image.", ok: false as const };
  }
  if (file.size <= 0 || file.size > MAX_ROOM_IMAGE_BYTES) {
    return { error: "Room images must be between 1 byte and 5 MB.", ok: false as const };
  }

  const { env } = await getCloudflareContext({ async: true });
  const bucket = (env as unknown as { MEDIA_BUCKET?: MediaBucket }).MEDIA_BUCKET;
  if (!bucket) return { error: "R2 media storage is not configured.", ok: false as const };

  const objectKey = `${R2_IMAGE_PREFIX}rooms/${safeImageFilename(file.name)}`;
  await bucket.put(objectKey, file.stream(), {
    httpMetadata: {
      cacheControl: "public, max-age=31536000, immutable",
      contentType: file.type,
    },
  });

  return { key: objectKey, ok: true as const, url: r2ImageUrl(objectKey) };
}
