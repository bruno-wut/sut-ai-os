import { notFound } from "next/navigation";

import { ReservationDetail } from "@/components/staff/reservation-detail";
import { getStaffReservation } from "@/lib/staff-dashboard-data";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Reservation Detail",
};

type ReservationPageProps = Readonly<{ params: Promise<{ id: string }> }>;

export default async function ReservationPage({ params }: ReservationPageProps) {
  const { id } = await params;
  const reservation = await getStaffReservation(id);
  if (!reservation) notFound();
  return <ReservationDetail reservation={reservation} />;
}
