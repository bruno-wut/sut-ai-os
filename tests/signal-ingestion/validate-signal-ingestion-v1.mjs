import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSignalNormalizer } from "../../services/signal-ingestion/signal-normalizer-v1.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const modulePath = path.join(repositoryRoot, "services/signal-ingestion/signal-normalizer-v1.mjs");
const SYNTHETIC_TEST_KEY = "synthetic-p3-001-hmac-test-key-0000000000000001";
const NOW = 1_786_600_000;
let assertions = 0;

function expect(condition, message) {
  assertions += 1;
  if (!condition) throw new Error(message);
}

function equal(actual, expected, message) {
  expect(JSON.stringify(actual) === JSON.stringify(expected), `${message}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function copy(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

function signingPayload(request) {
  const unsigned = {};
  for (const key of Object.keys(request)) if (key !== "signature") unsigned[key] = request[key];
  return stableJson(unsigned);
}

function sign(request, key = SYNTHETIC_TEST_KEY) {
  request.bodyBytes = Buffer.byteLength(stableJson(request.signal), "utf8");
  request.signature = createHmac("sha256", key).update(signingPayload(request), "utf8").digest("hex");
  return request;
}

function trustedContext(overrides = {}) {
  const base = {
    verificationKey: SYNTHETIC_TEST_KEY,
    nowEpochSeconds: NOW,
    nonceStatus: "fresh",
    idempotencyStatus: "new",
    callerLimitStatus: "within_limit",
    routeLimitStatus: "within_limit",
    budget: {
      authorityState: "available",
      configurationState: "valid",
      meterState: "fresh",
      budgetState: "below_warning",
      observedAtEpochSeconds: NOW - 10,
      maxAgeSeconds: 300
    }
  };
  const merged = { ...base, ...overrides };
  if (overrides.budget) merged.budget = { ...base.budget, ...overrides.budget };
  return merged;
}

function hourlySignal() {
  return {
    category: "hourly_analytics_aggregate",
    signalId: "signal:hourly:001",
    correlationId: "correlation:001",
    occurredAt: "2026-08-13T07:00:00Z",
    data: {
      windowStart: "2026-08-13T06:00:00Z",
      windowEnd: "2026-08-13T07:00:00Z",
      sampleCount: 120,
      aggregationComplete: true,
      metrics: [
        { name: "page_views", value: 120, unit: "count" },
        { name: "sessions", value: 80, unit: "count" }
      ]
    }
  };
}

function dailySignal() {
  const signal = hourlySignal();
  signal.category = "daily_analytics_aggregate";
  signal.signalId = "signal:daily:001";
  signal.data.windowStart = "2026-08-12T00:00:00Z";
  signal.data.windowEnd = "2026-08-13T00:00:00Z";
  return signal;
}

function lifecycleSignal() {
  return {
    category: "essential_booking_lifecycle_event",
    signalId: "signal:booking:001",
    correlationId: "correlation:booking:001",
    occurredAt: "2026-08-13T07:00:00Z",
    data: {
      eventType: "booking_confirmed",
      lifecycleReferenceId: "booking-ref:hashed:001",
      propertyScope: "sut-grand-hotel",
      stateVersion: 2,
      changeSequence: 4
    }
  };
}

function requestFor(signal = hourlySignal(), source = { sourceClass: "analytics_source", sourceId: "google_analytics_aggregate" }) {
  return sign({
    schemaVersion: "1.0.0",
    requestId: "request:signal:001",
    method: "POST",
    routeClass: "aggregate_or_lifecycle_ingest",
    source,
    audience: "staff-control-signal-ingestion",
    issuedAtEpochSeconds: NOW - 10,
    expiresAtEpochSeconds: NOW + 120,
    nonce: "nonce-001",
    idempotencyKey: "idempotency:signal:001",
    signatureAlgorithm: "hmac-sha256",
    signature: "",
    bodyBytes: 0,
    signal
  });
}

const ZERO_EFFECTS = {
  aiInvocations: 0,
  permanentWorkItemsCreated: 0,
  persistenceWrites: 0,
  queueMessages: 0,
  workflowStarts: 0,
  notifications: 0,
  productionWrites: 0
};

function isPlainTree(value, seen = new Set()) {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (typeof value !== "object" || seen.has(value)) return false;
  seen.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (!Array.isArray(value) && prototype !== Object.prototype && prototype !== null) return false;
  return Object.values(value).every((entry) => isPlainTree(entry, seen));
}

function isDeepFrozen(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return true;
  seen.add(value);
  return Object.isFrozen(value) && Object.values(value).every((entry) => isDeepFrozen(entry, seen));
}

function validateDecision(decision, label) {
  expect(decision && typeof decision === "object", `${label}: decision must be an object`);
  equal(Object.keys(decision), ["ok", "value", "rejection", "effects"], `${label}: decision keys`);
  equal(decision.effects, ZERO_EFFECTS, `${label}: no side effects`);
  expect(isPlainTree(decision), `${label}: result must contain plain data only`);
  expect(isDeepFrozen(decision), `${label}: result must be recursively frozen`);
  if (decision.ok) {
    expect(decision.rejection === null && decision.value !== null, `${label}: accepted variant`);
    equal(Object.keys(decision.value), ["schemaVersion", "category", "event", "nonAuthoritative", "persistenceAuthorized", "permanentWorkItemAuthorized", "aiInvocationAuthorized", "productionWriteAuthorized"], `${label}: accepted value keys`);
    expect(decision.value.nonAuthoritative === true, `${label}: accepted result remains non-authoritative`);
    expect(decision.value.persistenceAuthorized === false && decision.value.permanentWorkItemAuthorized === false && decision.value.aiInvocationAuthorized === false && decision.value.productionWriteAuthorized === false, `${label}: accepted result grants no action`);
    const event = decision.value.event;
    equal(Object.keys(event), ["schemaVersion", "eventId", "correlationId", "source", "type", "severity", "occurredAt", "payload"], `${label}: P1-001 event envelope keys`);
    expect(event.schemaVersion === "1.0.0" && event.severity === "info", `${label}: P1-001 fixed semantics`);
    expect(/^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/.test(event.type), `${label}: event type pattern`);
  } else {
    expect(decision.value === null && decision.rejection !== null, `${label}: rejected variant`);
    equal(Object.keys(decision.rejection), ["schemaVersion", "failClosed", "reasonCodes"], `${label}: rejection keys`);
    expect(decision.rejection.schemaVersion === "1.0.0" && decision.rejection.failClosed === true, `${label}: rejection fails closed`);
    expect(Array.isArray(decision.rejection.reasonCodes) && decision.rejection.reasonCodes.length > 0, `${label}: deterministic reasons`);
  }
}

function check(normalizer, request, expectedOk, expectedReasons, label, ...extraArguments) {
  let decision;
  try {
    decision = normalizer.normalize(request, ...extraArguments);
  } catch (error) {
    throw new Error(`${label}: threw ${error?.message ?? String(error)}`);
  }
  validateDecision(decision, label);
  expect(decision.ok === expectedOk, `${label}: expected ok=${expectedOk}`);
  if (!expectedOk) equal(decision.rejection.reasonCodes, expectedReasons, `${label}: reason precedence`);
  return decision;
}

function signedMutation(request, mutate) {
  const candidate = copy(request);
  mutate(candidate);
  return sign(candidate);
}

try {
  const source = await readFile(modulePath, "utf8");
  expect(source.includes('from "node:crypto"'), "runtime must use Node standard crypto for HMAC verification");
  expect(!/(?:from|import\s*\()[^\n]*(?:node:fs|node:http|node:https|child_process|cloudflare|supabase|github|openai|line|database|queue|workflow|scheduler)/i.test(source), "runtime must not import infrastructure providers");
  expect(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(|\bprocess\s*\.|\.env\b/i.test(source), "runtime must not access environment or invoke network clients");
  equal([...source.matchAll(/\bexport\s+function\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]), ["createSignalNormalizer"], "runtime declares one cohesive public factory");
  expect(!/export\s+(?:const|let|var|class)\b/u.test(source), "runtime must not export internal authority");
  expect(source.includes("createHmac(\"sha256\", verificationKey)"), "runtime must compute HMAC-SHA256 itself");
  expect(source.includes("timingSafeEqual"), "runtime must compare signatures with constant-time primitive");

  const normalizer = createSignalNormalizer(trustedContext());
  expect(Object.isFrozen(normalizer), "normalizer interface must be frozen");
  equal(Object.keys(normalizer), ["normalize"], "normalizer exposes one operation");

  const hourly = check(normalizer, requestFor(), true, null, "hourly analytics aggregate");
  expect(hourly.value.event.type === "analytics.aggregate.hourly", "hourly event type");
  const daily = check(normalizer, requestFor(dailySignal(), { sourceClass: "analytics_source", sourceId: "google_search_console_aggregate" }), true, null, "daily search aggregate");
  expect(daily.value.event.type === "analytics.aggregate.daily", "daily event type");
  const lifecycle = check(normalizer, requestFor(lifecycleSignal(), { sourceClass: "booking_control_plane", sourceId: "booking_lifecycle_gateway" }), true, null, "essential lifecycle event");
  expect(lifecycle.value.event.type === "booking.lifecycle.booking.confirmed", "lifecycle event type");

  const unmutated = requestFor();
  const before = JSON.stringify(unmutated);
  check(normalizer, unmutated, true, null, "input is not mutated");
  expect(JSON.stringify(unmutated) === before, "normalizer must not mutate request");

  const reordered = {};
  for (const key of Object.keys(requestFor()).reverse()) reordered[key] = requestFor()[key];
  reordered.signature = requestFor().signature;
  check(normalizer, reordered, true, null, "canonical signing ignores object insertion order");

  const badSignature = requestFor();
  badSignature.signal.data.metrics[0].value += 1;
  check(normalizer, badSignature, false, ["INVALID_SIGNATURE"], "signed body mutation");
  const wrongKey = requestFor();
  sign(wrongKey, "different-synthetic-test-key-0000000000000000001");
  check(normalizer, wrongKey, false, ["INVALID_SIGNATURE"], "wrong HMAC key");
  const malformedSignature = requestFor();
  malformedSignature.signature = "not-a-signature";
  check(normalizer, malformedSignature, false, ["INVALID_SIGNATURE"], "malformed signature");
  const wrongAlgorithm = signedMutation(requestFor(), (value) => { value.signatureAlgorithm = "sha512"; });
  check(normalizer, wrongAlgorithm, false, ["INVALID_SIGNATURE"], "unsupported signature algorithm");
  const injectedVerifier = { ...requestFor(), verifier: () => true };
  check(normalizer, injectedVerifier, false, ["CALLER_AUTHORITY_INJECTION"], "fake verifier injection");
  check(normalizer, wrongKey, false, ["INVALID_SIGNATURE"], "extra dependency argument cannot bypass HMAC", { verifier: () => true, policy: { allow: true } });

  for (const field of ["schema", "policy", "contract", "adapter", "configuration", "validator", "dependencies", "verificationKey", "secret", "credential"]) {
    const candidate = { ...requestFor(), [field]: {} };
    check(normalizer, candidate, false, ["CALLER_AUTHORITY_INJECTION"], `authority injection ${field}`);
  }

  check(createSignalNormalizer(null), requestFor(), false, ["TRUST_CONTEXT_UNAVAILABLE"], "missing trust context");
  check(createSignalNormalizer({ ...trustedContext(), verifier: () => true }), requestFor(), false, ["TRUST_CONTEXT_UNAVAILABLE"], "fake trusted verifier rejected");
  check(createSignalNormalizer({ ...trustedContext(), verificationKey: "short" }), requestFor(), false, ["TRUST_CONTEXT_UNAVAILABLE"], "invalid verification key rejected");

  const authCases = [
    [signedMutation(requestFor(), (value) => { value.audience = "ai-workload"; }), ["INVALID_AUDIENCE"], "audience mismatch"],
    [signedMutation(requestFor(), (value) => { value.expiresAtEpochSeconds = NOW - 1; }), ["AUTHENTICATION_EXPIRED"], "expired authentication"],
    [signedMutation(requestFor(), (value) => { value.issuedAtEpochSeconds = NOW + 61; value.expiresAtEpochSeconds = NOW + 120; }), ["TIMESTAMP_OUTSIDE_WINDOW"], "future timestamp outside skew"],
    [signedMutation(requestFor(), (value) => { value.expiresAtEpochSeconds = value.issuedAtEpochSeconds + 301; }), ["INVALID_AUTHENTICATION"], "credential lifetime too long"],
    [signedMutation(requestFor(), (value) => { value.nonce = "UPPER"; }), ["INVALID_AUTHENTICATION"], "invalid nonce"],
    [signedMutation(requestFor(), (value) => { value.method = "GET"; }), ["UNSUPPORTED_ROUTE"], "wrong method"],
    [signedMutation(requestFor(), (value) => { value.routeClass = "bounded_work_request"; }), ["UNSUPPORTED_ROUTE"], "control route"],
    [signedMutation(requestFor(), (value) => { value.schemaVersion = "2.0.0"; }), ["UNSUPPORTED_SCHEMA_VERSION"], "unsupported schema version"]
  ];
  for (const [candidate, reasons, label] of authCases) check(normalizer, candidate, false, reasons, label);

  check(createSignalNormalizer(trustedContext({ nonceStatus: "reused" })), requestFor(), false, ["REPLAY_DETECTED"], "replayed nonce");
  check(createSignalNormalizer(trustedContext({ nonceStatus: "missing" })), requestFor(), false, ["REPLAY_DETECTED"], "missing nonce state");
  check(createSignalNormalizer(trustedContext({ idempotencyStatus: "duplicate_same_request" })), requestFor(), false, ["DUPLICATE_REQUEST"], "duplicate same request does not dispatch");
  check(createSignalNormalizer(trustedContext({ idempotencyStatus: "conflict" })), requestFor(), false, ["IDEMPOTENCY_CONFLICT"], "idempotency conflict");
  check(createSignalNormalizer(trustedContext({ callerLimitStatus: "exceeded" })), requestFor(), false, ["CALLER_RATE_LIMIT_EXCEEDED"], "caller rate exceeded");
  check(createSignalNormalizer(trustedContext({ routeLimitStatus: "exceeded" })), requestFor(), false, ["ROUTE_RATE_LIMIT_EXCEEDED"], "route rate exceeded");
  check(createSignalNormalizer(trustedContext({ callerLimitStatus: "unknown", routeLimitStatus: "unknown" })), requestFor(), false, ["RATE_LIMIT_STATE_UNKNOWN"], "unknown rate state");

  const budgetCases = [
    [{ authorityState: "missing" }, ["BUDGET_AUTHORITY_UNAVAILABLE"], "missing budget authority"],
    [{ configurationState: "unsupported" }, ["BUDGET_CONFIGURATION_INVALID"], "unsupported budget configuration"],
    [{ meterState: "unavailable" }, ["BUDGET_METER_UNAVAILABLE"], "unavailable budget meter"],
    [{ observedAtEpochSeconds: NOW - 301 }, ["BUDGET_METER_STALE"], "stale budget observation"],
    [{ budgetState: "warning_90" }, ["BUDGET_LIMIT_REACHED"], "warning 90 fails closed"],
    [{ budgetState: "hard_limit_reached" }, ["BUDGET_LIMIT_REACHED"], "hard limit reached"],
    [{ budgetState: "hard_limit_exceeded" }, ["BUDGET_LIMIT_REACHED"], "hard limit exceeded"]
  ];
  for (const [budget, reasons, label] of budgetCases) check(createSignalNormalizer(trustedContext({ budget })), requestFor(), false, reasons, label);

  const unknownSource = signedMutation(requestFor(), (value) => { value.source.sourceId = "unknown_source"; });
  check(normalizer, unknownSource, false, ["UNKNOWN_SOURCE"], "unknown source");
  const sourceClassMismatch = signedMutation(requestFor(), (value) => { value.source.sourceClass = "booking_control_plane"; });
  check(normalizer, sourceClassMismatch, false, ["UNKNOWN_SOURCE"], "source class mismatch");
  const categorySourceMismatch = requestFor(lifecycleSignal(), { sourceClass: "analytics_source", sourceId: "google_analytics_aggregate" });
  check(normalizer, categorySourceMismatch, false, ["SOURCE_CATEGORY_MISMATCH"], "category source mismatch");

  for (const category of ["raw_page_view", "raw_click", "raw_scroll", "raw_marketing_telemetry"]) {
    const candidate = signedMutation(requestFor(), (value) => { value.signal.category = category; value.signal.data = {}; });
    check(normalizer, candidate, false, ["RAW_CLICKSTREAM_PROHIBITED", "SOURCE_CATEGORY_MISMATCH"], `raw category ${category}`);
  }
  for (const category of ["anomaly", "incident", "workflow_command", "ai_request", "authorization_request", "approval"]) {
    const candidate = signedMutation(requestFor(), (value) => { value.signal.category = category; value.signal.data = {}; });
    check(normalizer, candidate, false, ["CONTROL_PLANE_INPUT_PROHIBITED", "SOURCE_CATEGORY_MISMATCH"], `control-plane category ${category}`);
  }
  const embeddedRaw = signedMutation(requestFor(), (value) => { value.signal.data.rawClicks = [{ x: 1 }]; });
  check(normalizer, embeddedRaw, false, ["RAW_CLICKSTREAM_PROHIBITED", "INVALID_SIGNAL"], "embedded raw clickstream");
  const embeddedControl = signedMutation(requestFor(), (value) => { value.signal.data.workflowCommand = "execute"; });
  check(normalizer, embeddedControl, false, ["CONTROL_PLANE_INPUT_PROHIBITED", "INVALID_SIGNAL"], "embedded control-plane command");

  const invalidSignals = [
    [(value) => { value.signal.data.metrics = []; }, ["INVALID_SIGNAL", "CARDINALITY_LIMIT_EXCEEDED"], "empty metric batch"],
    [(value) => { value.signal.data.metrics = Array.from({ length: 51 }, (_, index) => ({ name: `metric_${String(index).padStart(2, "0")}`, value: index, unit: "count" })); }, ["INVALID_SIGNAL", "CARDINALITY_LIMIT_EXCEEDED"], "metric cardinality exceeded"],
    [(value) => { value.signal.data.metrics.reverse(); }, ["INVALID_SIGNAL"], "unsorted metrics"],
    [(value) => { value.signal.data.windowEnd = "2026-08-13T08:00:00Z"; }, ["INVALID_SIGNAL"], "wrong hourly window"],
    [(value) => { value.signal.data.windowStart = "2026-02-30T06:00:00Z"; }, ["INVALID_SIGNAL"], "invalid calendar timestamp"],
    [(value) => { value.signal.data.sampleCount = 0; }, ["INVALID_SIGNAL"], "empty aggregate sample"],
    [(value) => { value.signal.data.metrics[0].value = -1; }, ["INVALID_SIGNAL"], "negative metric"],
    [(value) => { value.signal.occurredAt = "not-a-time"; }, ["INVALID_SIGNAL"], "invalid occurrence time"]
  ];
  for (const [mutate, reasons, label] of invalidSignals) check(normalizer, signedMutation(requestFor(), mutate), false, reasons, label);

  for (const eventType of ["booking_created", "booking_confirmed", "booking_cancelled", "guest_checked_in", "guest_checked_out"]) {
    const signal = lifecycleSignal();
    signal.data.eventType = eventType;
    check(normalizer, requestFor(signal, { sourceClass: "booking_control_plane", sourceId: "booking_lifecycle_gateway" }), true, null, `lifecycle vocabulary ${eventType}`);
  }
  const badLifecycle = lifecycleSignal();
  badLifecycle.data.eventType = "price_changed";
  check(normalizer, requestFor(badLifecycle, { sourceClass: "booking_control_plane", sourceId: "booking_lifecycle_gateway" }), false, ["INVALID_SIGNAL"], "non-essential lifecycle event");
  const guestData = lifecycleSignal();
  guestData.data.guestEmail = "guest@example.invalid";
  check(normalizer, requestFor(guestData, { sourceClass: "booking_control_plane", sourceId: "booking_lifecycle_gateway" }), false, ["INVALID_SIGNAL"], "guest field excluded by closed lifecycle shape");

  const bodyLimit = requestFor();
  bodyLimit.bodyBytes = 65_537;
  bodyLimit.signature = createHmac("sha256", SYNTHETIC_TEST_KEY).update(signingPayload(bodyLimit), "utf8").digest("hex");
  check(normalizer, bodyLimit, false, ["REQUEST_BODY_LIMIT_EXCEEDED"], "request body limit");

  const malformed = [null, undefined, true, "request", 1, 1n, Symbol("request"), () => {}, [], new Date(), { ...requestFor(), extra: true }];
  const cyclic = {}; cyclic.self = cyclic; malformed.push(cyclic);
  const accessor = {}; Object.defineProperty(accessor, "schemaVersion", { get() { throw new Error("getter must not run"); }, enumerable: true }); malformed.push(accessor);
  malformed.push(new Proxy({}, { ownKeys() { throw new Error("proxy trap"); } }));
  for (const [index, candidate] of malformed.entries()) check(normalizer, candidate, false, ["MALFORMED_REQUEST"], `malformed never-throw ${index}`);

  process.stdout.write(`P3-001 signed signal-ingestion V1 validation passed (${assertions} assertions).\n`);
} catch (error) {
  process.stderr.write(`P3-001 signed signal-ingestion V1 validation failed: ${error.message}\n`);
  process.exitCode = 1;
}
