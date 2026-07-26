"use client";

import { Filter, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { formatThaiBaht } from "@/lib/fixtures";
import type { DashboardReservation } from "@/lib/staff-dashboard-data";
import { useLocale } from "@/components/localization/locale-provider";

export function ReservationsTable({ rows: reservations }: Readonly<{
  rows: readonly DashboardReservation[];
}>) {
  const { dictionary } = useLocale();
  const copy = dictionary.reservationsTable;

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");

  const paymentSummary = (reservation: DashboardReservation) => {
    if (reservation.paymentStatus === "refunded") return copy.paymentRefunded;
    if (reservation.paymentStatus === "collected") return copy.paymentCollected;
    return copy.paymentDue(formatThaiBaht(reservation.amountDue));
  };

  const stripeTransactionLabel = (reservation: DashboardReservation) => {
    return reservation.paymentMode === "stripe" ? reservation.stripeTransactionId ?? "-" : "-";
  };

  const paymentMethodLabel = (reservation: DashboardReservation) => {
    if (reservation.paymentMode === "pay_at_hotel") return "-";
    return reservation.stripePaymentMethodLabel ?? copy.stripe;
  };

  const rows = useMemo(() => reservations.filter((reservation) => {
    const matchesQuery = `${reservation.number} ${reservation.guestName} ${reservation.bookingReferenceId ?? ""}`.toLowerCase().includes(query.toLowerCase());
    return matchesQuery && (status === "All" || reservation.status === status);
  }), [query, reservations, status]);

  return (
    <section className="staff-panel reservation-panel">
      <div className="reservation-filters">
        <label className="search-field" htmlFor="search-reservations-input"><Search aria-hidden="true" size={16} /><span className="sr-only">{copy.searchLabel}</span><input id="search-reservations-input" aria-label={copy.searchLabel} onChange={(event) => setQuery(event.target.value)} placeholder={copy.searchPlaceholder} value={query} /></label>
        <label className="filter-field"><Filter aria-hidden="true" size={15} /><span className="sr-only">{copy.filterLabel}</span><select onChange={(event) => setStatus(event.target.value)} value={status}><option value="All">{copy.filterAll}</option><option value="Pending">{copy.filterPending}</option><option value="Synced">{copy.filterSynced}</option><option value="Cancelled">{copy.filterCancelled}</option></select></label>
        <span className="preview-kicker">{copy.kicker}</span>
      </div>
      <div aria-label="Reservations queue table" className="data-table-wrap" role="region" tabIndex={0}>
        <table className="data-table">
          <thead>
            <tr><th scope="col">{copy.thReservation}</th><th scope="col">{copy.thGuest}</th><th scope="col">{copy.thStay}</th><th scope="col">{copy.thRoom}</th><th scope="col">{copy.thPayment}</th><th scope="col">{copy.thMethod}</th><th scope="col">{copy.thTransaction}</th><th scope="col">{copy.thPmsStatus}</th><th scope="col"><span className="sr-only">{copy.openReservation}</span></th></tr>
          </thead>
          <tbody>
            {rows.map((reservation) => {
              const localizedPmsStatus = reservation.status === "Pending"
                ? copy.filterPending
                : reservation.status === "Synced"
                  ? copy.filterSynced
                  : copy.filterCancelled;
              return (
                <tr className={reservation.created.includes("3 hr") ? "is-overdue" : ""} key={reservation.id}>
                  <td data-label="Reservation">
                    <strong>{reservation.number}</strong>
                    {reservation.bookingReferenceId ? (
                      <span style={{ display: "block", fontSize: "0.85em", color: "var(--fg-muted, #666)", marginTop: "2px" }}>
                        Ref: {reservation.bookingReferenceId}
                      </span>
                    ) : null}
                    <span>{reservation.created}</span>
                  </td>
                  <td data-label="Guest">{reservation.guestName}</td>
                  <td data-label="Stay">{reservation.stay}</td>
                  <td data-label="Room">{reservation.roomType}{reservation.assignment === "shuffle_required" ? <em>{copy.reassignmentNeeded}</em> : null}</td>
                  <td data-label="Payment"><span className={`payment-badge payment-badge--${reservation.paymentStatus}`}>{reservation.paymentMode === "stripe" ? copy.stripe : copy.atHotel} - {paymentSummary(reservation)}</span></td>
                  <td data-label="Method">{paymentMethodLabel(reservation)}</td>
                  <td data-label="Transaction"><code className="transaction-id">{stripeTransactionLabel(reservation)}</code></td>
                  <td data-label="PMS status"><span className={`status-pill status-pill--${reservation.status.toLowerCase()}`}>{localizedPmsStatus}</span></td>
                  <td className="reservation-row-action"><Link aria-label={`Open ${reservation.number}`} className="table-link" href={`/staff/reservations/${reservation.id}`}>{copy.openReservation}</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length === 0 ? <div className="table-empty">{copy.empty}</div> : null}
      <footer className="table-pagination"><span>{copy.showing(rows.length, reservations.length)}</span></footer>
    </section>
  );
}
