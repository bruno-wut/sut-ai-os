import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DashboardRefundReview = Readonly<{
  amount: number;
  created: string;
  guestName: string;
  id: string;
  note?: string;
  number: string;
  refundStatus: "failed" | "pending" | "processing";
  stay: string;
}>;

function formatStay(checkIn: string, checkOut: string) {
  return `${checkIn} to ${checkOut}`;
}

function formatCreatedAt(value: string) {
  const createdAt = new Date(value).getTime();
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60_000));

  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return elapsedHours < 24 ? `${elapsedHours} hr ago` : `${Math.floor(elapsedHours / 24)} day ago`;
}

export async function getStaffDashboardRefundReviews(): Promise<DashboardRefundReview[]> {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("web_reservations")
    .select("id, reservation_number, guest_name, check_in_date, check_out_date, created_at, refund_status, refund_max_amount, payment_adjustment_amount, refund_status_note")
    .in("refund_status", ["pending", "processing", "failed"])
    .order("refund_updated_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(10);

  if (error || !data?.length) {
    return [];
  }

  return data
    .filter((row): row is typeof row & { refund_status: "failed" | "pending" | "processing" } => (
      row.refund_status === "pending" || row.refund_status === "processing" || row.refund_status === "failed"
    ))
    .map((row) => ({
      amount: Math.abs(Number(row.refund_max_amount ?? 0)),
      created: formatCreatedAt(row.created_at),
      guestName: row.guest_name ?? "Anonymized guest",
      id: row.id,
      note: row.refund_status_note ?? undefined,
      number: row.reservation_number,
      refundStatus: row.refund_status,
      stay: formatStay(row.check_in_date, row.check_out_date),
    }));
}
