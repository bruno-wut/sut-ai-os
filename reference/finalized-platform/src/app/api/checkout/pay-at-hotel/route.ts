import { NextResponse } from "next/server";
import { z } from "zod";

import {
  checkoutFetchMetadataIsAllowed,
  checkoutOriginIsAllowed,
  checkoutRateLimitHeaders,
  consumeCheckoutHoldRateLimit,
  getClientIpAddress,
} from "@/lib/checkout-abuse-protection";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkoutGuestSchema } from "@/lib/validation/checkout";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

const payAtHotelFinalizeSchema = checkoutGuestSchema.extend({
  holdToken: z.uuid(),
});

function responseHeaders(extra?: Record<string, string>) {
  return {
    ...noStoreHeaders,
    ...extra,
  };
}

export async function POST(request: Request) {
  if (!checkoutOriginIsAllowed(request) || !checkoutFetchMetadataIsAllowed(request)) {
    return NextResponse.json(
      {
        code: "CHECKOUT_HOLD_FORBIDDEN",
        error: "This booking request was blocked. Please start again from the hotel website.",
      },
      { headers: responseHeaders(), status: 403 },
    );
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { code: "INVALID_CHECKOUT_REQUEST", error: "Please review your booking details." },
      { headers: responseHeaders(), status: 400 },
    );
  }

  const payloadObject =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  const rateLimitDecision = await consumeCheckoutHoldRateLimit(
    getClientIpAddress(request),
    typeof payloadObject?.holdToken === "string" ? payloadObject.holdToken : null,
  );

  if (rateLimitDecision.retryAfterSeconds) {
    return NextResponse.json(
      {
        code: "RATE_LIMITED",
        error: "Too many booking attempts were made from this network. Please wait and try again.",
      },
      {
        headers: responseHeaders(checkoutRateLimitHeaders(rateLimitDecision)),
        status: 429,
      },
    );
  }

  const parsed = payAtHotelFinalizeSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "INVALID_CHECKOUT_REQUEST",
        error: parsed.error.issues[0]?.message ?? "Please review your booking details.",
      },
      { headers: responseHeaders(checkoutRateLimitHeaders(rateLimitDecision)), status: 400 },
    );
  }

  const supabase = createSupabaseServiceRoleClient();

  if (process.env.CHECKOUT_HOLD_LIVE_ENABLED !== "true" || !supabase) {
    return NextResponse.json(
      {
        code: "CHECKOUT_HOLD_NOT_CONNECTED",
        error: "Online booking is being prepared. Please contact the hotel to reserve this stay.",
      },
      { headers: responseHeaders({ ...checkoutRateLimitHeaders(rateLimitDecision), "Retry-After": "3600" }), status: 503 },
    );
  }

  const { data, error } = await supabase.rpc("finalize_pay_at_hotel_checkout_hold", {
    p_guest_email: parsed.data.guestEmail,
    p_guest_name: parsed.data.guestName,
    p_guest_phone: parsed.data.guestPhone,
    p_hold_token: parsed.data.holdToken,
  });

  if (error) {
    if (error.message.includes("HOLD_NOT_ACTIVE") || error.message.includes("HOLD_NOT_FOUND")) {
      return NextResponse.json(
        {
          code: "CHECKOUT_HOLD_STALE",
          error: "This protected checkout window has ended. Please try again to refresh room availability.",
        },
        { headers: responseHeaders(checkoutRateLimitHeaders(rateLimitDecision)), status: 409 },
      );
    }

    return NextResponse.json(
      {
        code: "PAY_AT_HOTEL_FINALIZATION_FAILED",
        error: "We could not complete this booking just now. Please contact front desk operations.",
      },
      { headers: responseHeaders({ ...checkoutRateLimitHeaders(rateLimitDecision), "Retry-After": "10" }), status: 503 },
    );
  }

  const result = data as { ok?: boolean };

  if (!result?.ok) {
    return NextResponse.json(
      {
        code: "PAY_AT_HOTEL_FINALIZATION_FAILED",
        error: "We could not complete this booking just now. Please contact front desk operations.",
      },
      { headers: responseHeaders({ ...checkoutRateLimitHeaders(rateLimitDecision), "Retry-After": "10" }), status: 503 },
    );
  }

  return NextResponse.json(
    {
      confirmationUrl: `/confirmation?mode=pay_at_hotel&hold_token=${encodeURIComponent(parsed.data.holdToken)}`,
    },
    { headers: responseHeaders(checkoutRateLimitHeaders(rateLimitDecision)), status: 201 },
  );
}
