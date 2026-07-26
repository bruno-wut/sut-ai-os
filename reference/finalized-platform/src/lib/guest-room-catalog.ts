export const FAMILY_ROOM_KEYS = ["classic", "executive"] as const;
export const DIRECT_ROOM_KEYS = [
  "deluxe-room",
  "studio-suite",
  "executive-suite",
  "grand-residence",
] as const;

export type FamilyRoomKey = (typeof FAMILY_ROOM_KEYS)[number];
export type DirectRoomKey = (typeof DIRECT_ROOM_KEYS)[number];

const DIRECT_ROOM_NAMES: Record<DirectRoomKey, string> = {
  "deluxe-room": "Deluxe Room",
  "studio-suite": "Studio Suite",
  "executive-suite": "Executive Suite",
  "grand-residence": "Grand Residence",
};

export function isFamilyRoomKey(value: string): value is FamilyRoomKey {
  return value === "classic" || value === "executive";
}

export function isGuestRoomBookingKey(value: string) {
  return (
    isFamilyRoomKey(value) ||
    value in DIRECT_ROOM_NAMES ||
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

export function directRoomNameFromKey(value: string) {
  return value in DIRECT_ROOM_NAMES ? DIRECT_ROOM_NAMES[value as DirectRoomKey] : null;
}

export function guestRoomDisplayName(name: string) {
  return name.replace(/\s*\((Double|Twin)\)$/i, "");
}
