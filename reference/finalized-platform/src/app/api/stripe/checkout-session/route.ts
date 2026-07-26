import { NextResponse } from "next/server";
import Stripe from "stripe";

import {
  checkoutRateLimitHeaders,
} from "@/lib/checkout-abuse-protection";
import {
  executeCheckoutHoldWorkflow,
  responseHeaders,
} from "@/lib/booking/create-checkout-hold";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

function getAppUrl(requestUrl: string) {
  return (process.env.NEXT_PUBLIC_APP_URL ?? new URL(requestUrl).origin).replace(/\/+$/, "");
}

function getStripeCheckoutLogoUrl(appUrl: string) {
  const configuredLogoUrl = process.env.STRIPE_CHECKOUT_LOGO_URL?.trim();

  if (configuredLogoUrl) {
    try {
      const logoUrl = new URL(configuredLogoUrl);

      if (logoUrl.protocol === "https:") {
        return logoUrl.toString();
      }
    } catch {
      // Fall back to the app-hosted wordmark for a malformed deployment value.
    }
  }

  return new URL("/images/sri-u-thong-wordmark.png", appUrl).toString();
}

function getCheckoutReturnUrl(
  appUrl: string,
  locale: "en" | "th",
  checkout: {
    adults: number;
    checkIn: string;
    checkOut: string;
    children: number;
    promoCode: string | null;
    roomCategory: string;
    rooms: number;
  },
) {
  const params = new URLSearchParams({
    adults: checkout.adults.toString(),
    checkIn: checkout.checkIn,
    checkOut: checkout.checkOut,
    children: checkout.children.toString(),
    room: checkout.roomCategory,
    rooms: checkout.rooms.toString(),
  });

  if (checkout.promoCode) {
    params.set("promoCode", checkout.promoCode);
  }

  return `${appUrl}/${locale}/checkout?${params.toString()}`;
}

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const appUrl = getAppUrl(request.url);
  const hotelId = process.env.HOTEL_ID;

  if (!stripeSecretKey || !hotelId) {
    return NextResponse.json(
      { code: "STRIPE_NOT_CONFIGURED", error: "Stripe Checkout is not configured." },
      { headers: responseHeaders(), status: 503 },
    );
  }

  const result = await executeCheckoutHoldWorkflow(request);

  if (result.isSuccess === false) {
    return result.errorResponse;
  }

  const { checkout, hold, pricing, rateLimitDecision } = result;
  const rateHeaders = checkoutRateLimitHeaders(rateLimitDecision);

  if (hold.payment_mode !== "stripe") {
    return NextResponse.json(
      {
        code: "PAYMENT_MODE_UNAVAILABLE",
        error: "This checkout request is not set to Stripe payment.",
      },
      { headers: responseHeaders(rateHeaders), status: 400 },
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  const currentLocale = checkout.locale;
  const stripeLocale = currentLocale === "th" ? "th" : "en";
  const expiresAt = Math.floor(Date.now() / 1000) + (35 * 60);

  const session = await stripe.checkout.sessions.create({
    allow_promotion_codes: true,
    branding_settings: {
      background_color: "#fffdf8",
      border_style: "rounded",
      button_color: "#2c2a29",
      display_name: "Sri U-Thong Grand Hotel",
      logo: {
        type: "url",
        url: getStripeCheckoutLogoUrl(appUrl),
      },
    },
    cancel_url: getCheckoutReturnUrl(appUrl, checkout.locale, checkout),
    client_reference_id: hold.hold_token,
    currency: "thb",
    customer_email: checkout.guestEmail,
    expires_at: expiresAt,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "thb",
          product_data: {
            name: "Base Room Subtotal (THB)",
            description: `${hold.night_count} night${hold.night_count === 1 ? "" : "s"} · ${hold.rooms_requested} room${hold.rooms_requested === 1 ? "" : "s"}`,
          },
          unit_amount: pricing.baseSubtotal * 100,
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "thb",
          product_data: {
            name: "Hotel Service Charge (10%)",
          },
          unit_amount: pricing.serviceCharge * 100,
        },
      },
      {
        quantity: 1,
        price_data: {
          currency: "thb",
          product_data: {
            name: "VAT (7%)",
          },
          unit_amount: pricing.vat * 100,
        },
      },
    ],
    locale: stripeLocale,
    metadata: {
      adults: checkout.adults.toString(),
      check_in: checkout.checkIn,
      check_out: checkout.checkOut,
      children: checkout.children.toString(),
      grand_total: pricing.grandTotal.toString(),
      guest_name: checkout.guestName,
      guest_phone: checkout.guestPhone,
      hold_id: hold.hold_token,
      hold_token: hold.hold_token,
      hotel_id: hotelId,
      locale: checkout.locale,
      promo_code: checkout.promoCode ?? "",
      room_category: checkout.roomCategory,
      rooms: checkout.rooms.toString(),
      booking_reference_id: hold.booking_reference_id ?? "",
    },
    mode: "payment",
    payment_method_types: ["card", "promptpay"],
    phone_number_collection: { enabled: false },
    success_url: `${appUrl}/${checkout.locale}/confirmation?mode=stripe&session_id={CHECKOUT_SESSION_ID}`,
  });

  return NextResponse.json(
    {
      checkoutSessionId: session.id,
      url: session.url,
    },
    { headers: responseHeaders(rateHeaders), status: 201 },
  );
}
