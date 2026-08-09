import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { normalizeSignalEnvelope } from "../../services/signal-ingestion/src/normalize-signal-envelope-v1.mjs";

const moduleUrl = new URL("../../services/signal-ingestion/src/normalize-signal-envelope-v1.mjs", import.meta.url);
const documentationUrl = new URL("../../docs/signal-ingestion/SIGNAL_INGESTION_NORMALIZATION_V1.md", import.meta.url);
let cases = 0;

function check(condition, label) {
  cases += 1;
  assert.ok(condition, label);
}

function equal(actual, expected, label) {
  cases += 1;
  assert.deepEqual(actual, expected, label);
}

function clone(value) {
  return structuredClone(value);
}

function mutate(value, path, replacement) {
  const copy = clone(value);
  let cursor = copy;
  for (const key of path.slice(0, -1)) cursor = cursor[key];
  cursor[path.at(-1)] = replacement;
  return copy;
}

function reasons(result, expected, label) {
  check(result?.ok === false, `${label}: rejected`);
  check(result?.value === null, `${label}: no normalized value`);
  check(result?.rejection?.failClosed === true, `${label}: fail closed`);
  equal(result?.rejection?.reasonCodes, expected, `${label}: deterministic reasons`);
}

function deeplyFrozen(value) {
  if (value === null || typeof value !== "object") return true;
  return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen);
}

function canonicalEnvelope(category = "hourly_analytics_aggregate") {
  const aggregate = category !== "essential_booking_lifecycle_event";
  return {
    schemaVersion: "1.0.0",
    requestId: "request-001",
    source: {
      sourceId: aggregate ? "analytics_aggregate_source" : "booking_lifecycle_source",
      sourceClass: aggregate ? "analytics_source" : "booking_control_plane",
      routeClass: "aggregate_or_lifecycle_ingest"
    },
    security: {
      authenticationStatus: "verified",
      signatureStatus: "verified",
      audience: "signal-ingestion-v1",
      credentialAgeSeconds: 30,
      requestTimestamp: "2026-08-09T06:00:00Z",
      receivedTimestamp: "2026-08-09T06:00:30Z"
    },
    delivery: {
      nonce: "nonce-001",
      nonceStatus: "fresh",
      replayStatus: "not_seen",
      idempotencyKey: "idempotency-001",
      idempotencyStatus: "new"
    },
    limits: {
      requestBodyBytes: 1_024,
      callerRate: { state: "fresh", windowSeconds: 60, observedRequestsIncludingCurrent: 10, limit: 100 },
      routeRate: { state: "fresh", windowSeconds: 60, observedRequestsIncludingCurrent: 20, limit: 200 },
      budget: {
        authorityStatus: "available",
        configurationStatus: "valid",
        meterStatus: "fresh",
        meterAgeSeconds: 10,
        resourceDimension: "worker_requests",
        unit: "requests",
        usedUnits: 100,
        reservedUnits: 10,
        requestUnits: 1,
        hardLimit: 1_000
      }
    },
    signal: aggregate ? {
      signalId: "signal-001",
      correlationId: "correlation-001",
      category,
      cardinality: "aggregate",
      occurredAt: category === "hourly_analytics_aggregate" ? "2026-08-09T06:00:00Z" : "2026-08-09T00:00:00Z",
      payload: {
        metricName: "search_impressions",
        value: 240,
        sampleCount: 240,
        periodStart: category === "hourly_analytics_aggregate" ? "2026-08-09T05:00:00Z" : "2026-08-08T00:00:00Z",
        periodEnd: category === "hourly_analytics_aggregate" ? "2026-08-09T06:00:00Z" : "2026-08-09T00:00:00Z"
      }
    } : {
      signalId: "signal-002",
      correlationId: "correlation-002",
      category,
      cardinality: "essential_event",
      occurredAt: "2026-08-09T05:59:50Z",
      payload: { eventType: "checkout.completion.declined", state: "declined", occurrenceCount: 1 }
    }
  };
}

const acceptedCategories = ["hourly_analytics_aggregate", "daily_analytics_aggregate", "essential_booking_lifecycle_event"];
for (const category of acceptedCategories) {
  const result = normalizeSignalEnvelope(canonicalEnvelope(category));
  check(result.ok, `${category}: accepted`);
  check(result.rejection === null, `${category}: no rejection`);
  check(result.value.disposition === "normalized_only" && result.value.nonAuthoritative === true, `${category}: inert normalization`);
  check(result.value.normalizedSignal.category === category, `${category}: category retained`);
  check(deeplyFrozen(result), `${category}: result deeply frozen`);
  check(Object.values(result.value.authority).every((claim) => claim === false), `${category}: no authority returned`);
}

const hourly = normalizeSignalEnvelope(canonicalEnvelope()).value.normalizedSignal;
equal(hourly, {
  schemaVersion: "1.0.0",
  eventId: "signal-001",
  correlationId: "correlation-001",
  source: { system: "analytics_aggregate_source", component: "signal-ingestion" },
  type: "analytics.aggregate.hourly",
  severity: "info",
  occurredAt: "2026-08-09T06:00:00Z",
  category: "hourly_analytics_aggregate",
  cardinality: "aggregate",
  payload: { metricName: "search_impressions", value: 240, sampleCount: 240, periodStart: "2026-08-09T05:00:00Z", periodEnd: "2026-08-09T06:00:00Z" }
}, "hourly aggregate normalizes deterministically");

for (const field of ["schemaVersion", "requestId", "source", "security", "delivery", "limits", "signal"]) {
  const input = canonicalEnvelope();
  delete input[field];
  reasons(normalizeSignalEnvelope(input), ["MALFORMED_ENVELOPE"], `missing root ${field}`);
}
reasons(normalizeSignalEnvelope({ ...canonicalEnvelope(), unexpected: true }), ["MALFORMED_ENVELOPE"], "extra root field");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["schemaVersion"], "2.0.0")), ["UNSUPPORTED_SCHEMA_VERSION"], "unsupported version");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["source", "sourceId"], "unknown_source")), ["UNKNOWN_SOURCE"], "unknown source");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["source", "sourceClass"], "booking_control_plane")), ["SOURCE_CONTRACT_MISMATCH"], "source class relabelling");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["source", "routeClass"], "staff_notification")), ["SOURCE_CONTRACT_MISMATCH"], "control route rejected");

for (const path of [["security", "authenticationStatus"], ["security", "signatureStatus"]]) {
  reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), path, "unverified")), ["UNAUTHENTICATED_SOURCE"], `${path.at(-1)} unverified`);
}
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["security", "audience"], "staff-control")), ["INVALID_AUDIENCE"], "wrong audience");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["security", "credentialAgeSeconds"], 301)), ["CREDENTIAL_EXPIRED"], "expired source credential");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["security", "requestTimestamp"], "2026-08-09T05:59:29Z")), ["INVALID_REQUEST_TIMESTAMP"], "request outside skew window");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["security", "requestTimestamp"], "2026-02-30T00:00:00Z")), ["INVALID_REQUEST_TIMESTAMP"], "calendar-invalid timestamp");

reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["delivery", "nonceStatus"], "reused")), ["REPLAY_DETECTED"], "reused nonce");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["delivery", "replayStatus"], "seen")), ["REPLAY_DETECTED"], "replayed request");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["delivery", "idempotencyKey"], "")), ["MISSING_IDEMPOTENCY_KEY"], "missing idempotency key");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["delivery", "idempotencyStatus"], "duplicate_same_request")), ["IDEMPOTENCY_CONFLICT"], "duplicate accepted request cannot redispatch");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["delivery", "idempotencyStatus"], "conflict")), ["IDEMPOTENCY_CONFLICT"], "idempotency conflict");

reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["limits", "requestBodyBytes"], 65_537)), ["REQUEST_SIZE_LIMIT_EXCEEDED"], "oversize body");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["limits", "callerRate", "observedRequestsIncludingCurrent"], 101)), ["CALLER_RATE_LIMITED"], "caller rate exceeded");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["limits", "routeRate", "observedRequestsIncludingCurrent"], 201)), ["ROUTE_RATE_LIMITED"], "route rate exceeded");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["limits", "callerRate", "state"], "unknown")), ["LIMIT_STATE_UNAVAILABLE"], "unknown caller limit state");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["limits", "routeRate", "limit"], 1_001)), ["RATE_LIMIT_CONFIGURATION_INVALID"], "unbounded route limit");
for (const path of [["authorityStatus"], ["configurationStatus"], ["meterStatus"]]) {
  reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["limits", "budget", ...path], "unknown")), ["BUDGET_STATE_UNAVAILABLE"], `budget ${path[0]} unavailable`);
}
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["limits", "budget", "meterAgeSeconds"], 301)), ["BUDGET_STATE_UNAVAILABLE"], "stale budget meter");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["limits", "budget", "usedUnits"], 989)), ["BUDGET_LIMIT_REACHED"], "budget hard limit reached");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["limits", "budget", "usedUnits"], 1_000)), ["BUDGET_LIMIT_REACHED"], "budget exceeded");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["limits", "budget", "resourceDimension"], "ai_invocations")), ["BUDGET_CONFIGURATION_INVALID"], "wrong budget dimension");

for (const category of ["raw_page_view", "raw_click", "raw_scroll", "raw_marketing_telemetry", "raw_clickstream"]) {
  reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["signal", "category"], category)), ["RAW_CLICKSTREAM_REJECTED"], `${category} rejected`);
}
for (const category of ["page_view", "click", "scroll", "marketing_event", "guest_interaction", "per_event_telemetry"]) {
  reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["signal", "category"], category)), ["PER_EVENT_SIGNAL_REJECTED"], `${category} rejected`);
}
const rawArray = canonicalEnvelope();
rawArray.signal.payload.events = [{ click: true }];
reasons(normalizeSignalEnvelope(rawArray), ["RAW_CLICKSTREAM_REJECTED"], "embedded event stream rejected before shape validation");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["signal", "category"], "incident")), ["UNKNOWN_SIGNAL_CATEGORY"], "non-ingestion governance category rejected");

const wrongSource = canonicalEnvelope("essential_booking_lifecycle_event");
wrongSource.source = canonicalEnvelope().source;
reasons(normalizeSignalEnvelope(wrongSource), ["SOURCE_CATEGORY_MISMATCH"], "booking event from analytics source");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["signal", "cardinality"], "individual_event")), ["MALFORMED_AGGREGATE"], "aggregate per-event relabelling");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["signal", "payload", "periodStart"], "2026-08-09T05:30:00Z")), ["INVALID_AGGREGATION_WINDOW"], "partial aggregate window");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["signal", "payload", "sampleCount"], 0)), ["MALFORMED_AGGREGATE"], "empty aggregate");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["signal", "occurredAt"], "2026-08-01T00:00:00Z")), ["INVALID_SIGNAL_TIMESTAMP"], "stale signal");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope(), ["signal", "occurredAt"], "2026-08-09T06:01:00Z")), ["INVALID_SIGNAL_TIMESTAMP"], "future signal");

for (const eventType of ["checkout.completion.declined", "payment.webhook.failed", "booking.hold.conflicts_increased"]) {
  const input = canonicalEnvelope("essential_booking_lifecycle_event");
  input.signal.payload.eventType = eventType;
  input.signal.payload.state = { "checkout.completion.declined": "declined", "payment.webhook.failed": "failed", "booking.hold.conflicts_increased": "increased" }[eventType];
  check(normalizeSignalEnvelope(input).ok, `${eventType}: approved essential event accepted`);
}
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope("essential_booking_lifecycle_event"), ["signal", "payload", "eventType"], "booking.created")), ["UNAPPROVED_ESSENTIAL_EVENT"], "unapproved booking event");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope("essential_booking_lifecycle_event"), ["signal", "payload", "state"], "approved")), ["UNAPPROVED_ESSENTIAL_EVENT"], "essential-event state mismatch");
reasons(normalizeSignalEnvelope(mutate(canonicalEnvelope("essential_booking_lifecycle_event"), ["signal", "payload", "occurrenceCount"], 501)), ["UNAPPROVED_ESSENTIAL_EVENT"], "essential-event count over ceiling");

for (const field of ["schema", "policy", "contract", "validator", "configuration", "adapter", "dependencies"]) {
  const injected = canonicalEnvelope();
  injected[field] = {};
  reasons(normalizeSignalEnvelope(injected), ["CALLER_AUTHORITY_INJECTION"], `${field} injection`);
}
for (const field of ["authorityClaims", "productionWriteAuthorized", "persistenceAuthorized", "executionAuthorized"]) {
  const injected = canonicalEnvelope();
  injected.signal.payload[field] = false;
  reasons(normalizeSignalEnvelope(injected), ["AUTHORITY_CLAIM_REJECTED"], `${field} claim rejected even when false`);
}
const extraArgumentsResult = normalizeSignalEnvelope(canonicalEnvelope(), { policy: { allowRawClickstream: true } }, () => true);
check(extraArgumentsResult.ok, "extra caller arguments are ignored and cannot redirect authority");

const malformedInputs = [null, undefined, true, false, 0, 1, "envelope", [], Symbol("envelope"), 1n, NaN, Infinity, new Date(), /envelope/u, () => {}, Object.create({ inherited: true })];
for (const input of malformedInputs) {
  let result;
  let threw = false;
  try { result = normalizeSignalEnvelope(input); } catch { threw = true; }
  check(!threw, `malformed ${String(input)} never throws`);
  reasons(result, ["MALFORMED_ENVELOPE"], `malformed ${String(input)}`);
  check(deeplyFrozen(result), `malformed ${String(input)} result frozen`);
}
const cyclic = canonicalEnvelope(); cyclic.cycle = cyclic;
reasons(normalizeSignalEnvelope(cyclic), ["MALFORMED_ENVELOPE"], "cyclic envelope");
const accessor = canonicalEnvelope(); Object.defineProperty(accessor, "requestId", { enumerable: true, get() { throw new Error("must not escape"); } });
reasons(normalizeSignalEnvelope(accessor), ["MALFORMED_ENVELOPE"], "throwing accessor");
const proxied = new Proxy(canonicalEnvelope(), { ownKeys() { throw new Error("must not escape"); } });
reasons(normalizeSignalEnvelope(proxied), ["MALFORMED_ENVELOPE"], "throwing proxy");
const tooDeep = canonicalEnvelope(); let cursor = tooDeep.signal.payload; for (let index = 0; index < 20; index += 1) { cursor.child = {}; cursor = cursor.child; }
reasons(normalizeSignalEnvelope(tooDeep), ["MALFORMED_ENVELOPE"], "over-deep hostile input");

const [moduleSource, documentation] = await Promise.all([readFile(moduleUrl, "utf8"), readFile(documentationUrl, "utf8")]);
equal([...moduleSource.matchAll(/\bexport\s+function\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]), ["normalizeSignalEnvelope"], "exactly one public function");
check(!/^\s*import\s/mu.test(moduleSource), "core has no imports");
check(!/\bfetch\s*\(|XMLHttpRequest|WebSocket|from\s+["']node:(?:https?|net|tls|fs|child_process)|process\.(?:env|cwd)|Date\.now|new\s+Date/iu.test(moduleSource), "core has no network, filesystem, process, environment, clock-now, or execution dependency");
check(!/\b(?:persist|enqueue|queue|invoke|notify|execute|deploy|book|charge|price|reserveInventory)\s*\(/iu.test(moduleSource), "core contains no side-effect operation call");
for (const term of ["65,536", "60 seconds", "300 seconds", "1,000", "172,800", "hourly_analytics_aggregate", "essential_booking_lifecycle_event", "RAW_CLICKSTREAM_REJECTED", "normalized_only", "independent review"]) {
  check(documentation.includes(term), `documentation states ${term}`);
}

console.log(`P3-001 signal-ingestion normalization V1 validation passed (${cases} cases).`);
