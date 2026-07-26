import type { Metadata } from "next";

import { BookingLookupExperience } from "@/components/booking/booking-lookup-experience";

export const metadata: Metadata = {
  title: "Booking Lookup",
  description: "Check a Sri U-Thong Grand Hotel direct booking status with a reference ID and email address.",
};

export default function BookingLookupPage() {
  return <BookingLookupExperience />;
}
