import { NextResponse } from "next/server";

import {
  checkoutFetchMetadataIsAllowed,
  checkoutOriginIsAllowed,
  checkoutRateLimitHeaders,
  consumeCheckoutHoldRateLimit,
  getClientIpAddress,
  type RateLimitDecision,
} from "@/lib/checkout-abuse-protection";
import { directRoomNameFromKey, isFamilyRoomKey } from "@/lib/guest-room-catalog";
import { calculateBookingPrice } from "@/lib/booking/pricing";
import { checkoutHoldRequestSchema, type CheckoutHoldRequest } from "@/lib/validation/checkout";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { checkoutHoldResultSchema } from "@/lib/booking/db-validation-schemas";

export const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

export function responseHeaders(extra?: Record<string, string>) {
  return {
    ...noStoreHeaders,
    ...extra,
  };
}

export type CheckoutHoldResult = Readonly<{
  allocation_mode: string;
  consent_recorded: boolean;
  currency: string;
  expires_at: string;
  hold_token: string;
  night_count: number;
  ok: boolean;
  payment_mode: "stripe" | "pay_at_hotel";
  rooms_requested: number;
  status: string;
  total_amount: number;
  booking_reference_id?: string;
}>;

export type CheckoutHoldSuccess = {
  isSuccess: true;
  checkout: CheckoutHoldRequest;
  hold: CheckoutHoldResult;
  pricing: ReturnType<typeof calculateBookingPrice>;
  rateLimitDecision: RateLimitDecision;
};

export type CheckoutHoldFailure = {
  isSuccess: false;
  errorResponse: NextResponse;
  rateLimitDecision?: RateLimitDecision;
};

export type CheckoutHoldWorkflowResult = CheckoutHoldSuccess | CheckoutHoldFailure;

export function databaseErrorResponse(message: string, extraHeaders?: Record<string, string>): NextResponse {
  if (message.includes("INSUFFICIENT_INVENTORY")) {
    return NextResponse.json(
      {
        code: "INSUFFICIENT_INVENTORY",
        error: "That room is no longer available for all selected dates. Please choose another room or different dates.",
      },
      { headers: responseHeaders(extraHeaders), status: 409 },
    );
  }

  if (message.includes("INVENTORY_COVERAGE_INCOMPLETE")) {
    return NextResponse.json(
      {
        code: "INVENTORY_TEMPORARILY_UNAVAILABLE",
        error: "This room is temporarily unavailable online. Please try again shortly or contact the hotel.",
      },
      { headers: responseHeaders({ ...extraHeaders, "Retry-After": "300" }), status: 503 },
    );
  }

  if (
    message.includes("Room type is not available") ||
    message.includes("Check-in cannot be earlier") ||
    message.includes("maximum stay")
  ) {
    return NextResponse.json(
      {
        code: "INVALID_CHECKOUT_REQUEST",
        error: "Please review your room and stay dates.",
      },
      { headers: responseHeaders(extraHeaders), status: 400 },
    );
  }

  return NextResponse.json(
    {
      code: "CHECKOUT_HOLD_UNAVAILABLE",
      error: "We could not protect this room just now. Please wait a moment and try again with the same details.",
    },
    { headers: responseHeaders({ ...extraHeaders, "Retry-After": "5" }), status: 503 },
  );
}

export function unavailableResponse(extraHeaders?: Record<string, string>): NextResponse {
  return NextResponse.json(
    {
      code: "CHECKOUT_HOLD_NOT_CONNECTED",
      error: "Online booking is being prepared. Please contact the hotel to reserve this stay.",
    },
    { headers: responseHeaders({ ...extraHeaders, "Retry-After": "3600" }), status: 503 },
  );
}


/**
 * Shared workflow function to validate, rate-limit, and execute a checkout hold in Supabase.
 */
export async function executeCheckoutHoldWorkflow(
  request: Request,
): Promise<CheckoutHoldWorkflowResult> {
  if (!checkoutOriginIsAllowed(request) || !checkoutFetchMetadataIsAllowed(request)) {
    return {
      isSuccess: false,
      errorResponse: NextResponse.json(
        {
          code: "CHECKOUT_HOLD_FORBIDDEN",
          error: "This booking request was blocked. Please start again from the hotel website.",
        },
        { headers: responseHeaders(), status: 403 },
      ),
    };
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (contentLength > 16_384) {
    return {
      isSuccess: false,
      errorResponse: NextResponse.json(
        { code: "INVALID_CHECKOUT_REQUEST", error: "The checkout request is too large." },
        { headers: responseHeaders(), status: 413 },
      ),
    };
  }

  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return {
      isSuccess: false,
      errorResponse: NextResponse.json(
        { code: "INVALID_CHECKOUT_REQUEST", error: "Please review your booking details." },
        { headers: responseHeaders(), status: 400 },
      ),
    };
  }

  const payloadObject =
    payload && typeof payload === "object" && !Array.isArray(payload)
      ? (payload as Record<string, unknown>)
      : null;
  const clientIp = getClientIpAddress(request);
  const rateLimitDecision = await consumeCheckoutHoldRateLimit(
    clientIp,
    typeof payloadObject?.idempotencyKey === "string" ? payloadObject.idempotencyKey : null,
  );

  const rateHeaders = checkoutRateLimitHeaders(rateLimitDecision);

  if (rateLimitDecision.retryAfterSeconds) {
    return {
      isSuccess: false,
      errorResponse: NextResponse.json(
        {
          code: "RATE_LIMITED",
          error: "Too many booking attempts were made from this network. Please wait and try again.",
        },
        {
          headers: responseHeaders(rateHeaders),
          status: 429,
        },
      ),
      rateLimitDecision,
    };
  }

  const parsed = checkoutHoldRequestSchema.safeParse(payload);

  if (!parsed.success) {
    return {
      isSuccess: false,
      errorResponse: NextResponse.json(
        {
          code: "INVALID_CHECKOUT_REQUEST",
          error: parsed.error.issues[0]?.message ?? "Please review your booking details.",
        },
        { headers: responseHeaders(rateHeaders), status: 400 },
      ),
      rateLimitDecision,
    };
  }

  const supabase = createSupabaseServiceRoleClient();

  if (process.env.CHECKOUT_HOLD_LIVE_ENABLED !== "true" || !supabase) {
    return {
      isSuccess: false,
      errorResponse: unavailableResponse(rateHeaders),
      rateLimitDecision,
    };
  }

  const checkout = parsed.data;
  const directRoomName = directRoomNameFromKey(checkout.roomCategory);
  let roomTypeId = checkout.roomCategory;

  if (directRoomName) {
    const { data: roomType, error: roomTypeError } = await supabase
      .from("room_types")
      .select("id")
      .eq("name", directRoomName)
      .eq("is_active", true)
      .maybeSingle();

    if (roomTypeError || !roomType?.id) {
      return {
        isSuccess: false,
        errorResponse: databaseErrorResponse("Room type is not available", rateHeaders),
        rateLimitDecision,
      };
    }

    roomTypeId = roomType.id;
  }

  const holdArgs = {
    p_adults: checkout.adults,
    p_cancellation_policy_version: checkout.cancellationPolicyVersion,
    p_check_in: checkout.checkIn,
    p_check_out: checkout.checkOut,
    p_children: checkout.children,
    p_consent_ip_address: clientIp,
    p_consent_user_agent: request.headers.get("user-agent"),
    p_customer_email: checkout.guestEmail,
    p_customer_name: checkout.guestName,
    p_customer_phone: checkout.guestPhone,
    p_idempotency_key: checkout.idempotencyKey,
    p_marketing_consent: checkout.marketingConsent,
    p_payment_mode: checkout.paymentMode,
    p_pdpa_consent: checkout.pdpaConsent,
    p_privacy_policy_version: checkout.privacyPolicyVersion,
    p_promo_code: checkout.promoCode,
    p_rooms_requested: checkout.rooms,
    p_terms_version: checkout.termsVersion,
  } as const;

  const { data, error } = isFamilyRoomKey(checkout.roomCategory)
    ? await supabase.rpc("create_category_checkout_hold_with_context", {
        ...holdArgs,
        p_room_category: checkout.roomCategory,
      })
    : await supabase.rpc("create_checkout_hold_with_context", {
        ...holdArgs,
        p_room_type_id: roomTypeId,
      });

  if (error) {
    return {
      isSuccess: false,
      errorResponse: databaseErrorResponse(error.message, rateHeaders),
      rateLimitDecision,
    };
  }

  const parsedHold = checkoutHoldResultSchema.safeParse(data);

  if (!parsedHold.success) {
    return {
      isSuccess: false,
      errorResponse: databaseErrorResponse("INVALID_HOLD_SCHEMA", rateHeaders),
      rateLimitDecision,
    };
  }

  const hold = parsedHold.data;

  if (hold && !hold.ok) {
    return {
      isSuccess: false,
      errorResponse: NextResponse.json(
        {
          code: "CHECKOUT_HOLD_STALE",
          error: "This protected checkout window has ended. Please try again to refresh room availability.",
        },
        { headers: responseHeaders(rateHeaders), status: 409 },
      ),
      rateLimitDecision,
    };
  }

  if (!hold?.hold_token || !hold.consent_recorded) {
    return {
      isSuccess: false,
      errorResponse: databaseErrorResponse("INVALID_HOLD_RESULT", rateHeaders),
      rateLimitDecision,
    };
  }

  const pricing = calculateBookingPrice(hold.total_amount);
  const { error: pricingUpdateError } = await supabase
    .from("checkout_holds")
    .update({ total_amount: pricing.grandTotal })
    .eq("public_token", hold.hold_token)
    .eq("status", "active");

  if (pricingUpdateError) {
    return {
      isSuccess: false,
      errorResponse: databaseErrorResponse("PRICE_FINALIZATION_FAILED", rateHeaders),
      rateLimitDecision,
    };
  }

  return {
    isSuccess: true,
    checkout,
    hold,
    pricing,
    rateLimitDecision,
  };
}
