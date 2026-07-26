"use server";

import { revalidatePath } from "next/cache";
import Stripe from "stripe";
import { z } from "zod";

import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const reservationIdSchema = z.string().uuid();
const refundReasonSchema = z.enum([
  "guest_requested",
  "force_majeure",
  "manager_override",
  "hotel_initiated",
  "duplicate_charge",
]);

const issueRefundInputSchema = z.object({
  amount: z.number().positive(),
  note: z.string().trim().max(500).optional(),
  reason: refundReasonSchema,
  reservationId: reservationIdSchema,
});

type ReservationActionResult<TData = unknown> =
  | Readonly<{ data: TData; ok: true }>
  | Readonly<{ error: string; ok: false }>;

function revalidateReservationPaths(reservationId: string) {
  revalidatePath("/staff/dashboard");
  revalidatePath("/staff/reservations");
  revalidatePath(`/staff/reservations/${reservationId}`);
}

function mapRefundActionError(message: string) {
  switch (message) {
    case "REFUND_AMOUNT_EXCEEDS_AVAILABLE":
      return "The refund amount is higher than the available refundable balance.";
    case "REFUND_NOT_PENDING":
      return "This refund is no longer pending review. Refresh the reservation before continuing.";
    case "RESERVATION_NOT_CANCELLED":
      return "Refunds can only be issued after the reservation has been cancelled.";
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

export async function issueStripeRefund(
  input: z.infer<typeof issueRefundInputSchema>,
): Promise<ReservationActionResult<unknown>> {
  const parsedInput = issueRefundInputSchema.safeParse(input);
  if (!parsedInput.success) {
    return { error: "Enter a valid refund amount and reason before issuing the refund.", ok: false };
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return { error: "Stripe refunds are not configured for this environment.", ok: false };
  }

  const session = await requireStaffSupabaseClient();
  if (!session.ok) {
    return { error: session.error, ok: false };
  }

  const serviceSupabase = createSupabaseServiceRoleClient();
  if (!serviceSupabase) {
    return { error: "Refund reconciliation is unavailable in this environment.", ok: false };
  }

  const { data, error } = await session.supabase.rpc("create_stripe_refund_request", {
    p_refund_amount: parsedInput.data.amount,
    p_refund_reason: parsedInput.data.reason,
    p_reservation_id: parsedInput.data.reservationId,
    p_staff_note: parsedInput.data.note ?? null,
  });

  if (error) {
    return { error: mapRefundActionError(error.message), ok: false };
  }

  const refundRequest = data as {
    amount?: number;
    amount_minor?: number;
    currency?: string;
    idempotency_key?: string;
    refund_reason?: string;
    refund_request_id?: string;
    reservation_id?: string;
    reservation_number?: string;
    stripe_payment_intent_id?: string;
  } | null;

  if (
    !refundRequest?.refund_request_id ||
    !refundRequest.reservation_id ||
    !refundRequest.stripe_payment_intent_id ||
    !refundRequest.amount_minor ||
    !refundRequest.idempotency_key
  ) {
    return { error: "Refund request could not be prepared.", ok: false };
  }

  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const refund = await stripe.refunds.create(
      {
        amount: refundRequest.amount_minor,
        metadata: {
          refund_reason: refundRequest.refund_reason ?? parsedInput.data.reason,
          reservation_id: refundRequest.reservation_id,
          reservation_number: refundRequest.reservation_number ?? "",
        },
        payment_intent: refundRequest.stripe_payment_intent_id,
        reason: parsedInput.data.reason === "guest_requested" ? "requested_by_customer" : undefined,
      },
      {
        idempotencyKey: refundRequest.idempotency_key,
      },
    );

    const completion = await serviceSupabase.rpc("complete_stripe_refund_request", {
      p_amount_refunded: refund.amount / 100,
      p_refund_request_id: refundRequest.refund_request_id,
      p_stripe_refund_id: refund.id,
      p_stripe_status: refund.status ?? "processing",
    });

    if (completion.error) {
      return { error: "Stripe accepted the refund, but the local ledger could not be updated. The webhook should reconcile shortly.", ok: false };
    }

    revalidateReservationPaths(parsedInput.data.reservationId);

    return { data: completion.data, ok: true };
  } catch (refundError) {
    const message = refundError instanceof Error ? refundError.message : "Stripe refund failed.";
    await serviceSupabase.rpc("fail_stripe_refund_request", {
      p_error_message: message,
      p_refund_request_id: refundRequest.refund_request_id,
    });

    revalidateReservationPaths(parsedInput.data.reservationId);

    return { error: `Stripe refund could not be issued: ${message}`, ok: false };
  }
}
