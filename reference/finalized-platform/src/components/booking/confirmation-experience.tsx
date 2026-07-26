"use client";

import { Check, CircleDashed, MailCheck } from "lucide-react";
import Link from "next/link";

import { useLocale } from "@/components/localization/locale-provider";
import { localizePath } from "@/lib/i18n/config";

export function ConfirmationExperience({
  holdToken,
  paymentMode,
  reservationNumber = "WEB-00000000-0001",
  sessionId,
}: Readonly<{ holdToken?: string; paymentMode: "stripe" | "pay_at_hotel"; reservationNumber?: string; sessionId?: string }>) {
  const { locale, dictionary } = useLocale();
  const t = dictionary.confirmation;
  const isLiveStripeReturn =
    paymentMode === "stripe" && (reservationNumber.startsWith("cs_") || Boolean(sessionId));
  const confirmed = !isLiveStripeReturn;
  const lookupPath = sessionId
    ? `/lookup?session_id=${encodeURIComponent(sessionId)}`
    : holdToken
    ? `/lookup?hold_token=${encodeURIComponent(holdToken)}`
    : "/lookup";

  const displayReservation =
    reservationNumber &&
    reservationNumber !== "WEB-00000000-0001" &&
    !reservationNumber.startsWith("cs_");

  return (
    <main className="confirmation-page" id="guest-content">
      <div className="confirmation-card">
        <div className="preview-kicker">{isLiveStripeReturn ? t.securePaymentReceived : t.reservationStatus}</div>
        <div className={`confirmation-icon${confirmed ? " confirmation-icon--confirmed" : ""}`}>
          {confirmed ? <Check aria-hidden="true" size={34} /> : <CircleDashed aria-hidden="true" size={34} />}
        </div>
        <p className="eyebrow">
          {displayReservation ? t.reservation(reservationNumber) : t.reservationProcessing}
        </p>
        <h1 className="display-title">{confirmed ? t.stayConfirmed : t.reservationReceived}</h1>
        <p className="confirmation-lead">
          {confirmed
            ? t.confirmedLead
            : paymentMode === "stripe"
              ? t.stripeProcessingLead
              : t.hotelProcessingLead}
        </p>
        <div className="confirmation-state-grid">
          <div><span>{t.bookingStatus}</span><strong>{confirmed ? t.confirmed : t.processing}</strong></div>
          <div><span>{t.paymentStatus}</span><strong>{paymentMode === "stripe" ? t.collectedOnline : t.dueAtHotel}</strong></div>
        </div>
        <div className="confirmation-status" role="status">
          <MailCheck aria-hidden="true" size={20} />
          <div><strong>{confirmed ? t.confirmationEmail : t.confirmationInProgress}</strong><p>{paymentMode === "pay_at_hotel" ? t.emailDueAtHotel : confirmed ? t.emailOnlineReceived : t.emailKeepPage}</p></div>
        </div>
        <ol className="confirmation-timeline">
          <li className="is-complete"><span><Check aria-hidden="true" size={14} /></span><div><strong>{paymentMode === "stripe" ? t.paymentReceived : t.bookingReceived}</strong><p>{paymentMode === "stripe" ? t.securePaymentCompleted : t.paymentDueAtHotel}</p></div></li>
          <li className={confirmed ? "is-complete" : "is-current"}><span>{confirmed ? <Check aria-hidden="true" size={14} /> : "2"}</span><div><strong>{t.hotelReview}</strong><p>{t.hotelReviewLead}</p></div></li>
          <li className={confirmed ? "is-complete" : ""}><span>{confirmed ? <Check aria-hidden="true" size={14} /> : "3"}</span><div><strong>{t.hotelConfirmed}</strong><p>{t.finalConfirmationSent}</p></div></li>
        </ol>
        <div className="confirmation-actions">
          <Link className="button button--primary" href={localizePath(lookupPath, locale)}>{t.viewBooking}</Link>
        </div>
      </div>
    </main>
  );
}
