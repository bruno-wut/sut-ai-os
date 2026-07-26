import { describe, expect, it } from "vitest";

import { checkoutGuestSchema, checkoutHoldRequestSchema } from "./checkout";

describe("checkoutGuestSchema", () => {
  it("requires guest name, email, and phone before hold creation", () => {
    const result = checkoutGuestSchema.safeParse({
      guestName: " ",
      guestEmail: "",
      guestPhone: null,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.guestName).toBeDefined();
      expect(result.error.flatten().fieldErrors.guestEmail).toBeDefined();
      expect(result.error.flatten().fieldErrors.guestPhone).toBeDefined();
    }
  });

  it("normalizes valid guest details", () => {
    expect(
      checkoutGuestSchema.parse({
        guestName: "  Narin S.  ",
        guestEmail: "  Guest@Example.com ",
        guestPhone: " +66 81 234 5678 ",
      }),
    ).toEqual({
      guestName: "Narin S.",
      guestEmail: "guest@example.com",
      guestPhone: "+66 81 234 5678",
    });
  });
});

describe("checkoutHoldRequestSchema", () => {
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

  it("accepts a complete future Bangkok-dated hold request", () => {
    expect(checkoutHoldRequestSchema.safeParse(validRequest).success).toBe(true);
  });

  it("accepts grouped, direct fallback, and database room keys", () => {
    expect(checkoutHoldRequestSchema.safeParse({ ...validRequest, roomCategory: "executive" }).success).toBe(true);
    expect(checkoutHoldRequestSchema.safeParse({ ...validRequest, roomCategory: "studio-suite" }).success).toBe(true);
    expect(
      checkoutHoldRequestSchema.safeParse({
        ...validRequest,
        roomCategory: "22222222-2222-4222-8222-222222222222",
      }).success,
    ).toBe(true);
    expect(checkoutHoldRequestSchema.safeParse({ ...validRequest, roomCategory: "classic-double" }).success).toBe(false);
  });

  it("rejects invalid calendar dates and reversed stays", () => {
    expect(
      checkoutHoldRequestSchema.safeParse({
        ...validRequest,
        checkIn: "2030-02-30",
      }).success,
    ).toBe(false);

    expect(
      checkoutHoldRequestSchema.safeParse({
        ...validRequest,
        checkOut: validRequest.checkIn,
      }).success,
    ).toBe(false);
  });
});
