import type Stripe from "stripe";

const terminalFinalizationErrors = [
  "PAYMENT_IDEMPOTENCY_CONFLICT",
  "PAYMENT_ALREADY_USED",
  "STRIPE_SESSION_MISMATCH",
  "PAYMENT_TOTAL_MISMATCH",
  "HOLD_NOT_ACTIVE",
  "HOLD_NOT_FOUND",
  "PAYMENT_MODE_MISMATCH",
] as const;

export type StripeWebhookReviewCode =
  | (typeof terminalFinalizationErrors)[number]
  | "SIGNED_CHECKOUT_CONTEXT_INCOMPLETE";

export function getTerminalStripeFinalizationError(
  message: string,
): StripeWebhookReviewCode | null {
  return terminalFinalizationErrors.find((code) => message.includes(code)) ?? null;
}

export function getStripeCheckoutFinalization(session: Stripe.Checkout.Session) {
  if (session.payment_status !== "paid") {
    throw new Error("STRIPE_SESSION_NOT_PAID");
  }

  if (session.amount_total === null || !session.currency) {
    throw new Error("STRIPE_PAYMENT_TOTAL_MISSING");
  }

  const holdToken = session.metadata?.hold_token?.trim();
  const guestName =
    session.customer_details?.name?.trim() ||
    session.metadata?.guest_name?.trim();
  const guestEmail = (
    session.customer_details?.email?.trim() ||
    session.metadata?.guest_email?.trim()
  )?.toLowerCase();
  const guestPhone =
    session.customer_details?.phone?.trim() ||
    session.metadata?.guest_phone?.trim();

  if (!holdToken || !guestName || !guestEmail || !guestPhone) {
    throw new Error("STRIPE_CHECKOUT_CONTEXT_MISSING");
  }

  const paymentIntent =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;

  return {
    p_currency: session.currency.toUpperCase(),
    p_guest_email: guestEmail,
    p_guest_name: guestName,
    p_guest_phone: guestPhone,
    p_hold_token: holdToken,
    p_stripe_payment_intent_id: paymentIntent,
    p_stripe_session_id: session.id,
    // Stripe amount_total is always the signed minor-unit amount.
    p_total_paid: session.amount_total / 100,
  };
}

export function isTerminalStripeFinalizationError(message: string) {
  return getTerminalStripeFinalizationError(message) !== null;
}
