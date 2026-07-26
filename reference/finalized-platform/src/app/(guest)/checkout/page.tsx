import { CheckoutExperience } from "@/components/booking/checkout-experience";
import { getRoomOptions } from "@/lib/booking-data";
import { normalizeStayDates } from "@/lib/hotel-dates";
import { redirect } from "next/navigation";

type CheckoutPageProps = Readonly<{
  searchParams: Promise<{
    adults?: string;
    checkIn?: string;
    checkOut?: string;
    children?: string;
    promoCode?: string;
    room?: string;
    rooms?: string;
  }>;
}>;

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;
  const { options: roomOptions } = await getRoomOptions();
  const selectedRoom = roomOptions.find((room) => room.slug === params.room);

  if (!params.room || !selectedRoom) {
    redirect("/book");
  }

  const stayDates = normalizeStayDates(params.checkIn, params.checkOut);
  const roomCount = Math.max(1, Number.parseInt(params.rooms ?? "1", 10) || 1);
  const adultCount = Math.max(1, Number.parseInt(params.adults ?? "2", 10) || 2);
  const childCount = Math.max(0, Number.parseInt(params.children ?? "0", 10) || 0);

  return (
    <CheckoutExperience
      adults={adultCount}
      checkIn={stayDates.checkIn}
      checkOut={stayDates.checkOut}
      childGuests={childCount}
      room={selectedRoom}
      rooms={roomCount}
      promoCode={params.promoCode?.trim() || null}
    />
  );
}
