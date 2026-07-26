import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, update } = vi.hoisted(() => ({
  rpc: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: () => ({
      update,
    }),
    rpc,
  }),
}));

import { executeCheckoutHoldWorkflow } from "./create-checkout-hold";

const validPayload = {
  adults: 2,
  cancellationPolicyVersion: "2026-06-01",
  checkIn: "2030-01-10",
  checkOut: "2030-01-12",
  children: 0,
  guestEmail: "test@example.com",
  guestName: "Narin S.",
  guestPhone: "+66 81 234 5678",
  idempotencyKey: "11111111-2222-3333-4444-555555555555",
  locale: "en",
  marketingConsent: false,
  paymentMode: "stripe",
  pdpaConsent: true,
  privacyPolicyVersion: "2026-06-01",
  promoCode: null,
  roomCategory: "classic",
  rooms: 1,
  termsVersion: "2026-06-01",
};

function createRequest(body: unknown, origin = "https://staging-preview-7q2x.sriuthonghotels.com") {
  return new Request("https://staging-preview-7q2x.sriuthonghotels.com/api/checkout/hold", {
    body: JSON.stringify(body),
    headers: {
      "cf-connecting-ip": "203.0.113.5",
      "Content-Type": "application/json",
      Origin: origin,
      "Sec-Fetch-Site": "same-origin",
    },
    method: "POST",
  });
}

describe("executeCheckoutHoldWorkflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CHECKOUT_HOLD_LIVE_ENABLED = "true";
    process.env.NEXT_PUBLIC_APP_URL = "https://staging-preview-7q2x.sriuthonghotels.com";
    vi.stubEnv("NODE_ENV", "test");

    rpc.mockResolvedValue({
      data: {
        allocation_mode: "category",
        consent_recorded: true,
        currency: "THB",
        expires_at: "2030-01-10T00:35:00.000Z",
        hold_token: "test-hold-token",
        night_count: 2,
        ok: true,
        payment_mode: "stripe",
        rooms_requested: 1,
        status: "active",
        total_amount: 1800,
      },
      error: null,
    });
    update.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("blocks requests with forbidden/missing origins", async () => {
    const request = new Request("https://staging-preview-7q2x.sriuthonghotels.com/api/checkout/hold", {
      body: JSON.stringify(validPayload),
      method: "POST",
    });

    const result = await executeCheckoutHoldWorkflow(request);
    expect(result.isSuccess).toBe(false);
    if (result.isSuccess === false) {
      expect(result.errorResponse.status).toBe(403);
    }
  });

  it("successfully creates a hold workflow when parameters and origin match", async () => {
    const request = createRequest(validPayload);

    const result = await executeCheckoutHoldWorkflow(request);
    expect(result.isSuccess).toBe(true);
    if (result.isSuccess) {
      expect(result.hold.hold_token).toBe("test-hold-token");
      expect(result.pricing.grandTotal).toBe(1800);
    }
  });
});
