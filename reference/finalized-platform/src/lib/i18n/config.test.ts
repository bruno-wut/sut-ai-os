import { describe, expect, it } from "vitest";

import { localeFromPathname, localizePath, stripLocaleFromPathname } from "@/lib/i18n/config";

describe("locale path routing", () => {
  it("reads supported locale prefixes and defaults to English", () => {
    expect(localeFromPathname("/th/book")).toBe("th");
    expect(localeFromPathname("/en/staff/dashboard")).toBe("en");
    expect(localeFromPathname("/book")).toBe("en");
  });

  it("switches locale without losing path, query, or hash", () => {
    expect(localizePath("/en/book?adults=2#rooms", "th")).toBe("/th/book?adults=2#rooms");
    expect(localizePath("/checkout?room=deluxe", "en")).toBe("/en/checkout?room=deluxe");
    expect(localizePath("/th/book?lang=th&adults=2", "en")).toBe("/en/book?adults=2");
  });

  it("removes locale prefixes for internal route protection", () => {
    expect(stripLocaleFromPathname("/th/staff/reservations")).toBe("/staff/reservations");
    expect(stripLocaleFromPathname("/en/book")).toBe("/book");
  });
});
