"use client";

import { CheckCircle2, LoaderCircle, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useLocale } from "@/components/localization/locale-provider";
import type { RoomOption } from "@/lib/booking-data";
import { getCheckoutIdempotencyKey, resetCheckoutIdempotencyKey } from "@/lib/booking/checkout-idempotency";
import { calculateBookingPrice } from "@/lib/booking/pricing";
import { formatThaiBaht } from "@/lib/fixtures";
import { formatDisplayDate, normalizeStayDates } from "@/lib/hotel-dates";
import { LEGAL_DOCUMENT_LINKS, LEGAL_VERSIONS } from "@/lib/legal/legal-versions";
import { localizePath } from "@/lib/i18n/config";
import { checkoutGuestSchema } from "@/lib/validation/checkout";

type HoldState = "idle" | "checking";
type PaymentMode = "stripe" | "pay_at_hotel";

type CheckoutExperienceProps = Readonly<{
  adults: number;
  checkIn: string;
  checkOut: string;
  childGuests: number;
  promoCode: string | null;
  room: RoomOption;
  rooms: number;
}>;

type LocalizedRoomCategory = Readonly<{
  name: string;
}>;

function getNightCount(checkIn: string, checkOut: string) {
  return Math.max(1, (Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
}

export function CheckoutExperience({ adults, checkIn, checkOut, childGuests, promoCode, room, rooms }: CheckoutExperienceProps) {
  const router = useRouter();
  const { dictionary, locale } = useLocale();
  const copy = dictionary.checkout;
  const stayDates = normalizeStayDates(checkIn, checkOut);
  const nightCount = getNightCount(stayDates.checkIn, stayDates.checkOut);
  const [holdState, setHoldState] = useState<HoldState>("idle");
  const [paymentMode, setPaymentMode] = useState<PaymentMode>("stripe");
  const [validationError, setValidationError] = useState<string | null>(null);
  const pricing = calculateBookingPrice(room.nightlyPrice * nightCount * rooms);
  const total = pricing.grandTotal;

  async function handleCheckout(form: HTMLFormElement, retryingStaleHold = false) {
    const formData = new FormData(form);
    const guest = checkoutGuestSchema.safeParse({
      guestName: formData.get("name"),
      guestEmail: formData.get("email"),
      guestPhone: formData.get("phone"),
    });

    if (!guest.success) {
      setValidationError(locale === "th" ? copy.guestError : (guest.error.issues[0]?.message ?? copy.guestError));
      return;
    }

    const idempotencyKey = getCheckoutIdempotencyKey({
      adults,
      checkIn: stayDates.checkIn,
      checkOut: stayDates.checkOut,
      children: childGuests,
      paymentMode,
      promoCode,
      rooms,
      roomTypeId: room.slug,
    });

    setValidationError(null);
    setHoldState("checking");

    const checkoutPayload = {
      adults,
      cancellationPolicyVersion: LEGAL_VERSIONS.cancellationPolicy,
      checkIn: stayDates.checkIn,
      checkOut: stayDates.checkOut,
      children: childGuests,
      guestEmail: guest.data.guestEmail,
      guestName: guest.data.guestName,
      guestPhone: guest.data.guestPhone,
      idempotencyKey,
      marketingConsent: Boolean(formData.get("marketingConsent")),
      locale,
      paymentMode,
      pdpaConsent: formData.get("pdpaConsent") === "on",
      privacyPolicyVersion: LEGAL_VERSIONS.privacyPolicy,
      promoCode,
      roomCategory: room.slug,
      rooms,
      termsVersion: LEGAL_VERSIONS.terms,
    };

    if (paymentMode === "pay_at_hotel") {
      const holdResponse = await fetch("/api/checkout/hold", {
        body: JSON.stringify(checkoutPayload),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!holdResponse.ok) {
        const body = (await holdResponse.json().catch(() => null)) as { code?: string; error?: string } | null;
        if (body?.code === "CHECKOUT_HOLD_STALE" && !retryingStaleHold) {
          resetCheckoutIdempotencyKey();
          await handleCheckout(form, true);
          return;
        }
        setValidationError(locale === "th" ? copy.checkoutError : (body?.error ?? copy.checkoutError));
        setHoldState("idle");
        return;
      }

      const holdBody = (await holdResponse.json()) as { hold?: { holdToken?: string } };
      const holdToken = holdBody.hold?.holdToken;

      if (!holdToken) {
        setValidationError(copy.linkError);
        setHoldState("idle");
        return;
      }

      const finalizeResponse = await fetch("/api/checkout/pay-at-hotel", {
        body: JSON.stringify({
          guestEmail: guest.data.guestEmail,
          guestName: guest.data.guestName,
          guestPhone: guest.data.guestPhone,
          holdToken,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (!finalizeResponse.ok) {
      const body = (await finalizeResponse.json().catch(() => null)) as { code?: string; error?: string } | null;
      if (body?.code === "CHECKOUT_HOLD_STALE" && !retryingStaleHold) {
        resetCheckoutIdempotencyKey();
        await handleCheckout(form, true);
        return;
      }
      setValidationError(locale === "th" ? copy.checkoutError : (body?.error ?? copy.checkoutError));
      setHoldState("idle");
      return;
      }

      const finalizeBody = (await finalizeResponse.json()) as { confirmationUrl?: string | null };

      if (!finalizeBody.confirmationUrl) {
        setValidationError(copy.linkError);
        setHoldState("idle");
        return;
      }

      router.push(localizePath(finalizeBody.confirmationUrl, locale));
      return;
    }

    const response = await fetch("/api/stripe/checkout-session", {
      body: JSON.stringify(checkoutPayload),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { code?: string; error?: string } | null;
      if (body?.code === "CHECKOUT_HOLD_STALE" && !retryingStaleHold) {
        resetCheckoutIdempotencyKey();
        await handleCheckout(form, true);
        return;
      }
      setValidationError(locale === "th" ? copy.checkoutError : (body?.error ?? copy.checkoutError));
      setHoldState("idle");
      return;
    }

    const body = (await response.json()) as { url?: string | null };

    if (!body.url) {
      setValidationError(copy.linkError);
      setHoldState("idle");
      return;
    }

    window.location.assign(body.url as string);
  }

  function changePaymentMode(nextMode: PaymentMode) {
    setPaymentMode(nextMode);
    setHoldState("idle");
  }

  return (
    <main className="checkout-page" id="guest-content">
      <header className="checkout-heading">
        <span className="preview-kicker">{copy.live}</span>
        <h1 className="display-title">{copy.title}</h1>
        <p>{copy.lead}</p>
      </header>

      {holdState !== "idle" ? (
        <div aria-live="polite" className={`hold-state hold-state--${holdState}`}>
          <LoaderCircle aria-hidden="true" className="spin" size={23} />
          <div>
            <strong>{copy.checking}</strong>
            <p>{copy.checkingNote}</p>
          </div>
        </div>
      ) : null}

      <div className="checkout-grid">
        <section aria-labelledby="guest-details-heading" className="checkout-card">
          <div className="checkout-card__heading">
            <span>01</span>
            <div><p className="eyebrow">{copy.guestInfo}</p><h2 id="guest-details-heading">{copy.who}</h2></div>
          </div>
          <form className="checkout-form" id="checkout-form" onSubmit={(event) => { event.preventDefault(); handleCheckout(event.currentTarget); }}>
            <label className="field" htmlFor="checkout-name"><span className="field__label">{copy.fullName}</span><input id="checkout-name" autoComplete="name" className="field__control" name="name" placeholder={copy.guestName} required /></label>
            <label className="field" htmlFor="checkout-email"><span className="field__label">{copy.email}</span><input id="checkout-email" autoComplete="email" className="field__control" name="email" placeholder="name@example.com" required type="email" /></label>
            <label className="field" htmlFor="checkout-phone"><span className="field__label">{copy.phone}</span><input id="checkout-phone" autoComplete="tel" className="field__control" name="phone" placeholder="+66" required type="tel" /></label>
            <label className="field checkout-form__wide" htmlFor="checkout-requests"><span className="field__label">{copy.requests} <small>{copy.optional}</small></span><textarea id="checkout-requests" className="field__control" name="requests" placeholder={copy.requestsPlaceholder} rows={3} /></label>
            <fieldset className="payment-mode-fieldset checkout-form__wide">
              <legend>{copy.payQuestion}</legend>
              <label className={`payment-mode-option${paymentMode === "stripe" ? " is-selected" : ""}`}>
                <input checked={paymentMode === "stripe"} name="paymentMode" onChange={() => changePaymentMode("stripe")} type="radio" value="stripe" />
                <span><strong>{copy.payOnline}</strong><small>{copy.payOnlineNote}</small></span>
                <span className="payment-mode-option__state">{copy.collectedNow}</span>
              </label>
              <label className={`payment-mode-option${paymentMode === "pay_at_hotel" ? " is-selected" : ""}`}>
                <input checked={paymentMode === "pay_at_hotel"} name="paymentMode" onChange={() => changePaymentMode("pay_at_hotel")} type="radio" value="pay_at_hotel" />
                <span><strong>{copy.payHotel}</strong><small>{copy.payHotelNote}</small></span>
                <span className="payment-mode-option__state">{copy.dueHotel}</span>
              </label>
            </fieldset>
            <fieldset className="consent-fieldset checkout-form__wide">
              <legend>{copy.legalConsent}</legend>
              <input name="termsVersion" type="hidden" value={LEGAL_VERSIONS.terms} />
              <input name="privacyPolicyVersion" type="hidden" value={LEGAL_VERSIONS.privacyPolicy} />
              <input name="cancellationPolicyVersion" type="hidden" value={LEGAL_VERSIONS.cancellationPolicy} />
              <label className="consent-option consent-option--required">
                <input name="pdpaConsent" required type="checkbox" />
                <span>
                  <strong>{copy.agree}</strong>
                  <small>
                    {copy.acceptPrefix}{" "}
                    <a href={localizePath(LEGAL_DOCUMENT_LINKS.terms, locale)} target="_blank" rel="noreferrer">{copy.bookingTerms}</a>,{" "}
                    <a href={localizePath(LEGAL_DOCUMENT_LINKS.privacyPolicy, locale)} target="_blank" rel="noreferrer">{copy.privacyPolicy}</a>,{" "}
                    <a href={localizePath(LEGAL_DOCUMENT_LINKS.cancellationPolicy, locale)} target="_blank" rel="noreferrer">{copy.cancellationPolicy}</a>{" "}
                    {copy.consentSuffix}
                  </small>
                </span>
              </label>
              <label className="consent-option">
                <input name="marketingConsent" type="checkbox" />
                <span>
                  <strong>{copy.offers}</strong>
                  <small>{copy.offersNote}</small>
                </span>
              </label>
              <p className="consent-fieldset__versions">
                {copy.versions}: {copy.terms} {LEGAL_VERSIONS.terms} · {copy.privacy} {LEGAL_VERSIONS.privacyPolicy} · {copy.cancellation} {LEGAL_VERSIONS.cancellationPolicy}
              </p>
            </fieldset>
          </form>
          {validationError ? (
            <div className="lookup-message lookup-message--error" role="alert">
              {validationError}
            </div>
          ) : null}
          <div className="checkout-card__footer">
            {holdState === "idle" ? (
              <button className="button button--primary" form="checkout-form" type="submit"><LockKeyhole aria-hidden="true" size={16} />{paymentMode === "stripe" ? copy.continuePayment : copy.confirmHotel}</button>
            ) : (
              <button className="button button--primary" disabled type="button">{copy.checkingShort}</button>
            )}
            <p>{paymentMode === "stripe" ? copy.partnerNote : copy.noOnlinePayment}</p>
          </div>
        </section>

        <aside aria-labelledby="stay-summary-heading" className="checkout-summary">
          <p className="eyebrow">{copy.staySummary}</p>
          {(() => {
            const catKey = room.slug === "classic" ? "classic" :
                           room.slug === "executive" ? "executive" :
                           room.name === "Deluxe Room" ? "deluxe-room" :
                           room.name === "Studio Suite" ? "studio-suite" :
                           room.name === "Executive Suite" ? "executive-suite" :
                           room.name === "Grand Residence" ? "grand-residence" : room.slug;
            const localizedRoom = (dictionary.booking.categories as Record<string, LocalizedRoomCategory>)[catKey] ?? room;
            const roomName = localizedRoom.name || room.name;
            return <h2 id="stay-summary-heading">{roomName}</h2>;
          })()}
          <dl>
            <div><dt>{copy.checkIn}</dt><dd>{formatDisplayDate(stayDates.checkIn)} · {copy.fromNoon}</dd></div>
            <div><dt>{copy.checkOut}</dt><dd>{formatDisplayDate(stayDates.checkOut)} · {copy.byNoon}</dd></div>
            <div><dt>{copy.guests}</dt><dd>{adults} {adults === 1 ? copy.adult : copy.adults}{childGuests ? `, ${childGuests} ${childGuests === 1 ? copy.child : copy.children}` : ""} · {rooms} {rooms === 1 ? copy.room : copy.rooms}</dd></div>
            {promoCode ? <div><dt>{copy.promoCode}</dt><dd>{promoCode}</dd></div> : null}
            <div><dt>{copy.payment}</dt><dd>{paymentMode === "stripe" ? copy.secureOnline : copy.dueHotel}</dd></div>
          </dl>
          <div className="price-lines">
            <div><span>{copy.roomSubtotal}</span><strong>{formatThaiBaht(pricing.baseSubtotal)}</strong></div>
            <div><span>{copy.serviceCharge}</span><strong>{formatThaiBaht(pricing.serviceCharge)}</strong></div>
            <div><span>{copy.vat}</span><strong>{formatThaiBaht(pricing.vat)}</strong></div>
            <div className="price-lines__total"><span>{paymentMode === "stripe" ? copy.totalNow : copy.totalHotel}</span><strong>{formatThaiBaht(total)}</strong></div>
          </div>
          <ul className="checkout-assurances">
            <li><CheckCircle2 aria-hidden="true" size={16} />{copy.localTime}</li>
            <li><CheckCircle2 aria-hidden="true" size={16} />{copy.holdTime}</li>
            <li><CheckCircle2 aria-hidden="true" size={16} />{paymentMode === "stripe" ? copy.stripeSecure : copy.noOnlineCollected}</li>
          </ul>
        </aside>
      </div>
    </main>
  );
}
