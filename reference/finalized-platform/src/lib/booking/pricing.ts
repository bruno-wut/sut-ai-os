/**
 * Hotel service charge rate (10%) mandated per hotel operations standards in Thailand.
 */
export const HOTEL_SERVICE_CHARGE_RATE = 0.1;

/**
 * Value Added Tax (VAT) rate (7%) prescribed by the Revenue Department of Thailand.
 */
export const THAILAND_VAT_RATE = 0.07;

/**
 * Combined multiplier for price calculation including 10% service charge + 7% VAT applied on top of service charge.
 * Formula: 1 + 0.10 + (1.10 * 0.07) = 1.177
 */
const TAX_MULTIPLIER = 1 + HOTEL_SERVICE_CHARGE_RATE + ((1 + HOTEL_SERVICE_CHARGE_RATE) * THAILAND_VAT_RATE);

export function calculateBookingPrice(finalDisplayedTotal: number) {
  const grandTotal = Math.max(0, Math.round(finalDisplayedTotal));
  const baseSubtotal = Math.round(grandTotal / TAX_MULTIPLIER);
  const serviceCharge = Math.round(baseSubtotal * HOTEL_SERVICE_CHARGE_RATE);
  const vat = Math.max(0, grandTotal - baseSubtotal - serviceCharge);

  return { baseSubtotal, grandTotal, serviceCharge, vat };
}
