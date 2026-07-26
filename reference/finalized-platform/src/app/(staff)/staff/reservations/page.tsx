import { headers } from "next/headers";

import { ReservationsTable } from "@/components/staff/reservations-table";
import { StaffPageHeader } from "@/components/staff/staff-page-header";
import { getStaffDashboardReservations } from "@/lib/staff-dashboard-data";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

export default async function ReservationsPage() {
  const reservations = await getStaffDashboardReservations();

  const headerStore = await headers();
  const requestedLocale = headerStore.get("x-sut-locale");
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  const dictionary = getDictionary(locale);
  const copy = dictionary.staffReservations;

  return (
    <>
      <StaffPageHeader
        description={copy.description}
        eyebrow={copy.eyebrowQueue}
        title={copy.title}
      />
      <ReservationsTable rows={reservations} />
    </>
  );
}
