export const MAX_ROOM_GALLERY_IMAGES = 8;

export const ROOM_AMENITY_IDS = [
  "air-conditioning",
  "breakfast",
  "city-view",
  "daily-housekeeping",
  "desk",
  "electric-kettle",
  "hair-dryer",
  "in-room-wifi",
  "non-smoking",
  "private-bathroom",
  "refrigerator",
  "television",
  "toiletries",
  "wardrobe",
] as const;

export type RoomAmenityId = (typeof ROOM_AMENITY_IDS)[number];
export type ExtraBedPolicy = "available" | "not-available" | "on-request";

export type RoomDetails = Readonly<{
  amenities: readonly RoomAmenityId[];
  bedConfiguration: string;
  bedConfigurationTh: string;
  description: string;
  descriptionTh: string;
  extraBedPolicy: ExtraBedPolicy;
  galleryImages: readonly string[];
  sizeSqm: number;
}>;

export const ROOM_AMENITY_GROUPS = [
  {
    id: "comfort",
    label: { en: "Comfort & climate", th: "ความสะดวกสบาย" },
    amenities: ["air-conditioning", "non-smoking", "city-view"],
  },
  {
    id: "bathroom",
    label: { en: "Bathroom", th: "ห้องน้ำ" },
    amenities: ["private-bathroom", "toiletries", "hair-dryer"],
  },
  {
    id: "room",
    label: { en: "Room features", th: "สิ่งอำนวยความสะดวกในห้อง" },
    amenities: ["in-room-wifi", "television", "desk", "wardrobe", "refrigerator", "electric-kettle"],
  },
  {
    id: "service",
    label: { en: "Services", th: "บริการ" },
    amenities: ["breakfast", "daily-housekeeping"],
  },
] as const satisfies readonly {
  amenities: readonly RoomAmenityId[];
  id: string;
  label: Readonly<{ en: string; th: string }>;
}[];

export const ROOM_AMENITY_LABELS: Record<RoomAmenityId, Readonly<{ en: string; th: string }>> = {
  "air-conditioning": { en: "Air conditioning", th: "เครื่องปรับอากาศ" },
  breakfast: { en: "Breakfast included", th: "รวมอาหารเช้า" },
  "city-view": { en: "City view", th: "วิวเมือง" },
  "daily-housekeeping": { en: "Daily housekeeping", th: "บริการทำความสะอาดทุกวัน" },
  desk: { en: "Writing desk", th: "โต๊ะทำงาน" },
  "electric-kettle": { en: "Electric kettle", th: "กาต้มน้ำไฟฟ้า" },
  "hair-dryer": { en: "Hair dryer", th: "ไดร์เป่าผม" },
  "in-room-wifi": { en: "Complimentary Wi-Fi", th: "Wi-Fi ฟรี" },
  "non-smoking": { en: "Non-smoking room", th: "ห้องปลอดบุหรี่" },
  "private-bathroom": { en: "Private bathroom", th: "ห้องน้ำส่วนตัว" },
  refrigerator: { en: "Refrigerator", th: "ตู้เย็น" },
  television: { en: "Television", th: "โทรทัศน์" },
  toiletries: { en: "Bathroom toiletries", th: "เครื่องใช้ในห้องน้ำ" },
  wardrobe: { en: "Wardrobe", th: "ตู้เสื้อผ้า" },
};

const STANDARD_AMENITIES = ROOM_AMENITY_IDS;

type DefaultRoomDetails = Omit<RoomDetails, "galleryImages">;

const DEFAULT_ROOM_DETAILS: Record<string, DefaultRoomDetails> = {
  classic: {
    amenities: STANDARD_AMENITIES,
    bedConfiguration: "One double bed or two single beds",
    bedConfigurationTh: "เตียงใหญ่ 1 เตียง หรือเตียงเดี่ยว 2 เตียง",
    description: "A warm, restful room with thoughtful essentials for business visits, city breaks, and comfortable overnight stays in Suphanburi.",
    descriptionTh: "ห้องพักบรรยากาศอบอุ่น พร้อมสิ่งอำนวยความสะดวกที่คัดสรรสำหรับการเดินทางเพื่อธุรกิจ การพักผ่อนในเมือง และการค้างคืนอย่างสบายในสุพรรณบุรี",
    extraBedPolicy: "not-available",
    sizeSqm: 28,
  },
  "deluxe-room": {
    amenities: STANDARD_AMENITIES,
    bedConfiguration: "One double bed and one single bed",
    bedConfigurationTh: "เตียงใหญ่ 1 เตียง และเตียงเดี่ยว 1 เตียง",
    description: "A generous room designed for guests who appreciate added space, natural light, and an easy place to unwind together.",
    descriptionTh: "ห้องพักกว้างขวางสำหรับผู้ที่ชื่นชอบพื้นที่เพิ่มเติม แสงธรรมชาติ และมุมพักผ่อนร่วมกันอย่างสบาย",
    extraBedPolicy: "on-request",
    sizeSqm: 34,
  },
  "studio-suite": {
    amenities: STANDARD_AMENITIES,
    bedConfiguration: "One double bed",
    bedConfigurationTh: "เตียงใหญ่ 1 เตียง",
    description: "A residential-style suite with distinct sleeping and sitting areas, ideal for longer stays or a quieter pace.",
    descriptionTh: "ห้องสวีทสไตล์เรสซิเดนซ์ แบ่งพื้นที่นอนและพื้นที่นั่งเล่นอย่างเป็นสัดส่วน เหมาะสำหรับการพักระยะยาวหรือการพักผ่อนอย่างเป็นส่วนตัว",
    extraBedPolicy: "on-request",
    sizeSqm: 48,
  },
  executive: {
    amenities: STANDARD_AMENITIES,
    bedConfiguration: "One double bed or two single beds",
    bedConfigurationTh: "เตียงใหญ่ 1 เตียง หรือเตียงเดี่ยว 2 เตียง",
    description: "A composed sixth-floor retreat with refined finishes, comfortable work space, and a calm sense of privacy.",
    descriptionTh: "ห้องพักบนชั้น 6 ที่โดดเด่นด้วยงานตกแต่งประณีต พื้นที่ทำงานที่สะดวก และบรรยากาศเงียบสงบเป็นส่วนตัว",
    extraBedPolicy: "not-available",
    sizeSqm: 34,
  },
  "executive-suite": {
    amenities: STANDARD_AMENITIES,
    bedConfiguration: "One double bed",
    bedConfigurationTh: "เตียงใหญ่ 1 เตียง",
    description: "A polished two-room suite with a private bedroom and separate living salon for meetings, hosting, or unhurried evenings.",
    descriptionTh: "ห้องสวีทสองห้องที่หรูหรา พร้อมห้องนอนส่วนตัวและห้องนั่งเล่นแยกเป็นสัดส่วน เหมาะสำหรับการประชุม รับรองแขก หรือพักผ่อนยามค่ำคืน",
    extraBedPolicy: "on-request",
    sizeSqm: 48,
  },
  "grand-residence": {
    amenities: STANDARD_AMENITIES,
    bedConfiguration: "One king bed",
    bedConfigurationTh: "เตียงคิงไซส์ 1 เตียง",
    description: "The hotel’s most spacious residence, pairing a private bedroom with a formal lounge for distinguished long stays and special visits.",
    descriptionTh: "ห้องพักที่กว้างขวางที่สุดของโรงแรม ประกอบด้วยห้องนอนส่วนตัวและห้องรับรอง เหมาะสำหรับการพักระยะยาวและโอกาสพิเศษ",
    extraBedPolicy: "available",
    sizeSqm: 68,
  },
};

export function defaultRoomDetails(key: string, primaryImage: string): RoomDetails {
  const fallback = DEFAULT_ROOM_DETAILS[key] ?? DEFAULT_ROOM_DETAILS.classic;
  return { ...fallback, galleryImages: [primaryImage] };
}

export function isRoomAmenityId(value: string): value is RoomAmenityId {
  return ROOM_AMENITY_IDS.includes(value as RoomAmenityId);
}

export function isExtraBedPolicy(value: string): value is ExtraBedPolicy {
  return value === "available" || value === "not-available" || value === "on-request";
}
