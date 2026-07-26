import { describe, expect, it } from "vitest";
import type Stripe from "stripe";

import {
  getTerminalStripeFinalizationError,
  getStripeCheckoutFinalization,
  isTerminalStripeFinalizationError,
} from "./webhook";

function session(overrides: Partial<Stripe.Checkout.Session> = {}) {
  return {
    amount_total: 125050,
    currency: "thb",
    customer_details: {
      address: null,
      email: "GUEST@EXAMPLE.COM",
      name: "Guest Name",
      phone: "+66 81 234 5678",
      tax_exempt: "none",
      tax_ids: [],
    },
    id: "cs_test_signed",
    metadata: { hold_token: "11111111-1111-4111-8111-111111111111" },
    payment_intent: "pi_signed",
    payment_status: "paid",
    ...overrides,
  } as Stripe.Checkout.Session;
}

describe("Stripe webhook finalization", () => {
  it("uses the signed Stripe amount_total and converts minor units", () => {
    expect(getStripeCheckoutFinalization(session())).toMatchObject({
      p_currency: "THB",
      p_stripe_session_id: "cs_test_signed",
      p_total_paid: 1250.5,
    });
  });

  it("rejects unpaid sessions", () => {
    expect(() => getStripeCheckoutFinalization(session({ payment_status: "unpaid" })))
      .toThrow("STRIPE_SESSION_NOT_PAID");
  });

  it("classifies payment conflicts for manual review", () => {
    expect(isTerminalStripeFinalizationError("PAYMENT_TOTAL_MISMATCH")).toBe(true);
    expect(isTerminalStripeFinalizationError("network timeout")).toBe(false);
    expect(getTerminalStripeFinalizationError("database: PAYMENT_ALREADY_USED"))
      .toBe("PAYMENT_ALREADY_USED");
    expect(getTerminalStripeFinalizationError("network timeout")).toBeNull();
  });
});
