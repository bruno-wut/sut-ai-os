import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isStaffRole, type StaffRole } from "@/lib/staff-roles";

export async function getCurrentStaffRole(): Promise<StaffRole | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("staff_profiles")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  return isStaffRole(data?.role) ? data.role : null;
}
