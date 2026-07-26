import "server-only";

import { formatThaiBaht } from "@/lib/fixtures";

export type ReservationAuditEntry = Readonly<{
  action: string;
  actor: string;
  after: string;
  before: string;
  field: string;
  id: string;
  reason: string;
  time: string;
}>;

type JsonPrimitive = boolean | number | string | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

export type ReservationEditEventRow = {
  actor_user_id?: string | null;
  created_at: string;
  edit_kind: "cancellation" | "date_change" | "field_edit" | "note_change" | "rate_change" | "room_swap";
  field_name: string;
  id: string;
  is_manager_override: boolean;
  new_value: JsonValue;
  old_value: JsonValue;
  reason: string;
};

export type ReservationSyncEventRow = {
  actor_user_id?: string | null;
  created_at: string;
  from_status: "Cancelled" | "Pending" | "Synced";
  id: string;
  reason: string;
  to_status: "Cancelled" | "Pending" | "Synced";
};

export type ReservationRefundRequestRow = {
  actor_user_id?: string | null;
  amount_refunded: number | string;
  amount_requested: number | string;
  created_at: string;
  failure_message?: string | null;
  id: string;
  refund_reason: string;
  status: "cancelled" | "failed" | "not_required" | "pending" | "processing" | "succeeded";
  stripe_refund_id?: string | null;
};

export function formatAuditTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value)).replace(",", " ·");
}

export function formatAuditField(fieldName: string) {
  switch (fieldName) {
    case "amount_due":
      return "Amount due";
    case "booking_total":
      return "Booking total";
    case "check_in_date":
      return "Check-in date";
    case "check_out_date":
      return "Check-out date";
    case "guest_email":
      return "Guest email";
    case "guest_name":
      return "Guest name";
    case "guest_phone":
      return "Guest phone";
    case "internal_note":
      return "Internal note";
    case "payment_adjustment_amount":
      return "Payment adjustment";
    case "room_id":
      return "Assigned room";
    case "sync_status":
      return "PMS status";
    default:
      return fieldName.replace(/_/g, " ");
  }
}

export function formatAuditAction(
  editKind: ReservationEditEventRow["edit_kind"],
  isManagerOverride: boolean,
) {
  if (editKind === "cancellation") return "Cancelled";
  if (isManagerOverride || editKind === "date_change" || editKind === "rate_change" || editKind === "room_swap") {
    return "Manager override";
  }
  return "Edited";
}

export function formatAuditValue(
  fieldName: string,
  value: JsonValue,
  roomNumbersById: ReadonlyMap<string, string>,
) {
  if (value === null) return "—";

  if (fieldName === "room_id" && typeof value === "string") {
    return roomNumbersById.get(value) ?? value;
  }

  if (fieldName === "booking_total" || fieldName === "amount_due" || fieldName === "payment_adjustment_amount") {
    const numericValue = typeof value === "number" ? value : Number(value);
    return Number.isFinite(numericValue) ? formatThaiBaht(numericValue) : "—";
  }

  if ((fieldName === "check_in_date" || fieldName === "check_out_date") && typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }

  if (typeof value === "string") {
    return value.trim() || "—";
  }

  if (typeof value === "number") {
    return String(value);
  }

  return JSON.stringify(value);
}

export function buildReservationAuditTrail(args: {
  createdAt: string;
  createdReason: string;
  editEvents: readonly ReservationEditEventRow[];
  refundRequests: readonly ReservationRefundRequestRow[];
  roomNumbersById: ReadonlyMap<string, string>;
  staffProfilesByUserId: ReadonlyMap<string, string>;
  syncEvents: readonly ReservationSyncEventRow[];
}) {
  return [
    ...args.refundRequests.map((event) => ({
      createdAt: event.created_at,
      entry: {
        action: "Refund review",
        actor: event.actor_user_id
          ? (args.staffProfilesByUserId.get(event.actor_user_id) ?? "Staff member")
          : "Booking system",
        after: `${event.status} (${formatThaiBaht(Number(event.amount_refunded ?? 0))} refunded)`,
        before: formatThaiBaht(Number(event.amount_requested ?? 0)),
        field: "Stripe refund",
        id: `refund:${event.id}`,
        reason: event.failure_message
          ? `${event.refund_reason}: ${event.failure_message}`
          : event.refund_reason,
        time: formatAuditTime(event.created_at),
      } satisfies ReservationAuditEntry,
    })),
    ...args.editEvents.map((event) => ({
      createdAt: event.created_at,
      entry: {
        action: formatAuditAction(event.edit_kind, event.is_manager_override),
        actor: event.actor_user_id
          ? (args.staffProfilesByUserId.get(event.actor_user_id) ?? "Staff member")
          : "Booking system",
        after: formatAuditValue(event.field_name, event.new_value, args.roomNumbersById),
        before: formatAuditValue(event.field_name, event.old_value, args.roomNumbersById),
        field: formatAuditField(event.field_name),
        id: `edit:${event.id}`,
        reason: event.reason,
        time: formatAuditTime(event.created_at),
      } satisfies ReservationAuditEntry,
    })),
    ...args.syncEvents.map((event) => ({
      createdAt: event.created_at,
      entry: {
        action: event.to_status === "Cancelled" ? "Cancellation queued" : "PMS sync",
        actor: event.actor_user_id
          ? (args.staffProfilesByUserId.get(event.actor_user_id) ?? "Staff member")
          : "Booking system",
        after: event.to_status,
        before: event.from_status,
        field: "PMS status",
        id: `sync:${event.id}`,
        reason: event.reason,
        time: formatAuditTime(event.created_at),
      } satisfies ReservationAuditEntry,
    })),
    {
      createdAt: args.createdAt,
      entry: {
        action: "Created",
        actor: "Booking system",
        after: "Confirmed web booking",
        before: "—",
        field: "Reservation",
        id: "created",
        reason: args.createdReason,
        time: formatAuditTime(args.createdAt),
      } satisfies ReservationAuditEntry,
    },
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((item) => item.entry);
}
