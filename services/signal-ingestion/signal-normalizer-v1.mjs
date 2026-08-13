import { createHmac, timingSafeEqual } from "node:crypto";

const EXPECTED_AUDIENCE = "staff-control-signal-ingestion";
const EXPECTED_ROUTE = "aggregate_or_lifecycle_ingest";
const MAX_REQUEST_BODY_BYTES = 65_536;
const MAX_AUTH_LIFETIME_SECONDS = 300;
const MAX_CLOCK_SKEW_SECONDS = 60;
const MAX_BUDGET_AGE_SECONDS = 300;
const MAX_AGGREGATE_METRICS = 50;

const ROOT_FIELDS = Object.freeze([
  "schemaVersion", "requestId", "method", "routeClass", "source", "audience",
  "issuedAtEpochSeconds", "expiresAtEpochSeconds", "nonce", "idempotencyKey",
  "signatureAlgorithm", "signature", "bodyBytes", "signal"
]);
const SOURCE_FIELDS = Object.freeze(["sourceClass", "sourceId"]);
const SIGNAL_FIELDS = Object.freeze(["category", "signalId", "correlationId", "occurredAt", "data"]);
const AGGREGATE_FIELDS = Object.freeze(["windowStart", "windowEnd", "sampleCount", "aggregationComplete", "metrics"]);
const METRIC_FIELDS = Object.freeze(["name", "value", "unit"]);
const LIFECYCLE_FIELDS = Object.freeze(["eventType", "lifecycleReferenceId", "propertyScope", "stateVersion", "changeSequence"]);
const TRUST_FIELDS = Object.freeze(["verificationKey", "nowEpochSeconds", "nonceStatus", "idempotencyStatus", "callerLimitStatus", "routeLimitStatus", "budget"]);
const BUDGET_FIELDS = Object.freeze(["authorityState", "configurationState", "meterState", "budgetState", "observedAtEpochSeconds", "maxAgeSeconds"]);
const AUTHORITY_INJECTION_FIELDS = new Set(["schema", "policy", "contract", "adapter", "configuration", "validator", "dependencies", "verifier", "verificationKey", "secret", "credential"]);
const SOURCE_CATEGORY = Object.freeze({
  google_analytics_aggregate: Object.freeze({ sourceClass: "analytics_source", categories: Object.freeze(["hourly_analytics_aggregate", "daily_analytics_aggregate"]) }),
  google_search_console_aggregate: Object.freeze({ sourceClass: "analytics_source", categories: Object.freeze(["hourly_analytics_aggregate", "daily_analytics_aggregate"]) }),
  booking_lifecycle_gateway: Object.freeze({ sourceClass: "booking_control_plane", categories: Object.freeze(["essential_booking_lifecycle_event"]) })
});
const ACCEPTED_CATEGORIES = new Set(["hourly_analytics_aggregate", "daily_analytics_aggregate", "essential_booking_lifecycle_event"]);
const RAW_CATEGORIES = new Set(["raw_page_view", "raw_click", "raw_scroll", "raw_marketing_telemetry"]);
const CONTROL_CATEGORIES = new Set(["anomaly", "incident", "investigation", "recommendation", "intervention_proposal", "approval", "execution", "outcome", "required_audit_evidence", "workflow_command", "ai_request", "authorization_request"]);
const LIFECYCLE_EVENTS = new Set(["booking_created", "booking_confirmed", "booking_cancelled", "guest_checked_in", "guest_checked_out"]);
const METRIC_UNITS = new Set(["count", "basis_points", "milliseconds", "bytes", "currency_minor_units"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const LOWER_IDENTIFIER = /^[a-z][a-z0-9-]{0,63}$/;
const METRIC_NAME = /^[a-z][a-z0-9_]{0,63}$/;
const SIGNATURE = /^[a-f0-9]{64}$/;
const RFC3339_UTC = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?Z$/;
const RAW_EMBEDDED_KEYS = new Set(["rawEvent", "rawEvents", "rawPageView", "rawPageViews", "rawClick", "rawClicks", "rawScroll", "rawScrolls", "rawMarketingTelemetry", "guestInteraction", "guestInteractions"]);
const CONTROL_EMBEDDED_KEYS = new Set(["controlPlane", "workflow", "workflowCommand", "aiInvocation", "aiRequest", "authorization", "approval", "command"]);
const REASON_PRECEDENCE = Object.freeze([
  "TRUST_CONTEXT_UNAVAILABLE",
  "CALLER_AUTHORITY_INJECTION",
  "MALFORMED_REQUEST",
  "UNSUPPORTED_SCHEMA_VERSION",
  "UNSUPPORTED_ROUTE",
  "INVALID_AUTHENTICATION",
  "INVALID_SIGNATURE",
  "INVALID_AUDIENCE",
  "AUTHENTICATION_EXPIRED",
  "TIMESTAMP_OUTSIDE_WINDOW",
  "REPLAY_DETECTED",
  "DUPLICATE_REQUEST",
  "IDEMPOTENCY_CONFLICT",
  "REQUEST_BODY_LIMIT_EXCEEDED",
  "CALLER_RATE_LIMIT_EXCEEDED",
  "ROUTE_RATE_LIMIT_EXCEEDED",
  "RATE_LIMIT_STATE_UNKNOWN",
  "BUDGET_AUTHORITY_UNAVAILABLE",
  "BUDGET_CONFIGURATION_INVALID",
  "BUDGET_METER_UNAVAILABLE",
  "BUDGET_METER_STALE",
  "BUDGET_LIMIT_REACHED",
  "UNKNOWN_SOURCE",
  "RAW_CLICKSTREAM_PROHIBITED",
  "CONTROL_PLANE_INPUT_PROHIBITED",
  "UNKNOWN_CATEGORY",
  "SOURCE_CATEGORY_MISMATCH",
  "INVALID_SIGNAL",
  "CARDINALITY_LIMIT_EXCEEDED"
]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, fields) {
  return isPlainObject(value) && Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function guardedClone(value, seen = new Set(), depth = 0) {
  if (depth > 24) throw new TypeError("excessive depth");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number");
    return value;
  }
  if (typeof value !== "object") throw new TypeError("non-JSON value");
  if (seen.has(value)) throw new TypeError("cycle");
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const keys = Reflect.ownKeys(value);
      if (keys.some((key) => typeof key === "symbol" || (key !== "length" && !/^(0|[1-9][0-9]*)$/.test(key)))) throw new TypeError("non-plain array");
      const clone = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new TypeError("sparse or accessor array");
        clone.push(guardedClone(descriptor.value, seen, depth + 1));
      }
      return clone;
    }
    if (!isPlainObject(value)) throw new TypeError("non-plain object");
    const clone = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new TypeError("symbol key");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new TypeError("accessor");
      Object.defineProperty(clone, key, { value: guardedClone(descriptor.value, seen, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    return clone;
  } finally {
    seen.delete(value);
  }
}

function deepFreeze(value) {
  if (value !== null && typeof value === "object") {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
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

function hasAuthorityInjection(input) {
  try {
    return isPlainObject(input) && Reflect.ownKeys(input).some((key) => typeof key === "string" && AUTHORITY_INJECTION_FIELDS.has(key));
  } catch {
    return false;
  }
}

function validUtcTimestamp(value) {
  if (typeof value !== "string") return false;
  const match = value.match(RFC3339_UTC);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, fraction = ""] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return false;
  const milliseconds = Number(fraction.padEnd(3, "0"));
  return Date.parse(value) === Date.UTC(year, month - 1, day, hour, minute, second, milliseconds);
}

function effects() {
  return deepFreeze({ aiInvocations: 0, permanentWorkItemsCreated: 0, persistenceWrites: 0, queueMessages: 0, workflowStarts: 0, notifications: 0, productionWrites: 0 });
}

function rejection(reasons) {
  const selected = REASON_PRECEDENCE.filter((reason) => reasons.has(reason));
  return deepFreeze({ ok: false, value: null, rejection: { schemaVersion: "1.0.0", failClosed: true, reasonCodes: selected.length > 0 ? selected : ["MALFORMED_REQUEST"] }, effects: effects() });
}

function trustContextIsValid(context) {
  if (!exactKeys(context, TRUST_FIELDS) || !exactKeys(context.budget, BUDGET_FIELDS)) return false;
  if (typeof context.verificationKey !== "string" || context.verificationKey.length < 32 || context.verificationKey.length > 256) return false;
  if (!Number.isSafeInteger(context.nowEpochSeconds) || context.nowEpochSeconds < 0) return false;
  if (!new Set(["fresh", "missing", "reused", "invalid"]).has(context.nonceStatus)) return false;
  if (!new Set(["new", "missing", "duplicate_same_request", "conflict"]).has(context.idempotencyStatus)) return false;
  if (!new Set(["within_limit", "exceeded", "unknown"]).has(context.callerLimitStatus) || !new Set(["within_limit", "exceeded", "unknown"]).has(context.routeLimitStatus)) return false;
  const budget = context.budget;
  if (!new Set(["available", "missing", "unavailable", "inconsistent", "unknown"]).has(budget.authorityState)) return false;
  if (!new Set(["valid", "missing", "unsupported", "inconsistent", "unknown"]).has(budget.configurationState)) return false;
  if (!new Set(["fresh", "missing", "unavailable", "stale", "inconsistent", "uncertain", "unknown"]).has(budget.meterState)) return false;
  if (!new Set(["below_warning", "warning_50", "warning_75", "warning_90", "hard_limit_reached", "hard_limit_exceeded"]).has(budget.budgetState)) return false;
  return Number.isSafeInteger(budget.observedAtEpochSeconds) && budget.observedAtEpochSeconds >= 0 && Number.isSafeInteger(budget.maxAgeSeconds) && budget.maxAgeSeconds >= 0 && budget.maxAgeSeconds <= MAX_BUDGET_AGE_SECONDS;
}

function requestShapeIsComplete(request) {
  return exactKeys(request, ROOT_FIELDS) && exactKeys(request.source, SOURCE_FIELDS) && exactKeys(request.signal, SIGNAL_FIELDS) &&
    typeof request.schemaVersion === "string" && typeof request.requestId === "string" && typeof request.method === "string" && typeof request.routeClass === "string" &&
    typeof request.source.sourceClass === "string" && typeof request.source.sourceId === "string" && typeof request.audience === "string" &&
    typeof request.issuedAtEpochSeconds === "number" && typeof request.expiresAtEpochSeconds === "number" && typeof request.nonce === "string" &&
    typeof request.idempotencyKey === "string" && typeof request.signatureAlgorithm === "string" && typeof request.signature === "string" &&
    typeof request.bodyBytes === "number" && typeof request.signal.category === "string" && typeof request.signal.signalId === "string" &&
    typeof request.signal.correlationId === "string" && typeof request.signal.occurredAt === "string" && isPlainObject(request.signal.data);
}

function containsEmbeddedShape(value, prohibitedKeys, depth = 0) {
  if (depth > 12 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((entry) => containsEmbeddedShape(entry, prohibitedKeys, depth + 1));
  return Object.keys(value).some((key) => prohibitedKeys.has(key) || containsEmbeddedShape(value[key], prohibitedKeys, depth + 1));
}

function signatureIsValid(request, verificationKey) {
  if (request.signatureAlgorithm !== "hmac-sha256" || !SIGNATURE.test(request.signature)) return false;
  const expected = createHmac("sha256", verificationKey).update(signingPayload(request), "utf8").digest();
  const supplied = Buffer.from(request.signature, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

function authenticationReasons(request, context, reasons) {
  if (!IDENTIFIER.test(request.requestId) || !LOWER_IDENTIFIER.test(request.nonce) || !IDENTIFIER.test(request.idempotencyKey)) reasons.add("INVALID_AUTHENTICATION");
  if (request.audience !== EXPECTED_AUDIENCE) reasons.add("INVALID_AUDIENCE");
  if (!Number.isSafeInteger(request.issuedAtEpochSeconds) || !Number.isSafeInteger(request.expiresAtEpochSeconds) || request.issuedAtEpochSeconds < 0 || request.expiresAtEpochSeconds < 0 || request.expiresAtEpochSeconds <= request.issuedAtEpochSeconds || request.expiresAtEpochSeconds - request.issuedAtEpochSeconds > MAX_AUTH_LIFETIME_SECONDS) reasons.add("INVALID_AUTHENTICATION");
  else {
    if (context.nowEpochSeconds > request.expiresAtEpochSeconds) reasons.add("AUTHENTICATION_EXPIRED");
    if (request.issuedAtEpochSeconds > context.nowEpochSeconds + MAX_CLOCK_SKEW_SECONDS) reasons.add("TIMESTAMP_OUTSIDE_WINDOW");
  }
  if (context.nonceStatus !== "fresh") reasons.add("REPLAY_DETECTED");
  if (context.idempotencyStatus === "duplicate_same_request") reasons.add("DUPLICATE_REQUEST");
  else if (context.idempotencyStatus === "conflict") reasons.add("IDEMPOTENCY_CONFLICT");
  else if (context.idempotencyStatus !== "new") reasons.add("INVALID_AUTHENTICATION");
}

function operationalReasons(request, context, reasons) {
  const computedBodyBytes = Buffer.byteLength(stableJson(request.signal), "utf8");
  if (!Number.isSafeInteger(request.bodyBytes) || request.bodyBytes < 0 || request.bodyBytes !== computedBodyBytes || request.bodyBytes > MAX_REQUEST_BODY_BYTES) reasons.add("REQUEST_BODY_LIMIT_EXCEEDED");
  if (context.callerLimitStatus === "exceeded") reasons.add("CALLER_RATE_LIMIT_EXCEEDED");
  else if (context.callerLimitStatus !== "within_limit") reasons.add("RATE_LIMIT_STATE_UNKNOWN");
  if (context.routeLimitStatus === "exceeded") reasons.add("ROUTE_RATE_LIMIT_EXCEEDED");
  else if (context.routeLimitStatus !== "within_limit") reasons.add("RATE_LIMIT_STATE_UNKNOWN");
  const budget = context.budget;
  if (budget.authorityState !== "available") reasons.add("BUDGET_AUTHORITY_UNAVAILABLE");
  if (budget.configurationState !== "valid") reasons.add("BUDGET_CONFIGURATION_INVALID");
  if (budget.meterState !== "fresh") reasons.add("BUDGET_METER_UNAVAILABLE");
  if (context.nowEpochSeconds < budget.observedAtEpochSeconds || context.nowEpochSeconds - budget.observedAtEpochSeconds > budget.maxAgeSeconds) reasons.add("BUDGET_METER_STALE");
  if (new Set(["warning_90", "hard_limit_reached", "hard_limit_exceeded"]).has(budget.budgetState)) reasons.add("BUDGET_LIMIT_REACHED");
}

function aggregateDataIsValid(data, category, reasons) {
  if (!exactKeys(data, AGGREGATE_FIELDS) || !validUtcTimestamp(data.windowStart) || !validUtcTimestamp(data.windowEnd) || !Number.isSafeInteger(data.sampleCount) || data.sampleCount < 1 || data.aggregationComplete !== true || !Array.isArray(data.metrics)) return false;
  if (data.metrics.length < 1 || data.metrics.length > MAX_AGGREGATE_METRICS) {
    reasons.add("CARDINALITY_LIMIT_EXCEEDED");
    return false;
  }
  const start = Date.parse(data.windowStart);
  const end = Date.parse(data.windowEnd);
  const expectedDuration = category === "hourly_analytics_aggregate" ? 3_600_000 : 86_400_000;
  if (end - start !== expectedDuration) return false;
  let previousName = null;
  for (const metric of data.metrics) {
    if (!exactKeys(metric, METRIC_FIELDS) || typeof metric.name !== "string" || !METRIC_NAME.test(metric.name) || typeof metric.value !== "number" || !Number.isFinite(metric.value) || metric.value < 0 || !METRIC_UNITS.has(metric.unit)) return false;
    if (previousName !== null && previousName >= metric.name) return false;
    previousName = metric.name;
  }
  return true;
}

function lifecycleDataIsValid(data) {
  return exactKeys(data, LIFECYCLE_FIELDS) && LIFECYCLE_EVENTS.has(data.eventType) && IDENTIFIER.test(data.lifecycleReferenceId) && data.propertyScope === "sut-grand-hotel" && Number.isSafeInteger(data.stateVersion) && data.stateVersion > 0 && Number.isSafeInteger(data.changeSequence) && data.changeSequence > 0;
}

function signalReasons(request, reasons) {
  const { signal, source } = request;
  if (RAW_CATEGORIES.has(signal.category)) reasons.add("RAW_CLICKSTREAM_PROHIBITED");
  else if (CONTROL_CATEGORIES.has(signal.category)) reasons.add("CONTROL_PLANE_INPUT_PROHIBITED");
  else if (!ACCEPTED_CATEGORIES.has(signal.category)) reasons.add("UNKNOWN_CATEGORY");
  if (containsEmbeddedShape(signal.data, RAW_EMBEDDED_KEYS)) reasons.add("RAW_CLICKSTREAM_PROHIBITED");
  if (containsEmbeddedShape(signal.data, CONTROL_EMBEDDED_KEYS)) reasons.add("CONTROL_PLANE_INPUT_PROHIBITED");
  const sourceRule = SOURCE_CATEGORY[source.sourceId];
  if (!sourceRule || sourceRule.sourceClass !== source.sourceClass) reasons.add("UNKNOWN_SOURCE");
  else if (!sourceRule.categories.includes(signal.category)) reasons.add("SOURCE_CATEGORY_MISMATCH");
  if (!IDENTIFIER.test(signal.signalId) || !IDENTIFIER.test(signal.correlationId) || !validUtcTimestamp(signal.occurredAt)) reasons.add("INVALID_SIGNAL");
  if (signal.category === "hourly_analytics_aggregate" || signal.category === "daily_analytics_aggregate") {
    if (!aggregateDataIsValid(signal.data, signal.category, reasons)) reasons.add("INVALID_SIGNAL");
  } else if (signal.category === "essential_booking_lifecycle_event") {
    if (!lifecycleDataIsValid(signal.data)) reasons.add("INVALID_SIGNAL");
  }
}

function normalizedEvent(request) {
  const { signal, source } = request;
  let type;
  let payload;
  if (signal.category === "essential_booking_lifecycle_event") {
    type = `booking.lifecycle.${signal.data.eventType.replaceAll("_", ".")}`;
    payload = {
      category: signal.category,
      eventType: signal.data.eventType,
      lifecycleReferenceId: signal.data.lifecycleReferenceId,
      propertyScope: signal.data.propertyScope,
      stateVersion: signal.data.stateVersion,
      changeSequence: signal.data.changeSequence
    };
  } else {
    const cadence = signal.category === "hourly_analytics_aggregate" ? "hourly" : "daily";
    type = `analytics.aggregate.${cadence}`;
    payload = {
      category: signal.category,
      windowStart: signal.data.windowStart,
      windowEnd: signal.data.windowEnd,
      sampleCount: signal.data.sampleCount,
      metrics: signal.data.metrics.map((metric) => ({ ...metric }))
    };
  }
  return {
    schemaVersion: "1.0.0",
    eventId: signal.signalId,
    correlationId: signal.correlationId,
    source: { system: source.sourceId, component: "signal-ingestion" },
    type,
    severity: "info",
    occurredAt: signal.occurredAt,
    payload
  };
}

function accepted(request) {
  return deepFreeze({
    ok: true,
    value: {
      schemaVersion: "1.0.0",
      category: request.signal.category,
      event: normalizedEvent(request),
      nonAuthoritative: true,
      persistenceAuthorized: false,
      permanentWorkItemAuthorized: false,
      aiInvocationAuthorized: false,
      productionWriteAuthorized: false
    },
    rejection: null,
    effects: effects()
  });
}

export function createSignalNormalizer(trustedContext) {
  let context;
  try {
    context = guardedClone(trustedContext);
  } catch {
    context = null;
  }
  const contextValid = trustContextIsValid(context);
  if (contextValid) deepFreeze(context);

  return Object.freeze({
    normalize(request) {
      try {
        if (!contextValid) return rejection(new Set(["TRUST_CONTEXT_UNAVAILABLE"]));
        if (hasAuthorityInjection(request)) return rejection(new Set(["CALLER_AUTHORITY_INJECTION"]));
        let value;
        try {
          value = guardedClone(request);
        } catch {
          return rejection(new Set(["MALFORMED_REQUEST"]));
        }
        if (!requestShapeIsComplete(value)) return rejection(new Set(["MALFORMED_REQUEST"]));
        const reasons = new Set();
        if (value.schemaVersion !== "1.0.0") reasons.add("UNSUPPORTED_SCHEMA_VERSION");
        if (value.method !== "POST" || value.routeClass !== EXPECTED_ROUTE) reasons.add("UNSUPPORTED_ROUTE");
        authenticationReasons(value, context, reasons);
        if (!signatureIsValid(value, context.verificationKey)) reasons.add("INVALID_SIGNATURE");
        operationalReasons(value, context, reasons);
        signalReasons(value, reasons);
        if (reasons.size > 0) return rejection(reasons);
        return accepted(value);
      } catch {
        return rejection(new Set(["TRUST_CONTEXT_UNAVAILABLE"]));
      }
    }
  });
}
