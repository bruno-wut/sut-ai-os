import {
  BedDouble,
  CalendarClock,
  CircleAlert,
  CircleDollarSign,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { headers } from "next/headers";

import { StaffPageHeader } from "@/components/staff/staff-page-header";
import { formatThaiBaht } from "@/lib/fixtures";
import { getStaffDashboardReservations } from "@/lib/staff-dashboard-data";
import { getStaffDashboardRefundReviews } from "@/lib/staff-refund-reviews";
import { getStaffInventoryData } from "@/lib/staff-inventory-data";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

export default async function StaffDashboardPage() {
  const headerStore = await headers();
  const requestedLocale = headerStore.get("x-sut-locale");
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  const dictionary = getDictionary(locale);
  const copy = dictionary.dashboard;

  const [reservations, refundReviews, inventory] = await Promise.all([
    getStaffDashboardReservations(),
    getStaffDashboardRefundReviews(),
    getStaffInventoryData(),
  ]);
  const pendingReservations = reservations.filter((item) => item.status === "Pending");
  const shuffleRequired = reservations.filter((item) => item.assignment === "shuffle_required").length;
  const tonightAvailable = inventory.roomTypes.reduce((sum, type) => sum + (type.days[0]?.available ?? 0), 0);
  const isLive = inventory.connected;

  const metrics = [
    { detail: isLive ? copy.metricDetails.pendingPms : copy.metricDetails.unavailable, icon: CalendarClock, label: copy.metricLabels.pendingPms, value: String(pendingReservations.length) },
    { detail: isLive ? copy.metricDetails.tonightAvailable : copy.metricDetails.unavailable, icon: BedDouble, label: copy.metricLabels.tonightAvailable, value: String(tonightAvailable) },
    { detail: isLive ? copy.metricDetails.refundReview : copy.metricDetails.unavailable, icon: CircleDollarSign, label: copy.metricLabels.refundReview, value: String(refundReviews.filter((item) => item.refundStatus === "pending").length) },
    { detail: isLive ? copy.metricDetails.reassignmentNeeded : copy.metricDetails.unavailable, icon: RefreshCcw, label: copy.metricLabels.reassignmentNeeded, value: String(shuffleRequired) },
  ] as const;

  const transactionLabel = (reservation: (typeof reservations)[number]) =>
    reservation.paymentMode === "stripe" ? reservation.stripeTransactionId ?? "-" : "-";

  const paymentMethodLabel = (reservation: (typeof reservations)[number]) =>
    reservation.paymentMode === "pay_at_hotel" ? "-" : reservation.stripePaymentMethodLabel ?? (locale === "th" ? copy.pmsEntry.methodCard : "Stripe");

  return (
    <>
      <StaffPageHeader
        description={copy.description}
        eyebrow={isLive ? copy.eyebrowLive : copy.eyebrowOffline}
        title={copy.title}
      />

      <div className="health-banner" role="status">
        <CircleAlert aria-hidden="true" size={19} />
        <div>
          <strong>{isLive ? copy.bannerConnected : copy.bannerConfigRequired}</strong>
          <p>
            {isLive ? copy.bannerConnectedDesc : copy.bannerConfigRequiredDesc}
          </p>
        </div>
      </div>

      <section aria-label="Operational metrics" className="metrics-grid">
        {metrics.map(({ detail, icon: Icon, label, value }) => (
          <article className="metric-card" key={label}>
            <div className="metric-card__label">
              {label}
              <Icon aria-hidden="true" size={17} strokeWidth={1.6} />
            </div>
            <p className="metric-card__value">{value}</p>
            <p className="metric-card__detail">{detail}</p>
          </article>
        ))}
      </section>

      <div className="staff-grid">
        <section className="staff-panel staff-panel--main" aria-labelledby="refund-review-heading">
          <header className="staff-panel__header">
            <h2 id="refund-review-heading">{copy.refundReview.heading}</h2>
            <span>{isLive ? copy.refundReview.subHeadingLive : copy.refundReview.subHeadingOffline}</span>
          </header>
          <div aria-label="Refund review table" className="data-table-wrap" role="region" tabIndex={0}>
            <table className="data-table dashboard-table">
              <thead>
                <tr>
                  <th scope="col">{copy.refundReview.thReservation}</th>
                  <th scope="col">{copy.refundReview.thGuest}</th>
                  <th scope="col">{copy.refundReview.thStay}</th>
                  <th scope="col">{copy.refundReview.thRefund}</th>
                  <th scope="col">{copy.refundReview.thAction}</th>
                </tr>
              </thead>
              <tbody>
                {refundReviews.map((reservation) => (
                  <tr className={reservation.refundStatus === "failed" ? "is-overdue" : ""} key={reservation.id}>
                    <td><strong>{reservation.number}</strong><span>{reservation.created}</span></td>
                    <td>{reservation.guestName}</td>
                    <td>{reservation.stay}</td>
                    <td>
                      <span className={`payment-badge payment-badge--${reservation.refundStatus === "failed" ? "failed" : "pending"}`}>
                        {reservation.refundStatus === "failed"
                          ? copy.refundReview.refundFailed
                          : reservation.refundStatus === "processing"
                            ? copy.refundReview.stripeProcessing
                            : `${formatThaiBaht(reservation.amount)} ${copy.refundReview.toReview}`}
                      </span>
                    </td>
                    <td><Link className="table-link" href={`/staff/reservations/${reservation.id}` as Route}>{copy.refundReview.open}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {refundReviews.length === 0 ? <div className="table-empty">{copy.refundReview.empty}</div> : null}
        </section>

        <section className="staff-panel staff-panel--side" aria-labelledby="health-heading">
          <header className="staff-panel__header">
            <h2 id="health-heading">{copy.systemHealth.heading}</h2>
            <span>{isLive ? copy.systemHealth.subHeadingLive : copy.systemHealth.subHeadingOffline}</span>
          </header>
          <div className="status-list">
            <div className="status-list__item">
              <span>{copy.systemHealth.worker}</span>
              <span className={`status-pill ${isLive ? "status-pill--synced" : "status-pill--failed"}`}>{isLive ? copy.systemHealth.connected : copy.systemHealth.unavailable}</span>
            </div>
            <div className="status-list__item">
              <span>{copy.systemHealth.emailQueue}</span>
              <span className="status-pill status-pill--pending">{isLive ? copy.systemHealth.notChecked : copy.systemHealth.unavailable}</span>
            </div>
            <div className="status-list__item">
              <span>{copy.systemHealth.inventoryHorizon}</span>
              <span className="status-pill status-pill--synced">{copy.systemHealth.days365}</span>
            </div>
            <div className="status-list__item">
              <span>{copy.systemHealth.failedJobs}</span>
              <span className={`status-pill ${isLive ? "status-pill--synced" : "status-pill--failed"}`}>{isLive ? copy.systemHealth.notChecked : copy.systemHealth.unavailable}</span>
            </div>
          </div>
        </section>

        <section className="staff-panel staff-panel--main" aria-labelledby="pending-heading">
          <header className="staff-panel__header">
            <h2 id="pending-heading">{copy.pmsEntry.heading}</h2>
            <span>{isLive ? copy.pmsEntry.subHeadingLive : copy.pmsEntry.subHeadingOffline}</span>
          </header>
          <div className="data-table-wrap">
            <table className="data-table dashboard-table">
              <thead>
                <tr>
                  <th scope="col">{copy.pmsEntry.thReservation}</th>
                  <th scope="col">{copy.pmsEntry.thGuest}</th>
                  <th scope="col">{copy.pmsEntry.thStay}</th>
                  <th scope="col">{copy.pmsEntry.thPayment}</th>
                  <th scope="col">{copy.pmsEntry.thMethod}</th>
                  <th scope="col">{copy.pmsEntry.thTransaction}</th>
                  <th scope="col">{copy.pmsEntry.thAction}</th>
                </tr>
              </thead>
              <tbody>
                {pendingReservations.map((reservation) => (
                  <tr className={reservation.created.includes("3 hr") ? "is-overdue" : ""} key={reservation.id}>
                    <td><strong>{reservation.number}</strong><span>{reservation.created}</span></td>
                    <td>{reservation.guestName}</td>
                    <td>{reservation.stay}</td>
                    <td>
                      <span className={`payment-badge payment-badge--${reservation.paymentStatus}`}>
                        {reservation.paymentMode === "stripe"
                          ? reservation.paymentStatus === "refunded"
                            ? copy.pmsEntry.stripeRefunded
                            : copy.pmsEntry.stripeCollected
                          : `${copy.pmsEntry.dueAtHotel} ${formatThaiBaht(reservation.amountDue)}`}
                      </span>
                    </td>
                    <td>{paymentMethodLabel(reservation)}</td>
                    <td><code className="transaction-id">{transactionLabel(reservation)}</code></td>
                    <td><Link className="table-link" href={`/staff/reservations/${reservation.id}` as Route}>{copy.pmsEntry.open}</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pendingReservations.length === 0 ? <div className="table-empty">{copy.pmsEntry.empty}</div> : null}
        </section>
      </div>
    </>
  );
}
