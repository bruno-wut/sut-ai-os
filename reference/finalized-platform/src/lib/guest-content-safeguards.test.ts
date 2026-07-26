import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const guestComponentFiles = [
  "src/components/booking/guest-header.tsx",
  "src/components/booking/booking-experience.tsx",
  "src/components/booking/booking-lookup-experience.tsx",
  "src/components/booking/checkout-experience.tsx",
] as const;

function readGuestComponents() {
  return guestComponentFiles
    .map((file) => readFileSync(join(process.cwd(), file), "utf8"))
    .join("\n");
}

describe("guest content safeguards", () => {
  it("does not expose test lookup credentials in the guest interface", () => {
    const source = readGuestComponents();

    expect(source).not.toContain("preview@sriuthong.com");
    expect(source).not.toContain("WEB-260720-014");
  });

  it("does not hardcode staging storefront hosts in guest chrome", () => {
    const source = readGuestComponents();

    expect(source).not.toContain("sri-u-thong-storefront-staging.pages.dev");
    expect(source).not.toContain("staging-preview-7q2x.sriuthonghotels.com");
  });

  it("does not label ordinary booking screens as previews", () => {
    const source = readGuestComponents();

    expect(source).not.toContain('"Preview room"');
    expect(source).not.toContain("Local preview:");
    expect(source).not.toContain("copy.previewRoomResults");
    expect(source).not.toContain("copy.previewAvailability");
    expect(source).not.toContain("copy.preview}");
  });
});
