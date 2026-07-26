import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServiceRoleClient, retrieve, rpc, maybeSingle } = vi.hoisted(() => ({
  createSupabaseServiceRoleClient: vi.fn(),
  maybeSingle: vi.fn(),
  retrieve: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("stripe", () => ({
  default: class Stripe {
    static createFetchHttpClient() {
      return {};
    }

    checkout = {
      sessions: {
        retrieve,
      },
    };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient,
}));

import { POST } from "./route";

const validRequest = {
  bookingReferenceId: "WEB-20260704-0001",
  email: "guest@example.com",
};
const genericError = "Booking details could not be verified. Please contact front desk operations.";

function supabaseClient() {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle,
    select: vi.fn(() => query),
  };

  return {
    from: vi.fn(() => query),
    rpc,
  };
}

describe("POST /api/booking-lookup", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.HOTEL_ID = "2a932172-26a1-4beb-ad13-c5da91134c97";
    process.env.STRIPE_SECRET_KEY = "sk_test_lookup";
    createSupabaseServiceRoleClient.mockReturnValue(null);
  });

  it("rejects invalid lookup input", async () => {
    const response = await POST(
      new Request("http://localhost/api/booking-lookup", {
        body: JSON.stringify({ ...validRequest, email: "not-an-email" }),
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.71",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Enter the email used for the booking.",
    });
  });

  it("masks repeated lookup abuse behind the same not-found response", async () => {
    let lastResponse: Response | undefined;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      lastResponse = await POST(
        new Request("http://localhost/api/booking-lookup", {
          body: JSON.stringify(validRequest),
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "198.51.100.72",
          },
          method: "POST",
        }),
      );
    }

    expect(lastResponse?.status).toBe(404);
    await expect(lastResponse?.json()).resolves.toMatchObject({
      error: genericError,
    });
  });

  it("returns 429 with standard rate-limit and retry headers after 20 attempts", async () => {
    let lastResponse: Response | undefined;

    for (let attempt = 0; attempt < 21; attempt += 1) {
      lastResponse = await POST(
        new Request("http://localhost/api/booking-lookup", {
          body: JSON.stringify(validRequest),
          headers: {
            "Content-Type": "application/json",
            "X-Forwarded-For": "198.51.100.73",
          },
          method: "POST",
        }),
      );
    }

    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("ratelimit-limit")).toBe("20");
    expect(lastResponse?.headers.get("ratelimit-remaining")).toBe("0");
    expect(lastResponse?.headers.get("retry-after")).toBeTruthy();
    await expect(lastResponse?.json()).resolves.toMatchObject({
      code: "RATE_LIMITED",
      error: genericError,
    });
  });

  it("returns the uniform generic response for malformed Stripe session lookup attempts", async () => {
    const response = await POST(
      new Request("http://localhost/api/booking-lookup", {
        body: JSON.stringify({ sessionId: "not-a-session" }),
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.172",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: genericError,
    });
    expect(retrieve).not.toHaveBeenCalled();
  });

  it("validates a paid Stripe session before resolving the safe booking lookup", async () => {
    createSupabaseServiceRoleClient.mockReturnValue(supabaseClient());
    retrieve.mockResolvedValue({
      customer_details: { email: "Guest@Example.com" },
      id: "cs_test_secure123",
      metadata: {
        guest_email: "guest@example.com",
        hold_token: "11111111-1111-4111-8111-111111111111",
        hotel_id: "2a932172-26a1-4beb-ad13-c5da91134c97",
      },
      mode: "payment",
      payment_status: "paid",
      status: "complete",
    });
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          booking_reference_id: "SUT-ABCDEF1234567890",
          reservation_number: "WEB-20300110-00000001",
        },
        error: null,
      });
    rpc.mockResolvedValue({
      data: {
        bookingReferenceId: "SUT-ABCDEF1234567890",
        checkInDate: "2030-01-10",
        checkOutDate: "2030-01-12",
        hotel: { address: "Suphanburi", name: "Sri U-Thong Grand Hotel", phone: "+66 35 501 290-3" },
        paymentMode: "stripe",
        paymentSummary: "Payment collected",
        reservationNumber: "WEB-20300110-00000001",
        roomCategory: "Classic Room",
        rooms: 1,
        status: "confirmed",
        statusLabel: "Confirmed by hotel",
        updatedAt: "2030-01-10T00:00:00.000Z",
      },
      error: null,
    });

    const response = await POST(
      new Request("http://localhost/api/booking-lookup", {
        body: JSON.stringify({ sessionId: "cs_test_secure123" }),
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.173",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(retrieve).toHaveBeenCalledWith("cs_test_secure123");
    expect(rpc).toHaveBeenCalledWith("lookup_guest_reservation", {
      p_booking_reference_id: "SUT-ABCDEF1234567890",
      p_guest_email: "guest@example.com",
    });
    await expect(response.json()).resolves.toMatchObject({
      booking: {
        bookingReferenceId: "SUT-ABCDEF1234567890",
        status: "confirmed",
      },
    });
  });

  it("returns a safe pending summary while webhook finalization catches up", async () => {
    createSupabaseServiceRoleClient.mockReturnValue(supabaseClient());
    retrieve.mockResolvedValue({
      customer_email: "guest@example.com",
      id: "cs_test_pending123",
      metadata: {
        check_in: "2030-01-10",
        check_out: "2030-01-12",
        guest_email: "guest@example.com",
        hold_token: "11111111-1111-4111-8111-111111111111",
        hotel_id: "2a932172-26a1-4beb-ad13-c5da91134c97",
        room_category: "classic",
        rooms: "2",
      },
      mode: "payment",
      payment_status: "paid",
      status: "complete",
    });
    maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await POST(
      new Request("http://localhost/api/booking-lookup", {
        body: JSON.stringify({ sessionId: "cs_test_pending123" }),
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.174",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalledWith("lookup_guest_reservation", expect.anything());
    await expect(response.json()).resolves.toMatchObject({
      booking: {
        paymentSummary: "Payment collected",
        roomCategory: "Classic Room",
        rooms: 2,
        status: "pending",
        statusLabel: "Payment received",
      },
      pending: true,
    });
  });

  it("resolves a pay-at-hotel hold token to a safe booking status without URL PII", async () => {
    createSupabaseServiceRoleClient.mockReturnValue(supabaseClient());
    maybeSingle
      .mockResolvedValueOnce({
        data: { converted_reservation_id: "reservation-1" },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          booking_reference_id: "SUT-HOTEL1234567890",
          check_in_date: "2030-01-10",
          check_out_date: "2030-01-12",
          hotel_id: "hotel-1",
          payment_mode: "pay_at_hotel",
          payment_status: "not_collected",
          reservation_number: "WEB-20300110-00000002",
          room_type: "Executive Room",
          rooms_requested: 1,
          sync_status: "Pending",
          updated_at: "2030-01-10T00:00:00.000Z",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          hotel_name: "Sri U-Thong Grand Hotel",
          public_contact_address: "Suphanburi",
          public_contact_phone: "+66 35 501 290-3",
        },
        error: null,
      });

    const response = await POST(
      new Request("http://localhost/api/booking-lookup", {
        body: JSON.stringify({ holdToken: "11111111-1111-4111-8111-111111111111" }),
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-For": "198.51.100.175",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(rpc).not.toHaveBeenCalledWith("lookup_guest_reservation", expect.anything());
    await expect(response.json()).resolves.toMatchObject({
      booking: {
        bookingReferenceId: "SUT-HOTEL1234567890",
        paymentSummary: "Payment due at hotel",
        roomCategory: "Executive Room",
        status: "pending",
      },
    });
  });
});
