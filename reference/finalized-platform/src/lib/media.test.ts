import { describe, expect, it } from "vitest";

import {
  isApprovedRoomImageSource,
  normalizeR2ImageSource,
  r2ImageUrl,
  ROOM_IMAGE_PRESETS,
} from "@/lib/media";

describe("canonical R2 media URLs", () => {
  it("builds canonical image URLs", () => {
    expect(r2ImageUrl("grand-deluxe-room.jpg")).toBe(
      "https://assets.sriuthonghotels.com/library/images/grand-deluxe-room.jpg",
    );
  });

  it("normalizes local and legacy transformation sources", () => {
    expect(normalizeR2ImageSource("/images/grand-suite-room.jpg")).toBe(ROOM_IMAGE_PRESETS[2]);
    expect(
      normalizeR2ImageSource(
        "https://assets.sriuthonghotels.com/cdn-cgi/image/format=auto/library/images/grand-deluxe-room.jpg",
      ),
    ).toBe(ROOM_IMAGE_PRESETS[1]);
  });

  it("accepts canonical R2 room URLs and rejects unrelated hosts", () => {
    expect(isApprovedRoomImageSource(ROOM_IMAGE_PRESETS[0])).toBe(true);
    expect(isApprovedRoomImageSource("https://example.com/library/images/room.jpg")).toBe(false);
  });
});
