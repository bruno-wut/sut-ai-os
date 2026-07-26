export const SITE_CONFIG = {
  brand: {
    hotelName: "Sri U-Thong Grand Hotel",
    canonicalSiteUrl: "https://sriuthonggrand.com",
    stagingSiteUrl: "https://staging.sri-u-thong-storefront-staging.pages.dev",
    bookingSiteUrl: "https://secure.sriuthonghotels.com",
    logoAlt: "Sri U-Thong Grand Hotel",
    symbolAlt: "Sri U-Thong symbol",
  },
  contact: {
    addressLine: "19 Nangpim Road, T. Tha Pee Liang, A. Muang, Suphanburi, Thailand 72000",
    mailingAddress: "19 Nang Phim Road, Tha Phi Liang, Mueang Suphan Buri District, Suphan Buri 72000, Thailand",
    phoneDisplay: "+66 (0) 35 502 293",
    phoneSchema: "+66 35 502 293",
    phoneHref: "tel:+6635502293",
    faxDisplay: "+66 35 501 110",
    reservationsEmail: "reservations@sriuthonghotels.com",
    reservationsEmailHref: "mailto:reservations@sriuthonghotels.com",
    privacyEmail: "privacy@sriuthonggrand.com",
    mapsUrl:
      "https://www.google.com/maps/search/?api=1&query=Sri+U-Thong+Grand+Hotel%2C+19+Nangpim+Road%2C+Suphanburi+72000",
    mapsEmbedUrl:
      "https://www.google.com/maps?q=Sri%20U-Thong%20Grand%20Hotel%2C%2019%20Nangpim%20Road%2C%20Suphanburi%2072000&z=15&output=embed",
    schemaAddress: {
      streetAddress: "19 Nangpim Road, T. Tha Pee Liang, A. Muang",
      addressLocality: "Suphanburi",
      postalCode: "72000",
      addressCountry: "TH",
    },
  },
  social: {
    agodaUrl:
      "https://www.agoda.com/th-th/sri-u-thong-grand-hotel/hotel/suphan-buri-th.html?cid=1844104&ds=YfK3TWaLCHpqzmfZ",
    facebookUrl:
      "https://www.facebook.com/p/%E0%B9%82%E0%B8%A3%E0%B8%87%E0%B9%81%E0%B8%A3%E0%B8%A1%E0%B8%A8%E0%B8%A3%E0%B8%B5%E0%B8%AD%E0%B8%B9%E0%B9%88%E0%B8%97%E0%B8%AD%E0%B8%87%E0%B9%81%E0%B8%81%E0%B8%A3%E0%B8%99%E0%B8%94%E0%B9%8C-61561678355597/",
    lineUrl: null,
  },
  legal: {
    privacyPolicyPath: "/legal/privacy",
    cancellationPolicyPath: "/legal/cancellation",
    bookingTermsPath: "/legal/terms",
  },
  operations: {
    timezone: "Asia/Bangkok",
    checkInTime: "12:00 PM",
    checkOutTime: "12:00 PM",
  },
} as const;

export const SITE_SOCIAL_URLS = [
  SITE_CONFIG.brand.canonicalSiteUrl,
  SITE_CONFIG.social.agodaUrl,
  SITE_CONFIG.social.facebookUrl,
] as const;

export const SITE_LEGAL_PATHS = {
  terms: SITE_CONFIG.legal.bookingTermsPath,
  privacyPolicy: SITE_CONFIG.legal.privacyPolicyPath,
  cancellationPolicy: SITE_CONFIG.legal.cancellationPolicyPath,
} as const;
