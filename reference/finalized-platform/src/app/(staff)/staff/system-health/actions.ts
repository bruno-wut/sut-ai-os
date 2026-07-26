"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentStaffRole } from "@/lib/staff-access";
import { canRecoverSystemHealth } from "@/lib/staff-roles";

export async function requeueDeadLetter(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!eventId || reason.length < 10) return;

  const role = await getCurrentStaffRole();
  if (!role || !canRecoverSystemHealth(role)) return;

  const supabase = await createSupabaseServerClient();
  if (!supabase) return;

  const result = await supabase.rpc("requeue_dead_letter_notification", {
    p_event_id: eventId,
    p_reason: reason,
  });

  if (!result.error) revalidatePath("/staff/system-health");
}
