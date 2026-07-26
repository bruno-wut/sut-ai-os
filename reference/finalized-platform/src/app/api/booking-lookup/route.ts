import { NextResponse } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Stripe from "stripe";
import { z } from "zod";

import {
  checkoutRateLimitHeaders,
  consumeBookingLookupRateLimit,
  getClientIpAddress,
} from "@/lib/checkout-abuse-protection";
import { getBangkokDateString } from "@/lib/hotel-dates";
import { HOTEL_FACTS } from "@/lib/hotel-facts";
import { getCorrelationId, logger } from "@/lib/logger";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getStripeCheckoutFinalization } from "@/lib/stripe/webhook";
import {
  finalizationResultSchema,
  hotelContactRowSchema,
  lookupResultSchema,
  reservationStatusRowSchema,
  type HotelContactRow,
  type ReservationStatusRow,
} from "@/lib/booking/db-validation-schemas";

export const dynamic = "force-dynamic";

const lookupSchema = z.object({
  bookingReferenceId: z
    .string()
    .trim()
    .min(6, "Enter your booking reference.")
    .max(64, "Booking reference is too long.")
    .regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/, "Use only letters, numbers, and hyphens."),
  email: z.string().trim().email("Enter the email used for the booking.").max(320),
});

const stripeSessionLookupSchema = z.object({
  sessionId: z
    .string()
    .trim()
    .min(8)
    .max(255)
    .regex(/^cs_(test|live)_[a-zA-Z0-9_]+$/),
});

const holdTokenLookupSchema = z.object({
  holdToken: z.uuid(),
});

type LookupResult = Readonly<{
  bookingReferenceId: string;
  reservationNumber: string;
  status: "pending" | "confirmed" | "completed" | "cancelled";
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

type StripeCheckoutMetadata = Readonly<{
  booking_reference_id?: string;
  check_in?: string;
  check_out?: string;
  guest_email?: string;
  hold_token?: string;
  hotel_id?: string;
  room_category?: string;
  rooms?: string;
}>;

const noStoreHeaders = {
  "Cache-Control": "no-store, max-age=0",
};

const genericLookupError = "Booking details could not be verified. Please contact front desk operations.";

function maskedNotFound() {
  return NextResponse.json(
    { error: genericLookupError },
    { headers: noStoreHeaders, status: 404 },
  );
}

function rateLimitedLookup(rateLimitDecision: Awaited<ReturnType<typeof consumeBookingLookupRateLimit>>) {
  return NextResponse.json(
    { code: "RATE_LIMITED", error: genericLookupError },
    {
      headers: {
        ...noStoreHeaders,
        ...checkoutRateLimitHeaders(rateLimitDecision),
      },
      status: 429,
    },
  );
}

function roomCategoryLabel(value: string | undefined) {
  switch (value) {
    case "classic":
      return "Classic Room";
    case "executive":
      return "Executive Room";
    case "deluxe-room":
      return "Deluxe Room";
    case "studio-suite":
      return "Studio Suite";
    case "executive-suite":
      return "Executive Suite";
    case "grand-residence":
      return "Grand Residence";
    default:
      return "Selected room tier";
  }
}

function pendingStripeLookup(metadata: StripeCheckoutMetadata, fallbackReferenceId?: string): LookupResult {
  return {
    bookingReferenceId: fallbackReferenceId || metadata.booking_reference_id || "Issued shortly",
    reservationNumber: "Issued shortly",
    status: "pending",
    statusLabel: "Payment received",
    roomCategory: roomCategoryLabel(metadata.room_category),
    rooms: Number(metadata.rooms) || 1,
    checkInDate: metadata.check_in ?? "",
    checkOutDate: metadata.check_out ?? "",
    paymentMode: "stripe",
    paymentSummary: "Payment collected",
    updatedAt: new Date().toISOString(),
    hotel: {
      name: HOTEL_FACTS.name,
      phone: HOTEL_FACTS.phone,
      address: HOTEL_FACTS.address,
    },
  };
}

function publicStatusForReservation(reservation: ReservationStatusRow): LookupResult["status"] {
  if (reservation.sync_status === "Cancelled") return "cancelled";
  if (reservation.sync_status === "Synced" && reservation.check_out_date < getBangkokDateString()) {
    return "completed";
  }
  if (reservation.sync_status === "Synced") return "confirmed";
  return "pending";
}

function statusLabelFor(status: LookupResult["status"]) {
  switch (status) {
    case "cancelled":
      return "Booking cancelled";
    case "completed":
      return "Stay completed";
    case "confirmed":
      return "Confirmed by hotel";
    case "pending":
    default:
      return "Booking received";
  }
}

function paymentSummaryFor(reservation: ReservationStatusRow) {
  if (reservation.payment_status === "collected") return "Payment collected";
  if (reservation.payment_mode === "pay_at_hotel" && reservation.payment_status === "not_collected") {
    return "Payment due at hotel";
  }
  if (reservation.payment_status === "refunded") return "Payment refunded";
  return "Payment pending";
}

function safeReservationLookup(reservation: ReservationStatusRow, hotel: HotelContactRow | null): LookupResult {
  const status = publicStatusForReservation(reservation);

  return {
    bookingReferenceId: reservation.booking_reference_id ?? reservation.reservation_number,
    reservationNumber: reservation.reservation_number,
    status,
    statusLabel: statusLabelFor(status),
    roomCategory: reservation.room_type,
    rooms: reservation.rooms_requested,
    checkInDate: reservation.check_in_date,
    checkOutDate: reservation.check_out_date,
    paymentMode: reservation.payment_mode,
    paymentSummary: paymentSummaryFor(reservation),
    updatedAt: reservation.updated_at,
    hotel: {
      name: hotel?.hotel_name ?? HOTEL_FACTS.name,
      phone: hotel?.public_contact_phone ?? HOTEL_FACTS.phone,
      address: hotel?.public_contact_address ?? HOTEL_FACTS.address,
    },
  };
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Please enter your booking reference and email." },
      { headers: noStoreHeaders, status: 400 },
    );
  }

  const sessionLookup = stripeSessionLookupSchema.safeParse(payload);

  if (sessionLookup.success) {
    return lookupStripeCheckoutSession(request, sessionLookup.data.sessionId);
  }

  const holdTokenLookup = holdTokenLookupSchema.safeParse(payload);

  if (holdTokenLookup.success) {
    return lookupPayAtHotelHold(request, holdTokenLookup.data.holdToken);
  }

  if (typeof payload === "object" && payload !== null && "sessionId" in payload) {
    return maskedNotFound();
  }

  if (typeof payload === "object" && payload !== null && "holdToken" in payload) {
    return maskedNotFound();
  }

  const parsed = lookupSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Please check your lookup details." },
      { headers: noStoreHeaders, status: 400 },
    );
  }

  const bookingReferenceId = parsed.data.bookingReferenceId.toUpperCase();
  const email = parsed.data.email.toLowerCase();
  const rateLimitDecision = await consumeBookingLookupRateLimit(getClientIpAddress(request));

  if (rateLimitDecision.retryAfterSeconds) {
    return rateLimitedLookup(rateLimitDecision);
  }

  const supabase = createSupabaseServiceRoleClient();

  if (!supabase) {
    return maskedNotFound();
  }

  const { data, error } = await supabase.rpc("lookup_guest_reservation", {
    p_booking_reference_id: bookingReferenceId,
    p_guest_email: email,
  });

  if (error) {
    if (error.message.includes("BOOKING_LOOKUP_PII_SCRUBBED")) {
      return NextResponse.json(
        { error: "Your booking details have been securely archived in accordance with our privacy policies." },
        { headers: noStoreHeaders, status: 404 },
      );
    }

    if (error.message.includes("BOOKING_LOOKUP_NOT_FOUND") || error.message.includes("INVALID_LOOKUP_INPUT")) {
      const fallbackHold = await lookupFallbackCheckoutHold(supabase, bookingReferenceId, email);
      if (fallbackHold) {
        return NextResponse.json({ booking: fallbackHold }, { headers: noStoreHeaders });
      }
      return maskedNotFound();
    }

    return NextResponse.json(
      { error: "Booking lookup is temporarily unavailable. Please contact the hotel." },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  const parsedBooking = lookupResultSchema.safeParse(data);

  if (!parsedBooking.success) {
    return maskedNotFound();
  }

  return NextResponse.json({ booking: parsedBooking.data }, { headers: noStoreHeaders });
}

async function lookupPayAtHotelHold(request: Request, holdToken: string) {
  const rateLimitDecision = await consumeBookingLookupRateLimit(getClientIpAddress(request));

  if (rateLimitDecision.retryAfterSeconds) {
    return rateLimitedLookup(rateLimitDecision);
  }

  const supabase = createSupabaseServiceRoleClient();

  if (!supabase) {
    return maskedNotFound();
  }

  const holdResult = await supabase
    .from("checkout_holds")
    .select("converted_reservation_id")
    .eq("public_token", holdToken)
    .eq("payment_mode", "pay_at_hotel")
    .maybeSingle();

  if (holdResult.error || !holdResult.data?.converted_reservation_id) {
    return maskedNotFound();
  }

  const reservationResult = await supabase
    .from("web_reservations")
    .select("booking_reference_id, reservation_number, sync_status, room_type, rooms_requested, check_in_date, check_out_date, payment_mode, payment_status, updated_at, hotel_id")
    .eq("id", holdResult.data.converted_reservation_id)
    .maybeSingle();

  const parsedReservation = reservationStatusRowSchema.safeParse(reservationResult.data);

  if (!parsedReservation.success) {
    return maskedNotFound();
  }

  const reservation = parsedReservation.data;
  const hotelResult = await supabase
    .from("hotel_settings")
    .select("hotel_name, public_contact_phone, public_contact_address")
    .eq("id", reservation.hotel_id)
    .maybeSingle();

  if (hotelResult.error) {
    return NextResponse.json(
      { error: "Booking lookup is temporarily unavailable. Please contact front desk operations." },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  const parsedHotel = hotelResult.data ? hotelContactRowSchema.safeParse(hotelResult.data) : null;
  const hotelContact = parsedHotel?.success ? parsedHotel.data : null;

  return NextResponse.json(
    { booking: safeReservationLookup(reservation, hotelContact) },
    { headers: noStoreHeaders },
  );
}

async function lookupStripeCheckoutSession(request: Request, sessionId: string) {
  const rateLimitDecision = await consumeBookingLookupRateLimit(getClientIpAddress(request));

  if (rateLimitDecision.retryAfterSeconds) {
    return rateLimitedLookup(rateLimitDecision);
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  const hotelId = process.env.HOTEL_ID;
  const supabase = createSupabaseServiceRoleClient();

  if (!stripeSecretKey || !hotelId || !supabase) {
    return maskedNotFound();
  }

  const existingReservation = await supabase
    .from("web_reservations")
    .select("booking_reference_id, reservation_number, guest_email")
    .eq("stripe_session_id", sessionId)
    .maybeSingle();

  if (existingReservation.data) {
    const reference =
      existingReservation.data.booking_reference_id ||
      existingReservation.data.reservation_number;

    if (reference) {
      const { data, error } = await supabase.rpc("lookup_guest_reservation", {
        p_booking_reference_id: reference,
        p_guest_email: existingReservation.data.guest_email,
      });

      if (error) {
        if (error.message.includes("BOOKING_LOOKUP_PII_SCRUBBED")) {
          return NextResponse.json(
            { error: "Your booking details have been securely archived in accordance with our privacy policies." },
            { headers: noStoreHeaders, status: 404 },
          );
        }
        return maskedNotFound();
      }

      const parsedLookup = lookupResultSchema.safeParse(data);
      if (!parsedLookup.success) {
        return maskedNotFound();
      }

      return NextResponse.json({ booking: parsedLookup.data }, { headers: noStoreHeaders });
    }
  }

  const stripe = new Stripe(stripeSecretKey, {
    httpClient: Stripe.createFetchHttpClient(),
  });
  let session: Stripe.Checkout.Session;

  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return maskedNotFound();
  }

  const metadata = (session.metadata ?? {}) as StripeCheckoutMetadata;
  const guestEmail = (
    session.customer_details?.email?.trim() ||
    session.customer_email?.trim() ||
    metadata.guest_email?.trim()
  )?.toLowerCase();

  if (
    session.id !== sessionId ||
    session.mode !== "payment" ||
    session.payment_status !== "paid" ||
    session.status !== "complete" ||
    metadata.hotel_id !== hotelId ||
    !guestEmail ||
    !metadata.hold_token
  ) {
    return maskedNotFound();
  }

  const reservationResult = await supabase
    .from("web_reservations")
    .select("booking_reference_id, reservation_number")
    .eq("stripe_session_id", session.id)
    .maybeSingle();

  const reference =
    reservationResult.data?.booking_reference_id ||
    reservationResult.data?.reservation_number;

  if (!reference) {
    let bookingReferenceId = metadata.booking_reference_id;
    if (!bookingReferenceId && metadata.hold_token) {
      try {
        const { data: hold } = await supabase
          .from("checkout_holds")
          .select("booking_reference_id")
          .eq("public_token", metadata.hold_token)
          .maybeSingle();
        if (hold?.booking_reference_id) {
          bookingReferenceId = hold.booking_reference_id;
        }
      } catch (err) {
        logger.error("Failed to query fallback booking_reference_id from hold", {
          correlationId: getCorrelationId(request),
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    try {
      const parameters = getStripeCheckoutFinalization(session);
      const { data: finalizationData, error: finalizationError } = await supabase.rpc(
        "finalize_paid_checkout_hold",
        parameters,
      );

      const parsedFinalization = finalizationResultSchema.safeParse(finalizationData);
      const result = parsedFinalization.success ? parsedFinalization.data : null;

      if (!finalizationError && result?.ok) {
        if (process.env.CRON_SECRET) {
          try {
            const processPromise = fetch(new URL("/api/notifications/process", request.url).href, {
              method: "POST",
              headers: { authorization: `Bearer ${process.env.CRON_SECRET}` },
            }).catch(() => {});

            try {
              const cfContext = getCloudflareContext();
              if (cfContext?.ctx?.waitUntil) {
                cfContext.ctx.waitUntil(processPromise);
              }
            } catch {
              // Context is unavailable in local vitest or non-Cloudflare environments
            }
          } catch {
            // Ignore background notification trigger errors
          }
        }

        const { data: finalizedLookup } = await supabase.rpc("lookup_guest_reservation", {
          p_booking_reference_id: bookingReferenceId || "",
          p_guest_email: guestEmail,
        });

        const parsedFinalizedLookup = lookupResultSchema.safeParse(finalizedLookup);
        if (parsedFinalizedLookup.success) {
          return NextResponse.json({ booking: parsedFinalizedLookup.data }, { headers: noStoreHeaders });
        }
      }
    } catch (err) {
      logger.error("Synchronous finalization failed", {
        correlationId: getCorrelationId(request),
        error: err instanceof Error ? err.message : String(err),
      });
    }

    const pendingLookup = pendingStripeLookup(metadata, bookingReferenceId);

    return NextResponse.json(
      { booking: pendingLookup, pending: true },
      { headers: noStoreHeaders },
    );
  }

  const { data, error } = await supabase.rpc("lookup_guest_reservation", {
    p_booking_reference_id: reference,
    p_guest_email: guestEmail,
  });

  if (error) {
    if (error.message.includes("BOOKING_LOOKUP_PII_SCRUBBED")) {
      return NextResponse.json(
        { error: "Your booking details have been securely archived in accordance with our privacy policies." },
        { headers: noStoreHeaders, status: 404 },
      );
    }

    if (error.message.includes("BOOKING_LOOKUP_NOT_FOUND") || error.message.includes("INVALID_LOOKUP_INPUT")) {
      return maskedNotFound();
    }

    return NextResponse.json(
      { error: "Booking lookup is temporarily unavailable. Please contact front desk operations." },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  const parsedLookup = lookupResultSchema.safeParse(data);
  if (!parsedLookup.success) {
    return maskedNotFound();
  }

  return NextResponse.json({ booking: parsedLookup.data }, { headers: noStoreHeaders });
}

async function lookupFallbackCheckoutHold(
  supabase: NonNullable<ReturnType<typeof createSupabaseServiceRoleClient>>,
  bookingReferenceId: string,
  email: string,
): Promise<LookupResult | null> {
  try {
    const { data: hold, error } = await supabase
      .from("checkout_holds")
      .select(`
        booking_reference_id,
        status,
        check_in_date,
        check_out_date,
        total_amount,
        currency,
        rooms_requested,
        payment_mode,
        customer_email,
        room_types ( name )
      `)
      .eq("booking_reference_id", bookingReferenceId)
      .maybeSingle();

    if (error || !hold) return null;

    if (hold.customer_email?.toLowerCase() !== email.toLowerCase()) {
      return null;
    }

    // Only allow lookups for active holds to prevent displaying expired ones
    if (hold.status !== "active") {
      return null;
    }

    const roomTypeObj = hold.room_types as unknown as { name: string } | null;
    const roomCategory = roomTypeObj?.name || "Selected room tier";

    return {
      bookingReferenceId: hold.booking_reference_id,
      reservationNumber: "Issued shortly",
      status: "pending",
      statusLabel: hold.payment_mode === "stripe" ? "Payment processing" : "Booking received",
      roomCategory,
      rooms: hold.rooms_requested,
      checkInDate: hold.check_in_date,
      checkOutDate: hold.check_out_date,
      paymentMode: hold.payment_mode,
      paymentSummary: hold.payment_mode === "stripe" ? "Payment pending confirmation" : "Payment due at hotel",
      updatedAt: new Date().toISOString(),
      hotel: {
        name: HOTEL_FACTS.name,
        phone: HOTEL_FACTS.phone,
        address: HOTEL_FACTS.address,
      },
    };
  } catch (err) {
    logger.error("Fallback checkout hold lookup failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
