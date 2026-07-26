import { describe, expect, it } from "vitest";

import {
  SRI_U_THONG_ROOM_COUNT,
  SRI_U_THONG_ROOM_PLAN,
  SRI_U_THONG_WEB_ROOM_COUNT,
} from "@/lib/hotel-inventory-plan";

describe("Sri U-Thong real inventory plan", () => {
  it("contains the eight rebranded room categories and 111 rooms", () => {
    expect(SRI_U_THONG_ROOM_PLAN).toHaveLength(8);
    expect(SRI_U_THONG_ROOM_COUNT).toBe(111);
  });

  it("assigns every physical room exactly once", () => {
    const roomNumbers = SRI_U_THONG_ROOM_PLAN.flatMap(
      (roomType) => roomType.roomNumbers,
    );

    expect(new Set(roomNumbers).size).toBe(roomNumbers.length);
  });

  it("publishes a controlled 41-room website allocation", () => {
    expect(SRI_U_THONG_WEB_ROOM_COUNT).toBe(41);

    for (const roomType of SRI_U_THONG_ROOM_PLAN) {
      const physicalRoomNumbers = new Set<string>(roomType.roomNumbers);
      expect(
        roomType.websiteRoomNumbers.every((roomNumber) =>
          physicalRoomNumbers.has(roomNumber),
        ),
      ).toBe(true);
    }

    expect(
      Object.fromEntries(
        SRI_U_THONG_ROOM_PLAN.map((roomType) => [
          roomType.name,
          roomType.websiteRoomNumbers.length,
        ]),
      ),
    ).toEqual({
      "Classic Room (Double)": 8,
      "Classic Room (Twin)": 18,
      "Deluxe Room": 3,
      "Executive Room (Double)": 3,
      "Executive Room (Twin)": 3,
      "Executive Suite": 1,
      "Grand Residence": 1,
      "Studio Suite": 4,
    });
  });

  it("matches the approved category volumes and rates", () => {
    expect(
      Object.fromEntries(
        SRI_U_THONG_ROOM_PLAN.map((roomType) => [
          roomType.name,
          { rate: roomType.rate, rooms: roomType.roomNumbers.length },
        ]),
      ),
    ).toEqual({
      "Classic Room (Double)": { rate: 900, rooms: 23 },
      "Classic Room (Twin)": { rate: 900, rooms: 59 },
      "Deluxe Room": { rate: 1_400, rooms: 6 },
      "Executive Room (Double)": { rate: 1_600, rooms: 7 },
      "Executive Room (Twin)": { rate: 1_600, rooms: 6 },
      "Executive Suite": { rate: 3_200, rooms: 1 },
      "Grand Residence": { rate: 4_000, rooms: 1 },
      "Studio Suite": { rate: 1_600, rooms: 8 },
    });
  });
});
