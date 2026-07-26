import { describe, expect, it } from "vitest";

import { checkoutFetchMetadataIsAllowed, checkoutOriginIsAllowed } from "@/lib/checkout-abuse-protection";

describe("Origin & Fetch Metadata Validation (S-05)", () => {
  it("rejects requests missing an Origin header", () => {
    const request = new Request("https://example.com/api/checkout/hold", {
      method: "POST",
      headers: {
        "Sec-Fetch-Site": "same-origin",
      },
    });

    expect(checkoutOriginIsAllowed(request)).toBe(false);
  });

  it("rejects requests missing a Sec-Fetch-Site header", () => {
    const request = new Request("https://example.com/api/checkout/hold", {
      method: "POST",
      headers: {
        Origin: "https://example.com",
      },
    });

    expect(checkoutFetchMetadataIsAllowed(request)).toBe(false);
  });

  it("accepts same-origin requests with valid metadata headers", () => {
    const request = new Request("https://example.com/api/checkout/hold", {
      method: "POST",
      headers: {
        Origin: "https://example.com",
        "Sec-Fetch-Site": "same-origin",
      },
    });

    expect(checkoutOriginIsAllowed(request)).toBe(true);
    expect(checkoutFetchMetadataIsAllowed(request)).toBe(true);
  });
});
