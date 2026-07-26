import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";

import { buildReservationEmail } from "@/lib/notifications/email";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };
const workerConfigSchema = z.object({
  appUrl: z.string().url(),
  cronSecret: z.string().min(16),
  emailFrom: z.string().regex(/^[^<]*<[^@\s]+@[^>\s]+>$|^[^@\s]+@[^@\s]+$/),
  emailReplyTo: z.string().email(),
  resendApiKey: z.string().startsWith("re_"),
});
const permanentProviderErrors = new Set([
  "invalid_api_key",
  "invalid_attachment",
  "invalid_from_address",
  "invalid_idempotency_key",
  "invalid_idempotent_request",
  "invalid_parameter",
  "invalid_region",
  "missing_api_key",
  "missing_required_field",
  "restricted_api_key",
  "security_error",
  "validation_error",
]);

const claimedEventSchema = z.object({
  attempt_number: z.number().int().positive(),
  channel: z.string(),
  delivery_payload: z.unknown(),
  event_id: z.string().uuid(),
  kind: z.string(),
  lease_id: z.string().uuid(),
  provider_message_id: z.string().min(1).max(256),
  recipient: z.string().email(),
});

const deliveryMutationSchema = z.object({
  ok: z.boolean(),
  stale_lease: z.boolean(),
});

class FatalNotificationWorkerError extends Error {
  constructor(
    readonly code: string,
    readonly userMessage: string,
  ) {
    super(userMessage);
  }
}

class ProviderDeliveryError extends Error {
  constructor(
    readonly providerName: string,
    readonly permanent: boolean,
    readonly retryAfterSeconds: number | null,
  ) {
    super("Email provider request failed.");
  }
}

function authorized(request: Request, cronSecret: string) {
  return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function sanitizedProviderError(error: unknown) {
  if (error instanceof ProviderDeliveryError) {
    return `Email provider error: ${error.providerName.slice(0, 100)}`;
  }
  if (error && typeof error === "object" && "name" in error) {
    return `Email provider error: ${String(error.name).slice(0, 100)}`;
  }
  return "Email provider request failed.";
}

function retryAfterSeconds(headers: Record<string, string> | null) {
  const value = headers?.["retry-after"];
  if (!value) return null;

  const seconds = Number(value);
  if (Number.isInteger(seconds)) return Math.min(86_400, Math.max(30, seconds));

  const dateDelay = Math.ceil((new Date(value).getTime() - Date.now()) / 1000);
  return Number.isFinite(dateDelay) ? Math.min(86_400, Math.max(30, dateDelay)) : null;
}

async function withProviderTimeout<T>(operation: Promise<T>, timeoutMilliseconds = 15_000) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new ProviderDeliveryError("request_timeout", false, null)),
          timeoutMilliseconds,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function parseDeliveryMutationResult(
  result: { data: unknown; error: { message?: string } | null },
  code: string,
  userMessage: string,
) {
  if (result.error) {
    throw new FatalNotificationWorkerError(code, userMessage);
  }

  const parsed = deliveryMutationSchema.safeParse(result.data);
  if (!parsed.success) {
    throw new FatalNotificationWorkerError(code, userMessage);
  }

  return parsed.data;
}

export async function POST(request: Request) {
  const supabase = createSupabaseServiceRoleClient();
  const config = workerConfigSchema.safeParse({
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin,
    cronSecret: process.env.CRON_SECRET,
    emailFrom: process.env.EMAIL_FROM,
    emailReplyTo: process.env.EMAIL_REPLY_TO,
    resendApiKey: process.env.RESEND_API_KEY,
  });

  if (!config.success || !supabase) {
    return NextResponse.json(
      { code: "NOTIFICATION_WORKER_NOT_CONFIGURED", error: "Notification worker is not configured." },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  if (!authorized(request, config.data.cronSecret)) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", error: "Unauthorized." },
      { headers: noStoreHeaders, status: 401 },
    );
  }

  const { data, error } = await supabase.rpc("claim_notification_batch", {
    p_batch_size: 50,
  });

  if (error) {
    return NextResponse.json(
      { code: "NOTIFICATION_CLAIM_FAILED", error: "Notification queue is unavailable." },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  const claimed = z.array(claimedEventSchema).safeParse(data ?? []);
  if (!claimed.success) {
    return NextResponse.json(
      { code: "INVALID_NOTIFICATION_BATCH", error: "Notification queue returned invalid work." },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  const resend = new Resend(config.data.resendApiKey);
  let sent = 0;
  let failed = 0;
  let stale = 0;
  let fatalError: FatalNotificationWorkerError | null = null;

  for (const event of claimed.data) {
    try {
      if (event.channel !== "email") {
        throw new Error("Unsupported notification channel");
      }

      const suppression = await supabase.rpc("notification_recipient_is_suppressed", {
        p_event_id: event.event_id,
      });
      if (suppression.error || typeof suppression.data !== "boolean") {
        throw new FatalNotificationWorkerError(
          "NOTIFICATION_SUPPRESSION_CHECK_FAILED",
          "Notification suppression state could not be checked.",
        );
      }
      if (suppression.data) {
        const cancellation = await supabase.rpc("cancel_notification_delivery", {
          p_attempt_number: event.attempt_number,
          p_error_message: "Recipient is on the transactional email suppression list.",
          p_event_id: event.event_id,
          p_lease_id: event.lease_id,
        });
        const cancellationResult = parseDeliveryMutationResult(
          cancellation,
          "NOTIFICATION_CANCELLATION_FAILED",
          "Suppressed notification could not be cancelled.",
        );
        if (!cancellationResult.ok) stale += 1;
        else failed += 1;
        continue;
      }

      const email = buildReservationEmail(event.kind, event.delivery_payload, config.data.appUrl);
      const result = await withProviderTimeout(resend.emails.send(
          {
            from: config.data.emailFrom,
            html: email.html,
            replyTo: config.data.emailReplyTo,
          subject: email.subject,
          text: email.text,
          to: event.recipient,
        },
        { idempotencyKey: email.idempotencyKey },
      ));

      if (result.error || !result.data?.id) {
        const name = result.error?.name ?? "missing_provider_delivery_id";
        throw new ProviderDeliveryError(
          name,
          permanentProviderErrors.has(name),
          retryAfterSeconds(result.headers),
        );
      }

      const completion = await supabase.rpc("complete_notification_delivery", {
        p_attempt_number: event.attempt_number,
        p_event_id: event.event_id,
        p_lease_id: event.lease_id,
        p_provider_delivery_id: result.data.id,
      });

      const completionResult = parseDeliveryMutationResult(
        completion,
        "NOTIFICATION_COMPLETION_FAILED",
        "Notification completion state could not be recorded.",
      );

      if (!completionResult.ok) {
        stale += 1;
        continue;
      }

      sent += 1;
    } catch (deliveryError) {
      if (deliveryError instanceof FatalNotificationWorkerError) {
        fatalError = deliveryError;
        break;
      }

      const mutationName =
        deliveryError instanceof ProviderDeliveryError && deliveryError.permanent
          ? "dead_letter_notification_delivery"
          : "fail_notification_delivery";
      const failure = await supabase.rpc(mutationName, {
        p_attempt_number: event.attempt_number,
        p_error_message: sanitizedProviderError(deliveryError),
        p_event_id: event.event_id,
        p_lease_id: event.lease_id,
        ...(mutationName === "fail_notification_delivery"
          ? {
              p_retry_after_seconds:
                deliveryError instanceof ProviderDeliveryError
                  ? deliveryError.retryAfterSeconds
                  : null,
            }
          : {}),
      });

      let failureResult;
      try {
        failureResult = parseDeliveryMutationResult(
          failure,
          "NOTIFICATION_FAILURE_UPDATE_FAILED",
          "Notification retry state could not be recorded.",
        );
      } catch (failurePersistenceError) {
        if (failurePersistenceError instanceof FatalNotificationWorkerError) {
          fatalError = failurePersistenceError;
          break;
        }

        throw failurePersistenceError;
      }

      if (!failureResult.ok) {
        stale += 1;
        continue;
      }

      failed += 1;
    }
  }

  if (fatalError) {
    return NextResponse.json(
      { claimed: claimed.data.length, code: fatalError.code, error: fatalError.userMessage, failed, sent, stale },
      { headers: noStoreHeaders, status: 503 },
    );
  }

  return NextResponse.json(
    { claimed: claimed.data.length, failed, sent, stale },
    { headers: noStoreHeaders, status: failed > 0 || stale > 0 ? 207 : 200 },
  );
}
