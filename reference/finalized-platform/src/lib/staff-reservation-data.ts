import "server-only";

import type { ReservationFixture } from "@/lib/fixtures";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { StaffRole } from "@/lib/staff-roles";
import { webReservationDetailRowSchema } from "@/lib/booking/db-validation-schemas";
import {
  buildReservationAuditTrail,
  type ReservationAuditEntry,
  type ReservationEditEventRow,
  type ReservationRefundRequestRow,
  type ReservationSyncEventRow,
} from "@/lib/staff-audit-trail";

export type { StaffRole } from "@/lib/staff-roles";
export type { ReservationAuditEntry } from "@/lib/staff-audit-trail";

export type OverrideRoomOption = Readonly<{
  id: string;
  roomNumber: string;
}>;

export type DashboardReservation = ReservationFixture & Readonly<{
  assignedRoom?: string;
  assignedRoomId?: string;
  auditTrail: readonly ReservationAuditEntry[];
  bookingReferenceId?: string;
  canIssueRefund: boolean;
  canOverride: boolean;
  checkInDate?: string;
  checkOutDate?: string;
  currentStaffRole?: StaffRole;
  currentNightlyRate?: number;
  editVersion: number;
  guestEmail?: string;
  guestPhone?: string;
  internalNote?: string;
  isPiiAnonymized?: boolean;
  lateCancellationApprovalRequired?: boolean;
  overrideConstraintNote?: string;
  overrideRoomOptions: readonly OverrideRoomOption[];
  paymentAdjustmentAmount?: number;
  paymentAdjustmentRequired?: boolean;
  refundFailureMessage?: string;
  refundMaxAmount?: number;
  refundStatus?: "cancelled" | "failed" | "not_required" | "pending" | "processing" | "succeeded";
  refundStatusNote?: string;
  stripePaymentMethodLabel?: string;
  source: "fixture" | "supabase";
  stripeTransactionId?: string;
}>;

export type WebReservationSummaryRow = {
  amount_due?: number | string;
  booking_reference_id?: string | null;
  check_in_date: string;
  check_out_date: string;
  created_at: string;
  guest_email?: string;
  guest_name?: string | null;
  guest_phone?: string;
  id: string;
  payment_mode?: "stripe" | "pay_at_hotel";
  payment_status?: "collected" | "not_collected" | "refunded";
  refund_max_amount?: number | string;
  refund_status?: "cancelled" | "failed" | "not_required" | "pending" | "processing" | "succeeded";
  refund_status_note?: string | null;
  reservation_number: string;
  room_shuffle_required: boolean;
  room_type: string;
  rooms_requested: number;
  stripe_payment_intent_id?: string | null;
  stripe_payment_method_brand?: string | null;
  stripe_payment_method_last4?: string | null;
  stripe_payment_method_type?: string | null;
  sync_status: "Cancelled" | "Pending" | "Synced";
  total_paid?: number | string;
};

export type WebReservationDetailRow = WebReservationSummaryRow & {
  edit_version: number;
  hotel_id: string;
  internal_note?: string | null;
  payment_adjustment_amount?: number | string;
  payment_adjustment_required?: boolean;
  room_type_id: string;
};

type ReservationRoomNightRow = {
  nightly_price: number | string;
  room_id: string;
};

type PhysicalRoomRow = {
  id: string;
  room_number: string;
};

type StaffProfileRow = {
  full_name: string;
  role: StaffRole;
  user_id: string;
};

type HotelTimezoneRow = {
  timezone: string;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatStay(checkIn: string, checkOut: string) {
  return `${checkIn} to ${checkOut}`;
}

function getHotelTodayIso(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  })
    .formatToParts(new Date())
    .reduce<Record<string, string>>((accumulator, part) => {
      accumulator[part.type] = part.value;
      return accumulator;
    }, {});

  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDaysToIsoDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function requiresLateCancellationApproval(args: {
  checkInDate: string;
  currentRole: StaffRole | null;
  timezone: string;
}) {
  if (args.currentRole !== "front_desk") {
    return false;
  }

  const hotelToday = getHotelTodayIso(args.timezone);
  const approvalBoundary = addDaysToIsoDate(hotelToday, 1);
  return args.checkInDate <= approvalBoundary;
}

function formatCreatedAt(value: string) {
  const createdAt = new Date(value).getTime();
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - createdAt) / 60_000));

  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} min ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  return elapsedHours < 24 ? `${elapsedHours} hr ago` : `${Math.floor(elapsedHours / 24)} day ago`;
}

function formatCardBrand(value?: string | null) {
  if (!value) return "Card";
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatStripePaymentMethod(row: Pick<WebReservationSummaryRow, "stripe_payment_method_brand" | "stripe_payment_method_last4" | "stripe_payment_method_type">) {
  if (!row.stripe_payment_method_type) return undefined;

  if (row.stripe_payment_method_type === "card") {
    const brand = formatCardBrand(row.stripe_payment_method_brand);
    return row.stripe_payment_method_last4 ? `${brand} **** ${row.stripe_payment_method_last4}` : brand;
  }

  if (row.stripe_payment_method_type === "promptpay") {
    return "PromptPay QR";
  }

  return row.stripe_payment_method_type
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function buildReservationSummary(
  row: WebReservationSummaryRow,
): DashboardReservation {
  const amountDue = Number(row.amount_due ?? 0);
  const totalPaid = Number(row.total_paid ?? 0);
  const isPiiAnonymized = !row.guest_name && !row.guest_email && !row.guest_phone;

  return {
    amountDue,
    assignment: row.room_shuffle_required ? "shuffle_required" : "assigned",
    auditTrail: [],
    bookingReferenceId: row.booking_reference_id ?? undefined,
    canIssueRefund: false,
    canOverride: false,
    created: formatCreatedAt(row.created_at),
    editVersion: 1,
    guestEmail: row.guest_email,
    guestName: row.guest_name ?? "Anonymized guest",
    guestPhone: row.guest_phone,
    id: row.id,
    isPiiAnonymized,
    number: row.reservation_number,
    overrideRoomOptions: [],
    paymentMode: row.payment_mode ?? "stripe",
    paymentStatus: row.payment_status ?? "collected",
    refundMaxAmount: Number(row.refund_max_amount ?? 0),
    refundStatus: row.refund_status ?? "not_required",
    refundStatusNote: row.refund_status_note ?? undefined,
    roomType: `${row.room_type} x ${row.rooms_requested}`,
    source: "supabase",
    status: row.sync_status,
    stay: formatStay(row.check_in_date, row.check_out_date),
    stripePaymentMethodLabel: row.payment_mode === "stripe" ? formatStripePaymentMethod(row) : undefined,
    stripeTransactionId: row.payment_mode === "stripe" ? row.stripe_payment_intent_id ?? undefined : undefined,
    total: totalPaid + amountDue,
  };
}

function getOverrideConstraintNote(
  currentRole: StaffRole | null,
  roomsRequested: number,
  activeRoomIds: readonly string[],
) {
  if (currentRole !== "admin" && currentRole !== "manager") {
    return "Only a manager or admin can adjust room, date, or rate overrides.";
  }

  if (roomsRequested !== 1) {
    return "Multi-room overrides still need the dedicated planner workflow.";
  }

  if (activeRoomIds.length !== 1) {
    return "This booking spans multiple room assignments and needs the planner workflow.";
  }

  return undefined;
}

export async function getStaffReservation(id: string): Promise<DashboardReservation | null> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;

  const reservationLookup = supabase
    .from("web_reservations")
    .select("id, hotel_id, reservation_number, booking_reference_id, stripe_payment_intent_id, stripe_payment_method_type, stripe_payment_method_brand, stripe_payment_method_last4, guest_name, guest_email, guest_phone, room_type, room_type_id, rooms_requested, check_in_date, check_out_date, total_paid, amount_due, payment_mode, payment_status, sync_status, room_shuffle_required, created_at, internal_note, edit_version, payment_adjustment_required, payment_adjustment_amount, refund_status, refund_max_amount, refund_status_note");
  const reservationQuery = isUuid(id)
    ? reservationLookup.eq("id", id)
    : reservationLookup.eq("reservation_number", id)
      .or(`booking_reference_id.eq.${id}`);

  // Round 1: Fetch reservation details and auth user in parallel
  const [
    { data: rawReservation, error: reservationError },
    { data: { user } },
  ] = await Promise.all([
    reservationQuery.maybeSingle(),
    supabase.auth.getUser(),
  ]);

  const parsedReservation = webReservationDetailRowSchema.safeParse(rawReservation);

  if (reservationError || !parsedReservation.success) {
    return null;
  }

  const reservation = parsedReservation.data;
  const reservationId = reservation.id;

  // Round 2: Fetch all child entities concurrently
  const [
    { data: roomNights },
    { data: editEvents },
    { data: syncEvents },
    { data: refundRequests },
    { data: currentStaffProfile },
    { data: hotelSettings },
    { data: overrideRoomRows },
  ] = await Promise.all([
    supabase
      .from("reservation_room_nights")
      .select("room_id, nightly_price")
      .eq("reservation_id", reservationId)
      .eq("status", "active")
      .order("stay_date", { ascending: true })
      .returns<ReservationRoomNightRow[]>(),
    supabase
      .from("reservation_edit_events")
      .select("id, created_at, edit_kind, field_name, old_value, new_value, reason, is_manager_override, actor_user_id")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<ReservationEditEventRow[]>(),
    supabase
      .from("reservation_sync_events")
      .select("id, created_at, from_status, to_status, reason, actor_user_id")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<ReservationSyncEventRow[]>(),
    supabase
      .from("reservation_refund_requests")
      .select("id, created_at, status, refund_reason, amount_requested, amount_refunded, stripe_refund_id, failure_message, actor_user_id")
      .eq("reservation_id", reservationId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .returns<ReservationRefundRequestRow[]>(),
    user
      ? supabase
          .from("staff_profiles")
          .select("user_id, role, full_name")
          .eq("user_id", user.id)
          .maybeSingle()
          .returns<StaffProfileRow>()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("hotel_settings")
      .select("timezone")
      .eq("id", reservation.hotel_id)
      .maybeSingle()
      .returns<HotelTimezoneRow>(),
    supabase
      .from("physical_rooms")
      .select("id, room_number")
      .eq("room_type_id", reservation.room_type_id)
      .eq("is_active", true)
      .order("room_number", { ascending: true })
      .returns<PhysicalRoomRow[]>(),
  ]);

  const activeRoomIds = [...new Set((roomNights ?? []).map((roomNight) => roomNight.room_id))];
  const roomIdsFromAudit = [...new Set(
    (editEvents ?? [])
      .filter((event) => event.field_name === "room_id")
      .flatMap((event) => [event.old_value, event.new_value])
      .filter((value): value is string => typeof value === "string"),
  )];
  const roomIdsNeedingLookup = [...new Set([...activeRoomIds, ...roomIdsFromAudit])];

  const actorIds = [...new Set(
    [...(editEvents ?? []), ...(syncEvents ?? []), ...(refundRequests ?? [])]
      .map((event) => event.actor_user_id)
      .filter((value): value is string => Boolean(value)),
  )];

  // Round 3: Pre-populate from Round 2 queries and fetch missing items concurrently
  const roomNumbersById = new Map((overrideRoomRows ?? []).map((room) => [room.id, room.room_number]));
  const missingRoomIds = roomIdsNeedingLookup.filter((roomId) => !roomNumbersById.has(roomId));

  const staffProfilesByUserId = new Map<string, string>();
  if (user?.id && currentStaffProfile?.full_name) {
    staffProfilesByUserId.set(user.id, currentStaffProfile.full_name);
  }
  const missingActorIds = actorIds.filter((actorId) => !staffProfilesByUserId.has(actorId));

  const [
    { data: roomNumberRows },
    { data: auditActorProfiles },
  ] = await Promise.all([
    missingRoomIds.length
      ? supabase
          .from("physical_rooms")
          .select("id, room_number")
          .in("id", missingRoomIds)
          .returns<PhysicalRoomRow[]>()
      : Promise.resolve({ data: [], error: null }),
    missingActorIds.length
      ? supabase
          .from("staff_profiles")
          .select("user_id, full_name")
          .in("user_id", missingActorIds)
          .returns<Pick<StaffProfileRow, "full_name" | "user_id">[]>()
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const room of roomNumberRows ?? []) {
    roomNumbersById.set(room.id, room.room_number);
  }
  for (const profile of auditActorProfiles ?? []) {
    staffProfilesByUserId.set(profile.user_id, profile.full_name);
  }

  const assignedRoomId = activeRoomIds.length === 1 ? activeRoomIds[0] : undefined;
  const assignedRoom = activeRoomIds.length > 0 
    ? activeRoomIds.map((id) => roomNumbersById.get(id)).filter(Boolean).join(", ") 
    : undefined;
  const currentNightlyRate = roomNights?.[0]?.nightly_price != null ? Number(roomNights[0].nightly_price) : undefined;
  const overrideConstraintNote = getOverrideConstraintNote(
    currentStaffProfile?.role ?? null,
    reservation.rooms_requested,
    activeRoomIds,
  );
  const hotelTimezone = hotelSettings?.timezone ?? "Asia/Bangkok";
  const lateCancellationApprovalRequired = requiresLateCancellationApproval({
    checkInDate: reservation.check_in_date,
    currentRole: currentStaffProfile?.role ?? null,
    timezone: hotelTimezone,
  });

  const summary = buildReservationSummary(reservation);

  return {
    ...summary,
    assignedRoom,
    assignedRoomId,
    auditTrail: buildReservationAuditTrail({
      createdAt: reservation.created_at,
      createdReason: "Guest checkout",
      editEvents: editEvents ?? [],
      refundRequests: refundRequests ?? [],
      roomNumbersById,
      staffProfilesByUserId,
      syncEvents: syncEvents ?? [],
    }),
    canIssueRefund:
      (currentStaffProfile?.role === "admin" || currentStaffProfile?.role === "manager")
      && reservation.sync_status === "Cancelled"
      && reservation.payment_mode === "stripe"
      && reservation.payment_status === "collected"
      && reservation.refund_status === "pending"
      && Number(reservation.refund_max_amount ?? 0) > 0,
    canOverride: !overrideConstraintNote,
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    currentNightlyRate: Number.isFinite(currentNightlyRate) ? currentNightlyRate : undefined,
    currentStaffRole: currentStaffProfile?.role ?? undefined,
    editVersion: reservation.edit_version,
    guestEmail: reservation.guest_email,
    guestPhone: reservation.guest_phone,
    internalNote: reservation.internal_note ?? undefined,
    lateCancellationApprovalRequired,
    overrideConstraintNote,
    overrideRoomOptions: [
      ...(assignedRoomId && assignedRoom && !(overrideRoomRows ?? []).some((room) => room.id === assignedRoomId)
        ? [{ id: assignedRoomId, roomNumber: assignedRoom }]
        : []),
      ...((overrideRoomRows ?? []).map((room) => ({
        id: room.id,
        roomNumber: room.room_number,
      }))),
    ],
    paymentAdjustmentAmount: Number(reservation.payment_adjustment_amount ?? 0),
    paymentAdjustmentRequired: reservation.payment_adjustment_required ?? false,
    refundFailureMessage: refundRequests?.find((request) => request.status === "failed")?.failure_message ?? undefined,
    refundMaxAmount: Number(reservation.refund_max_amount ?? 0),
    refundStatus: reservation.refund_status ?? "not_required",
    refundStatusNote: reservation.refund_status_note ?? undefined,
  };
}
