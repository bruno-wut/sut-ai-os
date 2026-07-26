import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildReservationSummary,
  type DashboardReservation,
  type WebReservationSummaryRow,
} from "@/lib/staff-reservation-data";

export * from "@/lib/staff-reservation-data";

export async function getStaffDashboardReservations(): Promise<DashboardReservation[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("web_reservations")
    .select("id, reservation_number, booking_reference_id, stripe_payment_intent_id, stripe_payment_method_type, stripe_payment_method_brand, stripe_payment_method_last4, guest_name, guest_email, guest_phone, room_type, rooms_requested, check_in_date, check_out_date, total_paid, amount_due, payment_mode, payment_status, sync_status, room_shuffle_required, created_at, refund_status, refund_max_amount, refund_status_note")
    .order("created_at", { ascending: false })
    .limit(20)
    .returns<WebReservationSummaryRow[]>();

  if (error || !data?.length) {
    return [];
  }

  return data.map((row) => buildReservationSummary(row));
}
