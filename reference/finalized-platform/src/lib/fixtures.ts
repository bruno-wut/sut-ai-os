export type RoomFixture = Readonly<{
  slug: string;
  name: string;
  image: string;
  summary: string;
  sleeps: number;
  size: string;
  nightlyPrice: number;
  roomsLeft: number;
  features: readonly string[];
}>;

export const ROOM_FIXTURES: readonly RoomFixture[] = [
  {
    slug: "superior",
    name: "Superior Room",
    image: "/images/grand-superior-room.jpg",
    summary: "A calm, practical room for short business trips and city visits.",
    sleeps: 2,
    size: "28 m²",
    nightlyPrice: 1450,
    roomsLeft: 4,
    features: ["King or twin beds", "Breakfast available", "City view"],
  },
  {
    slug: "deluxe",
    name: "Deluxe Room",
    image: "/images/grand-deluxe-room.jpg",
    summary: "A more spacious stay with a dedicated sitting area and refined finishes.",
    sleeps: 3,
    size: "34 m²",
    nightlyPrice: 1850,
    roomsLeft: 2,
    features: ["King bed", "Sitting area", "Breakfast available"],
  },
  {
    slug: "suite",
    name: "Suite",
    image: "/images/grand-suite-room.jpg",
    summary: "Generous space for longer stays, special visits, or quiet evenings in.",
    sleeps: 2,
    size: "48 m²",
    nightlyPrice: 2650,
    roomsLeft: 1,
    features: ["Separate living area", "King bed", "Breakfast included"],
  },
] as const;

export type ReservationFixture = Readonly<{
  id: string;
  number: string;
  guestName: string;
  roomType: string;
  stay: string;
  total: number;
  amountDue: number;
  created: string;
  status: "Pending" | "Synced" | "Cancelled";
  paymentMode: "stripe" | "pay_at_hotel";
  paymentStatus: "not_collected" | "collected" | "refunded";
  assignment: "assigned" | "shuffle_required";
}>;

export const RESERVATION_FIXTURES: readonly ReservationFixture[] = [
  {
    id: "preview-1",
    number: "WEB-260720-014",
    guestName: "Narin S.",
    roomType: "Deluxe Room × 1",
    stay: "20–22 Jul 2026",
    total: 3700,
    amountDue: 0,
    created: "18 min ago",
    status: "Pending",
    paymentMode: "stripe",
    paymentStatus: "collected",
    assignment: "assigned",
  },
  {
    id: "preview-2",
    number: "WEB-260720-013",
    guestName: "Ploy K.",
    roomType: "Superior Room × 2",
    stay: "21–24 Jul 2026",
    total: 0,
    amountDue: 8700,
    created: "1 hr 42 min ago",
    status: "Pending",
    paymentMode: "pay_at_hotel",
    paymentStatus: "not_collected",
    assignment: "shuffle_required",
  },
  {
    id: "preview-3",
    number: "WEB-260720-011",
    guestName: "Daniel M.",
    roomType: "Suite × 1",
    stay: "25–27 Jul 2026",
    total: 5300,
    amountDue: 0,
    created: "3 hr 18 min ago",
    status: "Pending",
    paymentMode: "stripe",
    paymentStatus: "collected",
    assignment: "assigned",
  },
  {
    id: "preview-4",
    number: "WEB-260719-009",
    guestName: "Siriporn T.",
    roomType: "Superior Room × 1",
    stay: "19–20 Jul 2026",
    total: 1450,
    amountDue: 0,
    created: "Yesterday",
    status: "Synced",
    paymentMode: "pay_at_hotel",
    paymentStatus: "collected",
    assignment: "assigned",
  },
] as const;

export function formatThaiBaht(value: number) {
  return new Intl.NumberFormat("en-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(value);
}
