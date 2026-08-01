/** Static P2-007 resource classification. This module performs no resource-control action. */

const ROOT_FIELDS = Object.freeze(["schemaVersion", "observationId", "resourceDimension", "unit", "workloadZone", "budgetAuthorityState", "configurationState", "meterState", "usedUnits", "reservedUnits", "hardLimitUnits", "observedAt", "meterAgeSeconds", "workloadControls", "bookingIsolation", "authorityClaims"]);
const WORKLOAD_FIELDS = Object.freeze(["batchingMode", "batchSize", "deduplicationRequired", "idempotencyRequired", "backpressureRequired", "rateLimitPerMinute", "concurrencyLimit", "retryLimit", "retryAttempt", "deadLetterHandlingRequired", "priorityQueueRequired", "summaryMode", "perGuestInteractionUnitOfWork", "perEventAiInvocation", "safeToRequeue"]);
const BOOKING_FIELDS = Object.freeze(["bookingWorkload", "sharesQuotaWithBooking", "sharesCredentialsWithBooking", "sharesDeploymentWithBooking", "sharesFailureBoundaryWithBooking"]);
const AUTHORITY_FIELDS = Object.freeze(["callerSuppliesPolicy", "callerSuppliesThresholds", "decisionAuthorizesScheduling", "decisionAuthorizesExecution", "decisionAuthorizesNotification", "decisionAuthorizesProductionWrite", "productionWriteGranted"]);
const INJECTED_AUTHORITY_FIELDS = new Set(["schema", "policy", "contract", "validator", "configuration", "thresholds", "resourceBudgetPolicy", "adapter", "dependencies"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TIMESTAMP = /^[0-9]{4}-(0[1-9]|1[0-2])-([0-2][0-9]|3[01])T([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]Z$/;

const DIMENSIONS = Object.freeze([
  Object.freeze({ resourceDimension: "worker_requests", unit: "requests" }),
  Object.freeze({ resourceDimension: "worker_cpu_milliseconds", unit: "milliseconds" }),
  Object.freeze({ resourceDimension: "queue_operations", unit: "operations" }),
  Object.freeze({ resourceDimension: "workflow_steps", unit: "steps" }),
  Object.freeze({ resourceDimension: "persistence_size_bytes", unit: "bytes" }),
  Object.freeze({ resourceDimension: "persistence_growth_bytes", unit: "bytes" }),
  Object.freeze({ resourceDimension: "persistence_egress_bytes", unit: "bytes" }),
  Object.freeze({ resourceDimension: "runner_minutes", unit: "minutes" }),
  Object.freeze({ resourceDimension: "ai_invocations", unit: "invocations" }),
  Object.freeze({ resourceDimension: "ai_tokens", unit: "tokens" }),
  Object.freeze({ resourceDimension: "notification_messages", unit: "messages" })
]);
const UNIT_BY_DIMENSION = new Map(DIMENSIONS.map(({ resourceDimension, unit }) => [resourceDimension, unit]));
const BUDGET_AUTHORITY_STATES = new Set(["available", "missing", "unavailable", "inconsistent", "unknown"]);
const CONFIGURATION_STATES = new Set(["valid", "missing", "unsupported", "inconsistent", "unknown"]);
const METER_STATES = new Set(["fresh", "missing", "unavailable", "stale", "inconsistent", "uncertain", "unknown"]);
const WORKLOAD_ZONES = new Set(["staff_control", "ai_workload"]);
const BATCHING_MODES = new Set(["bounded_batch", "scheduled_summary", "governed_case"]);
const SUMMARY_MODES = new Set(["scheduled_summary", "governed_case"]);
const CEILINGS = Object.freeze({ maxBatchSize: 500, maxRateLimitPerMinute: 1000, maxConcurrency: 8, maxRetryLimit: 3, maxMeterAgeSeconds: 300 });
const REASON_PRECEDENCE = Object.freeze(["INTERNAL_AUTHORITY_UNAVAILABLE", "CALLER_AUTHORITY_INJECTION", "MALFORMED_OBSERVATION", "UNSUPPORTED_SCHEMA_VERSION", "UNKNOWN_RESOURCE_DIMENSION", "UNIT_MISMATCH", "UNSUPPORTED_WORKLOAD_ZONE", "BOOKING_WORKLOAD_PROHIBITED", "BOOKING_QUOTA_BOUNDARY_VIOLATION", "BOOKING_CREDENTIAL_BOUNDARY_VIOLATION", "BOOKING_DEPLOYMENT_BOUNDARY_VIOLATION", "BOOKING_FAILURE_BOUNDARY_VIOLATION", "BUDGET_AUTHORITY_MISSING", "BUDGET_AUTHORITY_UNAVAILABLE", "BUDGET_AUTHORITY_INCONSISTENT", "BUDGET_AUTHORITY_UNKNOWN", "CONFIGURATION_MISSING", "UNSUPPORTED_CONFIGURATION", "CONFIGURATION_INCONSISTENT", "CONFIGURATION_UNKNOWN", "METER_MISSING", "METER_UNAVAILABLE", "METER_STALE", "METER_INCONSISTENT", "METER_UNCERTAIN", "METER_UNKNOWN", "METRIC_MISSING", "HARD_LIMIT_MISSING", "METERING_TIMESTAMP_MISSING", "METER_AGE_INVALID", "UNBOUNDED_BATCHING", "DEDUPLICATION_REQUIRED", "IDEMPOTENCY_REQUIRED", "BACKPRESSURE_REQUIRED", "RATE_LIMIT_REQUIRED", "CONCURRENCY_LIMIT_REQUIRED", "RETRY_LIMIT_REQUIRED", "RETRY_ATTEMPT_INVALID", "DEAD_LETTER_HANDLING_REQUIRED", "PRIORITY_QUEUE_REQUIRED", "CONTINUOUS_OR_PER_EVENT_SUMMARY_PROHIBITED", "PER_INTERACTION_WORK_PROHIBITED", "PER_EVENT_AI_INVOCATION_PROHIBITED", "WORKLOAD_CEILING_EXCEEDED", "SELF_AUTHORIZATION_CLAIM", "PRODUCTION_WRITE_CLAIM"]);

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, fields) {
  return isPlainObject(value) && Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function guardedClone(value, seen = new Set(), depth = 0) {
  if (depth > 32) throw new TypeError("excessive depth");
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

function arraysEqual(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => typeof value === "object" ? JSON.stringify(value) === JSON.stringify(right[index]) : value === right[index]);
}

function policySemanticsAreExact(policy) {
  if (!exactKeys(policy, ["schemaVersion", "policyId", "resourceDimensions", "thresholdBasisPoints", "budgetStates", "meterStates", "budgetAuthorityStates", "configurationStates", "workloadZones", "decisionOutcomes", "workloadCeilings", "decisionRules", "bookingIsolation", "reasonPrecedence", "authority"])) return false;
  return policy.schemaVersion === "1.0.0" && policy.policyId === "resource-budget-policy-v1" && arraysEqual(policy.resourceDimensions, DIMENSIONS) && arraysEqual(policy.reasonPrecedence, REASON_PRECEDENCE) && JSON.stringify(policy.thresholdBasisPoints) === JSON.stringify({ warning50: 5000, warning75: 7500, warning90: 9000, hardLimit: 10000 }) && JSON.stringify(policy.workloadCeilings) === JSON.stringify(CEILINGS) && JSON.stringify(policy.bookingIsolation) === JSON.stringify({ bookingWorkload: false, sharesQuotaWithBooking: false, sharesCredentialsWithBooking: false, sharesDeploymentWithBooking: false, sharesFailureBoundaryWithBooking: false }) && JSON.stringify(policy.authority) === JSON.stringify({ nonAuthoritative: true, schedulingAuthorized: false, executionAuthorized: false, notificationAuthorized: false, productionWriteAuthorized: false, capacityReservationAuthorized: false, bookingEffectAuthorized: false });
}

function schemaSemanticsAreExpected(schema) {
  return isPlainObject(schema) && schema.$schema === "https://json-schema.org/draft/2020-12/schema" && schema.$id === "https://sut-ai-os.local/schemas/resource-budget-contract-v1.schema.json" && schema.additionalProperties === false && schema.$defs?.resourceBudgetObservation?.additionalProperties === false && Array.isArray(schema.$defs?.resourceBudgetDecision?.oneOf) && schema.$defs.resourceBudgetDecision.oneOf.length === 2;
}

async function loadAuthority() {
  try {
    const [{ default: schemaSource }, { default: policySource }, { default: Ajv2020 }] = await Promise.all([
      import("../../../schemas/resource-budget-contract-v1.schema.json", { with: { type: "json" } }),
      import("../../../policies/resource-budget-policy-v1.json", { with: { type: "json" } }),
      import("ajv/dist/2020.js")
    ]);
    const schema = deepFreeze(guardedClone(schemaSource));
    const policy = deepFreeze(guardedClone(policySource));
    if (!schemaSemanticsAreExpected(schema) || !policySemanticsAreExact(policy)) return null;
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
    if (!ajv.validateSchema(schema)) return null;
    const validatePolicy = ajv.compile(schema);
    if (!validatePolicy(policy)) return null;
    const validateObservation = ajv.compile({ $ref: `${schema.$id}#/$defs/resourceBudgetObservation` });
    return Object.freeze({ validateObservation });
  } catch {
    return null;
  }
}

const authority = await loadAuthority();

function hasCallerAuthorityInjection(input) {
  try {
    if (!isPlainObject(input)) return false;
    if (Reflect.ownKeys(input).some((key) => typeof key === "string" && INJECTED_AUTHORITY_FIELDS.has(key))) return true;
    const claimDescriptor = Object.getOwnPropertyDescriptor(input, "authorityClaims");
    if (!claimDescriptor || !Object.hasOwn(claimDescriptor, "value") || !isPlainObject(claimDescriptor.value)) return false;
    for (const field of ["callerSuppliesPolicy", "callerSuppliesThresholds"]) {
      const descriptor = Object.getOwnPropertyDescriptor(claimDescriptor.value, field);
      if (descriptor && Object.hasOwn(descriptor, "value") && descriptor.value === true) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function rejection(reasonCodes, outcome = "block_candidate") {
  return deepFreeze({ ok: false, value: null, rejection: { schemaVersion: "1.0.0", failClosed: true, outcome, reasonCodes: [...reasonCodes] } });
}

function shapeIsComplete(value) {
  if (!exactKeys(value, ROOT_FIELDS) || typeof value.schemaVersion !== "string" || typeof value.observationId !== "string" || typeof value.resourceDimension !== "string" || typeof value.unit !== "string" || typeof value.workloadZone !== "string" || typeof value.budgetAuthorityState !== "string" || typeof value.configurationState !== "string" || typeof value.meterState !== "string") return false;
  if (!["number", "object"].includes(typeof value.usedUnits) || !["number", "object"].includes(typeof value.reservedUnits) || !["number", "object"].includes(typeof value.hardLimitUnits) || !["string", "object"].includes(typeof value.observedAt) || !["number", "object"].includes(typeof value.meterAgeSeconds)) return false;
  if (!exactKeys(value.workloadControls, WORKLOAD_FIELDS) || !exactKeys(value.bookingIsolation, BOOKING_FIELDS) || !exactKeys(value.authorityClaims, AUTHORITY_FIELDS)) return false;
  const workload = value.workloadControls;
  if (typeof workload.batchingMode !== "string" || typeof workload.summaryMode !== "string") return false;
  for (const field of ["deduplicationRequired", "idempotencyRequired", "backpressureRequired", "deadLetterHandlingRequired", "priorityQueueRequired", "perGuestInteractionUnitOfWork", "perEventAiInvocation", "safeToRequeue"]) if (typeof workload[field] !== "boolean") return false;
  for (const field of BOOKING_FIELDS) if (typeof value.bookingIsolation[field] !== "boolean") return false;
  return AUTHORITY_FIELDS.every((field) => typeof value.authorityClaims[field] === "boolean");
}

function isSafeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isSafePositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function semanticReasons(value) {
  const reasons = new Set();
  if (!IDENTIFIER.test(value.observationId)) reasons.add("MALFORMED_OBSERVATION");
  if (value.schemaVersion !== "1.0.0") reasons.add("UNSUPPORTED_SCHEMA_VERSION");
  const expectedUnit = UNIT_BY_DIMENSION.get(value.resourceDimension);
  if (!expectedUnit) reasons.add("UNKNOWN_RESOURCE_DIMENSION");
  else if (value.unit !== expectedUnit) reasons.add("UNIT_MISMATCH");
  if (!WORKLOAD_ZONES.has(value.workloadZone)) reasons.add("UNSUPPORTED_WORKLOAD_ZONE");
  if (value.workloadZone === "booking_control_plane" || value.bookingIsolation.bookingWorkload) reasons.add("BOOKING_WORKLOAD_PROHIBITED");
  if (value.bookingIsolation.sharesQuotaWithBooking) reasons.add("BOOKING_QUOTA_BOUNDARY_VIOLATION");
  if (value.bookingIsolation.sharesCredentialsWithBooking) reasons.add("BOOKING_CREDENTIAL_BOUNDARY_VIOLATION");
  if (value.bookingIsolation.sharesDeploymentWithBooking) reasons.add("BOOKING_DEPLOYMENT_BOUNDARY_VIOLATION");
  if (value.bookingIsolation.sharesFailureBoundaryWithBooking) reasons.add("BOOKING_FAILURE_BOUNDARY_VIOLATION");

  const authorityReasons = { missing: "BUDGET_AUTHORITY_MISSING", unavailable: "BUDGET_AUTHORITY_UNAVAILABLE", inconsistent: "BUDGET_AUTHORITY_INCONSISTENT", unknown: "BUDGET_AUTHORITY_UNKNOWN" };
  if (value.budgetAuthorityState !== "available") reasons.add(authorityReasons[value.budgetAuthorityState] ?? "BUDGET_AUTHORITY_UNKNOWN");
  const configurationReasons = { missing: "CONFIGURATION_MISSING", unsupported: "UNSUPPORTED_CONFIGURATION", inconsistent: "CONFIGURATION_INCONSISTENT", unknown: "CONFIGURATION_UNKNOWN" };
  if (value.configurationState !== "valid") reasons.add(configurationReasons[value.configurationState] ?? "CONFIGURATION_UNKNOWN");
  const meterReasons = { missing: "METER_MISSING", unavailable: "METER_UNAVAILABLE", stale: "METER_STALE", inconsistent: "METER_INCONSISTENT", uncertain: "METER_UNCERTAIN", unknown: "METER_UNKNOWN" };
  if (value.meterState !== "fresh") reasons.add(meterReasons[value.meterState] ?? "METER_UNKNOWN");

  if (value.usedUnits === null || value.reservedUnits === null) reasons.add("METRIC_MISSING");
  else if (!isSafeNonNegativeInteger(value.usedUnits) || !isSafeNonNegativeInteger(value.reservedUnits)) reasons.add("MALFORMED_OBSERVATION");
  if (value.hardLimitUnits === null || value.hardLimitUnits === 0) reasons.add("HARD_LIMIT_MISSING");
  else if (!isSafePositiveInteger(value.hardLimitUnits)) reasons.add("MALFORMED_OBSERVATION");
  if (value.observedAt === null) reasons.add("METERING_TIMESTAMP_MISSING");
  else if (typeof value.observedAt !== "string" || !TIMESTAMP.test(value.observedAt)) reasons.add("MALFORMED_OBSERVATION");
  if (!isSafeNonNegativeInteger(value.meterAgeSeconds)) reasons.add("METER_AGE_INVALID");
  else if (value.meterAgeSeconds > CEILINGS.maxMeterAgeSeconds) reasons.add("METER_STALE");

  const workload = value.workloadControls;
  if (!BATCHING_MODES.has(workload.batchingMode) || !isSafePositiveInteger(workload.batchSize)) reasons.add("UNBOUNDED_BATCHING");
  if (!workload.deduplicationRequired) reasons.add("DEDUPLICATION_REQUIRED");
  if (!workload.idempotencyRequired) reasons.add("IDEMPOTENCY_REQUIRED");
  if (!workload.backpressureRequired) reasons.add("BACKPRESSURE_REQUIRED");
  if (!isSafePositiveInteger(workload.rateLimitPerMinute)) reasons.add("RATE_LIMIT_REQUIRED");
  if (!isSafePositiveInteger(workload.concurrencyLimit)) reasons.add("CONCURRENCY_LIMIT_REQUIRED");
  if (!isSafeNonNegativeInteger(workload.retryLimit)) reasons.add("RETRY_LIMIT_REQUIRED");
  if (!isSafeNonNegativeInteger(workload.retryAttempt) || !isSafeNonNegativeInteger(workload.retryLimit) || workload.retryAttempt > workload.retryLimit) reasons.add("RETRY_ATTEMPT_INVALID");
  if (!workload.deadLetterHandlingRequired) reasons.add("DEAD_LETTER_HANDLING_REQUIRED");
  if (!workload.priorityQueueRequired) reasons.add("PRIORITY_QUEUE_REQUIRED");
  if (!SUMMARY_MODES.has(workload.summaryMode)) reasons.add("CONTINUOUS_OR_PER_EVENT_SUMMARY_PROHIBITED");
  if (workload.perGuestInteractionUnitOfWork) reasons.add("PER_INTERACTION_WORK_PROHIBITED");
  if (workload.perEventAiInvocation) reasons.add("PER_EVENT_AI_INVOCATION_PROHIBITED");
  if ((isSafePositiveInteger(workload.batchSize) && workload.batchSize > CEILINGS.maxBatchSize) || (isSafePositiveInteger(workload.rateLimitPerMinute) && workload.rateLimitPerMinute > CEILINGS.maxRateLimitPerMinute) || (isSafePositiveInteger(workload.concurrencyLimit) && workload.concurrencyLimit > CEILINGS.maxConcurrency) || (isSafeNonNegativeInteger(workload.retryLimit) && workload.retryLimit > CEILINGS.maxRetryLimit)) reasons.add("WORKLOAD_CEILING_EXCEEDED");

  if (value.authorityClaims.decisionAuthorizesScheduling || value.authorityClaims.decisionAuthorizesExecution || value.authorityClaims.decisionAuthorizesNotification) reasons.add("SELF_AUTHORIZATION_CLAIM");
  if (value.authorityClaims.decisionAuthorizesProductionWrite || value.authorityClaims.productionWriteGranted) reasons.add("PRODUCTION_WRITE_CLAIM");
  return REASON_PRECEDENCE.filter((reason) => reasons.has(reason));
}

function workloadAllowsSafeRequeue(workload) {
  return workload.safeToRequeue === true && BATCHING_MODES.has(workload.batchingMode) && isSafePositiveInteger(workload.batchSize) && workload.batchSize <= CEILINGS.maxBatchSize && workload.deduplicationRequired && workload.idempotencyRequired && workload.backpressureRequired && isSafePositiveInteger(workload.rateLimitPerMinute) && workload.rateLimitPerMinute <= CEILINGS.maxRateLimitPerMinute && isSafePositiveInteger(workload.concurrencyLimit) && workload.concurrencyLimit <= CEILINGS.maxConcurrency && isSafeNonNegativeInteger(workload.retryLimit) && workload.retryLimit <= CEILINGS.maxRetryLimit && isSafeNonNegativeInteger(workload.retryAttempt) && workload.retryAttempt < workload.retryLimit && workload.deadLetterHandlingRequired && workload.priorityQueueRequired && SUMMARY_MODES.has(workload.summaryMode) && !workload.perGuestInteractionUnitOfWork && !workload.perEventAiInvocation;
}

function rejectionOutcome(reasons, workload) {
  const uncertainReasons = new Set(["METER_MISSING", "METER_UNAVAILABLE", "METER_STALE", "METER_INCONSISTENT", "METER_UNCERTAIN", "METER_UNKNOWN", "METRIC_MISSING", "HARD_LIMIT_MISSING", "METERING_TIMESTAMP_MISSING", "METER_AGE_INVALID"]);
  if (reasons.length > 0 && reasons.every((reason) => uncertainReasons.has(reason))) return workloadAllowsSafeRequeue(workload) ? "requeue_candidate" : "pause_candidate";
  return "block_candidate";
}

function classifiedValue(value) {
  const rawBasisPoints = (BigInt(value.usedUnits) + BigInt(value.reservedUnits)) * 10000n / BigInt(value.hardLimitUnits);
  const usageBasisPoints = Number(rawBasisPoints > 10000n ? 10001n : rawBasisPoints);
  let budgetState;
  let reasonCode;
  let outcome;
  let failClosed = false;
  if (rawBasisPoints < 5000n) [budgetState, reasonCode, outcome] = ["below_warning", "WITHIN_BUDGET", "continue_candidate"];
  else if (rawBasisPoints < 7500n) [budgetState, reasonCode, outcome] = ["warning_50", "WARNING_50_REACHED", "warn_continue_candidate"];
  else if (rawBasisPoints < 9000n) [budgetState, reasonCode, outcome] = ["warning_75", "WARNING_75_REACHED", "throttle_candidate"];
  else if (rawBasisPoints < 10000n) {
    [budgetState, reasonCode, outcome, failClosed] = ["warning_90", "WARNING_90_REACHED", workloadAllowsSafeRequeue(value.workloadControls) ? "requeue_candidate" : "pause_candidate", true];
  } else if (rawBasisPoints === 10000n) [budgetState, reasonCode, outcome, failClosed] = ["hard_limit_reached", "HARD_LIMIT_REACHED", "block_candidate", true];
  else [budgetState, reasonCode, outcome, failClosed] = ["hard_limit_exceeded", "HARD_LIMIT_EXCEEDED", "block_candidate", true];
  return deepFreeze({ ok: true, value: { schemaVersion: "1.0.0", observationId: value.observationId, resourceDimension: value.resourceDimension, budgetState, usageBasisPoints, reasonCode, outcome, failClosed, nonAuthoritative: true, schedulingAuthorized: false, executionAuthorized: false, notificationAuthorized: false, productionWriteAuthorized: false }, rejection: null });
}

export function evaluateResourceBudget(observation) {
  try {
    if (!authority) return rejection(["INTERNAL_AUTHORITY_UNAVAILABLE"]);
    if (hasCallerAuthorityInjection(observation)) return rejection(["CALLER_AUTHORITY_INJECTION"]);
    let value;
    try {
      value = guardedClone(observation);
    } catch {
      return rejection(["MALFORMED_OBSERVATION"]);
    }
    if (!shapeIsComplete(value)) return rejection(["MALFORMED_OBSERVATION"]);
    const reasons = semanticReasons(value);
    if (!authority.validateObservation(value) && reasons.length === 0) reasons.push("MALFORMED_OBSERVATION");
    if (reasons.length > 0) return rejection(reasons, rejectionOutcome(reasons, value.workloadControls));
    return classifiedValue(value);
  } catch {
    return rejection(["INTERNAL_AUTHORITY_UNAVAILABLE"]);
  }
}
