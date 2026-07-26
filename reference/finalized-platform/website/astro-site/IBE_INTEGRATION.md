# IBE Integration Guide

This website is already prepared for future IBE handoff from the homepage booking widget.

## Current behavior

- Guests choose `check-in`, `check-out`, `adults`, `children`, `rooms`, and an optional `promoCode`.
- If IBE is not enabled yet, the booking widget sends these details to the contact page as a pre-filled enquiry.

## File to update later

- [src/data/bookingConfig.js](C:/Users/Bruno%20Browny/Documents/Codex/2026-06-16/use-model-gpt-5-codex-mode/src/data/bookingConfig.js)

## How to connect the IBE later

1. Set `enabled` to `true`.
2. Paste the hosted IBE booking page URL into `ibeBaseUrl`.
3. Match the `queryMap` keys to the exact query parameter names required by the IBE provider.

Example:

```js
const bookingConfig = {
  enabled: true,
  ibeBaseUrl: "https://your-ibe-provider.com/booking-engine",
  fallbackUrl: "/contact/",
  queryMap: {
    checkin: "arrival",
    checkout: "departure",
    adults: "adults",
    children: "children",
    rooms: "rooms",
    promoCode: "promo"
  }
};
```

## Data passed from the website

- `checkin`
- `checkout`
- `adults`
- `children`
- `rooms`
- `promoCode`

## Notes

- If your IBE expects dates in a different format, that can be adjusted in [src/components/BookingBar.astro](C:/Users/Bruno%20Browny/Documents/Codex/2026-06-16/use-model-gpt-5-codex-mode/src/components/BookingBar.astro).
- If the IBE supports opening in a new tab, that can be added later.
- If the IBE requires extra fields such as `hotelId`, `currency`, or `language`, we can add them to `queryMap` or append them as fixed values.
