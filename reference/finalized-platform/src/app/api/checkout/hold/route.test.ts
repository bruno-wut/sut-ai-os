import { describe, expect, it } from "vitest";

import { POST } from "./route";

const validRequest = {
  adults: 2,
  checkIn: "2030-01-10",
  checkOut: "2030-01-12",
  children: 0,
  guestEmail: "guest@example.com",
  guestName: "Narin S.",
  guestPhone: "+66 81 234 5678",
  idempotencyKey: "11111111-1111-4111-8111-111111111111",
  cancellationPolicyVersion: "2026-06-01",
  marketingConsent: false,
  paymentMode: "stripe",
  pdpaConsent: true,
  privacyPolicyVersion: "2026-06-01",
  promoCode: null,
  rooms: 1,
  roomCategory: "classic",
  termsVersion: "2026-06-01",
};

describe("POST /api/checkout/hold", () => {
  it("rejects incomplete guest details before the integration boundary", async () => {
    const response = await POST(
      new Request("http://localhost/api/checkout/hold", {
        body: JSON.stringify({ ...validRequest, guestEmail: "" }),
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
          "Sec-Fetch-Site": "same-origin",
          "X-Forwarded-For": "198.51.100.10",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      code: "INVALID_CHECKOUT_REQUEST",
    });
  });

  it("rejects executable markup in the guest name before persistence", async () => {
    const response = await POST(
      new Request("http://localhost/api/checkout/hold", {
        body: JSON.stringify({ ...validRequest, guestName: "<script>alert(1)</script>" }),
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
          "Sec-Fetch-Site": "same-origin",
          "X-Forwarded-For": "198.51.100.12",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "INVALID_CHECKOUT_REQUEST",
      error: "Full name cannot contain markup or control characters.",
    });
  });

  it("remains safely disabled after a valid request until Supabase is connected", async () => {
    const response = await POST(
      new Request("http://localhost/api/checkout/hold", {
        body: JSON.stringify(validRequest),
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
          "Sec-Fetch-Site": "same-origin",
          "X-Forwarded-For": "198.51.100.11",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("ratelimit-limit")).toBe("5");
    await expect(response.json()).resolves.toMatchObject({
      code: "CHECKOUT_HOLD_NOT_CONNECTED",
    });
  });

  it("blocks cross-site checkout submissions", async () => {
    const response = await POST(
      new Request("http://localhost/api/checkout/hold", {
        body: JSON.stringify(validRequest),
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example",
          "Sec-Fetch-Site": "cross-site",
        },
        method: "POST",
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "CHECKOUT_HOLD_FORBIDDEN",
    });
  });

  it("rate limits too many new idempotency keys from the same IP", async () => {
    let lastResponse: Response | undefined;

    for (let attempt = 0; attempt < 6; attempt += 1) {
      lastResponse = await POST(
        new Request("http://localhost/api/checkout/hold", {
          body: JSON.stringify({
            ...validRequest,
            idempotencyKey: `11111111-1111-4111-8111-${String(attempt).padStart(12, "0")}`,
          }),
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost",
            "Sec-Fetch-Site": "same-origin",
            "X-Forwarded-For": "198.51.100.25",
          },
          method: "POST",
        }),
      );
    }

    expect(lastResponse?.status).toBe(429);
    expect(lastResponse?.headers.get("retry-after")).toBeTruthy();
    await expect(lastResponse?.json()).resolves.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
