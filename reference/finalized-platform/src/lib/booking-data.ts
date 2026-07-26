import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";

import { SRI_U_THONG_ROOM_PLAN } from "@/lib/hotel-inventory-plan";
import { addDaysToDateString, getBangkokDateString, normalizeStayDates } from "@/lib/hotel-dates";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { normalizeR2ImageSource, ROOM_IMAGE_PRESETS } from "@/lib/media";
import { guestRoomDisplayName } from "@/lib/guest-room-catalog";
import {
  defaultRoomDetails,
  isExtraBedPolicy,
  isRoomAmenityId,
  MAX_ROOM_GALLERY_IMAGES,
  type ExtraBedPolicy,
  type RoomAmenityId,
  type RoomDetails,
} from "@/lib/room-details";

export type RoomOption = Readonly<{
  slug: string;
  name: string;
  image: string;
  summary: string;
  sleeps: number;
  size: string;
  nightlyPrice: number;
  roomsLeft: number;
  features: readonly string[];
  amenities: readonly RoomAmenityId[];
  bedConfiguration: string;
  bedConfigurationTh: string;
  description: string;
  descriptionTh: string;
  extraBedPolicy: ExtraBedPolicy;
  galleryImages: readonly string[];
  sizeSqm: number;
  source: "fixture" | "supabase";
  nextAvailableDate?: string | null;
  maxAdults: number;
  isAvailable: boolean;
  notAvailableReason?: "SOLD_OUT" | "CAPACITY_EXCEEDED" | null;
  capacityMessage?: string;
}>;

export type RoomSearchResult = Readonly<{
  options: RoomOption[];
  suggestion?: {
    message: string;
    targetRooms: number;
  } | null;
}>;

export type BookingSearchParams = {
  checkIn?: string;
  checkOut?: string;
  adults?: string;
  rooms?: string;
};

type RoomTypeRow = {
  amenities: unknown;
  base_nightly_rate: number | string;
  bed_configuration: string | null;
  bed_configuration_th: string | null;
  extra_bed_policy: string | null;
  full_description: string | null;
  full_description_th: string | null;
  gallery_image_urls: unknown;
  id: string;
  image_url: string | null;
  max_adults: number | null;
  name: string;
  room_size_sqm: number | string | null;
};

type PhysicalRoomRow = {
  id: string;
  room_type_id: string;
  web_allocation_enabled: boolean;
};

type AllotmentRow = {
  date: string;
  is_available: boolean;
  is_booked: boolean;
  room_id: string;
  room_type_id: string;
};

type CatalogTemplate = Readonly<{
  features: readonly string[];
  image: string;
  name: string;
  size: string;
  sleeps: number;
  summary: string;
}> & RoomDetails;

const FAMILY_TEMPLATES: Record<"classic" | "executive", CatalogTemplate> = {
  classic: {
    ...defaultRoomDetails("classic", "/images/grand-superior-room.jpg"),
    features: ["Bed type allocated by the hotel", "Breakfast available"],
    image: "/images/grand-superior-room.jpg",
    name: "Classic Room",
    size: "28 m²",
    sleeps: 2,
    summary: "A calm, practical room for short business trips and city visits.",
  },
  executive: {
    ...defaultRoomDetails("executive", "/images/grand-deluxe-room.jpg"),
    features: ["Bed type allocated by the hotel", "Breakfast available"],
    image: "/images/grand-deluxe-room.jpg",
    name: "Executive Room",
    size: "34 m²",
    sleeps: 2,
    summary: "A more spacious stay with a dedicated sitting area and refined finishes.",
  },
};

const DIRECT_TEMPLATES: Record<string, CatalogTemplate> = {
  "Deluxe Room": {
    ...defaultRoomDetails("deluxe-room", "/images/grand-deluxe-room.jpg"),
    features: ["Breakfast available", "City view"],
    image: "/images/grand-deluxe-room.jpg",
    name: "Deluxe Room",
    size: "34 m²",
    sleeps: 3,
    summary: "A more spacious stay with a dedicated sitting area and refined finishes.",
  },
  "Studio Suite": {
    ...defaultRoomDetails("studio-suite", "/images/grand-suite-room.jpg"),
    features: ["Separate living area", "Breakfast included"],
    image: "/images/grand-suite-room.jpg",
    name: "Studio Suite",
    size: "48 m²",
    sleeps: 2,
    summary: "Generous space for longer stays, special visits, or quiet evenings in.",
  },
  "Executive Suite": {
    ...defaultRoomDetails("executive-suite", "/images/grand-suite-room.jpg"),
    features: ["Separate living area", "Breakfast included"],
    image: "/images/grand-suite-room.jpg",
    name: "Executive Suite",
    size: "48 m²",
    sleeps: 2,
    summary: "A polished suite with extra room to settle in and relax.",
  },
  "Grand Residence": {
    ...defaultRoomDetails("grand-residence", "/images/grand-suite-room.jpg"),
    features: ["Separate lounge", "Breakfast included"],
    image: "/images/grand-suite-room.jpg",
    name: "Grand Residence",
    size: "68 m²",
    sleeps: 3,
    summary: "The hotel’s largest residence with long-stay comfort and extra privacy.",
  },
};

function fallbackRoomOptions(searchParams?: BookingSearchParams): RoomSearchResult {
  const byName = new Map(SRI_U_THONG_ROOM_PLAN.map((room) => [room.name, room]));
  const classicDouble = byName.get("Classic Room (Double)");
  const classicTwin = byName.get("Classic Room (Twin)");
  const executiveDouble = byName.get("Executive Room (Double)");
  const executiveTwin = byName.get("Executive Room (Twin)");

  const adultCount = Math.max(1, Number.parseInt(searchParams?.adults ?? "2", 10) || 2);
  const roomCount = Math.max(1, Number.parseInt(searchParams?.rooms ?? "1", 10) || 1);
  const requiredAdultsPerRoom = Math.ceil(adultCount / roomCount);

  const options = [
    {
      ...FAMILY_TEMPLATES.classic,
      nightlyPrice: 900,
      roomsLeft: (classicDouble?.websiteRoomNumbers.length ?? 0) + (classicTwin?.websiteRoomNumbers.length ?? 0),
      slug: "classic",
      source: "fixture" as const,
      maxAdults: FAMILY_TEMPLATES.classic.sleeps,
    },
    {
      ...DIRECT_TEMPLATES["Deluxe Room"],
      nightlyPrice: 1_400,
      roomsLeft: byName.get("Deluxe Room")?.websiteRoomNumbers.length ?? 0,
      slug: "deluxe-room",
      source: "fixture" as const,
      maxAdults: DIRECT_TEMPLATES["Deluxe Room"].sleeps,
    },
    {
      ...DIRECT_TEMPLATES["Studio Suite"],
      nightlyPrice: 1_600,
      roomsLeft: byName.get("Studio Suite")?.websiteRoomNumbers.length ?? 0,
      slug: "studio-suite",
      source: "fixture" as const,
      maxAdults: DIRECT_TEMPLATES["Studio Suite"].sleeps,
    },
    {
      ...FAMILY_TEMPLATES.executive,
      nightlyPrice: 1_600,
      roomsLeft: (executiveDouble?.websiteRoomNumbers.length ?? 0) + (executiveTwin?.websiteRoomNumbers.length ?? 0),
      slug: "executive",
      source: "fixture" as const,
      maxAdults: FAMILY_TEMPLATES.executive.sleeps,
    },
    {
      ...DIRECT_TEMPLATES["Executive Suite"],
      nightlyPrice: 3_200,
      roomsLeft: byName.get("Executive Suite")?.websiteRoomNumbers.length ?? 0,
      slug: "executive-suite",
      source: "fixture" as const,
      maxAdults: DIRECT_TEMPLATES["Executive Suite"].sleeps,
    },
    {
      ...DIRECT_TEMPLATES["Grand Residence"],
      nightlyPrice: 4_000,
      roomsLeft: byName.get("Grand Residence")?.websiteRoomNumbers.length ?? 0,
      slug: "grand-residence",
      source: "fixture" as const,
      maxAdults: DIRECT_TEMPLATES["Grand Residence"].sleeps,
    },
  ];

  let suggestion = null;
  const maxCapacity = Math.max(...options.map((opt) => opt.maxAdults));
  const minRoomsRequired = Math.ceil(adultCount / maxCapacity);
  
  if (roomCount < minRoomsRequired) {
    suggestion = {
      message: `For ${adultCount} guests, we recommend booking at least ${minRoomsRequired} rooms.`,
      targetRooms: minRoomsRequired,
    };
  }

  const finalOptions = options.map((opt) => {
    const finalOption = { ...opt, isAvailable: true, notAvailableReason: null as "SOLD_OUT" | "CAPACITY_EXCEEDED" | null, capacityMessage: undefined as string | undefined };
    if (opt.roomsLeft <= 0) {
      finalOption.isAvailable = false;
      finalOption.notAvailableReason = "SOLD_OUT";
    } else if (requiredAdultsPerRoom > opt.maxAdults) {
      finalOption.isAvailable = false;
      finalOption.notAvailableReason = "CAPACITY_EXCEEDED";
      finalOption.capacityMessage = `Maximum ${opt.maxAdults} adults per room`;
    }
    return finalOption as RoomOption;
  });

  return { options: finalOptions, suggestion };
}

function normalizeNightlyRate(value: number | string) {
  return Number(value);
}

function normalizePositiveNumber(value: number | string | null, fallback: number) {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}

function resolveLiveRoomDetails(row: RoomTypeRow, template: CatalogTemplate, primaryImage: string) {
  const galleryFromDatabase = Array.isArray(row.gallery_image_urls)
    ? row.gallery_image_urls.filter((image): image is string => typeof image === "string" && image.trim().length > 0)
    : [];
  const galleryImages = Array.from(new Set(
    [primaryImage, ...galleryFromDatabase].map(normalizeR2ImageSource),
  )).slice(0, MAX_ROOM_GALLERY_IMAGES);
  const amenitiesFromDatabase = Array.isArray(row.amenities)
    ? row.amenities.filter((amenity): amenity is RoomAmenityId => typeof amenity === "string" && isRoomAmenityId(amenity))
    : [];

  return {
    amenities: amenitiesFromDatabase.length > 0 ? amenitiesFromDatabase : template.amenities,
    bedConfiguration: row.bed_configuration?.trim() || template.bedConfiguration,
    bedConfigurationTh: row.bed_configuration_th?.trim() || template.bedConfigurationTh,
    description: row.full_description?.trim() || template.description,
    descriptionTh: row.full_description_th?.trim() || template.descriptionTh,
    extraBedPolicy: row.extra_bed_policy && isExtraBedPolicy(row.extra_bed_policy)
      ? row.extra_bed_policy
      : template.extraBedPolicy,
    galleryImages: galleryImages.length > 0 ? galleryImages : [primaryImage],
    maxAdults: Math.max(1, Math.round(normalizePositiveNumber(row.max_adults, template.sleeps))),
    sizeSqm: normalizePositiveNumber(row.room_size_sqm, template.sizeSqm),
  };
}

function buildOption(
  slug: string,
  template: CatalogTemplate,
  nightlyPrice: number,
  roomsLeft: number,
  source: "fixture" | "supabase",
  image: string,
  details: RoomDetails = template,
  maxAdults: number = template.sleeps,
): RoomOption {
  return {
    amenities: details.amenities,
    bedConfiguration: details.bedConfiguration,
    bedConfigurationTh: details.bedConfigurationTh,
    description: details.description,
    descriptionTh: details.descriptionTh,
    extraBedPolicy: details.extraBedPolicy,
    features: template.features,
    galleryImages: details.galleryImages,
    image,
    name: template.name,
    nightlyPrice,
    roomsLeft,
    size: `${details.sizeSqm} m²`,
    sizeSqm: details.sizeSqm,
    slug,
    source,
    summary: template.summary,
    sleeps: template.sleeps,
    nextAvailableDate: null,
    maxAdults,
    isAvailable: true,
  };
}

function familySlugFromName(name: string) {
  if (name === "Classic Room (Double)" || name === "Classic Room (Twin)") return "classic";
  if (name === "Executive Room (Double)" || name === "Executive Room (Twin)") return "executive";
  return null;
}

function familyTemplateForName(name: string) {
  const familySlug = familySlugFromName(name);
  return familySlug ? FAMILY_TEMPLATES[familySlug] : DIRECT_TEMPLATES[name];
}

function guestRoomSlugFromType(name: string, id: string) {
  const familySlug = familySlugFromName(name);
  return familySlug ?? id;
}

function resolveGuestRoomImage(image: string | null, fallback: string) {
  return normalizeR2ImageSource(image || fallback);
}

async function getLiveRoomOptions(searchParams?: BookingSearchParams): Promise<RoomSearchResult | null> {
  const supabase = createSupabaseServiceRoleClient();
  if (!supabase) return null;

  const defaultCheckIn = getBangkokDateString();
  const defaultCheckOut = addDaysToDateString(defaultCheckIn, 2);
  const stayDates = normalizeStayDates(searchParams?.checkIn || defaultCheckIn, searchParams?.checkOut || defaultCheckOut);
  const startDate = stayDates.checkIn;
  const endDate = stayDates.checkOut;
  const stayNights: string[] = [];
  
  const adultCount = Math.max(1, Number.parseInt(searchParams?.adults ?? "2", 10) || 2);
  const roomCount = Math.max(1, Number.parseInt(searchParams?.rooms ?? "1", 10) || 1);
  const requiredAdultsPerRoom = Math.ceil(adultCount / roomCount);

  for (let date = startDate; date < endDate; date = addDaysToDateString(date, 1)) {
    stayNights.push(date);
  }

  const [roomTypesResult, roomsResult, allotmentsResult] = await Promise.all([
    supabase
      .from("room_types")
      .select("id, name, base_nightly_rate, image_url, gallery_image_urls, room_size_sqm, max_adults, bed_configuration, bed_configuration_th, extra_bed_policy, full_description, full_description_th, amenities")
      .eq("is_active", true)
      .order("name")
      .returns<RoomTypeRow[]>(),
    supabase.from("physical_rooms").select("id, room_type_id, web_allocation_enabled").eq("is_active", true).returns<PhysicalRoomRow[]>(),
    supabase
      .from("physical_room_allotments")
      .select("date, room_id, room_type_id, is_available, is_booked")
      .gte("date", startDate)
      .lt("date", endDate)
      .returns<AllotmentRow[]>(),
  ]);

  if (roomTypesResult.error || roomsResult.error || allotmentsResult.error) {
    return null;
  }

  const roomTypes = roomTypesResult.data ?? [];
  const physicalRooms = roomsResult.data ?? [];
  const allotments = allotmentsResult.data ?? [];
  const optionRows = roomTypes
    .map((roomType) => {
      const familySlug = familySlugFromName(roomType.name);
      const template = familyTemplateForName(roomType.name);
      const matchingRooms = physicalRooms.filter((room) => room.room_type_id === roomType.id && room.web_allocation_enabled);
      const roomsLeft = matchingRooms.filter((room) =>
        stayNights.every((date) =>
          allotments.some(
            (row) =>
              row.date === date &&
              row.room_type_id === roomType.id &&
              row.room_id === room.id &&
              row.is_available &&
              !row.is_booked,
          ),
        ),
      ).length;

      return {
        details: resolveLiveRoomDetails(
          roomType,
          template,
          resolveGuestRoomImage(roomType.image_url, template.image),
        ),
        familySlug,
        id: roomType.id,
        image: resolveGuestRoomImage(roomType.image_url, template.image),
        name: roomType.name,
        nightlyPrice: normalizeNightlyRate(roomType.base_nightly_rate),
        roomsLeft,
        template,
      };
    });

  const grouped = new Map<
    string,
    {
      image: string;
      details: RoomDetails & { maxAdults: number };
      name: string;
      nightlyPrice: number;
      roomsLeft: number;
      template: CatalogTemplate;
      nextAvailableDate?: string | null;
    }
  >();

  for (const room of optionRows) {
    const slug = guestRoomSlugFromType(room.name, room.id);
    const key = slug;
    const existing = grouped.get(key);

    if (existing) {
      existing.roomsLeft += room.roomsLeft;
      existing.details = {
        ...existing.details,
        amenities: Array.from(new Set([...existing.details.amenities, ...room.details.amenities])),
        galleryImages: Array.from(new Set([...existing.details.galleryImages, ...room.details.galleryImages]))
          .slice(0, MAX_ROOM_GALLERY_IMAGES),
        maxAdults: Math.max(existing.details.maxAdults, room.details.maxAdults),
      };
      continue;
    }

    grouped.set(key, {
      details: room.details,
      image: room.image,
      name: familySlugFromName(room.name) ? guestRoomDisplayName(room.name) : room.name,
      nightlyPrice: room.nightlyPrice,
      roomsLeft: room.roomsLeft,
      template: room.template,
      nextAvailableDate: null,
    });
  }

  // Lookahead Check for fully booked room types
  const soldOutEntries = Array.from(grouped.entries()).filter(([, entry]) => entry.roomsLeft === 0);
  const lookaheadRequests = soldOutEntries
    .map(([key]) => {
      const matchingRoomTypes = roomTypes.filter((rt) => guestRoomSlugFromType(rt.name, rt.id) === key);
      return { key, roomTypeId: matchingRoomTypes[0]?.id };
    })
    .filter((item): item is { key: string; roomTypeId: string } => Boolean(item.roomTypeId));

  if (lookaheadRequests.length > 0) {
    const roomTypeIds = lookaheadRequests.map((req) => req.roomTypeId);

    try {
      const { data, error } = await supabase.rpc("find_next_available_dates", {
        p_length_of_stay: stayNights.length,
        p_room_type_ids: roomTypeIds,
        p_start_date: startDate,
      });

      if (!error && Array.isArray(data)) {
        const dateByRoomTypeId = new Map(
          (data as { next_available_date: string; room_type_id: string }[]).map((row) => [
            row.room_type_id,
            row.next_available_date,
          ]),
        );

        for (const req of lookaheadRequests) {
          const entry = grouped.get(req.key);
          const nextAvailableDate = dateByRoomTypeId.get(req.roomTypeId);
          if (entry && nextAvailableDate) {
            entry.nextAvailableDate = nextAvailableDate;
          }
        }
      } else {
        // Fallback to parallel individual queries if batch RPC is not yet present on DB target
        await Promise.all(
          lookaheadRequests.map(async (req) => {
            const entry = grouped.get(req.key);
            if (!entry) return;
            try {
              const { data: singleData } = await supabase.rpc("find_next_available_date", {
                p_length_of_stay: stayNights.length,
                p_room_type_id: req.roomTypeId,
                p_start_date: startDate,
              });
              if (singleData) {
                entry.nextAvailableDate = singleData as string;
              }
            } catch {
              // Ignore fallback errors
            }
          }),
        );
      }
    } catch {
      // Ignore batch lookahead failures
    }
  }

  const orderedKeys = [
    "classic",
    ...roomTypes.filter((roomType) => !familySlugFromName(roomType.name) && roomType.name === "Deluxe Room").map((roomType) => roomType.id),
    ...roomTypes.filter((roomType) => !familySlugFromName(roomType.name) && roomType.name === "Studio Suite").map((roomType) => roomType.id),
    "executive",
    ...roomTypes.filter((roomType) => !familySlugFromName(roomType.name) && roomType.name === "Executive Suite").map((roomType) => roomType.id),
    ...roomTypes.filter((roomType) => !familySlugFromName(roomType.name) && roomType.name === "Grand Residence").map((roomType) => roomType.id),
  ];

  const options = orderedKeys
    .map((key) => {
      const entry = grouped.get(key);
      if (!entry) return null;

      const option = buildOption(
        key,
        entry.template,
        entry.nightlyPrice,
        entry.roomsLeft,
        "supabase",
        entry.image,
        entry.details,
        entry.details.maxAdults,
      );
      
      const finalOption = { ...option };
      if (entry.nextAvailableDate) {
        finalOption.nextAvailableDate = entry.nextAvailableDate;
      }
      
      if (entry.roomsLeft <= 0) {
        finalOption.isAvailable = false;
        finalOption.notAvailableReason = "SOLD_OUT";
      } else if (requiredAdultsPerRoom > finalOption.maxAdults) {
        finalOption.isAvailable = false;
        finalOption.notAvailableReason = "CAPACITY_EXCEEDED";
        finalOption.capacityMessage = `Maximum ${finalOption.maxAdults} adults per room`;
      }
      
      return finalOption as RoomOption;
    })
    .filter((room): room is RoomOption => room !== null);

  if (options.length === 0) return null;

  let suggestion = null;
  const maxCapacity = Math.max(...options.map((opt) => opt.maxAdults));
  const minRoomsRequired = Math.ceil(adultCount / maxCapacity);
  
  if (roomCount < minRoomsRequired) {
    suggestion = {
      message: `For ${adultCount} guests, we recommend booking at least ${minRoomsRequired} rooms.`,
      targetRooms: minRoomsRequired,
    };
  }

  return { options, suggestion };
}

export async function getRoomOptions(searchParams?: BookingSearchParams): Promise<RoomSearchResult> {
  const liveRooms = await getLiveRoomOptions(searchParams);
  const result = liveRooms ?? fallbackRoomOptions(searchParams);

  let stagingPreviewEnabled = process.env.STAGING_PREVIEW_ENABLED === "true";
  try {
    const { env } = await getCloudflareContext({ async: true });
    stagingPreviewEnabled = (env as unknown as { STAGING_PREVIEW_ENABLED?: string }).STAGING_PREVIEW_ENABLED === "true";
  } catch {
    // Local builds and unit tests do not have a Cloudflare request context.
  }

  if (!stagingPreviewEnabled) return result;

  // Staging-only visual fixture: keep production room content untouched while
  // demonstrating the multi-image gallery with the repository's existing media.
  return {
    ...result,
    options: result.options.map((room) => room.slug === "classic"
      ? {
          ...room,
          galleryImages: [
            ROOM_IMAGE_PRESETS[0],
            ROOM_IMAGE_PRESETS[1],
            ROOM_IMAGE_PRESETS[2],
          ],
        }
      : room),
  };
}
