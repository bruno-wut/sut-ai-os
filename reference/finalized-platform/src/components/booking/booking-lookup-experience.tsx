"use client";

import { CheckCircle2, Clock3, Download, LoaderCircle, Mail, Search, ShieldCheck, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

import { formatDisplayDate } from "@/lib/hotel-dates";
import { SITE_CONFIG } from "@/lib/site-config";
import { useLocale } from "@/components/localization/locale-provider";

type LookupStatus = "pending" | "confirmed" | "completed" | "cancelled";
type SessionLookupState = "idle" | "verifying" | "synced" | "delayed" | "error";

type PaymentSummaryKey = "collected" | "dueAtHotel" | "refunded" | "pending" | "processing";

type LookupBooking = Readonly<{
  bookingReferenceId: string;
  reservationNumber: string;
  status: LookupStatus;
  statusLabel: string;
  roomCategory: string;
  rooms: number;
  checkInDate: string;
  checkOutDate: string;
  paymentMode: "stripe" | "pay_at_hotel";
  paymentSummary: string;
  updatedAt: string;
  hotel: {
    name: string;
    phone: string;
    address: string;
  };
}>;

type LookupResponse = Readonly<{
  booking?: LookupBooking;
  error?: string;
  pending?: boolean;
}>;

const statusIcons: Record<LookupStatus, typeof Clock3> = {
  pending: Clock3,
  confirmed: ShieldCheck,
  completed: CheckCircle2,
  cancelled: XCircle,
};

const escalationEmail = SITE_CONFIG.contact.reservationsEmail;

function paymentSummaryKey(summary: string): PaymentSummaryKey {
  switch (summary) {
    case "Payment collected":
      return "collected";
    case "Payment due at hotel":
      return "dueAtHotel";
    case "Payment refunded":
      return "refunded";
    case "Payment processing":
      return "processing";
    case "Payment pending confirmation":
    case "Payment pending":
    default:
      return "pending";
  }
}

export function BookingLookupExperience() {
  const { dictionary } = useLocale();
  const copy = dictionary.lookup;
  const searchParams = useSearchParams();
  const [booking, setBooking] = useState<LookupBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionLookupState, setSessionLookupState] = useState<SessionLookupState>("idle");

  useEffect(() => {
    const sessionId = searchParams.get("session_id");
    const holdToken = searchParams.get("hold_token");
    if (!sessionId && !holdToken) return;

    let cancelled = false;
    let timeoutId: number | null = null;
    let attempts = 0;

    async function verifySession() {
      attempts += 1;
      setSessionLookupState("verifying");
      setError(null);

      try {
        const response = await fetch("/api/booking-lookup", {
          body: JSON.stringify(sessionId ? { sessionId } : { holdToken }),
          headers: {
            "Content-Type": "application/json",
          },
          method: "POST",
        });
        const result = (await response.json()) as LookupResponse;

        if (cancelled) return;

        if (!response.ok || !result.booking) {
          setBooking(null);
          setError(result.error ?? copy.genericError);
          setSessionLookupState("error");
          return;
        }

        setBooking(result.booking);

        if (result.pending) {
          if (attempts < 5) {
            timeoutId = window.setTimeout(verifySession, 3000);
            return;
          }

          setSessionLookupState("delayed");
          return;
        }

        setSessionLookupState("synced");
      } catch {
        if (cancelled) return;
        setBooking(null);
        setError(copy.genericError);
        setSessionLookupState("error");
      }
    }

    verifySession();

    return () => {
      cancelled = true;
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };
  }, [copy.genericError, searchParams]);

  async function handleLookup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setBooking(null);
    setIsSubmitting(true);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/booking-lookup", {
        body: JSON.stringify({
          bookingReferenceId: formData.get("bookingReferenceId"),
          email: formData.get("email"),
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      const result = (await response.json()) as LookupResponse;

      if (!response.ok || !result.booking) {
        setError(result.error ?? copy.genericError);
        return;
      }

      setBooking(result.booking);
    } catch {
      setError(copy.unavailableError);
    } finally {
      setIsSubmitting(false);
    }
  }

  const StatusIcon = booking ? statusIcons[booking.status] : Search;
  const hasSessionLookup = Boolean(searchParams.get("session_id") || searchParams.get("hold_token"));
  const isVerifyingSession = sessionLookupState === "verifying";

  return (
    <main className="lookup-page" id="guest-content">
      <section className="lookup-hero" aria-labelledby="lookup-heading">
        <p className="preview-kicker">{copy.kicker}</p>
        <h1 className="display-title" id="lookup-heading">{copy.title}</h1>
        <p>{copy.lead}</p>
      </section>

      <div className="lookup-grid">
        <section className="lookup-card" aria-labelledby="lookup-form-heading">
          <div className="checkout-card__heading">
            <span>01</span>
            <div>
              <p className="eyebrow">{copy.formEyebrow}</p>
              <h2 id="lookup-form-heading">{copy.formHeading}</h2>
            </div>
          </div>

          <form className="lookup-form" onSubmit={handleLookup}>
            <label className="field" htmlFor="lookup-reference">
              <span className="field__label">{copy.referenceIdLabel}</span>
              <input
                autoComplete="off"
                className="field__control"
                id="lookup-reference"
                name="bookingReferenceId"
                placeholder="SUT-1A2B3C4D5E6F7890"
                required
              />
            </label>
            <label className="field" htmlFor="lookup-email">
              <span className="field__label">{copy.emailLabel}</span>
              <input
                autoComplete="email"
                className="field__control"
                id="lookup-email"
                name="email"
                placeholder="name@example.com"
                required
                type="email"
              />
            </label>
            <button className="button button--primary" disabled={isSubmitting} type="submit">
              {isSubmitting ? <LoaderCircle aria-hidden="true" className="spin" size={16} /> : <Search aria-hidden="true" size={16} />}
              {isSubmitting ? copy.checking : copy.checkBookingBtn}
            </button>
          </form>

          {hasSessionLookup ? (
            <div className="lookup-message lookup-message--status" role="status">
              {isVerifyingSession ? <LoaderCircle aria-hidden="true" className="spin" size={18} /> : <ShieldCheck aria-hidden="true" size={18} />}
              <span>
                {isVerifyingSession
                  ? copy.verifyLedger
                  : sessionLookupState === "synced"
                    ? copy.synced
                    : sessionLookupState === "delayed"
                      ? copy.delayed(escalationEmail)
                      : copy.autoVerifyFailed}
              </span>
            </div>
          ) : null}

          {error ? (
            <div className="lookup-message lookup-message--error" role="alert">
              {error}
            </div>
          ) : null}
        </section>

        <aside className={`lookup-result lookup-result--${booking?.status ?? "empty"}`} aria-live="polite">
          <div className="lookup-result__icon">
            <StatusIcon aria-hidden="true" size={25} />
          </div>

          {booking ? (
            <>
              <p className="eyebrow">{copy.bookingStatus}</p>
              <h2>{copy.statusLabels[booking.status]}</h2>
              <p>{copy.statusText[booking.status]}</p>
              <dl className="lookup-details">
                <div>
                  <dt>{copy.reference}</dt>
                  <dd>{booking.bookingReferenceId}</dd>
                </div>
                <div>
                  <dt>{copy.roomCategory}</dt>
                  <dd>{booking.roomCategory} x {booking.rooms} {booking.rooms === 1 ? copy.room : copy.rooms}</dd>
                </div>
                <div>
                  <dt>{copy.stayDates}</dt>
                  <dd>{formatDisplayDate(booking.checkInDate)} {copy.to} {formatDisplayDate(booking.checkOutDate)}</dd>
                </div>
                <div>
                  <dt>{copy.payment}</dt>
                  <dd>{copy.paymentStatusText[paymentSummaryKey(booking.paymentSummary)]}</dd>
                </div>
              </dl>
              <div className="lookup-contact">
                <strong>{copy.needHelp}</strong>
                <span>{booking.hotel.name}</span>
                <a href={`tel:${booking.hotel.phone.replace(/[^+\d]/g, "")}`}>{booking.hotel.phone}</a>
                <span>{booking.hotel.address}</span>
              </div>
              <div className="lookup-actions">
                <button className="button button--secondary" onClick={() => window.print()} type="button">
                  <Download aria-hidden="true" size={16} />
                  {copy.saveConfirmation}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">{copy.privateByDesign}</p>
              <h2>{copy.readyWhenYouAre}</h2>
              <p>{copy.privateExplain}</p>
              <ul className="lookup-assurances">
                <li><CheckCircle2 aria-hidden="true" size={16} />{copy.noAccount}</li>
                <li><CheckCircle2 aria-hidden="true" size={16} />{copy.noNotes}</li>
                <li><CheckCircle2 aria-hidden="true" size={16} />{copy.abuseProtected}</li>
              </ul>
            </>
          )}
          <div className="lookup-escalation">
            <Mail aria-hidden="true" size={17} />
            <div>
              <strong>{copy.escalationHeading}</strong>
              <p>{copy.escalationText(escalationEmail)}</p>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
