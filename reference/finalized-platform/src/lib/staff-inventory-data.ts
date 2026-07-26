import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InventoryDay = Readonly<{
  available: number;
  date: string;
  label: string;
  nightlyRate: number;
  openForSale: boolean;
}>;

export type PhysicalRoomDay = Readonly<{
  date: string;
  status: "Booked" | "Held" | "Open" | "Closed";
}>;

export type InventoryPhysicalRoom = Readonly<{
  days: readonly PhysicalRoomDay[];
  id: string;
  roomNumber: string;
}>;

export type InventoryRoomType = Readonly<{
  id: string;
  name: string;
  physicalRooms: number;
  physicalRoomStatuses: readonly InventoryPhysicalRoom[];
  webRooms: number;
  days: readonly InventoryDay[];
}>;

export type StaffInventoryData = Readonly<{
  connected: boolean;
  reconciliationIssueCount: number;
  roomTypes: readonly InventoryRoomType[];
}>;

type RoomTypeRow = { base_nightly_rate: number | string; id: string; name: string };
type PhysicalRoomRow = { id: string; room_number: string; room_type_id: string; web_allocation_enabled: boolean };
type AllotmentRow = {
  date: string;
  hold_id?: string | null;
  is_available: boolean;
  is_booked: boolean;
  nightly_price: number | string;
  room_id: string;
  room_type_id: string;
};
type ReservationNightRow = { room_id: string; stay_date: string };

function bangkokDate(offset: number) {
  const now = new Date();
  const bangkok = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Bangkok" }));
  bangkok.setDate(bangkok.getDate() + offset);
  return `${bangkok.getFullYear()}-${String(bangkok.getMonth() + 1).padStart(2, "0")}-${String(bangkok.getDate()).padStart(2, "0")}`;
}

function dayLabel(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
  }).format(new Date(`${date}T00:00:00Z`));
}

export async function getStaffInventoryData(): Promise<StaffInventoryData> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { connected: false, reconciliationIssueCount: 0, roomTypes: [] };

  const startDate = bangkokDate(0);
  const endDate = bangkokDate(7);
  const dates = Array.from({ length: 7 }, (_, index) => bangkokDate(index));

  const [roomTypesResult, roomsResult, allotmentsResult, reservationNightsResult] = await Promise.all([
    supabase.from("room_types").select("id, name, base_nightly_rate").eq("is_active", true).order("name").returns<RoomTypeRow[]>(),
    supabase.from("physical_rooms").select("id, room_number, room_type_id, web_allocation_enabled").eq("is_active", true).order("room_number").returns<PhysicalRoomRow[]>(),
    supabase
      .from("physical_room_allotments")
      .select("date, room_id, room_type_id, nightly_price, is_available, is_booked, hold_id")
      .gte("date", startDate)
      .lt("date", endDate)
      .returns<AllotmentRow[]>(),
    supabase
      .from("reservation_room_nights")
      .select("room_id, stay_date")
      .gte("stay_date", startDate)
      .lt("stay_date", endDate)
      .returns<ReservationNightRow[]>(),
  ]);

  if (roomTypesResult.error || roomsResult.error || allotmentsResult.error || reservationNightsResult.error) {
    return { connected: false, reconciliationIssueCount: 0, roomTypes: [] };
  }

  const rooms = roomsResult.data ?? [];
  const allotments = allotmentsResult.data ?? [];
  const webRoomIds = new Set(rooms.filter((room) => room.web_allocation_enabled).map((room) => room.id));
  const roomsByType = new Map<string, PhysicalRoomRow[]>();
  const allotmentByRoomDate = new Map<string, AllotmentRow>();
  const allotmentsByTypeDate = new Map<string, AllotmentRow[]>();

  for (const room of rooms) {
    const typeRooms = roomsByType.get(room.room_type_id) ?? [];
    typeRooms.push(room);
    roomsByType.set(room.room_type_id, typeRooms);
  }

  for (const allotment of allotments) {
    allotmentByRoomDate.set(`${allotment.room_id}:${allotment.date}`, allotment);
    if (webRoomIds.has(allotment.room_id)) {
      const typeDateKey = `${allotment.room_type_id}:${allotment.date}`;
      const typeDateRows = allotmentsByTypeDate.get(typeDateKey) ?? [];
      typeDateRows.push(allotment);
      allotmentsByTypeDate.set(typeDateKey, typeDateRows);
    }
  }

  const reservationNightKeys = new Set((reservationNightsResult.data ?? []).map((row) => `${row.room_id}:${row.stay_date}`));
  const bookedAllotmentKeys = new Set(allotments.filter((row) => row.is_booked).map((row) => `${row.room_id}:${row.date}`));
  const reconciliationIssueCount = new Set([...reservationNightKeys, ...bookedAllotmentKeys])
    .size - new Set([...reservationNightKeys].filter((key) => bookedAllotmentKeys.has(key))).size;

  return {
    connected: true,
    reconciliationIssueCount,
    roomTypes: (roomTypesResult.data ?? []).map((roomType) => {
      const physicalRooms = roomsByType.get(roomType.id) ?? [];
      const webRooms = physicalRooms.filter((room) => room.web_allocation_enabled);

      return {
        id: roomType.id,
        name: roomType.name,
        physicalRooms: physicalRooms.length,
        physicalRoomStatuses: physicalRooms.map((room) => ({
          id: room.id,
          roomNumber: room.room_number,
          days: dates.map((date) => {
            const allotment = allotmentByRoomDate.get(`${room.id}:${date}`);
            const reservationBooked = reservationNightKeys.has(`${room.id}:${date}`);
            return {
              date,
              status: reservationBooked || allotment?.is_booked
                ? "Booked" as const
                : allotment?.hold_id
                  ? "Held" as const
                  : allotment?.is_available
                    ? "Open" as const
                    : "Closed" as const,
            };
          }),
        })),
        webRooms: webRooms.length,
        days: dates.map((date) => {
          const rows = allotmentsByTypeDate.get(`${roomType.id}:${date}`) ?? [];
          return {
            available: rows.filter((row) => row.is_available && !row.is_booked && !row.hold_id).length,
            date,
            label: dayLabel(date),
            nightlyRate: Number(rows[0]?.nightly_price ?? roomType.base_nightly_rate),
            openForSale: rows.some((row) => row.is_available),
          };
        }),
      };
    }),
  };
}
