export const dynamic = "force-dynamic";

import { BookingExperience } from "@/components/booking/booking-experience";
import { getRoomOptions } from "@/lib/booking-data";

type BookingPageProps = Readonly<{
  searchParams: Promise<{
    adults?: string;
    checkIn?: string;
    checkOut?: string;
    children?: string;
    promoCode?: string;
    rooms?: string;
  }>;
}>;

export default async function BookingPage({ searchParams }: BookingPageProps) {
  const initialSearch = await searchParams;
  const { options: rooms, suggestion } = await getRoomOptions({
    checkIn: initialSearch.checkIn,
    checkOut: initialSearch.checkOut,
    adults: initialSearch.adults,
    rooms: initialSearch.rooms,
  });

  return (
    <main id="guest-content">
      <BookingExperience
        initialSearch={initialSearch}
        key={`${initialSearch.checkIn}_${initialSearch.checkOut}_${initialSearch.rooms}_${initialSearch.adults}`}
        rooms={rooms}
        suggestion={suggestion}
      />
    </main>
  );
}
