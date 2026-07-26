import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SystemHealthData = Readonly<{
  connected: boolean;
  deadLetters: readonly SystemHealthDeadLetter[];
  integrations: readonly IntegrationHealth[];
  recentFailures: readonly SystemHealthFailure[];
  summary: SystemHealthSummary | null;
}>;

export type IntegrationHealth = Readonly<{
  detail: string;
  name: "Supabase" | "Stripe" | "Resend";
  status: "Ready" | "Degraded" | "Not configured";
}>;

export type SystemHealthDeadLetter = Readonly<{
  attempts: number;
  errorSummary: string;
  id: string;
  kind: string;
  recipient: string;
  updatedAtLabel: string;
}>;

export type SystemHealthFailure = Readonly<{
  errorSummary: string;
  id: string;
  jobName: string;
  startedAtLabel: string;
  status: "Failed";
}>;

export type SystemHealthSummary = Readonly<{
  activeEmailSuppressionCount: number;
  adverseProviderEvents24h: number;
  failuresLast24Hours: number;
  latestMetrics: Record<string, number | string | boolean | null> | null;
  latestRunAgeLabel: string;
  latestRunStatus: string | null;
  notificationDeadLetterCount: number;
  notificationProcessingCount: number;
  notificationReadyToClaimCount: number;
  notificationRetryingCount: number;
  notificationStaleProcessingCount: number;
  operationalJobIsStale: boolean;
  schedulerStatusLabel: string;
  schedulerStatusNote: string;
}>;

type JsonScalar = boolean | number | string | null;
type JsonObject = { [key: string]: JsonScalar };

type SystemHealthSummaryRow = {
  active_email_suppression_count: number | string;
  failures_last_24_hours: number | string;
  latest_run_metrics: JsonObject | null;
  latest_run_started_at: string | null;
  latest_run_status: string | null;
  notification_dead_letter_count: number | string;
  notification_adverse_provider_events_24h: number | string;
  notification_oldest_ready_at: string | null;
  notification_processing_count: number | string;
  notification_ready_to_claim_count: number | string;
  notification_retrying_count: number | string;
  notification_stale_processing_count: number | string;
  operational_job_is_stale: boolean;
};

type RecentFailedBackgroundJobRow = {
  error_message: string | null;
  id: string;
  job_name: string;
  started_at: string;
};

type DeadLetterNotificationRow = {
  attempts: number | string;
  id: string;
  kind: string;
  last_error: string | null;
  recipient: string;
  updated_at: string;
};

type RecentSentNotificationRow = {
  sent_at: string;
};

function asNumber(value: number | string | null | undefined) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function formatRelativeAge(value: string | null) {
  if (!value) return "Never";

  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60_000));
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes}m ago`;

  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours}h ago`;

  return `${Math.floor(elapsedHours / 24)}d ago`;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  }).format(new Date(value)).replace(",", " ·");
}

function buildSummary(row: SystemHealthSummaryRow): SystemHealthSummary {
  const operationalJobIsStale = row.operational_job_is_stale;

  return {
    activeEmailSuppressionCount: asNumber(row.active_email_suppression_count),
    adverseProviderEvents24h: asNumber(row.notification_adverse_provider_events_24h),
    failuresLast24Hours: asNumber(row.failures_last_24_hours),
    latestMetrics: row.latest_run_metrics,
    latestRunAgeLabel: formatRelativeAge(row.latest_run_started_at),
    latestRunStatus: row.latest_run_status,
    notificationDeadLetterCount: asNumber(row.notification_dead_letter_count),
    notificationProcessingCount: asNumber(row.notification_processing_count),
    notificationReadyToClaimCount: asNumber(row.notification_ready_to_claim_count),
    notificationRetryingCount: asNumber(row.notification_retrying_count),
    notificationStaleProcessingCount: asNumber(row.notification_stale_processing_count),
    operationalJobIsStale,
    schedulerStatusLabel: operationalJobIsStale ? "Check" : "Ready",
    schedulerStatusNote: operationalJobIsStale
      ? "No fresh operational worker heartbeat in the last 15 minutes."
      : "Operational worker heartbeat is within the last 15 minutes.",
  };
}

async function probeProvider(args: {
  apiKey?: string;
  name: "Stripe" | "Resend";
  url: string;
  webhookSecret?: string;
}): Promise<IntegrationHealth> {
  if (!args.apiKey || !args.webhookSecret) {
    return { detail: "API key or webhook signing secret is missing.", name: args.name, status: "Not configured" };
  }

  try {
    const response = await fetch(args.url, {
      headers: { Authorization: `Bearer ${args.apiKey}` },
      signal: AbortSignal.timeout(4_000),
    });
    return response.ok
      ? { detail: "Authenticated API probe succeeded; webhook signing is configured.", name: args.name, status: "Ready" }
      : { detail: `Authenticated API probe returned HTTP ${response.status}.`, name: args.name, status: "Degraded" };
  } catch {
    return { detail: "Authenticated API probe timed out or could not connect.", name: args.name, status: "Degraded" };
  }
}

function normalizeResendHealth(
  health: IntegrationHealth,
  recentSentAt: string | null,
): IntegrationHealth {
  if (health.status !== "Degraded" || !health.detail.includes("HTTP 401") || !recentSentAt) return health;

  const sentAgeMs = Date.now() - new Date(recentSentAt).getTime();
  if (!Number.isFinite(sentAgeMs) || sentAgeMs > 24 * 60 * 60 * 1_000) return health;

  return {
    detail: "Sending-scoped API key accepted a provider submission within the last 24 hours; webhook signing is configured.",
    name: "Resend",
    status: "Ready",
  };
}

export async function getSystemHealthData(): Promise<SystemHealthData> {
  const supabase = await createSupabaseServerClient();
  if (!supabase) {
    return {
      connected: false,
      deadLetters: [],
      integrations: [
        { detail: "Authenticated database client is unavailable.", name: "Supabase", status: "Degraded" },
        await probeProvider({ apiKey: process.env.STRIPE_SECRET_KEY, name: "Stripe", url: "https://api.stripe.com/v1/account", webhookSecret: process.env.STRIPE_WEBHOOK_SECRET }),
        await probeProvider({ apiKey: process.env.RESEND_API_KEY, name: "Resend", url: "https://api.resend.com/domains", webhookSecret: process.env.RESEND_WEBHOOK_SECRET }),
      ],
      recentFailures: [],
      summary: null,
    };
  }

  const [summaryResult, failuresResult, deadLettersResult, recentSentResult, stripeHealth, resendProbeHealth] = await Promise.all([
    supabase
      .from("system_health_summary")
      .select("latest_run_status, latest_run_started_at, latest_run_metrics, operational_job_is_stale, failures_last_24_hours, notification_ready_to_claim_count, notification_oldest_ready_at, notification_processing_count, notification_stale_processing_count, notification_retrying_count, notification_dead_letter_count, notification_adverse_provider_events_24h, active_email_suppression_count")
      .maybeSingle()
      .returns<SystemHealthSummaryRow>(),
    supabase
      .from("recent_failed_background_jobs")
      .select("id, job_name, error_message, started_at")
      .order("started_at", { ascending: false })
      .limit(5)
      .returns<RecentFailedBackgroundJobRow[]>(),
    supabase
      .from("dead_letter_notification_events")
      .select("id, kind, recipient, attempts, last_error, updated_at")
      .order("updated_at", { ascending: false })
      .limit(5)
      .returns<DeadLetterNotificationRow[]>(),
    supabase
      .from("notification_events")
      .select("sent_at")
      .not("sent_at", "is", null)
      .order("sent_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .returns<RecentSentNotificationRow>(),
    probeProvider({ apiKey: process.env.STRIPE_SECRET_KEY, name: "Stripe", url: "https://api.stripe.com/v1/account", webhookSecret: process.env.STRIPE_WEBHOOK_SECRET }),
    probeProvider({ apiKey: process.env.RESEND_API_KEY, name: "Resend", url: "https://api.resend.com/domains", webhookSecret: process.env.RESEND_WEBHOOK_SECRET }),
  ]);

  const resendHealth = normalizeResendHealth(resendProbeHealth, recentSentResult.data?.sent_at ?? null);

  if (summaryResult.error || failuresResult.error || deadLettersResult.error || recentSentResult.error) {
    return {
      connected: false,
      deadLetters: [],
      integrations: [
        { detail: "Authenticated health views could not be queried.", name: "Supabase", status: "Degraded" },
        stripeHealth,
        resendHealth,
      ],
      recentFailures: [],
      summary: null,
    };
  }

  return {
    connected: true,
    deadLetters: (deadLettersResult.data ?? []).map((row) => ({
      attempts: asNumber(row.attempts),
      errorSummary: row.last_error?.trim() || "No error summary recorded.",
      id: row.id,
      kind: row.kind,
      recipient: row.recipient,
      updatedAtLabel: formatDateTime(row.updated_at),
    })),
    integrations: [
      { detail: "Authenticated database health views are reachable.", name: "Supabase", status: "Ready" },
      stripeHealth,
      resendHealth,
    ],
    recentFailures: (failuresResult.data ?? []).map((row) => ({
      errorSummary: row.error_message?.trim() || "No error summary recorded.",
      id: row.id,
      jobName: row.job_name,
      startedAtLabel: formatDateTime(row.started_at),
      status: "Failed",
    })),
    summary: summaryResult.data ? buildSummary(summaryResult.data) : null,
  };
}
