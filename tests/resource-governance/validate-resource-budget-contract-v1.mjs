import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import schema from "../../schemas/resource-budget-contract-v1.schema.json" with { type: "json" };
import policy from "../../policies/resource-budget-policy-v1.json" with { type: "json" };
import { evaluateResourceBudget } from "../../packages/resource-governance-contracts/src/resource-budget-contract-v1.mjs";

let cases = 0;
function check(condition, message) { cases += 1; assert.ok(condition, message); }
function equal(actual, expected, message) { cases += 1; assert.deepEqual(actual, expected, message); }
function clone(value) { return structuredClone(value); }
function mutate(value, path, replacement) { const copy = clone(value); let cursor = copy; for (const key of path.slice(0, -1)) cursor = cursor[key]; cursor[path.at(-1)] = replacement; return copy; }
function deeplyFrozen(value) { if (value === null || typeof value !== "object") return true; return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen); }
function reasons(decision, expected, message, outcome) {
  check(decision?.ok === false && decision.value === null, `${message}: rejected`);
  equal(decision.rejection.reasonCodes, expected, `${message}: reasons`);
  check(decision.rejection.failClosed === true, `${message}: fail closed`);
  if (outcome) equal(decision.rejection.outcome, outcome, `${message}: outcome`);
  check(validateDecision(decision), `${message}: valid decision`);
}

const DIMENSIONS = [
  ["worker_requests", "requests"], ["worker_cpu_milliseconds", "milliseconds"], ["queue_operations", "operations"],
  ["workflow_steps", "steps"], ["persistence_size_bytes", "bytes"], ["persistence_growth_bytes", "bytes"],
  ["persistence_egress_bytes", "bytes"], ["runner_minutes", "minutes"], ["ai_invocations", "invocations"],
  ["ai_tokens", "tokens"], ["notification_messages", "messages"]
];
const BUDGET_STATES = ["below_warning", "warning_50", "warning_75", "warning_90", "hard_limit_reached", "hard_limit_exceeded"];
const METER_STATES = ["fresh", "missing", "unavailable", "stale", "inconsistent", "uncertain", "unknown"];
const AUTHORITY_STATES = ["available", "missing", "unavailable", "inconsistent", "unknown"];
const CONFIGURATION_STATES = ["valid", "missing", "unsupported", "inconsistent", "unknown"];
const OUTCOMES = ["continue_candidate", "warn_continue_candidate", "throttle_candidate", "pause_candidate", "requeue_candidate", "block_candidate"];
const REASONS = ["INTERNAL_AUTHORITY_UNAVAILABLE", "CALLER_AUTHORITY_INJECTION", "MALFORMED_OBSERVATION", "UNSUPPORTED_SCHEMA_VERSION", "UNKNOWN_RESOURCE_DIMENSION", "UNIT_MISMATCH", "UNSUPPORTED_WORKLOAD_ZONE", "BOOKING_WORKLOAD_PROHIBITED", "BOOKING_QUOTA_BOUNDARY_VIOLATION", "BOOKING_CREDENTIAL_BOUNDARY_VIOLATION", "BOOKING_DEPLOYMENT_BOUNDARY_VIOLATION", "BOOKING_FAILURE_BOUNDARY_VIOLATION", "BUDGET_AUTHORITY_MISSING", "BUDGET_AUTHORITY_UNAVAILABLE", "BUDGET_AUTHORITY_INCONSISTENT", "BUDGET_AUTHORITY_UNKNOWN", "CONFIGURATION_MISSING", "UNSUPPORTED_CONFIGURATION", "CONFIGURATION_INCONSISTENT", "CONFIGURATION_UNKNOWN", "METER_MISSING", "METER_UNAVAILABLE", "METER_STALE", "METER_INCONSISTENT", "METER_UNCERTAIN", "METER_UNKNOWN", "METRIC_MISSING", "HARD_LIMIT_MISSING", "METERING_TIMESTAMP_MISSING", "METER_AGE_INVALID", "UNBOUNDED_BATCHING", "DEDUPLICATION_REQUIRED", "IDEMPOTENCY_REQUIRED", "BACKPRESSURE_REQUIRED", "RATE_LIMIT_REQUIRED", "CONCURRENCY_LIMIT_REQUIRED", "RETRY_LIMIT_REQUIRED", "RETRY_ATTEMPT_INVALID", "DEAD_LETTER_HANDLING_REQUIRED", "PRIORITY_QUEUE_REQUIRED", "CONTINUOUS_OR_PER_EVENT_SUMMARY_PROHIBITED", "PER_INTERACTION_WORK_PROHIBITED", "PER_EVENT_AI_INVOCATION_PROHIBITED", "WORKLOAD_CEILING_EXCEEDED", "SELF_AUTHORIZATION_CLAIM", "PRODUCTION_WRITE_CLAIM"];

const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
check(ajv.validateSchema(schema), `schema is valid Draft 2020-12: ${JSON.stringify(ajv.errors)}`);
const validatePolicy = ajv.compile(schema);
const validateObservation = ajv.compile({ $ref: `${schema.$id}#/$defs/resourceBudgetObservation` });
const validateDecision = ajv.compile({ $ref: `${schema.$id}#/$defs/resourceBudgetDecision` });
const validateAccepted = ajv.compile({ $ref: `${schema.$id}#/$defs/resourceBudgetDecision/oneOf/0` });
const validateRejected = ajv.compile({ $ref: `${schema.$id}#/$defs/resourceBudgetDecision/oneOf/1` });
check(validatePolicy(policy), `canonical policy satisfies schema: ${JSON.stringify(validatePolicy.errors)}`);
equal(Object.keys(policy), ["schemaVersion", "policyId", "resourceDimensions", "thresholdBasisPoints", "budgetStates", "meterStates", "budgetAuthorityStates", "configurationStates", "workloadZones", "decisionOutcomes", "workloadCeilings", "decisionRules", "bookingIsolation", "reasonPrecedence", "authority"], "policy root fields and order are exact");
equal(policy.resourceDimensions, DIMENSIONS.map(([resourceDimension, unit]) => ({ resourceDimension, unit })), "eleven dimensions and units are exact");
equal(policy.thresholdBasisPoints, { warning50: 5000, warning75: 7500, warning90: 9000, hardLimit: 10000 }, "thresholds are exact");
equal(policy.budgetStates, BUDGET_STATES, "budget states are exact");
equal(policy.meterStates, METER_STATES, "meter states are exact");
equal(policy.budgetAuthorityStates, AUTHORITY_STATES, "authority states are exact");
equal(policy.configurationStates, CONFIGURATION_STATES, "configuration states are exact");
equal(policy.workloadZones, ["staff_control", "ai_workload"], "workload zones are isolated");
equal(policy.decisionOutcomes, OUTCOMES, "outcomes are exact");
equal(policy.workloadCeilings, { maxBatchSize: 500, maxRateLimitPerMinute: 1000, maxConcurrency: 8, maxRetryLimit: 3, maxMeterAgeSeconds: 300 }, "ceilings are exact");
equal(policy.bookingIsolation, { bookingWorkload: false, sharesQuotaWithBooking: false, sharesCredentialsWithBooking: false, sharesDeploymentWithBooking: false, sharesFailureBoundaryWithBooking: false }, "booking isolation is exact");
equal(policy.reasonPrecedence, REASONS, "reason precedence is exact");
equal(policy.authority, { nonAuthoritative: true, schedulingAuthorized: false, executionAuthorized: false, notificationAuthorized: false, productionWriteAuthorized: false, capacityReservationAuthorized: false, bookingEffectAuthorized: false }, "policy grants no operational authority");

function assertClosedObjects(node, path = "schema") {
  if (node === null || typeof node !== "object") return;
  if (node.type === "object") check(node.additionalProperties === false, `${path} object is closed`);
  for (const [key, child] of Object.entries(node)) assertClosedObjects(child, `${path}.${key}`);
}
assertClosedObjects(schema);

function canonicalObservation(overrides = {}) {
  return Object.assign({
    schemaVersion: "1.0.0", observationId: "resource-observation-1", resourceDimension: "worker_requests", unit: "requests", workloadZone: "staff_control",
    budgetAuthorityState: "available", configurationState: "valid", meterState: "fresh", usedUnits: 100, reservedUnits: 0, hardLimitUnits: 1000,
    observedAt: "2026-08-01T00:00:00Z", meterAgeSeconds: 30,
    workloadControls: { batchingMode: "bounded_batch", batchSize: 100, deduplicationRequired: true, idempotencyRequired: true, backpressureRequired: true, rateLimitPerMinute: 100, concurrencyLimit: 4, retryLimit: 3, retryAttempt: 0, deadLetterHandlingRequired: true, priorityQueueRequired: true, summaryMode: "scheduled_summary", perGuestInteractionUnitOfWork: false, perEventAiInvocation: false, safeToRequeue: true },
    bookingIsolation: { bookingWorkload: false, sharesQuotaWithBooking: false, sharesCredentialsWithBooking: false, sharesDeploymentWithBooking: false, sharesFailureBoundaryWithBooking: false },
    authorityClaims: { callerSuppliesPolicy: false, callerSuppliesThresholds: false, decisionAuthorizesScheduling: false, decisionAuthorizesExecution: false, decisionAuthorizesNotification: false, decisionAuthorizesProductionWrite: false, productionWriteGranted: false }
  }, overrides);
}

for (const [resourceDimension, unit] of DIMENSIONS) {
  for (const workloadZone of ["staff_control", "ai_workload"]) {
    const observation = canonicalObservation({ resourceDimension, unit, workloadZone, observationId: `observation-${resourceDimension}-${workloadZone}` });
    check(validateObservation(observation), `${resourceDimension}/${workloadZone} observation satisfies schema`);
    const decision = evaluateResourceBudget(observation);
    check(decision.ok, `${resourceDimension}/${workloadZone} classifies`);
    check(validateDecision(decision), `${resourceDimension}/${workloadZone} decision satisfies schema`);
    check(Number(validateAccepted(decision)) + Number(validateRejected(decision)) === 1, `${resourceDimension}/${workloadZone} matches exactly one variant`);
    check(deeplyFrozen(decision), `${resourceDimension}/${workloadZone} result is deeply frozen`);
    check(decision.value.nonAuthoritative && !decision.value.schedulingAuthorized && !decision.value.executionAuthorized && !decision.value.notificationAuthorized && !decision.value.productionWriteAuthorized, `${resourceDimension}/${workloadZone} grants no authority`);
  }
}

const thresholds = [
  [0, "below_warning", 0, "WITHIN_BUDGET", "continue_candidate", false], [4999, "below_warning", 4999, "WITHIN_BUDGET", "continue_candidate", false],
  [5000, "warning_50", 5000, "WARNING_50_REACHED", "warn_continue_candidate", false], [5001, "warning_50", 5001, "WARNING_50_REACHED", "warn_continue_candidate", false],
  [7499, "warning_50", 7499, "WARNING_50_REACHED", "warn_continue_candidate", false], [7500, "warning_75", 7500, "WARNING_75_REACHED", "throttle_candidate", false],
  [7501, "warning_75", 7501, "WARNING_75_REACHED", "throttle_candidate", false], [8999, "warning_75", 8999, "WARNING_75_REACHED", "throttle_candidate", false],
  [9000, "warning_90", 9000, "WARNING_90_REACHED", "requeue_candidate", true], [9001, "warning_90", 9001, "WARNING_90_REACHED", "requeue_candidate", true],
  [9999, "warning_90", 9999, "WARNING_90_REACHED", "requeue_candidate", true], [10000, "hard_limit_reached", 10000, "HARD_LIMIT_REACHED", "block_candidate", true],
  [10001, "hard_limit_exceeded", 10001, "HARD_LIMIT_EXCEEDED", "block_candidate", true], [20000, "hard_limit_exceeded", 10001, "HARD_LIMIT_EXCEEDED", "block_candidate", true]
];
for (const [usedUnits, budgetState, usageBasisPoints, reasonCode, outcome, failClosed] of thresholds) {
  const decision = evaluateResourceBudget(canonicalObservation({ usedUnits, hardLimitUnits: 10000 }));
  check(decision.ok, `threshold ${usedUnits} classifies`);
  equal({ budgetState: decision.value.budgetState, usageBasisPoints: decision.value.usageBasisPoints, reasonCode: decision.value.reasonCode, outcome: decision.value.outcome, failClosed: decision.value.failClosed }, { budgetState, usageBasisPoints, reasonCode, outcome, failClosed }, `threshold ${usedUnits} mapping`);
}
const reserved = evaluateResourceBudget(canonicalObservation({ usedUnits: 4000, reservedUnits: 1000, hardLimitUnits: 10000 }));
equal([reserved.value.usageBasisPoints, reserved.value.budgetState], [5000, "warning_50"], "reserved units count toward threshold");
const safeMaximum = evaluateResourceBudget(canonicalObservation({ usedUnits: Number.MAX_SAFE_INTEGER, reservedUnits: 0, hardLimitUnits: Number.MAX_SAFE_INTEGER }));
equal([safeMaximum.value.usageBasisPoints, safeMaximum.value.budgetState], [10000, "hard_limit_reached"], "safe maximum integer has no floating drift");
const pauseAt90 = canonicalObservation({ usedUnits: 9000, hardLimitUnits: 10000 }); pauseAt90.workloadControls.safeToRequeue = false;
equal(evaluateResourceBudget(pauseAt90).value.outcome, "pause_candidate", "warning 90 pauses when safe requeue is unavailable");

const authorityReason = { missing: "BUDGET_AUTHORITY_MISSING", unavailable: "BUDGET_AUTHORITY_UNAVAILABLE", inconsistent: "BUDGET_AUTHORITY_INCONSISTENT", unknown: "BUDGET_AUTHORITY_UNKNOWN" };
for (const state of AUTHORITY_STATES.slice(1)) reasons(evaluateResourceBudget(canonicalObservation({ budgetAuthorityState: state })), [authorityReason[state]], `authority ${state}`, "block_candidate");
const configurationReason = { missing: "CONFIGURATION_MISSING", unsupported: "UNSUPPORTED_CONFIGURATION", inconsistent: "CONFIGURATION_INCONSISTENT", unknown: "CONFIGURATION_UNKNOWN" };
for (const state of CONFIGURATION_STATES.slice(1)) reasons(evaluateResourceBudget(canonicalObservation({ configurationState: state })), [configurationReason[state]], `configuration ${state}`, "block_candidate");
const meterReason = { missing: "METER_MISSING", unavailable: "METER_UNAVAILABLE", stale: "METER_STALE", inconsistent: "METER_INCONSISTENT", uncertain: "METER_UNCERTAIN", unknown: "METER_UNKNOWN" };
for (const state of METER_STATES.slice(1)) reasons(evaluateResourceBudget(canonicalObservation({ meterState: state })), [meterReason[state]], `meter ${state}`, "requeue_candidate");
const noRequeueMeter = canonicalObservation({ meterState: "uncertain" }); noRequeueMeter.workloadControls.safeToRequeue = false;
reasons(evaluateResourceBudget(noRequeueMeter), ["METER_UNCERTAIN"], "uncertain meter pauses without safe requeue", "pause_candidate");

reasons(evaluateResourceBudget(canonicalObservation({ usedUnits: null })), ["METRIC_MISSING"], "missing used metric", "requeue_candidate");
reasons(evaluateResourceBudget(canonicalObservation({ reservedUnits: null })), ["METRIC_MISSING"], "missing reserved metric", "requeue_candidate");
reasons(evaluateResourceBudget(canonicalObservation({ hardLimitUnits: null })), ["HARD_LIMIT_MISSING"], "missing hard limit", "requeue_candidate");
reasons(evaluateResourceBudget(canonicalObservation({ hardLimitUnits: 0 })), ["HARD_LIMIT_MISSING"], "zero hard limit", "requeue_candidate");
reasons(evaluateResourceBudget(canonicalObservation({ observedAt: null })), ["METERING_TIMESTAMP_MISSING"], "missing timestamp", "requeue_candidate");
reasons(evaluateResourceBudget(canonicalObservation({ meterAgeSeconds: null })), ["METER_AGE_INVALID"], "missing meter age", "requeue_candidate");
reasons(evaluateResourceBudget(canonicalObservation({ meterAgeSeconds: 301 })), ["METER_STALE"], "stale age", "requeue_candidate");
for (const [field, value] of [["usedUnits", -1], ["usedUnits", 1.5], ["usedUnits", Number.MAX_SAFE_INTEGER + 1], ["reservedUnits", -1], ["hardLimitUnits", -1], ["hardLimitUnits", 1.5], ["observedAt", "2026-08-01"], ["observedAt", "2026-02-31T00:00:00Z"], ["observedAt", "2025-02-29T00:00:00Z"], ["observedAt", "2024-02-30T00:00:00Z"], ["meterAgeSeconds", -1]]) reasons(evaluateResourceBudget(canonicalObservation({ [field]: value })), [field === "meterAgeSeconds" ? "METER_AGE_INVALID" : "MALFORMED_OBSERVATION"], `invalid ${field}`);

reasons(evaluateResourceBudget(canonicalObservation({ resourceDimension: "unknown_dimension" })), ["UNKNOWN_RESOURCE_DIMENSION"], "unknown dimension");
reasons(evaluateResourceBudget(canonicalObservation({ unit: "tokens" })), ["UNIT_MISMATCH"], "unit mismatch");
reasons(evaluateResourceBudget(canonicalObservation({ schemaVersion: "2.0.0" })), ["UNSUPPORTED_SCHEMA_VERSION"], "unsupported schema");
reasons(evaluateResourceBudget(canonicalObservation({ workloadZone: "guest_public" })), ["UNSUPPORTED_WORKLOAD_ZONE"], "guest zone prohibited");
reasons(evaluateResourceBudget(canonicalObservation({ workloadZone: "booking_control_plane" })), ["UNSUPPORTED_WORKLOAD_ZONE", "BOOKING_WORKLOAD_PROHIBITED"], "booking zone prohibited");
for (const [field, reason] of [["bookingWorkload", "BOOKING_WORKLOAD_PROHIBITED"], ["sharesQuotaWithBooking", "BOOKING_QUOTA_BOUNDARY_VIOLATION"], ["sharesCredentialsWithBooking", "BOOKING_CREDENTIAL_BOUNDARY_VIOLATION"], ["sharesDeploymentWithBooking", "BOOKING_DEPLOYMENT_BOUNDARY_VIOLATION"], ["sharesFailureBoundaryWithBooking", "BOOKING_FAILURE_BOUNDARY_VIOLATION"]]) reasons(evaluateResourceBudget(mutate(canonicalObservation(), ["bookingIsolation", field], true)), [reason], field);
const allBooking = canonicalObservation(); for (const field of Object.keys(allBooking.bookingIsolation)) allBooking.bookingIsolation[field] = true;
reasons(evaluateResourceBudget(allBooking), ["BOOKING_WORKLOAD_PROHIBITED", "BOOKING_QUOTA_BOUNDARY_VIOLATION", "BOOKING_CREDENTIAL_BOUNDARY_VIOLATION", "BOOKING_DEPLOYMENT_BOUNDARY_VIOLATION", "BOOKING_FAILURE_BOUNDARY_VIOLATION"], "all booking boundaries");

const workloadCases = [
  ["batchingMode", "unbounded", ["UNBOUNDED_BATCHING"]], ["batchingMode", "per_event", ["UNBOUNDED_BATCHING"]], ["batchSize", null, ["UNBOUNDED_BATCHING"]],
  ["batchSize", 501, ["WORKLOAD_CEILING_EXCEEDED"]], ["deduplicationRequired", false, ["DEDUPLICATION_REQUIRED"]], ["idempotencyRequired", false, ["IDEMPOTENCY_REQUIRED"]],
  ["backpressureRequired", false, ["BACKPRESSURE_REQUIRED"]], ["rateLimitPerMinute", null, ["RATE_LIMIT_REQUIRED"]], ["rateLimitPerMinute", 1001, ["WORKLOAD_CEILING_EXCEEDED"]],
  ["concurrencyLimit", null, ["CONCURRENCY_LIMIT_REQUIRED"]], ["concurrencyLimit", 9, ["WORKLOAD_CEILING_EXCEEDED"]], ["retryLimit", null, ["RETRY_LIMIT_REQUIRED", "RETRY_ATTEMPT_INVALID"]],
  ["retryLimit", 4, ["WORKLOAD_CEILING_EXCEEDED"]], ["retryAttempt", null, ["RETRY_ATTEMPT_INVALID"]], ["deadLetterHandlingRequired", false, ["DEAD_LETTER_HANDLING_REQUIRED"]],
  ["priorityQueueRequired", false, ["PRIORITY_QUEUE_REQUIRED"]], ["summaryMode", "continuous", ["CONTINUOUS_OR_PER_EVENT_SUMMARY_PROHIBITED"]], ["summaryMode", "per_event", ["CONTINUOUS_OR_PER_EVENT_SUMMARY_PROHIBITED"]],
  ["perGuestInteractionUnitOfWork", true, ["PER_INTERACTION_WORK_PROHIBITED"]], ["perEventAiInvocation", true, ["PER_EVENT_AI_INVOCATION_PROHIBITED"]]
];
for (const [field, value, expectedReasons] of workloadCases) reasons(evaluateResourceBudget(mutate(canonicalObservation(), ["workloadControls", field], value)), expectedReasons, `workload ${field}`);
reasons(evaluateResourceBudget(mutate(canonicalObservation(), ["workloadControls", "retryAttempt"], 4)), ["RETRY_ATTEMPT_INVALID"], "retry attempt exceeds limit");
const exhausted = canonicalObservation({ meterState: "uncertain" }); exhausted.workloadControls.retryAttempt = exhausted.workloadControls.retryLimit;
reasons(evaluateResourceBudget(exhausted), ["METER_UNCERTAIN"], "exhausted retry pauses", "pause_candidate");

for (const field of ["decisionAuthorizesScheduling", "decisionAuthorizesExecution", "decisionAuthorizesNotification"]) reasons(evaluateResourceBudget(mutate(canonicalObservation(), ["authorityClaims", field], true)), ["SELF_AUTHORIZATION_CLAIM"], `${field} rejected`);
for (const field of ["decisionAuthorizesProductionWrite", "productionWriteGranted"]) reasons(evaluateResourceBudget(mutate(canonicalObservation(), ["authorityClaims", field], true)), ["PRODUCTION_WRITE_CLAIM"], `${field} rejected`);
for (const field of ["callerSuppliesPolicy", "callerSuppliesThresholds"]) reasons(evaluateResourceBudget(mutate(canonicalObservation(), ["authorityClaims", field], true)), ["CALLER_AUTHORITY_INJECTION"], `${field} rejected`);
for (const field of ["schema", "policy", "contract", "validator", "configuration", "thresholds", "resourceBudgetPolicy", "adapter", "dependencies"]) { const injected = canonicalObservation(); injected[field] = {}; reasons(evaluateResourceBudget(injected), ["CALLER_AUTHORITY_INJECTION"], `${field} injection rejected`); }
const weakenedSchema = clone(schema); weakenedSchema.$defs.observationAuthorityClaims.properties.productionWriteGranted = { type: "boolean" };
const relabelledWrite = mutate(canonicalObservation(), ["authorityClaims", "productionWriteGranted"], true);
reasons(evaluateResourceBudget(relabelledWrite, weakenedSchema, { thresholds: { hardLimit: 999999 } }), ["PRODUCTION_WRITE_CLAIM"], "weakened caller schema cannot authorize production write");
check(evaluateResourceBudget(canonicalObservation(), weakenedSchema, { policy: {} }).ok, "extra arguments are ignored for canonical input");
const weakenedPolicy = clone(policy); weakenedPolicy.thresholdBasisPoints.hardLimit = 20000;
check(!validatePolicy(weakenedPolicy), "look-alike policy with weakened hard limit is not canonical");
equal(evaluateResourceBudget(canonicalObservation({ usedUnits: 10000, hardLimitUnits: 10000 }), weakenedPolicy).value.budgetState, "hard_limit_reached", "caller policy cannot redirect threshold authority");

const canonical = canonicalObservation();
const before = JSON.stringify(canonical);
const accepted = evaluateResourceBudget(canonical);
check(accepted.ok, "canonical observation accepted");
equal(JSON.stringify(canonical), before, "input is not mutated");
check(deeplyFrozen(accepted), "accepted result deeply frozen");
canonical.usedUnits = 999;
equal(accepted.value.usageBasisPoints, 1000, "later input mutation cannot change result");
equal(evaluateResourceBudget(canonicalObservation()), evaluateResourceBudget(canonicalObservation()), "repeated calls deterministic");
equal(evaluateResourceBudget(Object.fromEntries(Object.entries(canonicalObservation()).reverse())), evaluateResourceBudget(canonicalObservation()), "key order does not affect result");

const malformed = [null, undefined, true, false, 0, 1, "observation", [], Symbol("observation"), 1n, NaN, Infinity, new Date(), /observation/u, () => {}, Object.create({ inherited: true }), { ...canonicalObservation(), payload: { guestId: "guest" } }];
for (const input of malformed) { let decision; let threw = false; try { decision = evaluateResourceBudget(input); } catch { threw = true; } check(!threw, `malformed ${String(input)} never throws`); reasons(decision, ["MALFORMED_OBSERVATION"], `malformed ${String(input)}`); }
const cyclic = canonicalObservation(); cyclic.cycle = cyclic; reasons(evaluateResourceBudget(cyclic), ["MALFORMED_OBSERVATION"], "cyclic input");
const accessor = canonicalObservation(); Object.defineProperty(accessor, "observationId", { enumerable: true, get() { throw new Error("must not escape"); } }); reasons(evaluateResourceBudget(accessor), ["MALFORMED_OBSERVATION"], "throwing getter");
const proxied = new Proxy(canonicalObservation(), { ownKeys() { throw new Error("must not escape"); } }); reasons(evaluateResourceBudget(proxied), ["MALFORMED_OBSERVATION"], "throwing proxy");
const deep = canonicalObservation(); deep.payload = {}; let cursor = deep.payload; for (let index = 0; index < 40; index += 1) { cursor.child = {}; cursor = cursor.child; } reasons(evaluateResourceBudget(deep), ["MALFORMED_OBSERVATION"], "deep hostile input");

const rejected = evaluateResourceBudget(null);
check(Number(validateAccepted(accepted)) + Number(validateRejected(accepted)) === 1, "accepted decision matches exactly one variant");
check(Number(validateAccepted(rejected)) + Number(validateRejected(rejected)) === 1, "rejected decision matches exactly one variant");
for (const invalid of [{ ok: true, value: null, rejection: null }, { ok: false, value: null, rejection: { schemaVersion: "1.0.0", failClosed: false, outcome: "block_candidate", reasonCodes: ["MALFORMED_OBSERVATION"] } }, { ok: false, value: null, rejection: { schemaVersion: "1.0.0", failClosed: true, outcome: "continue_candidate", reasonCodes: [] } }, { ...accepted, extra: true }]) check(!validateDecision(invalid), "malformed result is rejected");

const moduleSource = await readFile(new URL("../../packages/resource-governance-contracts/src/resource-budget-contract-v1.mjs", import.meta.url), "utf8");
check(!/from\s+["'](?:cloudflare|supabase|github|openai|line|@?aws|pg|postgres|mysql|redis|bullmq|wrangler)/iu.test(moduleSource), "module imports no provider or infrastructure SDK");
check(!/scripts[\\/]verify|scripts[\\/]github|scripts[\\/]task/iu.test(moduleSource), "module imports no repository verifier");
check(!/\bfetch\s*\(|from\s+["']node:(?:https?|fs|net|tls|child_process|os)|process\.(?:env|cwd)|Date\.now|new\s+Date/iu.test(moduleSource), "module has no network, filesystem, environment, clock, or process dependency");
equal([...moduleSource.matchAll(/\bexport\s+function\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]), ["evaluateResourceBudget"], "module exports exactly one public function");
check(!/\b(?:reserveCapacity|throttle|pauseWork|requeue|enqueue|schedule|notify|execute|write|deadLetter)\s*\(/u.test(moduleSource), "module performs no operational action");

console.log(`P2-007 resource budget contract V1 validation passed (${cases} cases).`);
