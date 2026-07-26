import { astroSiteConfig } from "./siteConfig.js";

const configuredBookingUrl =
  import.meta.env.PUBLIC_SUT_IBE_URL ||
  import.meta.env.PUBLIC_BOOKING_URL ||
  `${astroSiteConfig.bookingSiteUrl}/book`;

const ibeBaseUrl = configuredBookingUrl.endsWith("/book")
  ? configuredBookingUrl
  : `${configuredBookingUrl.replace(/\/$/, "")}/book`;

export function getIbeLookupUrl(locale = "en") {
  const baseOrigin = configuredBookingUrl
    .replace(/\/book\/?$/, "")
    .replace(/\/$/, "");

  return `${baseOrigin}/${locale}/lookup`;
}

const bookingConfig = {
  enabled: Boolean(ibeBaseUrl),
  ibeBaseUrl,
  fallbackUrl: "",
  queryMap: {
    checkin: "checkIn",
    checkout: "checkOut",
    adults: "adults",
    children: "children",
    rooms: "rooms",
    promoCode: "promoCode"
  }
};

export default bookingConfig;
