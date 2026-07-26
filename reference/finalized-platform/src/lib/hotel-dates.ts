export const HOTEL_TIME_ZONE = "Asia/Bangkok";

export function getBangkokDateString(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "2-digit",
    timeZone: HOTEL_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    throw new Error("Unable to format Bangkok hotel date.");
  }

  return `${year}-${month}-${day}`;
}

export function addDaysToDateString(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));

  return date.toISOString().slice(0, 10);
}

export function sanitizeBangkokDate(value: string | undefined, minimum = getBangkokDateString()) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return minimum;
  }

  return value < minimum ? minimum : value;
}

export function normalizeStayDates(checkIn?: string, checkOut?: string) {
  const sanitizedCheckIn = sanitizeBangkokDate(checkIn);
  const minimumCheckOut = addDaysToDateString(sanitizedCheckIn, 1);
  const sanitizedCheckOut = sanitizeBangkokDate(checkOut, minimumCheckOut);

  return {
    checkIn: sanitizedCheckIn,
    checkOut: sanitizedCheckOut <= sanitizedCheckIn ? minimumCheckOut : sanitizedCheckOut,
  };
}

export function formatDisplayDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
