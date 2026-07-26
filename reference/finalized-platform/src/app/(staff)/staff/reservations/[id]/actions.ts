"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const reservationIdSchema = z.string().uuid();
const reservationVersionSchema = z.number().int().positive();

const editReservationInputSchema = z.object({
  expectedVersion: reservationVersionSchema,
  guestEmail: z.string().trim().email(),
  guestName: z.string().trim().min(1),
  guestPhone: z.string().trim().optional(),
  internalNote: z.string().optional(),
  reason: z.string().trim().min(1),
  reservationId: reservationIdSchema,
});

const cancelReservationInputSchema = z.object({
  expectedVersion: reservationVersionSchema,
  managerApprovalPin: z.string().trim().regex(/^\d{4,12}$/, "Enter a valid manager PIN.").optional(),
  reason: z.string().trim().min(1),
  reservationId: reservationIdSchema,
});

const overrideReservationInputSchema = z.object({
  checkInDate: z.string().trim().optional(),
  checkOutDate: z.string().trim().optional(),
  expectedVersion: reservationVersionSchema,
  internalNote: z.string().optional(),
  nightlyRate: z.number().nonnegative().optional(),
  reason: z.string().trim().min(1),
  reservationId: reservationIdSchema,
  roomId: reservationIdSchema.optional(),
});

type ReservationActionResult<TData = unknown> =
  | Readonly<{ data: TData; ok: true }>
  | Readonly<{ error: string; ok: false }>;

function revalidateReservationPaths(reservationId: string) {
  revalidatePath("/staff/dashboard");
  revalidatePath("/staff/reservations");
  revalidatePath(`/staff/reservations/${reservationId}`);
}

function mapReservationActionError(message: string) {
  switch (message) {
    case "MULTI_ROOM_OVERRIDE_REQUIRES_DEDICATED_PLANNER":
      return "This reservation spans multiple rooms, so it still needs the dedicated planner workflow.";
    case "NON_CONSECUTIVE_ASSIGNMENT_REQUIRES_PLANNER":
      return "This reservation already spans multiple room assignments and needs the planner workflow.";
    case "OVERRIDE_INVENTORY_CONFLICT":
      return "The selected room is no longer free for the full stay. Refresh and try another room or date.";
    case "RESERVATION_CANCELLED":
      return "This reservation has already been cancelled.";
    case "RESERVATION_VERSION_CONFLICT":
      return "This reservation changed in another session. Refresh the page and try again.";
    case "MANAGER_APPROVAL_REQUIRED":
      return "Manager or administrator authorization is required for cancellations within 24 hours of check-in. Ask an authorized manager to sign in and approve this action.";
    case "MANAGER_APPROVAL_PIN_REQUIRED":
      return "A manager or administrator PIN is required to cancel arrivals inside the 24-hour check-in window.";
    case "INVALID_MANAGER_APPROVAL_PIN":
      return "That manager or administrator PIN was not accepted. Confirm the approver and try again.";
    case "REFUND_AMOUNT_EXCEEDS_AVAILABLE":
      return "The refund amount is higher than the available refundable balance.";
    case "REFUND_NOT_PENDING":
      return "This refund is no longer pending review. Refresh the reservation before continuing.";
    case "RESERVATION_NOT_CANCELLED":
      return "Refunds can only be issued after the reservation has been cancelled.";
    case "ROOM_TYPE_OVERRIDE_NOT_ALLOWED":
      return "Overrides can only move the booking within the same room type.";
    case "STRIPE_REFUND_NOT_AVAILABLE":
      return "This reservation does not have a collected Stripe payment available for refund.";
    default:
      return message;
  }
}

async function requireStaffSupabaseClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return { error: "Reservation service is unavailable.", ok: false } as const;
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Your staff session has expired.", ok: false } as const;
  }

  return { ok: true, supabase } as const;
}

export async function markReservationEnteredInPms(
  reservationId: string,
): Promise<ReservationActionResult<unknown>> {
  const parsedId = reservationIdSchema.safeParse(reservationId);
  if (!parsedId.success) {
    return { error: "Invalid reservation.", ok: false };
  }

  const session = await requireStaffSupabaseClient();
  if (!session.ok) {
    return { error: session.error, ok: false };
  }

  const { data, error } = await session.supabase.rpc("mark_reservation_entered_in_pms", {
    p_confirm_shuffle_completed: false,
    p_reservation_id: parsedId.data,
  });

  if (error) {
    return { error: mapReservationActionError(error.message), ok: false };
  }

  revalidateReservationPaths(parsedId.data);

  return { data, ok: true };
}

export async function editReservation(
  input: z.infer<typeof editReservationInputSchema>,
): Promise<ReservationActionResult<unknown>> {
  const parsedInput = editReservationInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { error: "Enter the guest name, email, and reason before saving.", ok: false };
  }

  const session = await requireStaffSupabaseClient();
  if (!session.ok) {
    return { error: session.error, ok: false };
  }

  const { data, error } = await session.supabase.rpc("edit_reservation", {
    p_clear_internal_note: (parsedInput.data.internalNote ?? "").trim() === "",
    p_expected_version: parsedInput.data.expectedVersion,
    p_guest_email: parsedInput.data.guestEmail,
    p_guest_name: parsedInput.data.guestName,
    p_guest_phone: parsedInput.data.guestPhone?.trim() || null,
    p_internal_note: parsedInput.data.internalNote?.trim() || null,
    p_reason: parsedInput.data.reason,
    p_reservation_id: parsedInput.data.reservationId,
  });

  if (error) {
    return { error: mapReservationActionError(error.message), ok: false };
  }

  revalidateReservationPaths(parsedInput.data.reservationId);

  return { data, ok: true };
}

export async function overrideReservation(
  input: z.infer<typeof overrideReservationInputSchema>,
): Promise<ReservationActionResult<unknown>> {
  const parsedInput = overrideReservationInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { error: "Enter a valid override reason and keep the nightly rate at or above zero.", ok: false };
  }

  const session = await requireStaffSupabaseClient();
  if (!session.ok) {
    return { error: session.error, ok: false };
  }

  const { data, error } = await session.supabase.rpc("override_booking", {
    p_expected_version: parsedInput.data.expectedVersion,
    p_internal_note: parsedInput.data.internalNote?.trim() || null,
    p_new_check_in: parsedInput.data.checkInDate?.trim() || null,
    p_new_check_out: parsedInput.data.checkOutDate?.trim() || null,
    p_new_nightly_rate: parsedInput.data.nightlyRate ?? null,
    p_new_room_id: parsedInput.data.roomId ?? null,
    p_reason: parsedInput.data.reason,
    p_reservation_id: parsedInput.data.reservationId,
  });

  if (error) {
    return { error: mapReservationActionError(error.message), ok: false };
  }

  revalidateReservationPaths(parsedInput.data.reservationId);

  return { data, ok: true };
}

export async function cancelReservation(
  input: z.infer<typeof cancelReservationInputSchema>,
): Promise<ReservationActionResult<unknown>> {
  const parsedInput = cancelReservationInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { error: "Enter a cancellation reason before continuing.", ok: false };
  }

  const session = await requireStaffSupabaseClient();
  if (!session.ok) {
    return { error: session.error, ok: false };
  }

  const { data, error } = await session.supabase.rpc("cancel_reservation_with_approval", {
    p_expected_version: parsedInput.data.expectedVersion,
    p_manager_approval_pin: parsedInput.data.managerApprovalPin?.trim() || null,
    p_reason: parsedInput.data.reason,
    p_reservation_id: parsedInput.data.reservationId,
  });

  if (error) {
    return { error: mapReservationActionError(error.message), ok: false };
  }

  revalidateReservationPaths(parsedInput.data.reservationId);

  return { data, ok: true };
}
