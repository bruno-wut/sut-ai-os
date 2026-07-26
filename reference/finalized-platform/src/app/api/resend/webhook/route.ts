import { NextResponse } from "next/server";
import { Resend, type WebhookEventPayload } from "resend";
import { z } from "zod";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
const mutationResultSchema = z.object({
  duplicate: z.boolean(),
  ignored: z.boolean(),
  matched: z.boolean().optional(),
  ok: z.literal(true),
});
const outboundEmailDataSchema = z.object({
  email_id: z.string().min(1),
  to: z.array(z.string().email()).min(1),
});

function eventDetails(event: WebhookEventPayload) {
  if (event.type === "email.bounced") return { bounce: event.data.bounce };
  if (event.type === "email.failed") return { failed: event.data.failed };
  if (event.type === "email.suppressed") return { suppressed: event.data.suppressed };
  return {};
}

function suppression(event: WebhookEventPayload) {
  if (event.type === "email.complained") {
    return { reason: "Recipient reported the message as spam.", shouldSuppress: true };
  }
  if (event.type === "email.suppressed") {
    return { reason: event.data.suppressed.message, shouldSuppress: true };
  }
  if (event.type === "email.bounced" && event.data.bounce.type.toLowerCase() === "permanent") {
    return { reason: event.data.bounce.message, shouldSuppress: true };
  }
  return { reason: null, shouldSuppress: false };
}

export async function POST(request: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  const supabase = createSupabaseServiceRoleClient();

  if (!apiKey || !webhookSecret || !supabase) {
    return NextResponse.json(
      { code: "RESEND_WEBHOOK_NOT_CONFIGURED", error: "Email delivery webhook is not configured." },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  const webhookId = request.headers.get("svix-id");
  const timestamp = request.headers.get("svix-timestamp");
  const signature = request.headers.get("svix-signature");
  if (!webhookId || !timestamp || !signature) {
    return NextResponse.json(
      { code: "INVALID_WEBHOOK_SIGNATURE", error: "Invalid webhook signature." },
      { headers: noStoreHeaders, status: 400 },
    );
  }

  const payload = await request.text();
  let event: WebhookEventPayload;
  try {
    event = new Resend(apiKey).webhooks.verify({
      payload,
      headers: { id: webhookId, signature, timestamp },
      webhookSecret,
    });
  } catch {
    return NextResponse.json(
      { code: "INVALID_WEBHOOK_SIGNATURE", error: "Invalid webhook signature." },
      { headers: noStoreHeaders, status: 400 },
    );
  }

  if (!event.type.startsWith("email.") || event.type === "email.received") {
    return NextResponse.json({ ignored: true }, { headers: noStoreHeaders });
  }

  const outboundData = outboundEmailDataSchema.safeParse(event.data);
  if (!outboundData.success) {
    return NextResponse.json(
      { code: "INVALID_WEBHOOK_PAYLOAD", error: "Invalid email delivery event." },
      { headers: noStoreHeaders, status: 400 },
    );
  }

  const recipient = outboundData.data.to[0];
  const suppressionDecision = suppression(event);
  const result = await supabase.rpc("record_resend_email_event", {
    p_details: eventDetails(event),
    p_event_type: event.type,
    p_occurred_at: event.created_at,
    p_provider_delivery_id: outboundData.data.email_id,
    p_recipient: recipient,
    p_should_suppress: suppressionDecision.shouldSuppress,
    p_suppression_reason: suppressionDecision.reason,
    p_webhook_event_id: webhookId,
  });

  const parsed = mutationResultSchema.safeParse(result.data);
  if (result.error || !parsed.success) {
    return NextResponse.json(
      { code: "WEBHOOK_PERSISTENCE_FAILED", error: "Email delivery event could not be recorded." },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  return NextResponse.json(parsed.data, { headers: noStoreHeaders });
}
