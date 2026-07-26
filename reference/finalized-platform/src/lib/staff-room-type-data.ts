import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isExtraBedPolicy, isRoomAmenityId, type ExtraBedPolicy, type RoomAmenityId } from "@/lib/room-details";

export type StaffRoomTypeConfiguration = Readonly<{
  amenities: RoomAmenityId[];
  baseNightlyRate: number;
  bedConfiguration: string;
  bedConfigurationTh: string;
  code: string;
  description: string;
  descriptionTh: string;
  extraBedPolicy: ExtraBedPolicy;
  galleryImageUrls: string[];
  id: string;
  maxAdults: number;
  name: string;
  physicalRooms: ReadonlyArray<{
    id: string;
    number: string;
    webAllocationEnabled: boolean;
  }>;
  sizeSqm: number;
}>;

type RoomTypeRow = {
  amenities: unknown;
  base_nightly_rate: number | string;
  bed_configuration: string;
  bed_configuration_th: string;
  code: string;
  extra_bed_policy: string;
  full_description: string;
  full_description_th: string;
  gallery_image_urls: unknown;
  id: string;
  max_adults: number;
  name: string;
  room_size_sqm: number | string;
};

type PhysicalRoomRow = {
  id: string;
  room_number: string;
  room_type_id: string;
  web_allocation_enabled: boolean;
};

export async function getStaffRoomTypeConfigurations(): Promise<StaffRoomTypeConfiguration[]> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return [];

  const [roomTypesResult, roomsResult] = await Promise.all([
    supabase
      .from("room_types")
      .select("id, code, name, base_nightly_rate, gallery_image_urls, room_size_sqm, max_adults, bed_configuration, bed_configuration_th, extra_bed_policy, full_description, full_description_th, amenities")
      .eq("is_active", true)
      .order("name")
      .returns<RoomTypeRow[]>(),
    supabase
      .from("physical_rooms")
      .select("id, room_type_id, room_number, web_allocation_enabled")
      .eq("is_active", true)
      .order("room_number")
      .returns<PhysicalRoomRow[]>(),
  ]);

  if (roomTypesResult.error || roomsResult.error) return [];

  const rooms = roomsResult.data ?? [];
  return (roomTypesResult.data ?? []).map((roomType) => {
    const gallery = Array.isArray(roomType.gallery_image_urls)
      ? roomType.gallery_image_urls.filter((value): value is string => typeof value === "string")
      : [];
    const amenities = Array.isArray(roomType.amenities)
      ? roomType.amenities.filter((value): value is RoomAmenityId => typeof value === "string" && isRoomAmenityId(value))
      : [];

    return {
      amenities,
      baseNightlyRate: Number(roomType.base_nightly_rate),
      bedConfiguration: roomType.bed_configuration,
      bedConfigurationTh: roomType.bed_configuration_th,
      code: roomType.code,
      description: roomType.full_description,
      descriptionTh: roomType.full_description_th,
      extraBedPolicy: isExtraBedPolicy(roomType.extra_bed_policy) ? roomType.extra_bed_policy : "not-available",
      galleryImageUrls: gallery,
      id: roomType.id,
      maxAdults: roomType.max_adults,
      name: roomType.name,
      physicalRooms: rooms
        .filter((room) => room.room_type_id === roomType.id)
        .map((room) => ({ id: room.id, number: room.room_number, webAllocationEnabled: room.web_allocation_enabled })),
      sizeSqm: Number(roomType.room_size_sqm),
    };
  });
}
