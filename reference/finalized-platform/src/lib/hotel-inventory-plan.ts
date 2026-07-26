import { r2ImageUrl } from "@/lib/media";

export type HotelRoomTypePlan = {
  imageUrl: string;
  name: string;
  rate: number;
  roomNumbers: string[];
  series: "Heritage Series" | "Premier Series";
  websiteRoomNumbers: string[];
};

function roomRange(prefix: string, start: number, end: number) {
  return Array.from(
    { length: end - start + 1 },
    (_, index) => `${prefix}${String(start + index).padStart(2, "0")}`,
  );
}

export const SRI_U_THONG_ROOM_PLAN = [
  {
    imageUrl: r2ImageUrl("grand-superior-room.jpg"),
    name: "Classic Room (Twin)",
    rate: 900,
    roomNumbers: [
      ...roomRange("12", 1, 4),
      "1206",
      ...roomRange("12", 13, 15),
      ...roomRange("12", 17, 24),
      ...roomRange("13", 1, 4),
      ...roomRange("13", 6, 15),
      ...roomRange("13", 17, 24),
      ...roomRange("14", 1, 4),
      ...roomRange("14", 6, 11),
      ...roomRange("15", 1, 4),
      ...roomRange("15", 6, 12),
    ],
    series: "Heritage Series",
    websiteRoomNumbers: [
      ...roomRange("12", 1, 4),
      "1206",
      ...roomRange("12", 13, 15),
      ...roomRange("12", 17, 24),
      "1301",
      "1302",
    ],
  },
  {
    imageUrl: r2ImageUrl("grand-superior-room.jpg"),
    name: "Classic Room (Double)",
    rate: 900,
    roomNumbers: [
      ...roomRange("14", 12, 15),
      ...roomRange("14", 17, 24),
      ...roomRange("15", 13, 15),
      ...roomRange("15", 17, 24),
    ],
    series: "Heritage Series",
    websiteRoomNumbers: [
      ...roomRange("14", 12, 15),
      ...roomRange("14", 17, 20),
    ],
  },
  {
    imageUrl: r2ImageUrl("grand-deluxe-room.jpg"),
    name: "Deluxe Room",
    rate: 1_400,
    roomNumbers: roomRange("12", 7, 12),
    series: "Heritage Series",
    websiteRoomNumbers: roomRange("12", 7, 9),
  },
  {
    imageUrl: r2ImageUrl("grand-suite-room.jpg"),
    name: "Studio Suite",
    rate: 1_600,
    roomNumbers: ["1205", "1216", "1305", "1316", "1405", "1416", "1505", "1516"],
    series: "Heritage Series",
    websiteRoomNumbers: ["1205", "1305", "1405", "1505"],
  },
  {
    imageUrl: r2ImageUrl("grand-deluxe-room.jpg"),
    name: "Executive Room (Twin)",
    rate: 1_600,
    roomNumbers: [...roomRange("16", 1, 4), "1606", "1607"],
    series: "Premier Series",
    websiteRoomNumbers: roomRange("16", 1, 3),
  },
  {
    imageUrl: r2ImageUrl("grand-deluxe-room.jpg"),
    name: "Executive Room (Double)",
    rate: 1_600,
    roomNumbers: ["1608", "1609", ...roomRange("16", 11, 15)],
    series: "Premier Series",
    websiteRoomNumbers: ["1608", "1609", "1611"],
  },
  {
    imageUrl: r2ImageUrl("grand-suite-room.jpg"),
    name: "Executive Suite",
    rate: 3_200,
    roomNumbers: ["1605"],
    series: "Premier Series",
    websiteRoomNumbers: ["1605"],
  },
  {
    imageUrl: r2ImageUrl("grand-suite-room.jpg"),
    name: "Grand Residence",
    rate: 4_000,
    roomNumbers: ["1610"],
    series: "Premier Series",
    websiteRoomNumbers: ["1610"],
  },
] as const satisfies readonly HotelRoomTypePlan[];

export const SRI_U_THONG_ROOM_COUNT = SRI_U_THONG_ROOM_PLAN.reduce(
  (total, roomType) => total + roomType.roomNumbers.length,
  0,
);

export const SRI_U_THONG_WEB_ROOM_COUNT = SRI_U_THONG_ROOM_PLAN.reduce(
  (total, roomType) => total + roomType.websiteRoomNumbers.length,
  0,
);
