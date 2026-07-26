import { describe, expect, it, vi } from "vitest";

import {
  createCheckoutCartFingerprint,
  getCheckoutIdempotencyKey,
  type CheckoutCartIdentity,
} from "./checkout-idempotency";

const cart: CheckoutCartIdentity = {
  adults: 2,
  checkIn: "2030-01-10",
  checkOut: "2030-01-12",
  children: 0,
  paymentMode: "stripe",
  promoCode: null,
  rooms: 1,
  roomTypeId: "room-type-1",
};

function createStorage() {
  const values = new Map<string, string>();

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe("checkout idempotency", () => {
  it("reuses a key for a network retry of the unchanged cart", () => {
    const storage = createStorage();
    const randomUuid = vi.spyOn(crypto, "randomUUID").mockReturnValue("11111111-1111-4111-8111-111111111111");

    const first = getCheckoutIdempotencyKey(cart, storage);
    const retry = getCheckoutIdempotencyKey({ ...cart }, storage);

    expect(retry).toBe(first);
    expect(randomUuid).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["dates", { checkOut: "2030-01-13" }],
    ["room count", { rooms: 2 }],
    ["guest count", { adults: 3 }],
    ["promo code", { promoCode: "DIRECT" }],
    ["payment mode", { paymentMode: "pay_at_hotel" as const }],
  ])("generates a new key when %s changes", (_label, change) => {
    const storage = createStorage();
    vi.spyOn(crypto, "randomUUID")
      .mockReturnValueOnce("11111111-1111-4111-8111-111111111111")
      .mockReturnValueOnce("22222222-2222-4222-8222-222222222222");

    const first = getCheckoutIdempotencyKey(cart, storage);
    const changed = getCheckoutIdempotencyKey({ ...cart, ...change }, storage);

    expect(changed).not.toBe(first);
  });

  it("normalizes promo-code casing in the cart fingerprint", () => {
    expect(createCheckoutCartFingerprint({ ...cart, promoCode: " direct " })).toBe(
      createCheckoutCartFingerprint({ ...cart, promoCode: "DIRECT" }),
    );
  });
});
