import { beforeEach, describe, expect, it, vi } from "vitest";

const { constructEvent, eq, paymentIntentsRetrieve, refundsCreate, rpc, update } = vi.hoisted(() => ({
  constructEvent: vi.fn(),
  eq: vi.fn(),
  paymentIntentsRetrieve: vi.fn(),
  refundsCreate: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    static createFetchHttpClient() {
      return {};
    }

    paymentIntents = { retrieve: paymentIntentsRetrieve };
    refunds = { create: refundsCreate };
    webhooks = { constructEvent };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: () => ({ update }),
    rpc,
  }),
}));

import { POST } from "./route";

function stripeEvent() {
  return {
    data: {
      object: {
        amount_total: 125050,
        currency: "thb",
        customer_details: {
          email: "guest@example.com",
          name: "Guest Name",
          phone: "+66812345678",
        },
        id: "cs_test_signed123",
        metadata: {
          hold_token: "11111111-1111-4111-8111-111111111111",
        } as Record<string, string>,
        payment_intent: "pi_signed",
        payment_status: "paid",
        status: "complete",
      },
    },
    id: "evt_test_event123",
    livemode: false,
    type: "checkout.session.completed",
  };
}

function request() {
  return new Request("http://localhost/api/stripe/webhook", {
    body: "{}",
    headers: { "stripe-signature": "test-signature" },
    method: "POST",
  });
}

describe("Stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOTEL_ID = "2a932172-26a1-4beb-ad13-c5da91134c97";
    process.env.STRIPE_SECRET_KEY = "sk_test_route";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_route";
    constructEvent.mockReturnValue(stripeEvent());
    eq.mockResolvedValue({ data: null, error: null });
    paymentIntentsRetrieve.mockResolvedValue({
      latest_charge: {
        payment_method_details: {
          card: { brand: "visa", last4: "4242" },
          type: "card",
        },
      },
    });
    refundsCreate.mockResolvedValue({ id: "re_auto_refund", status: "pending" });
    update.mockReturnValue({ eq });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({
        latest_charge: {
          payment_method_details: {
            card: { brand: "visa", last4: "4242" },
            type: "card",
          },
        },
      }), { status: 200, headers: { "content-type": "application/json" } }),
    ));
  });

  it("records receipt and successful processing around finalization", async () => {
    rpc
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: { idempotent: false, ok: true, reservation_id: "reservation-1" },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc.mock.invocationCallOrder[1]).toBeLessThan(
      vi.mocked(fetch).mock.invocationCallOrder[0]!,
    );
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "record_stripe_webhook_event",
      "finalize_paid_checkout_hold",
      "record_stripe_webhook_event",
    ]);
    expect(rpc.mock.calls[2]?.[1]).toMatchObject({
      p_outcome_context: {
        idempotent: false,
        reservation_id: "reservation-1",
      },
      p_processing_state: "processed",
    });
    expect(update).toHaveBeenCalledWith({
      stripe_payment_method_brand: "visa",
      stripe_payment_method_last4: "4242",
      stripe_payment_method_type: "card",
    });
    expect(eq).toHaveBeenCalledWith("id", "reservation-1");
    expect(fetch).toHaveBeenCalledWith(
      "https://api.stripe.com/v1/payment_intents/pi_signed?expand[]=latest_charge",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("continues finalization when optional Stripe payment detail enrichment times out", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error("Request timed out")));
    rpc
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: { idempotent: false, ok: true, reservation_id: "reservation-1" },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "record_stripe_webhook_event",
      "finalize_paid_checkout_hold",
      "record_stripe_webhook_event",
    ]);
    expect(update).not.toHaveBeenCalled();
  });

  it("uses signed session metadata when Stripe omits customer phone details", async () => {
    const event = stripeEvent();
    event.data.object.customer_details.phone = null;
    event.data.object.metadata = {
      guest_email: "guest@example.com",
      guest_name: "Guest Name",
      guest_phone: "+66812345678",
      hold_token: "11111111-1111-4111-8111-111111111111",
    };
    constructEvent.mockReturnValue(event);
    rpc
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: { idempotent: false, ok: true, reservation_id: "reservation-1" },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({
      p_guest_phone: "+66812345678",
    });
  });

  it("acknowledges a terminal conflict only after recording manual review", async () => {
    rpc
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "PAYMENT_TOTAL_MISMATCH" },
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, review: true });
    expect(rpc.mock.calls[2]?.[1]).toMatchObject({
      p_processing_state: "manual_review",
      p_review_code: "PAYMENT_TOTAL_MISMATCH",
    });
  });

  it("submits an idempotent automatic refund for an expired paid hold", async () => {
    rpc
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "HOLD_NOT_ACTIVE" } })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(refundsCreate).toHaveBeenCalledWith(
      {
        payment_intent: "pi_signed",
        reason: "requested_by_customer",
      },
      expect.objectContaining({
        idempotencyKey: "expired-hold-refund:cs_test_signed123",
      }),
    );
    expect(rpc.mock.calls[2]?.[1]).toMatchObject({
      p_outcome_context: {
        auto_refund_id: "re_auto_refund",
        auto_refund_status: "pending",
      },
      p_processing_state: "manual_review",
      p_review_code: "HOLD_NOT_ACTIVE",
    });
  });

  it("returns 503 so Stripe retries when an expired-hold refund fails", async () => {
    refundsCreate.mockRejectedValueOnce(new Error("Stripe unavailable"));
    rpc
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "HOLD_NOT_ACTIVE" } })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
    expect(rpc.mock.calls[2]?.[1]).toMatchObject({
      p_outcome_context: { auto_refund_error: "STRIPE_REFUND_REQUEST_FAILED" },
    });
  });

  it("sets no-store on unsigned webhook errors", async () => {
    const response = await POST(new Request("http://localhost/api/stripe/webhook", { method: "POST" }));

    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toBe("no-store, max-age=0");
  });

  it("returns a retryable response when manual review cannot be recorded", async () => {
    rpc
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "PAYMENT_ALREADY_USED" },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "database unavailable" },
      });

    const response = await POST(request());

    expect(response.status).toBe(503);
  });

  it("returns a retryable response for transient finalization failures", async () => {
    rpc
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "network timeout" },
      });

    const response = await POST(request());

    expect(response.status).toBe(503);
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("ignores Stripe payment failures without touching reservation data", async () => {
    const event = stripeEvent();
    event.type = "payment_intent.payment_failed";
    constructEvent.mockReturnValue(event);

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("syncs asynchronous Stripe refund updates", async () => {
    constructEvent.mockReturnValue({
      data: {
        object: {
          amount: 120000,
          failure_reason: null,
          id: "re_test_123",
          payment_intent: "pi_test_123",
          status: "succeeded",
        },
      },
      id: "evt_refund_updated",
      livemode: false,
      type: "charge.refund.updated",
    });
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("sync_stripe_refund_status", {
      p_amount_refunded: 1200,
      p_failure_reason: null,
      p_stripe_payment_intent_id: "pi_test_123",
      p_stripe_refund_id: "re_test_123",
      p_stripe_status: "succeeded",
    });
  });

  it("passes expanded refund payment intent ids for manual Stripe Dashboard refunds", async () => {
    constructEvent.mockReturnValue({
      data: {
        object: {
          amount: 300000,
          failure_reason: null,
          id: "re_manual_123",
          payment_intent: { id: "pi_manual_123" },
          status: "succeeded",
        },
      },
      id: "evt_refund_manual",
      livemode: false,
      type: "charge.refund.updated",
    });
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("sync_stripe_refund_status", {
      p_amount_refunded: 3000,
      p_failure_reason: null,
      p_stripe_payment_intent_id: "pi_manual_123",
      p_stripe_refund_id: "re_manual_123",
      p_stripe_status: "succeeded",
    });
  });

  it("records completed but unpaid sessions as ignored without finalizing", async () => {
    const event = stripeEvent();
    event.data.object.payment_status = "unpaid";
    event.data.object.status = "complete";
    constructEvent.mockReturnValue(event);
    rpc
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "record_stripe_webhook_event",
      "record_stripe_webhook_event",
    ]);
    expect(rpc.mock.calls[1]?.[1]).toMatchObject({
      p_processing_state: "ignored",
    });
  });

  it("acknowledges duplicate deliveries after idempotent finalization", async () => {
    rpc
      .mockResolvedValueOnce({
        data: { idempotent: true, ok: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { idempotent: true, ok: true, reservation_id: "reservation-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { idempotent: true, ok: true },
        error: null,
      });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc.mock.calls[2]?.[1]).toMatchObject({
      p_outcome_context: {
        idempotent: true,
        reservation_id: "reservation-1",
      },
      p_processing_state: "processed",
    });
  });

  it("recovers on retry when finalization succeeded but outcome recording failed", async () => {
    rpc
      // First delivery: receipt and finalization succeed, final ledger write fails.
      .mockResolvedValueOnce({ data: { ok: true }, error: null })
      .mockResolvedValueOnce({
        data: { idempotent: false, ok: true, reservation_id: "reservation-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: "database unavailable" },
      })
      // Stripe retry: receipt is duplicate, finalization is idempotent, outcome persists.
      .mockResolvedValueOnce({
        data: { idempotent: true, ok: true },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { idempotent: true, ok: true, reservation_id: "reservation-1" },
        error: null,
      })
      .mockResolvedValueOnce({ data: { ok: true }, error: null });

    const firstResponse = await POST(request());
    const retryResponse = await POST(request());

    expect(firstResponse.status).toBe(503);
    expect(retryResponse.status).toBe(200);
    expect(rpc).toHaveBeenCalledTimes(6);
    expect(rpc.mock.calls[5]?.[1]).toMatchObject({
      p_outcome_context: {
        idempotent: true,
        reservation_id: "reservation-1",
      },
      p_processing_state: "processed",
    });
  });
});
