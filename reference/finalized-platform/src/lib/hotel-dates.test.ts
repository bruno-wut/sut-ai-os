import { describe, expect, it } from "vitest";

import {
  addDaysToDateString,
  getBangkokDateString,
  normalizeStayDates,
} from "./hotel-dates";

describe("Bangkok hotel date normalization", () => {
  it("rolls into the next hotel day even while UTC is still on the previous date", () => {
    expect(getBangkokDateString(new Date("2026-07-04T18:30:00.000Z"))).toBe("2026-07-05");
  });

  it("does not roll back for guests west of Thailand", () => {
    expect(getBangkokDateString(new Date("2026-07-05T02:00:00.000Z"))).toBe("2026-07-05");
  });

  it("normalizes stale and inverted calendar values against the Bangkok minimum", () => {
    expect(normalizeStayDates("2026-07-04", "2026-07-03")).toEqual({
      checkIn: getBangkokDateString(),
      checkOut: addDaysToDateString(getBangkokDateString(), 1),
    });
  });
});
