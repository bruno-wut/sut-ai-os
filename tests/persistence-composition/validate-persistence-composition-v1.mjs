import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createPersistencePort } from "../../packages/persistence-port/src/persistence-port-v1.mjs";
import { composePersistencePort } from "../../services/persistence-composition/persistence-composition-v1.mjs";

let cases = 0;
function check(condition, message) { cases += 1; assert.ok(condition, message); }
function equal(actual, expected, message) { cases += 1; assert.deepEqual(actual, expected, message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function mutate(value, path, replacement) { const copy = clone(value); let cursor = copy; for (const key of path.slice(0, -1)) cursor = cursor[key]; cursor[path.at(-1)] = replacement; return copy; }
function deeplyFrozen(value) { if (value === null || typeof value !== "object") return true; return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen); }

const DIGEST_A = `sha256:${"a".repeat(64)}`;
const DIGEST_B = `sha256:${"b".repeat(64)}`;

function governanceCandidate(overrides = {}) {
  const value = {
    schemaVersion: "1.0.0",
    candidateId: "aggregate-candidate-1",
    dataCategory: "hourly_analytics_aggregate",
    sourceClass: "analytics_source",
    artifactClass: "analytics_aggregate",
    aggregationInterval: "hourly",
    requestedAction: "retain",
    handlingIntent: { storage: "durable_ai_os", queue: "batched_aggregate_or_lifecycle", workflow: "scheduled_summary_or_governed_case", aiInvocation: "scheduled_summary_or_governed_case", onePermanentRowPerInteraction: false },
    historyProtection: { kind: "none", originalRecordPreserved: true, failedAttemptHistoryPreserved: true, rewriteRequested: false },
    authorityClaims: { callerSuppliesAuthority: false, classificationAuthorizesPersistence: false, classificationAuthorizesLifecycleAction: false, classificationAuthorizesAiInvocation: false, productionWriteGranted: false }
  };
  return Object.assign(value, overrides);
}

function capacityObservation(resourceDimension = "persistence_growth_bytes", overrides = {}) {
  return Object.assign({
    schemaVersion: "1.0.0",
    observationId: `capacity-${resourceDimension}`,
    resourceDimension,
    unit: "bytes",
    workloadZone: "ai_workload",
    budgetAuthorityState: "available",
    configurationState: "valid",
    meterState: "fresh",
    usedUnits: 100,
    reservedUnits: 0,
    hardLimitUnits: 1000,
    observedAt: "2026-08-13T00:00:00Z",
    meterAgeSeconds: 30,
    workloadControls: { batchingMode: "bounded_batch", batchSize: 100, deduplicationRequired: true, idempotencyRequired: true, backpressureRequired: true, rateLimitPerMinute: 100, concurrencyLimit: 4, retryLimit: 3, retryAttempt: 0, deadLetterHandlingRequired: true, priorityQueueRequired: true, summaryMode: "scheduled_summary", perGuestInteractionUnitOfWork: false, perEventAiInvocation: false, safeToRequeue: true },
    bookingIsolation: { bookingWorkload: false, sharesQuotaWithBooking: false, sharesCredentialsWithBooking: false, sharesDeploymentWithBooking: false, sharesFailureBoundaryWithBooking: false },
    authorityClaims: { callerSuppliesPolicy: false, callerSuppliesThresholds: false, decisionAuthorizesScheduling: false, decisionAuthorizesExecution: false, decisionAuthorizesNotification: false, decisionAuthorizesProductionWrite: false, productionWriteGranted: false }
  }, overrides);
}

function request(operation = "write", overrides = {}) {
  const dimensions = { read: "persistence_egress_bytes", write: "persistence_growth_bytes", append: "persistence_growth_bytes", delete_expired: "persistence_size_bytes" };
  const candidate = governanceCandidate();
  if (operation === "delete_expired") candidate.requestedAction = "scheduled_delete";
  return Object.assign({
    schemaVersion: "1.0.0",
    requestId: `request-${operation.replaceAll("_", "-")}`,
    operation,
    record: { recordId: "aggregate-record-1", contentDigest: DIGEST_A, contentBytes: 256 },
    governanceCandidate: candidate,
    capacityObservation: capacityObservation(dimensions[operation] ?? "persistence_growth_bytes"),
    authorityClaims: { callerSuppliesAuthority: false, providerAuthorizes: false, productionWriteGranted: false }
  }, overrides);
}

function auditCandidate() {
  return governanceCandidate({
    candidateId: "audit-candidate-1",
    dataCategory: "required_audit_evidence",
    sourceClass: "repository_evidence",
    artifactClass: "audit_evidence",
    aggregationInterval: "not_applicable",
    requestedAction: "retain",
    handlingIntent: { storage: "durable_ai_os", queue: "batched_aggregate_or_lifecycle", workflow: "scheduled_summary_or_governed_case", aiInvocation: "scheduled_summary_or_governed_case", onePermanentRowPerInteraction: false },
    historyProtection: { kind: "append_only_audit", originalRecordPreserved: true, failedAttemptHistoryPreserved: true, rewriteRequested: false }
  });
}

async function decision(port, input, label) {
  let value;
  let threw = false;
  try { value = await port.execute(input); } catch { threw = true; }
  check(!threw, `${label} never throws`);
  check(value && typeof value.ok === "boolean", `${label} returns a decision`);
  check(deeplyFrozen(value), `${label} decision is recursively frozen`);
  return value;
}

async function rejected(port, input, expectedReasons, label) {
  const value = await decision(port, input, label);
  check(value.ok === false && value.value === null && value.rejection?.failClosed === true, `${label} fails closed`);
  equal(value.rejection.reasonCodes, expectedReasons, `${label} returns deterministic reasons`);
  check(value.rejection.productionWriteAuthorized === false && value.rejection.externalSideEffectAuthorized === false, `${label} grants no authority`);
  return value;
}

async function accepted(port, input, status, label) {
  const value = await decision(port, input, label);
  check(value.ok === true && value.rejection === null, `${label} is accepted`);
  equal(value.value.status, status, `${label} status`);
  check(value.value.fixtureOnly && value.value.nonAuthoritative && !value.value.productionWriteAuthorized && !value.value.externalSideEffectAuthorized, `${label} remains fixture-only and non-authoritative`);
  return value;
}

// The composition exposes one deep, stable operation and captures its configuration.
for (const adapterId of ["reference-map-v1", "reference-journal-v1"]) {
  const configuration = { schemaVersion: "1.0.0", adapterId };
  const port = composePersistencePort(configuration);
  equal(Object.keys(port), ["execute"], `${adapterId} exposes one public operation`);
  check(Object.isFrozen(port), `${adapterId} port is frozen`);
  configuration.adapterId = "unsupported-after-composition";

  const written = await accepted(port, request("write"), "written", `${adapterId} write`);
  equal(written.value.adapterId, adapterId, `${adapterId} result identifies selected fixture adapter`);
  equal(written.value.record.revision, 1, `${adapterId} first write revision`);
  equal(written.value.governanceReference, { candidateId: "aggregate-candidate-1", dataCategory: "hourly_analytics_aggregate", artifactClass: "analytics_aggregate", requestedAction: "retain", eligibility: "future_lifecycle_candidate" }, `${adapterId} retains P2-006 reference`);
  equal(written.value.capacityReference, { observationId: "capacity-persistence_growth_bytes", resourceDimension: "persistence_growth_bytes", budgetState: "below_warning", reasonCode: "WITHIN_BUDGET" }, `${adapterId} retains P2-007 reference`);

  await rejected(port, request("write"), ["RECORD_ALREADY_EXISTS"], `${adapterId} duplicate write`);
  const appendInput = request("append"); appendInput.record.contentDigest = DIGEST_B;
  const appended = await accepted(port, appendInput, "appended", `${adapterId} append`);
  equal(appended.value.record.revision, 2, `${adapterId} append revision`);
  const readInput = request("read"); readInput.record.contentDigest = DIGEST_B;
  const found = await accepted(port, readInput, "found", `${adapterId} read`);
  equal([found.value.record.contentDigest, found.value.record.revision], [DIGEST_B, 2], `${adapterId} read sees latest revision`);
  const deleted = await accepted(port, request("delete_expired"), "deleted", `${adapterId} fixture delete`);
  equal(deleted.value.record.revision, 2, `${adapterId} delete returns removed revision`);
  await accepted(port, request("read"), "not_found", `${adapterId} read after delete`);

  const auditAppend = request("append", { requestId: `audit-${adapterId}`, record: { recordId: "audit-record-1", contentDigest: DIGEST_A, contentBytes: 32 }, governanceCandidate: auditCandidate() });
  const auditFirst = await accepted(port, auditAppend, "appended", `${adapterId} initial protected append`);
  equal(auditFirst.value.record.revision, 1, `${adapterId} protected history starts at revision one`);
  const auditNext = clone(auditAppend); auditNext.requestId = `audit-next-${adapterId}`; auditNext.record.contentDigest = DIGEST_B;
  const auditSecond = await accepted(port, auditNext, "appended", `${adapterId} second protected append`);
  equal(auditSecond.value.record.revision, 2, `${adapterId} protected history appends a revision`);
  await rejected(port, request("write", { requestId: `audit-write-${adapterId}`, record: { recordId: "audit-write-1", contentDigest: DIGEST_A, contentBytes: 32 }, governanceCandidate: auditCandidate() }), ["RETENTION_REFERENCE_MISMATCH"], `${adapterId} protected history rejects write operation`);
}

// Missing and unsupported composition configuration produce a closed port.
for (const [configuration, expected] of [
  [undefined, "ADAPTER_CONFIGURATION_MISSING"],
  [null, "ADAPTER_CONFIGURATION_MISSING"],
  [{}, "ADAPTER_CONFIGURATION_MISSING"],
  [{ schemaVersion: "2.0.0", adapterId: "reference-map-v1" }, "UNSUPPORTED_ADAPTER_CONFIGURATION"],
  [{ schemaVersion: "1.0.0", adapterId: "unknown-adapter" }, "UNSUPPORTED_ADAPTER_CONFIGURATION"]
]) {
  await rejected(composePersistencePort(configuration), request(), [expected], `configuration ${String(configuration)}`);
}
const hostileConfiguration = new Proxy({}, { ownKeys() { throw new Error("must not escape"); } });
await rejected(composePersistencePort(hostileConfiguration), request(), ["ADAPTER_CONFIGURATION_MISSING"], "hostile configuration");

// Governance and capacity authority always run before the adapter.
let adapterCalls = 0;
const permissiveAdapter = {
  adapterId: "permissive-fixture-v1",
  mode: "fixture_only",
  execute(operation, record) { adapterCalls += 1; return { ok: true, status: operation === "read" ? "found" : "written", record: { ...record, revision: 1 } }; }
};
const guardedPort = createPersistencePort(permissiveAdapter);

const raw = governanceCandidate({
  candidateId: "raw-click-candidate",
  dataCategory: "raw_click",
  sourceClass: "analytics_source",
  artifactClass: "source_system_managed",
  aggregationInterval: "source_only",
  requestedAction: "retain_at_source",
  handlingIntent: { storage: "source_system_only", queue: "none", workflow: "none", aiInvocation: "none", onePermanentRowPerInteraction: false }
});
await rejected(guardedPort, request("write", { governanceCandidate: raw }), ["RAW_SOURCE_ONLY_CATEGORY"], "raw click source-only boundary");
const perClick = governanceCandidate(); perClick.handlingIntent.onePermanentRowPerInteraction = true;
await rejected(guardedPort, request("write", { governanceCandidate: perClick }), ["DATA_GOVERNANCE_REJECTED", "PROHIBITED_PER_INTERACTION_PERSISTENCE"], "per-click permanent record");
const perClickQueue = governanceCandidate(); perClickQueue.handlingIntent.queue = "individual_guest_interaction";
await rejected(guardedPort, request("write", { governanceCandidate: perClickQueue }), ["DATA_GOVERNANCE_REJECTED", "PROHIBITED_PER_INTERACTION_QUEUE"], "per-click queue");
const perClickAi = governanceCandidate(); perClickAi.handlingIntent.aiInvocation = "individual_guest_interaction";
await rejected(guardedPort, request("write", { governanceCandidate: perClickAi }), ["DATA_GOVERNANCE_REJECTED", "PROHIBITED_PER_INTERACTION_AI_INVOCATION"], "per-click AI invocation");
await rejected(guardedPort, request("write", { governanceCandidate: governanceCandidate({ requestedAction: "scheduled_delete" }) }), ["RETENTION_REFERENCE_MISMATCH"], "write retention mismatch");

for (const [path, value, upstream] of [
  [["budgetAuthorityState"], "unknown", "BUDGET_AUTHORITY_UNKNOWN"],
  [["configurationState"], "unsupported", "UNSUPPORTED_CONFIGURATION"],
  [["meterState"], "unavailable", "METER_UNAVAILABLE"],
  [["bookingIsolation", "sharesQuotaWithBooking"], true, "BOOKING_QUOTA_BOUNDARY_VIOLATION"],
  [["workloadControls", "perGuestInteractionUnitOfWork"], true, "PER_INTERACTION_WORK_PROHIBITED"]
]) {
  const observation = mutate(capacityObservation(), path, value);
  await rejected(guardedPort, request("write", { capacityObservation: observation }), ["CAPACITY_GOVERNANCE_REJECTED", upstream], `capacity ${upstream}`);
}
await rejected(guardedPort, request("write", { capacityObservation: capacityObservation("persistence_egress_bytes") }), ["CAPACITY_DIMENSION_MISMATCH"], "wrong write capacity dimension");
for (const [usedUnits, expectedReason] of [[900, "WARNING_90_REACHED"], [1000, "HARD_LIMIT_REACHED"], [1100, "HARD_LIMIT_EXCEEDED"]]) {
  await rejected(guardedPort, request("write", { capacityObservation: capacityObservation("persistence_growth_bytes", { usedUnits }) }), ["CAPACITY_NOT_AVAILABLE", expectedReason], `capacity threshold ${usedUnits}`);
}
equal(adapterCalls, 0, "rejected governance and capacity inputs never reach adapter");

// 50/75 warnings remain deterministic accepted capacity references; 90 fails closed.
for (const [usedUnits, budgetState, reasonCode] of [[500, "warning_50", "WARNING_50_REACHED"], [750, "warning_75", "WARNING_75_REACHED"]]) {
  const result = await accepted(guardedPort, request("write", { requestId: `warning-${usedUnits}`, record: { recordId: `record-${usedUnits}`, contentDigest: DIGEST_A, contentBytes: 1 }, capacityObservation: capacityObservation("persistence_growth_bytes", { usedUnits }) }), "written", `capacity warning ${usedUnits}`);
  equal([result.value.capacityReference.budgetState, result.value.capacityReference.reasonCode], [budgetState, reasonCode], `capacity warning ${usedUnits} retained`);
}

// Caller authority, schemas, policies, and extra dependency arguments cannot redirect the core.
for (const [field, reason] of [["callerSuppliesAuthority", "CALLER_AUTHORITY_INJECTION"], ["providerAuthorizes", "PROVIDER_AUTHORITY_CLAIM"], ["productionWriteGranted", "PRODUCTION_WRITE_CLAIM"]]) {
  await rejected(guardedPort, mutate(request(), ["authorityClaims", field], true), [reason], `${field} claim`);
}
for (const field of ["schema", "policy", "contract", "validator", "configuration", "thresholds", "retentionConfiguration", "adapter", "dependencies"]) {
  const injected = request(); injected[field] = {};
  await rejected(guardedPort, injected, ["CALLER_AUTHORITY_INJECTION"], `${field} authority injection`);
}
const redirected = await guardedPort.execute(request("write", { requestId: "extra-arguments", record: { recordId: "extra-arguments", contentDigest: DIGEST_A, contentBytes: 1 } }), { schema: { allowEverything: true } }, { policy: { hardLimit: Infinity } });
check(redirected.ok, "extra dependency arguments are ignored for canonical request");

// Adapter configuration is captured and hostile adapters cannot turn rejection into acceptance.
let capturedCalls = 0;
const mutableAdapter = { adapterId: "captured-adapter-v1", mode: "fixture_only", execute(operation, record) { capturedCalls += 1; return { ok: true, status: "written", record: { ...record, revision: 1 } }; } };
const capturedPort = createPersistencePort(mutableAdapter);
mutableAdapter.execute = () => { throw new Error("mutated adapter must not replace captured function"); };
await accepted(capturedPort, request("write", { requestId: "captured", record: { recordId: "captured", contentDigest: DIGEST_A, contentBytes: 1 } }), "written", "captured adapter function");
equal(capturedCalls, 1, "captured adapter remains stable after mutation");
await rejected(createPersistencePort(null), request(), ["PERSISTENCE_ADAPTER_UNAVAILABLE"], "missing core adapter");
await rejected(createPersistencePort({ adapterId: "throwing-v1", mode: "fixture_only", execute() { throw new Error("offline"); } }), request(), ["PERSISTENCE_ADAPTER_UNAVAILABLE"], "throwing adapter");
await rejected(createPersistencePort({ adapterId: "malformed-v1", mode: "fixture_only", execute() { return { ok: true, status: "written", record: { revision: 1 } }; } }), request(), ["INVALID_ADAPTER_RESULT"], "malformed adapter result");
await rejected(createPersistencePort({ adapterId: "authorizing-v1", mode: "fixture_only", execute() { return { ok: true, status: "written", record: { schemaVersion: "1.0.0", recordId: "x", dataCategory: "x", artifactClass: "x", retentionAction: "x", contentDigest: DIGEST_A, contentBytes: 1, revision: 1, productionWriteAuthorized: true } }; } }), request(), ["INVALID_ADAPTER_RESULT"], "adapter authority injection result");
await rejected(createPersistencePort({ adapterId: "mismatched-v1", mode: "fixture_only", execute(operation, record) { return { ok: true, status: "written", record: { ...record, recordId: "different-record", revision: 1 } }; } }), request(), ["INVALID_ADAPTER_RESULT"], "adapter cannot substitute another record");
await rejected(createPersistencePort({ adapterId: "wrong-status-v1", mode: "fixture_only", execute(operation, record) { return { ok: true, status: "found", record: { ...record, revision: 1 } }; } }), request(), ["INVALID_ADAPTER_RESULT"], "adapter status must match requested operation");

// Every malformed or hostile request returns a deterministic denial.
const malformed = [null, undefined, true, false, 0, 1, "request", [], Symbol("request"), 1n, NaN, Infinity, new Date(), /request/u, () => {}, Object.create({ inherited: true }), { ...request(), payload: { guestId: "guest" } }];
for (const value of malformed) await rejected(guardedPort, value, ["MALFORMED_REQUEST"], `malformed ${String(value)}`);
const cyclic = request(); cyclic.cycle = cyclic;
await rejected(guardedPort, cyclic, ["MALFORMED_REQUEST"], "cyclic request");
const accessor = request(); Object.defineProperty(accessor, "requestId", { enumerable: true, get() { throw new Error("must not escape"); } });
await rejected(guardedPort, accessor, ["MALFORMED_REQUEST"], "throwing accessor");
const proxy = new Proxy(request(), { ownKeys() { throw new Error("must not escape"); } });
await rejected(guardedPort, proxy, ["MALFORMED_REQUEST"], "throwing proxy");
for (const [path, value, expected] of [
  [["schemaVersion"], "2.0.0", ["UNSUPPORTED_SCHEMA_VERSION"]],
  [["operation"], "upsert", ["UNSUPPORTED_OPERATION"]],
  [["requestId"], "bad id", ["INVALID_RECORD_REFERENCE"]],
  [["record", "contentDigest"], "sha256:bad", ["INVALID_RECORD_REFERENCE"]],
  [["record", "contentBytes"], 65_537, ["INVALID_RECORD_REFERENCE"]]
]) await rejected(guardedPort, mutate(request(), path, value), expected, `invalid ${path.join(".")}`);

const [coreSource, compositionSource] = await Promise.all([
  readFile(new URL("../../packages/persistence-port/src/persistence-port-v1.mjs", import.meta.url), "utf8"),
  readFile(new URL("../../services/persistence-composition/persistence-composition-v1.mjs", import.meta.url), "utf8")
]);
equal([...coreSource.matchAll(/\bexport\s+function\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]), ["createPersistencePort"], "core exports exactly one constructor");
equal([...compositionSource.matchAll(/\bexport\s+function\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]), ["composePersistencePort"], "composition exports exactly one selector");
check(!/from\s+["'](?:cloudflare|supabase|github|openai|line|@?aws|pg|postgres|mysql|redis|bullmq|wrangler|better-sqlite3|sqlite)/iu.test(coreSource), "core imports no provider, database, queue, AI, or local-server SDK");
check(!/services[\\/]persistence-composition|scripts[\\/](?:verify|github|task)|reference[\\/]finalized-platform/iu.test(coreSource), "core depends inward and not on composition, verification, governance scripts, or immutable reference");
check(!/\bfetch\s*\(|from\s+["']node:(?:https?|fs|net|tls|child_process|os)|process\.(?:env|cwd)|Date\.now|new\s+Date/iu.test(coreSource), "core has no network, filesystem, environment, process, or clock dependency");
check(!/from\s+["'](?:cloudflare|supabase|github|openai|line|@?aws|pg|postgres|mysql|redis|bullmq|wrangler|better-sqlite3|sqlite)/iu.test(compositionSource), "reference composition imports no provider or database SDK");
check(!/\bfetch\s*\(|from\s+["']node:(?:https?|fs|net|tls|child_process)|process\.env/iu.test(compositionSource), "reference composition has no network, filesystem, credential, or process access");
check(!/\b(?:aiInvocation|modelInvocation|queueMessage|workflowStart)\s*\(/u.test(coreSource + compositionSource), "persistence composition creates no AI invocation, queue message, or workflow per event");

console.log(`P3-004 persistence composition V1 validation passed (${cases} cases).`);
