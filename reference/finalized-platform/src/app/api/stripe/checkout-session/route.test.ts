import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { checkoutSessionsCreate, rpc, update } = vi.hoisted(() => ({
  checkoutSessionsCreate: vi.fn(),
  rpc: vi.fn(),
  update: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    static createFetchHttpClient() {
      return {};
    }

    checkout = {
      sessions: {
        create: checkoutSessionsCreate,
      },
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({
    from: () => ({
      update,
    }),
    rpc,
  }),
}));

import { POST } from "./route";

const validRequest = {
  adults: 2,
  cancellationPolicyVersion: "2026-06-01",
  checkIn: "2030-01-10",
  checkOut: "2030-01-12",
  children: 1,
  guestEmail: "guest@example.com",
  guestName: "Narin S.",
  guestPhone: "+66 81 234 5678",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  locale: "th",
  marketingConsent: false,
  paymentMode: "stripe",
  pdpaConsent: true,
  privacyPolicyVersion: "2026-06-01",
  promoCode: "DIRECT",
  roomCategory: "classic",
  rooms: 2,
  termsVersion: "2026-06-01",
};

function request(body = validRequest, ip = "203.0.113.1") {
  return new Request("https://staging-preview-7q2x.sriuthonghotels.com/api/stripe/checkout-session", {
    body: JSON.stringify(body),
    headers: {
      "cf-connecting-ip": ip,
      "Content-Type": "application/json",
      Origin: "https://staging-preview-7q2x.sriuthonghotels.com",
      "Sec-Fetch-Site": "same-origin",
      "user-agent": "vitest",
    },
    method: "POST",
  });
}

describe("POST /api/stripe/checkout-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-10T00:00:00.000Z"));
    process.env.CHECKOUT_HOLD_LIVE_ENABLED = "true";
    process.env.HOTEL_ID = "2a932172-26a1-4beb-ad13-c5da91134c97";
    process.env.NEXT_PUBLIC_APP_URL = "https://staging-preview-7q2x.sriuthonghotels.com/";
    vi.stubEnv("NODE_ENV", "test");
    process.env.STRIPE_CHECKOUT_LOGO_URL = "https://cdn.sriuthonghotels.com/stripe-wordmark.png";
    process.env.STRIPE_SECRET_KEY = "sk_test_route";

    rpc.mockResolvedValue({
      data: {
        allocation_mode: "category",
        consent_recorded: true,
        currency: "THB",
        expires_at: "2030-01-10T00:35:00.000Z",
        hold_token: "hold-public-token",
        night_count: 2,
        ok: true,
        payment_mode: "stripe",
        rooms_requested: 2,
        status: "active",
        total_amount: 2400,
      },
      error: null,
    });
    update.mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    checkoutSessionsCreate.mockResolvedValue({
      id: "cs_test_123",
      url: "https://checkout.stripe.test/session",
    });
  });

  afterEach(() => {
    delete process.env.STRIPE_CHECKOUT_LOGO_URL;
    vi.useRealTimers();
  });

  it("creates a Stripe Test Checkout session with preserved locale, amount, and return context", async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(checkoutSessionsCreate).toHaveBeenCalledTimes(1);
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        branding_settings: {
          background_color: "#fffdf8",
          border_style: "rounded",
          button_color: "#2c2a29",
          display_name: "Sri U-Thong Grand Hotel",
          logo: {
            type: "url",
            url: "https://cdn.sriuthonghotels.com/stripe-wordmark.png",
          },
        },
        cancel_url:
          "https://staging-preview-7q2x.sriuthonghotels.com/th/checkout?adults=2&checkIn=2030-01-10&checkOut=2030-01-12&children=1&room=classic&rooms=2&promoCode=DIRECT",
        client_reference_id: "hold-public-token",
        currency: "thb",
        customer_email: "guest@example.com",
        expires_at: 1894235700,
        locale: "th",
        mode: "payment",
        payment_method_types: ["card", "promptpay"],
        phone_number_collection: { enabled: false },
        success_url:
          "https://staging-preview-7q2x.sriuthonghotels.com/th/confirmation?mode=stripe&session_id={CHECKOUT_SESSION_ID}",
      }),
    );
    expect(checkoutSessionsCreate.mock.calls[0]?.[0].line_items).toEqual([
      {
        quantity: 1,
        price_data: {
          currency: "thb",
          product_data: {
            description: "2 nights · 2 rooms",
            name: "Base Room Subtotal (THB)",
          },
          unit_amount: 203900,
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "thb",
          product_data: { name: "Hotel Service Charge (10%)" },
          unit_amount: 20400,
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "thb",
          product_data: { name: "VAT (7%)" },
          unit_amount: 15700,
        },
      },
    ]);
    expect(checkoutSessionsCreate.mock.calls[0]?.[0].metadata).toMatchObject({
      adults: "2",
      check_in: "2030-01-10",
      check_out: "2030-01-12",
      children: "1",
      grand_total: "2400",
      guest_name: "Narin S.",
      guest_phone: "+66 81 234 5678",
      hold_id: "hold-public-token",
      hold_token: "hold-public-token",
      locale: "th",
      promo_code: "DIRECT",
      room_category: "classic",
      rooms: "2",
    });
    expect(checkoutSessionsCreate.mock.calls[0]?.[0].metadata).not.toHaveProperty("guest_email");
    await expect(response.json()).resolves.toEqual({
      checkoutSessionId: "cs_test_123",
      url: "https://checkout.stripe.test/session",
    });
  });

  it("uses English Stripe UI and return URLs for an English booking", async () => {
    const response = await POST(request({ ...validRequest, locale: "en" }, "203.0.113.2"));

    expect(response.status).toBe(201);
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        cancel_url: expect.stringContaining("/en/checkout?"),
        locale: "en",
        success_url: expect.stringContaining("/en/confirmation?"),
      }),
    );
  });

  it("falls back to the app-hosted wordmark when no public Stripe logo URL is configured", async () => {
    delete process.env.STRIPE_CHECKOUT_LOGO_URL;

    const response = await POST(request(validRequest, "203.0.113.3"));

    expect(response.status).toBe(201);
    expect(checkoutSessionsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        branding_settings: expect.objectContaining({
          logo: {
            type: "url",
            url: "https://staging-preview-7q2x.sriuthonghotels.com/images/sri-u-thong-wordmark.png",
          },
        }),
      }),
    );
  });
});
