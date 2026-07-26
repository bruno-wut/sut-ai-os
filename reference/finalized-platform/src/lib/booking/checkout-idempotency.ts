export type CheckoutCartIdentity = Readonly<{
  checkIn: string;
  checkOut: string;
  roomTypeId: string;
  rooms: number;
  adults: number;
  children: number;
  promoCode?: string | null;
  paymentMode: "stripe" | "pay_at_hotel";
}>;

type StoredCheckoutIdentity = Readonly<{
  fingerprint: string;
  idempotencyKey: string;
}>;

const STORAGE_KEY = "hotel-bridge:checkout-idempotency";

export function createCheckoutCartFingerprint(cart: CheckoutCartIdentity) {
  return JSON.stringify({
    adults: cart.adults,
    checkIn: cart.checkIn,
    checkOut: cart.checkOut,
    children: cart.children,
    paymentMode: cart.paymentMode,
    promoCode: cart.promoCode?.trim().toUpperCase() || null,
    rooms: cart.rooms,
    roomTypeId: cart.roomTypeId,
  });
}

export function getCheckoutIdempotencyKey(
  cart: CheckoutCartIdentity,
  storage: Pick<Storage, "getItem" | "setItem"> = window.sessionStorage,
) {
  const fingerprint = createCheckoutCartFingerprint(cart);

  try {
    const stored = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null") as StoredCheckoutIdentity | null;

    if (
      stored?.fingerprint === fingerprint &&
      typeof stored.idempotencyKey === "string" &&
      stored.idempotencyKey.length >= 16
    ) {
      return stored.idempotencyKey;
    }
  } catch {
    // Corrupt or unavailable browser state is replaced with a fresh key.
  }

  const idempotencyKey = crypto.randomUUID();
  storage.setItem(STORAGE_KEY, JSON.stringify({ fingerprint, idempotencyKey }));

  return idempotencyKey;
}

export function resetCheckoutIdempotencyKey(
  storage: Pick<Storage, "removeItem"> = window.sessionStorage,
) {
  storage.removeItem(STORAGE_KEY);
}
