import dotenv from 'dotenv';
dotenv.config({ path: '.env.staging.local' });

// We need to register ts-node or just import build-related files.
// But since the project is Next.js, we can write a simple node script that does what getRoomOptions does.
// Let's copy getRoomOptions / getLiveRoomOptions logic.

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function addDaysToDateString(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

async function run() {
  const checkIn = '2026-07-15';
  const checkOut = '2026-07-16';
  
  const startDate = checkIn;
  const endDate = checkOut;
  const stayNights = [];

  for (let date = startDate; date < endDate; date = addDaysToDateString(date, 1)) {
    stayNights.push(date);
  }
  
  console.log("stayNights:", stayNights);

  const [roomTypesResult, roomsResult, allotmentsResult] = await Promise.all([
    supabase.from("room_types").select("id, name, base_nightly_rate, image_url").eq("is_active", true).order("name"),
    supabase.from("physical_rooms").select("id, room_type_id, web_allocation_enabled").eq("is_active", true),
    supabase
      .from("physical_room_allotments")
      .select("date, room_id, room_type_id, is_available, is_booked")
      .gte("date", startDate)
      .lt("date", endDate),
  ]);

  const roomTypes = roomTypesResult.data ?? [];
  const physicalRooms = roomsResult.data ?? [];
  const allotments = allotmentsResult.data ?? [];
  
  console.log("Allotments retrieved count:", allotments.length);

  const optionRows = roomTypes
    .map((roomType) => {
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
        id: roomType.id,
        name: roomType.name,
        roomsLeft,
      };
    });
    
  console.log("Option rows with availability:");
  console.log(optionRows);
}

run().catch(console.error);
