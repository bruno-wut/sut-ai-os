import { describe, expect, it } from "vitest";

import {
  defaultRoomDetails,
  isExtraBedPolicy,
  isRoomAmenityId,
  MAX_ROOM_GALLERY_IMAGES,
  ROOM_AMENITY_GROUPS,
} from "@/lib/room-details";

describe("room detail catalog", () => {
  it("provides complete bilingual fallback details for every booking category", () => {
    for (const key of ["classic", "deluxe-room", "studio-suite", "executive", "executive-suite", "grand-residence"]) {
      const details = defaultRoomDetails(key, `/images/${key}.jpg`);

      expect(details.description.length).toBeGreaterThan(20);
      expect(details.descriptionTh.length).toBeGreaterThan(20);
      expect(details.bedConfiguration.length).toBeGreaterThan(0);
      expect(details.galleryImages).toEqual([`/images/${key}.jpg`]);
      expect(details.sizeSqm).toBeGreaterThan(0);
      expect(details.amenities.length).toBeGreaterThan(0);
    }
  });

  it("keeps amenity identifiers valid and grouped once", () => {
    const groupedAmenities = ROOM_AMENITY_GROUPS.flatMap((group) => group.amenities);

    expect(new Set(groupedAmenities).size).toBe(groupedAmenities.length);
    expect(groupedAmenities.every(isRoomAmenityId)).toBe(true);
  });

  it("defines the optimized gallery and policy boundaries", () => {
    expect(MAX_ROOM_GALLERY_IMAGES).toBe(8);
    expect(["available", "not-available", "on-request"].every(isExtraBedPolicy)).toBe(true);
    expect(isExtraBedPolicy("sometimes")).toBe(false);
  });
});
