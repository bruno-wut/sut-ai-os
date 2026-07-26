import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function getCurrentHotelSetupState() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { configured: false, setupComplete: false } as const;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { configured: true, setupComplete: false } as const;

  const { data: profile } = await supabase
    .from("staff_profiles")
    .select("hotel_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!profile?.hotel_id) return { configured: true, setupComplete: false } as const;

  const { data: hotel } = await supabase
    .from("hotel_settings")
    .select("setup_completed_at")
    .eq("id", profile.hotel_id)
    .maybeSingle();

  const { count: activeRoomTypeCount } = await supabase
    .from("room_types")
    .select("id", { count: "exact", head: true })
    .eq("hotel_id", profile.hotel_id)
    .eq("is_active", true);

  return {
    configured: true,
    setupComplete: Boolean(hotel?.setup_completed_at) || (activeRoomTypeCount ?? 0) > 0,
  } as const;
}
