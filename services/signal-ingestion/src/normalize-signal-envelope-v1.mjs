/**
 * Tier-0 signal-ingestion normalization core.
 *
 * The caller must be a trusted transport adapter that establishes the closed
 * security, delivery, rate, size, and budget facts before calling this module.
 * This module only validates and normalizes plain data. It grants no authority
 * and has no provider, persistence, queue, workflow, AI, notification, clock,
 * process, booking, payment, inventory, or pricing capability.
 */

const ROOT_FIELDS = Object.freeze(["schemaVersion", "requestId", "source", "security", "delivery", "limits", "signal"]);
const SOURCE_FIELDS = Object.freeze(["sourceId", "sourceClass", "routeClass"]);
const SECURITY_FIELDS = Object.freeze(["authenticationStatus", "signatureStatus", "audience", "credentialAgeSeconds", "requestTimestamp", "receivedTimestamp"]);
const DELIVERY_FIELDS = Object.freeze(["nonce", "nonceStatus", "replayStatus", "idempotencyKey", "idempotencyStatus"]);
const LIMIT_FIELDS = Object.freeze(["requestBodyBytes", "callerRate", "routeRate", "budget"]);
const RATE_FIELDS = Object.freeze(["state", "windowSeconds", "observedRequestsIncludingCurrent", "limit"]);
const BUDGET_FIELDS = Object.freeze(["authorityStatus", "configurationStatus", "meterStatus", "meterAgeSeconds", "resourceDimension", "unit", "usedUnits", "reservedUnits", "requestUnits", "hardLimit"]);
const SIGNAL_FIELDS = Object.freeze(["signalId", "correlationId", "category", "cardinality", "occurredAt", "payload"]);
const AGGREGATE_FIELDS = Object.freeze(["metricName", "value", "sampleCount", "periodStart", "periodEnd"]);
const ESSENTIAL_EVENT_FIELDS = Object.freeze(["eventType", "state", "occurrenceCount"]);

const MAX_REQUEST_BYTES = 65_536;
const MAX_RATE_PER_MINUTE = 1_000;
const MAX_BUDGET_HARD_LIMIT = 1_000_000;
const MAX_METER_AGE_SECONDS = 300;
const MAX_CREDENTIAL_AGE_SECONDS = 300;
const MAX_TIMESTAMP_SKEW_SECONDS = 60;
const MAX_SIGNAL_AGE_SECONDS = 172_800;
const MAX_SAMPLE_COUNT = 1_000_000;
const MAX_ESSENTIAL_OCCURRENCE_COUNT = 500;

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const METRIC_PATTERN = /^[a-z][a-z0-9_]{0,63}$/;
const TIMESTAMP_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/;

const APPROVED_SOURCES = Object.freeze({
  analytics_aggregate_source: Object.freeze({
    sourceClass: "analytics_source",
    categories: Object.freeze(["hourly_analytics_aggregate", "daily_analytics_aggregate"])
  }),
  booking_lifecycle_source: Object.freeze({
    sourceClass: "booking_control_plane",
    categories: Object.freeze(["essential_booking_lifecycle_event"])
  })
});

const APPROVED_CATEGORIES = new Set([
  "hourly_analytics_aggregate",
  "daily_analytics_aggregate",
  "essential_booking_lifecycle_event"
]);
const RAW_CATEGORIES = new Set(["raw_page_view", "raw_click", "raw_scroll", "raw_marketing_telemetry", "raw_clickstream"]);
const PER_EVENT_CATEGORIES = new Set(["page_view", "click", "scroll", "marketing_event", "guest_interaction", "per_event_telemetry"]);
const RAW_SHAPE_KEYS = new Set(["clicks", "events", "eventStream", "guestEvents", "guestInteractions", "pageViews", "rawClickstream", "rawTelemetry"]);
const AUTHORITY_KEYS = new Set(["actionAuthorized", "authority", "authorityClaims", "authorization", "bookingEffectAuthorized", "executionAuthorized", "persistenceAuthorized", "productionWriteAuthorized"]);
const CALLER_AUTHORITY_FIELDS = new Set(["adapter", "configuration", "contract", "dependencies", "policy", "schema", "validator"]);
const ESSENTIAL_EVENT_STATES = Object.freeze({
  "booking.hold.conflicts_increased": "increased",
  "checkout.completion.declined": "declined",
  "payment.webhook.failed": "failed"
});
const ESSENTIAL_EVENT_SEVERITIES = Object.freeze({
  "booking.hold.conflicts_increased": "warning",
  "checkout.completion.declined": "error",
  "payment.webhook.failed": "error"
});

const NO_AUTHORITY = Object.freeze({
  authenticationAuthority: false,
  authorizationAuthority: false,
  persistenceAuthority: false,
  queueAuthority: false,
  workflowAuthority: false,
  aiInvocationAuthority: false,
  notificationAuthority: false,
  executionAuthority: false,
  productionWriteAuthority: false,
  bookingEffectAuthority: false,
  paymentEffectAuthority: false,
  inventoryEffectAuthority: false,
  pricingEffectAuthority: false
});

function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function guardedClone(value, state = { active: new WeakSet(), seen: new WeakMap(), nodes: 0 }, depth = 0) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number");
    return value;
  }
  if (typeof value !== "object" || depth > 12 || state.nodes >= 256) throw new TypeError("unsafe value");
  if (state.active.has(value)) throw new TypeError("cyclic value");
  if (state.seen.has(value)) return state.seen.get(value);
  state.nodes += 1;
  state.active.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null && !Array.isArray(value)) throw new TypeError("non-plain object");
  const output = Array.isArray(value) ? [] : {};
  state.seen.set(value, output);
  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key !== "string")) throw new TypeError("symbol key");
  if (Array.isArray(value) && keys.some((key) => key !== "length" && (!Number.isInteger(Number(key)) || Number(key) < 0 || String(Number(key)) !== key))) throw new TypeError("unsafe array key");
  for (const key of keys) {
    if (key === "length") continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new TypeError("unsafe property");
    output[key] = guardedClone(descriptor.value, state, depth + 1);
  }
  state.active.delete(value);
  return output;
}

function hasExactKeys(value, expected) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function hasKeyDeep(value, keys) {
  if (value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((item) => hasKeyDeep(item, keys));
  return Object.entries(value).some(([key, child]) => keys.has(key) || hasKeyDeep(child, keys));
}

function safeInteger(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function parseTimestamp(value) {
  if (typeof value !== "string") return null;
  const match = value.match(TIMESTAMP_PATTERN);
  if (!match) return null;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const monthDays = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > monthDays[month - 1] || hour > 23 || minute > 59 || second > 59) return null;
  return Date.UTC(year, month - 1, day, hour, minute, second);
}

function rejection(reasonCode) {
  return deepFreeze({
    ok: false,
    value: null,
    rejection: { schemaVersion: "1.0.0", failClosed: true, reasonCodes: [reasonCode] }
  });
}

function validateRate(rate, exceededReason) {
  if (!hasExactKeys(rate, RATE_FIELDS) || rate.state !== "fresh") return "LIMIT_STATE_UNAVAILABLE";
  if (rate.windowSeconds !== 60 || !safeInteger(rate.limit, 1, MAX_RATE_PER_MINUTE) || !safeInteger(rate.observedRequestsIncludingCurrent, 1, MAX_RATE_PER_MINUTE + 1)) return "RATE_LIMIT_CONFIGURATION_INVALID";
  if (rate.observedRequestsIncludingCurrent > rate.limit) return exceededReason;
  return null;
}

function validateBudget(budget) {
  if (!hasExactKeys(budget, BUDGET_FIELDS)) return "BUDGET_STATE_UNAVAILABLE";
  if (budget.authorityStatus !== "available" || budget.configurationStatus !== "valid" || budget.meterStatus !== "fresh") return "BUDGET_STATE_UNAVAILABLE";
  if (!safeInteger(budget.meterAgeSeconds, 0, MAX_METER_AGE_SECONDS)) return "BUDGET_STATE_UNAVAILABLE";
  if (budget.resourceDimension !== "worker_requests" || budget.unit !== "requests") return "BUDGET_CONFIGURATION_INVALID";
  if (!safeInteger(budget.usedUnits, 0, MAX_BUDGET_HARD_LIMIT) || !safeInteger(budget.reservedUnits, 0, MAX_BUDGET_HARD_LIMIT) || !safeInteger(budget.requestUnits, 1, 1) || !safeInteger(budget.hardLimit, 1, MAX_BUDGET_HARD_LIMIT)) return "BUDGET_CONFIGURATION_INVALID";
  if (budget.usedUnits + budget.reservedUnits + budget.requestUnits >= budget.hardLimit) return "BUDGET_LIMIT_REACHED";
  return null;
}

function validateCommonSignal(signal, receivedAt) {
  if (!hasExactKeys(signal, SIGNAL_FIELDS) || !ID_PATTERN.test(signal.signalId) || !ID_PATTERN.test(signal.correlationId)) return "MALFORMED_SIGNAL";
  const occurredAt = parseTimestamp(signal.occurredAt);
  if (occurredAt === null || occurredAt > receivedAt || receivedAt - occurredAt > MAX_SIGNAL_AGE_SECONDS * 1000) return "INVALID_SIGNAL_TIMESTAMP";
  return null;
}

function normalizeAggregate(signal) {
  if (signal.cardinality !== "aggregate" || !hasExactKeys(signal.payload, AGGREGATE_FIELDS)) return { reason: "MALFORMED_AGGREGATE" };
  const payload = signal.payload;
  if (!METRIC_PATTERN.test(payload.metricName) || typeof payload.value !== "number" || !Number.isFinite(payload.value) || Math.abs(payload.value) > 1_000_000_000_000 || !safeInteger(payload.sampleCount, 1, MAX_SAMPLE_COUNT)) return { reason: "MALFORMED_AGGREGATE" };
  const start = parseTimestamp(payload.periodStart);
  const end = parseTimestamp(payload.periodEnd);
  const expectedSeconds = signal.category === "hourly_analytics_aggregate" ? 3_600 : 86_400;
  if (start === null || end === null || end - start !== expectedSeconds * 1000 || signal.occurredAt !== payload.periodEnd) return { reason: "INVALID_AGGREGATION_WINDOW" };
  return {
    type: signal.category === "hourly_analytics_aggregate" ? "analytics.aggregate.hourly" : "analytics.aggregate.daily",
    severity: "info",
    payload: {
      metricName: payload.metricName,
      value: payload.value,
      sampleCount: payload.sampleCount,
      periodStart: payload.periodStart,
      periodEnd: payload.periodEnd
    }
  };
}

function normalizeEssentialEvent(signal) {
  if (signal.cardinality !== "essential_event" || !hasExactKeys(signal.payload, ESSENTIAL_EVENT_FIELDS)) return { reason: "MALFORMED_ESSENTIAL_EVENT" };
  const payload = signal.payload;
  if (!Object.hasOwn(ESSENTIAL_EVENT_STATES, payload.eventType) || payload.state !== ESSENTIAL_EVENT_STATES[payload.eventType] || !safeInteger(payload.occurrenceCount, 1, MAX_ESSENTIAL_OCCURRENCE_COUNT)) return { reason: "UNAPPROVED_ESSENTIAL_EVENT" };
  return {
    type: payload.eventType,
    severity: ESSENTIAL_EVENT_SEVERITIES[payload.eventType],
    payload: { state: payload.state, occurrenceCount: payload.occurrenceCount }
  };
}

/**
 * Validate and normalize one already-authenticated, adapter-established signal
 * envelope. Additional arguments are ignored and cannot provide authority.
 */
export function normalizeSignalEnvelope(input) {
  try {
    const envelope = guardedClone(input);
    if (envelope === null || typeof envelope !== "object" || Array.isArray(envelope)) return rejection("MALFORMED_ENVELOPE");
    if (Object.keys(envelope).some((key) => CALLER_AUTHORITY_FIELDS.has(key))) return rejection("CALLER_AUTHORITY_INJECTION");
    if (hasKeyDeep(envelope, AUTHORITY_KEYS)) return rejection("AUTHORITY_CLAIM_REJECTED");
    if (!hasExactKeys(envelope, ROOT_FIELDS)) return rejection("MALFORMED_ENVELOPE");
    if (envelope.schemaVersion !== "1.0.0") return rejection("UNSUPPORTED_SCHEMA_VERSION");
    if (!ID_PATTERN.test(envelope.requestId)) return rejection("MALFORMED_ENVELOPE");

    if (!hasExactKeys(envelope.source, SOURCE_FIELDS)) return rejection("MALFORMED_SOURCE");
    const sourceRule = APPROVED_SOURCES[envelope.source.sourceId];
    if (!sourceRule) return rejection("UNKNOWN_SOURCE");
    if (envelope.source.sourceClass !== sourceRule.sourceClass || envelope.source.routeClass !== "aggregate_or_lifecycle_ingest") return rejection("SOURCE_CONTRACT_MISMATCH");

    if (!hasExactKeys(envelope.security, SECURITY_FIELDS)) return rejection("MALFORMED_SECURITY_CLAIMS");
    if (envelope.security.authenticationStatus !== "verified" || envelope.security.signatureStatus !== "verified") return rejection("UNAUTHENTICATED_SOURCE");
    if (envelope.security.audience !== "signal-ingestion-v1") return rejection("INVALID_AUDIENCE");
    if (!safeInteger(envelope.security.credentialAgeSeconds, 0, MAX_CREDENTIAL_AGE_SECONDS)) return rejection("CREDENTIAL_EXPIRED");
    const requestAt = parseTimestamp(envelope.security.requestTimestamp);
    const receivedAt = parseTimestamp(envelope.security.receivedTimestamp);
    if (requestAt === null || receivedAt === null || Math.abs(receivedAt - requestAt) > MAX_TIMESTAMP_SKEW_SECONDS * 1000) return rejection("INVALID_REQUEST_TIMESTAMP");

    if (!hasExactKeys(envelope.delivery, DELIVERY_FIELDS)) return rejection("MALFORMED_DELIVERY_CLAIMS");
    if (!ID_PATTERN.test(envelope.delivery.nonce) || envelope.delivery.nonceStatus !== "fresh" || envelope.delivery.replayStatus !== "not_seen") return rejection("REPLAY_DETECTED");
    if (!ID_PATTERN.test(envelope.delivery.idempotencyKey) || envelope.delivery.idempotencyStatus === "missing") return rejection("MISSING_IDEMPOTENCY_KEY");
    if (envelope.delivery.idempotencyStatus !== "new") return rejection("IDEMPOTENCY_CONFLICT");

    if (!hasExactKeys(envelope.limits, LIMIT_FIELDS)) return rejection("MALFORMED_LIMIT_CLAIMS");
    if (!safeInteger(envelope.limits.requestBodyBytes, 1, MAX_REQUEST_BYTES)) return rejection("REQUEST_SIZE_LIMIT_EXCEEDED");
    const callerRateReason = validateRate(envelope.limits.callerRate, "CALLER_RATE_LIMITED");
    if (callerRateReason) return rejection(callerRateReason);
    const routeRateReason = validateRate(envelope.limits.routeRate, "ROUTE_RATE_LIMITED");
    if (routeRateReason) return rejection(routeRateReason);
    const budgetReason = validateBudget(envelope.limits.budget);
    if (budgetReason) return rejection(budgetReason);

    if (hasKeyDeep(envelope.signal, RAW_SHAPE_KEYS)) return rejection("RAW_CLICKSTREAM_REJECTED");
    const category = envelope.signal?.category;
    if (RAW_CATEGORIES.has(category)) return rejection("RAW_CLICKSTREAM_REJECTED");
    if (PER_EVENT_CATEGORIES.has(category)) return rejection("PER_EVENT_SIGNAL_REJECTED");
    if (!APPROVED_CATEGORIES.has(category)) return rejection("UNKNOWN_SIGNAL_CATEGORY");
    if (!sourceRule.categories.includes(category)) return rejection("SOURCE_CATEGORY_MISMATCH");
    const commonReason = validateCommonSignal(envelope.signal, receivedAt);
    if (commonReason) return rejection(commonReason);

    const normalized = category === "essential_booking_lifecycle_event"
      ? normalizeEssentialEvent(envelope.signal)
      : normalizeAggregate(envelope.signal);
    if (normalized.reason) return rejection(normalized.reason);

    return deepFreeze({
      ok: true,
      value: {
        schemaVersion: "1.0.0",
        requestId: envelope.requestId,
        disposition: "normalized_only",
        nonAuthoritative: true,
        normalizedSignal: {
          schemaVersion: "1.0.0",
          eventId: envelope.signal.signalId,
          correlationId: envelope.signal.correlationId,
          source: { system: envelope.source.sourceId, component: "signal-ingestion" },
          type: normalized.type,
          severity: normalized.severity,
          occurredAt: envelope.signal.occurredAt,
          category,
          cardinality: envelope.signal.cardinality,
          payload: normalized.payload
        },
        authority: { ...NO_AUTHORITY }
      },
      rejection: null
    });
  } catch {
    return rejection("MALFORMED_ENVELOPE");
  }
}
