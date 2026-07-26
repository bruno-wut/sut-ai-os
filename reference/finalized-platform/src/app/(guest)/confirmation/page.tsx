import { ConfirmationExperience } from "@/components/booking/confirmation-experience";
import { logger } from "@/lib/logger";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import Stripe from "stripe";

type ConfirmationPageProps = Readonly<{
  searchParams: Promise<{ hold_token?: string; mode?: string; reservation?: string; session_id?: string }>;
}>;

export default async function ConfirmationPage({ searchParams }: ConfirmationPageProps) {
  const { hold_token: holdToken, mode, reservation, session_id: sessionId } = await searchParams;

  let displayReservation = reservation;

  if (!displayReservation) {
    if (mode !== "pay_at_hotel" && sessionId) {
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
      if (stripeSecretKey) {
        try {
          const stripe = new Stripe(stripeSecretKey, {
            httpClient: Stripe.createFetchHttpClient(),
          });
          const session = await stripe.checkout.sessions.retrieve(sessionId);
          if (session.metadata?.booking_reference_id) {
            displayReservation = session.metadata.booking_reference_id;
          }
        } catch (err) {
          logger.error("Failed to retrieve Stripe session in confirmation", {
            error: err instanceof Error ? err.message : String(err),
            sessionId,
          });
        }
      }
    }

    if (!displayReservation && holdToken) {
      const supabase = createSupabaseServiceRoleClient();
      if (supabase) {
        try {
          const { data } = await supabase
            .from("checkout_holds")
            .select("booking_reference_id")
            .eq("public_token", holdToken)
            .maybeSingle();
          if (data?.booking_reference_id) {
            displayReservation = data.booking_reference_id;
          }
        } catch (err) {
          logger.error("Failed to retrieve hold booking_reference_id in confirmation", {
            error: err instanceof Error ? err.message : String(err),
            holdToken,
          });
        }
      }
    }
  }

  return (
    <ConfirmationExperience
      holdToken={holdToken}
      paymentMode={mode === "pay_at_hotel" ? "pay_at_hotel" : "stripe"}
      reservationNumber={displayReservation}
      sessionId={sessionId}
    />
  );
}
