import { describe, expect, it } from "vitest";

import { calculateBookingPrice, HOTEL_SERVICE_CHARGE_RATE, THAILAND_VAT_RATE } from "@/lib/booking/pricing";

describe("calculateBookingPrice", () => {
  it("reverse-calculates subtotal, service charge, and VAT from the final guest total", () => {
    expect(calculateBookingPrice(1_200)).toEqual({
      baseSubtotal: 1_020,
      grandTotal: 1_200,
      serviceCharge: 102,
      vat: 78,
    });
  });

  it("rounds each amount to whole baht while preserving the final total", () => {
    const pricing = calculateBookingPrice(1_451.6);

    expect(pricing).toEqual({
      baseSubtotal: 1_234,
      grandTotal: 1_452,
      serviceCharge: 123,
      vat: 95,
    });
    expect(pricing.baseSubtotal + pricing.serviceCharge + pricing.vat).toBe(pricing.grandTotal);
  });

  it("handles zero and negative edge cases gracefully", () => {
    expect(calculateBookingPrice(0)).toEqual({
      baseSubtotal: 0,
      grandTotal: 0,
      serviceCharge: 0,
      vat: 0,
    });
    expect(calculateBookingPrice(-500)).toEqual({
      baseSubtotal: 0,
      grandTotal: 0,
      serviceCharge: 0,
      vat: 0,
    });
  });

  it("handles fractional satang inputs and non-integer totals cleanly", () => {
    const pricing = calculateBookingPrice(999.99);
    expect(pricing.grandTotal).toBe(1000);
    expect(pricing.baseSubtotal + pricing.serviceCharge + pricing.vat).toBe(1000);
  });

  it("handles large amounts (e.g. 500,000 THB corporate bookings)", () => {
    const pricing = calculateBookingPrice(500_000);
    expect(pricing.grandTotal).toBe(500_000);
    expect(pricing.baseSubtotal + pricing.serviceCharge + pricing.vat).toBe(500_000);
    expect(pricing.baseSubtotal).toBe(Math.round(500_000 / 1.177));
  });

  it("ensures subtotal + service charge + VAT exactly equals grandTotal across price points", () => {
    const testPrices = [1, 500, 900, 1400, 2500, 3200, 4800, 12550, 99999];

    for (const price of testPrices) {
      const breakdown = calculateBookingPrice(price);
      expect(breakdown.baseSubtotal + breakdown.serviceCharge + breakdown.vat).toBe(breakdown.grandTotal);
    }
  });

  it("exports valid legal tax constants", () => {
    expect(HOTEL_SERVICE_CHARGE_RATE).toBe(0.1);
    expect(THAILAND_VAT_RATE).toBe(0.07);
  });
});
