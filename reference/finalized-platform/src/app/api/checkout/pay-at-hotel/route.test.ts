import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ rpc }),
}));

import { POST } from "./route";

const validRequest = {
  guestEmail: "guest@example.com",
  guestName: "Narin S.",
  guestPhone: "+66 81 234 5678",
  holdToken: "11111111-1111-4111-8111-111111111111",
};

describe("POST /api/checkout/pay-at-hotel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CHECKOUT_HOLD_LIVE_ENABLED = "true";
    rpc.mockResolvedValue({
      data: {
        booking_reference_id: "SUT-ABCDEF1234567890",
        ok: true,
        reservation_id: "reservation-1",
      },
      error: null,
    });
  });

  it("finalizes a held pay-at-hotel booking and returns only a hold-token confirmation URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/checkout/pay-at-hotel", {
        body: JSON.stringify(validRequest),
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
          "Sec-Fetch-Site": "same-origin",
          "X-Forwarded-For": "198.51.100.222",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(rpc).toHaveBeenCalledWith("finalize_pay_at_hotel_checkout_hold", {
      p_guest_email: "guest@example.com",
      p_guest_name: "Narin S.",
      p_guest_phone: "+66 81 234 5678",
      p_hold_token: "11111111-1111-4111-8111-111111111111",
    });
    await expect(response.json()).resolves.toEqual({
      confirmationUrl: "/confirmation?mode=pay_at_hotel&hold_token=11111111-1111-4111-8111-111111111111",
    });
  });
});
