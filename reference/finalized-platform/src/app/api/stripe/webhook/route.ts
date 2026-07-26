import { NextResponse } from "next/server";
import Stripe from "stripe";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  getTerminalStripeFinalizationError,
  getStripeCheckoutFinalization,
} from "@/lib/stripe/webhook";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
const stripeEnrichmentTimeoutMs = 5_000;

type LedgerState = "received" | "processed" | "manual_review" | "ignored";

type LedgerInput = {
  checkoutSessionId: string | null;
  event: Stripe.Event;
  holdToken: string | null;
  reviewCode?: string | null;
  state: LedgerState;
  outcomeContext?: Record<string, boolean | string | null>;
};

function getStripeId(value: Stripe.PaymentIntent | string | null | undefined) {
  return typeof value === "string" ? value : value?.id ?? null;
}

function getPaymentMethodDetails(paymentIntent: Stripe.PaymentIntent | null) {
  const charge = paymentIntent && typeof paymentIntent.latest_charge !== "string"
    ? paymentIntent.latest_charge
    : null;
  const details = charge?.payment_method_details;

  if (!details?.type) {
    return null;
  }

  return {
    brand: details.type === "card" ? details.card?.brand ?? null : null,
    last4: details.type === "card" ? details.card?.last4 ?? null : null,
    type: details.type,
  };
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const hotelId = process.env.HOTEL_ID;
  const signature = request.headers.get("stripe-signature");

  if (!stripeSecretKey || !webhookSecret || !hotelId) {
    return NextResponse.json({ error: "Webhook is not configured." }, { headers: noStoreHeaders, status: 503 });
  }

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature." }, { headers: noStoreHeaders, status: 400 });
  }

  const rawBody = await request.text();
  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return NextResponse.json({ error: "Invalid Stripe signature." }, { headers: noStoreHeaders, status: 400 });
  }

  if (
    event.type !== "checkout.session.completed" &&
    event.type !== "checkout.session.async_payment_succeeded" &&
    event.type !== "charge.refund.updated"
  ) {
    return NextResponse.json({ received: true }, { headers: noStoreHeaders });
  }

  const supabase = createSupabaseServiceRoleClient();

  if (!supabase) {
    return NextResponse.json({ error: "Reservation service is unavailable." }, { headers: noStoreHeaders, status: 503 });
  }

  if (event.type === "charge.refund.updated") {
    const refund = event.data.object as Stripe.Refund;
    const { error } = await supabase.rpc("sync_stripe_refund_status", {
      p_amount_refunded: typeof refund.amount === "number" ? refund.amount / 100 : null,
      p_failure_reason: refund.failure_reason ?? null,
      p_stripe_payment_intent_id: getStripeId(refund.payment_intent),
      p_stripe_refund_id: refund.id,
      p_stripe_status: refund.status ?? "processing",
    });

    if (error) {
      return NextResponse.json({ error: "Refund status could not be recorded." }, { headers: noStoreHeaders, status: 503 });
    }

    return NextResponse.json({ received: true }, { headers: noStoreHeaders });
  }

  const checkoutSession = event.data.object;
  const holdToken = checkoutSession.metadata?.hold_token?.trim() || null;

  async function recordLedger(input: LedgerInput) {
    return supabase.rpc("record_stripe_webhook_event", {
      p_checkout_session_id: input.checkoutSessionId,
      p_event_context: {
        checkout_status: checkoutSession.status ?? null,
        currency: checkoutSession.currency?.toUpperCase() ?? null,
        livemode: event.livemode,
        payment_status: checkoutSession.payment_status,
      },
      p_event_type: input.event.type,
      p_hold_token: input.holdToken,
      p_hotel_id: hotelId,
      p_outcome_context: input.outcomeContext ?? {},
      p_processing_state: input.state,
      p_review_code: input.reviewCode ?? null,
      p_stripe_event_id: input.event.id,
    });
  }

  const receipt = await recordLedger({
    checkoutSessionId: checkoutSession.id,
    event,
    holdToken,
    state: "received",
  });

  if (receipt.error) {
    return NextResponse.json({ error: "Webhook receipt could not be recorded." }, { headers: noStoreHeaders, status: 503 });
  }

  let parameters: ReturnType<typeof getStripeCheckoutFinalization>;

  try {
    parameters = getStripeCheckoutFinalization(checkoutSession);
  } catch {
    // A completed but unpaid session is acknowledged; asynchronous methods
    // finalize only after checkout.session.async_payment_succeeded.
    if (checkoutSession.payment_status !== "paid") {
      const ignored = await recordLedger({
        checkoutSessionId: checkoutSession.id,
        event,
        holdToken,
        state: "ignored",
      });

      if (ignored.error) {
        return NextResponse.json({ error: "Webhook outcome could not be recorded." }, { headers: noStoreHeaders, status: 503 });
      }

      return NextResponse.json({ received: true }, { headers: noStoreHeaders });
    }

    const review = await recordLedger({
      checkoutSessionId: checkoutSession.id,
      event,
      holdToken,
      reviewCode: "SIGNED_CHECKOUT_CONTEXT_INCOMPLETE",
      state: "manual_review",
    });

    if (review.error) {
      return NextResponse.json({ error: "Manual review could not be recorded." }, { headers: noStoreHeaders, status: 503 });
    }

    return NextResponse.json({ received: true, review: true }, { headers: noStoreHeaders });
  }

  async function retrievePaymentIntent() {
    if (!parameters.p_stripe_payment_intent_id) return null;
    try {
      const response = await fetch(
        `https://api.stripe.com/v1/payment_intents/${encodeURIComponent(parameters.p_stripe_payment_intent_id)}?expand[]=latest_charge`,
        {
          headers: { authorization: `Bearer ${stripeSecretKey}` },
          signal: AbortSignal.timeout(stripeEnrichmentTimeoutMs),
        },
      );
      if (!response.ok) return null;
      return (await response.json()) as Stripe.PaymentIntent;
    } catch {
      return null;
    }
  }

  const { data, error } = await supabase.rpc("finalize_paid_checkout_hold", parameters);

  if (error) {
    const reviewCode = getTerminalStripeFinalizationError(error.message);

    if (!reviewCode) {
      return NextResponse.json({ error: "Reservation service is temporarily unavailable." }, { headers: noStoreHeaders, status: 503 });
    }

    let autoRefundFailed = false;
    let refundOutcome: Record<string, boolean | string | null> = {};

    if (reviewCode === "HOLD_NOT_ACTIVE") {
      const paymentIntentId = parameters.p_stripe_payment_intent_id;

      if (!paymentIntentId) {
        autoRefundFailed = true;
        refundOutcome = { auto_refund_error: "PAYMENT_INTENT_MISSING" };
      } else {
        try {
          const refund = await stripe.refunds.create(
            {
              payment_intent: paymentIntentId,
              reason: "requested_by_customer",
            },
            {
              idempotencyKey: `expired-hold-refund:${checkoutSession.id}`,
              maxNetworkRetries: 0,
              timeout: stripeEnrichmentTimeoutMs,
            },
          );
          refundOutcome = {
            auto_refund_id: refund.id,
            auto_refund_status: refund.status ?? "pending",
          };
        } catch {
          autoRefundFailed = true;
          refundOutcome = { auto_refund_error: "STRIPE_REFUND_REQUEST_FAILED" };
        }
      }
    }

    const review = await recordLedger({
      checkoutSessionId: checkoutSession.id,
      event,
      holdToken,
      outcomeContext: refundOutcome,
      reviewCode,
      state: "manual_review",
    });

    if (review.error) {
      return NextResponse.json({ error: "Manual review could not be recorded." }, { headers: noStoreHeaders, status: 503 });
    }

    if (autoRefundFailed) {
      return NextResponse.json(
        { error: "Automatic refund could not be submitted." },
        { headers: noStoreHeaders, status: 503 },
      );
    }

    return NextResponse.json({ received: true, review: true }, { headers: noStoreHeaders });
  }

  const result = data as { idempotent?: boolean; ok?: boolean; reservation_id?: string };

  if (!result?.ok) {
    return NextResponse.json({ error: "Reservation finalization failed." }, { headers: noStoreHeaders, status: 503 });
  }

  const paymentIntent = await retrievePaymentIntent();
  const paymentMethodDetails = getPaymentMethodDetails(paymentIntent);

  if (result.reservation_id && paymentMethodDetails) {
    await supabase
      .from("web_reservations")
      .update({
        stripe_payment_method_brand: paymentMethodDetails.brand,
        stripe_payment_method_last4: paymentMethodDetails.last4,
        stripe_payment_method_type: paymentMethodDetails.type,
      })
      .eq("id", result.reservation_id);
  }

  const processed = await recordLedger({
    checkoutSessionId: checkoutSession.id,
    event,
    holdToken,
    outcomeContext: {
      idempotent: result.idempotent ?? false,
      reservation_id: result.reservation_id ?? null,
    },
    state: "processed",
  });

  if (processed.error) {
    return NextResponse.json({ error: "Webhook outcome could not be recorded." }, { headers: noStoreHeaders, status: 503 });
  }

  if (process.env.CRON_SECRET) {
    try {
      await fetch(new URL("/api/notifications/process", request.url).href, {
        method: "POST",
        headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
      });
    } catch {
      // Ignore background notification trigger errors
    }
  }

  return NextResponse.json(
    { received: true },
    { headers: noStoreHeaders, status: 200 },
  );
}
