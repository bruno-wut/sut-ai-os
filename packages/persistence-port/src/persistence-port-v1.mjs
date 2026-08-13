import { classifyDataGovernanceCandidate } from "../../data-governance-contracts/src/data-minimisation-retention-contract-v1.mjs";
import { evaluateResourceBudget } from "../../resource-governance-contracts/src/resource-budget-contract-v1.mjs";

const ROOT_FIELDS = Object.freeze(["schemaVersion", "requestId", "operation", "record", "governanceCandidate", "authorityClaims"]);
const RECORD_FIELDS = Object.freeze(["recordId", "contentDigest", "contentBytes", "expectedRevision"]);
const AUTHORITY_FIELDS = Object.freeze(["callerSuppliesAuthority", "providerAuthorizes", "productionWriteGranted"]);
const ADAPTER_FIELDS = Object.freeze(["adapterId", "mode", "execute"]);
const CAPACITY_SOURCE_FIELDS = Object.freeze(["sourceId", "mode", "observe"]);
const TEST_CAPACITY_SOURCE_IDS = new Set(["trusted-test-capacity-v1", "offline-capacity-v1"]);
const OPERATIONS = new Set(["read", "write", "append", "delete_expired"]);
const WRITE_ACTIONS = new Set(["aggregate", "archive", "transfer_eligible", "retain"]);
const APPEND_ACTIONS = new Set(["archive", "transfer_eligible", "retain"]);
const READ_ACTIONS = new Set(["aggregate", "archive", "transfer_eligible", "retain"]);
const REQUIRED_DIMENSION = Object.freeze({ read: "persistence_egress_bytes", write: "persistence_growth_bytes", append: "persistence_growth_bytes", delete_expired: "persistence_size_bytes" });
const ACCEPTABLE_CAPACITY_OUTCOMES = new Set(["continue_candidate", "warn_continue_candidate", "throttle_candidate"]);
const INJECTED_AUTHORITY_FIELDS = new Set(["schema", "policy", "contract", "validator", "configuration", "thresholds", "retentionConfiguration", "adapter", "dependencies", "capacityObservation", "capacitySource", "resourceBudgetPolicy"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ADAPTER_RESULT_REASONS = new Set(["RECORD_ALREADY_EXISTS", "RECORD_IDENTITY_CONFLICT", "PROTECTED_RECORD_DELETE_FORBIDDEN", "RECORD_NOT_FOUND", "REVISION_CONFLICT", "IDEMPOTENCY_CONFLICT", "REFERENCE_CAPACITY_REACHED", "ADAPTER_CONFIGURATION_MISSING", "UNSUPPORTED_ADAPTER_CONFIGURATION"]);

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

function rejection(reasonCodes, adapterId = null) {
  return deepFreeze({
    ok: false,
    value: null,
    rejection: { schemaVersion: "1.0.0", failClosed: true, reasonCodes: [...reasonCodes], adapterId, productionWriteAuthorized: false, externalSideEffectAuthorized: false }
  });
}

function accepted(request, adapterId, capacitySourceId, adapterResult, governanceDecision, capacityDecision) {
  return deepFreeze({
    ok: true,
    value: {
      schemaVersion: "1.0.0",
      requestId: request.requestId,
      operation: request.operation,
      adapterId,
      status: adapterResult.status,
      record: adapterResult.record,
      governanceReference: {
        candidateId: governanceDecision.value.candidate.candidateId,
        dataCategory: governanceDecision.value.candidate.dataCategory,
        artifactClass: governanceDecision.value.candidate.artifactClass,
        requestedAction: governanceDecision.value.candidate.requestedAction,
        eligibility: governanceDecision.value.eligibility
      },
      capacityReference: {
        sourceId: capacitySourceId,
        observationId: capacityDecision.value.observationId,
        resourceDimension: capacityDecision.value.resourceDimension,
        budgetState: capacityDecision.value.budgetState,
        reasonCode: capacityDecision.value.reasonCode,
        boundContentBytes: request.record.contentBytes
      },
      fixtureOnly: true,
      nonAuthoritative: true,
      productionWriteAuthorized: false,
      externalSideEffectAuthorized: false
    },
    rejection: null
  });
}

function hasCallerAuthorityInjection(input) {
  if (!isPlainObject(input)) return false;
  return Reflect.ownKeys(input).some((key) => typeof key === "string" && INJECTED_AUTHORITY_FIELDS.has(key));
}

function requestShapeIsComplete(request) {
  if (!exactKeys(request, ROOT_FIELDS) || typeof request.schemaVersion !== "string" || typeof request.requestId !== "string" || typeof request.operation !== "string") return false;
  if (!exactKeys(request.record, RECORD_FIELDS) || typeof request.record.recordId !== "string" || typeof request.record.contentDigest !== "string" || !Number.isSafeInteger(request.record.contentBytes) || (request.record.expectedRevision !== null && !Number.isSafeInteger(request.record.expectedRevision))) return false;
  return exactKeys(request.authorityClaims, AUTHORITY_FIELDS) && AUTHORITY_FIELDS.every((field) => typeof request.authorityClaims[field] === "boolean");
}

function structuralReasons(request) {
  const reasons = [];
  if (request.schemaVersion !== "1.0.0") reasons.push("UNSUPPORTED_SCHEMA_VERSION");
  if (!IDENTIFIER.test(request.requestId) || !IDENTIFIER.test(request.record.recordId) || !DIGEST.test(request.record.contentDigest) || request.record.contentBytes < 0 || request.record.contentBytes > 65_536) reasons.push("INVALID_RECORD_REFERENCE");
  if (!OPERATIONS.has(request.operation)) reasons.push("UNSUPPORTED_OPERATION");
  if ((request.operation === "delete_expired" && (!Number.isSafeInteger(request.record.expectedRevision) || request.record.expectedRevision < 1)) || (request.operation !== "delete_expired" && request.record.expectedRevision !== null)) reasons.push("INVALID_EXPECTED_REVISION");
  if (request.authorityClaims.callerSuppliesAuthority) reasons.push("CALLER_AUTHORITY_INJECTION");
  if (request.authorityClaims.providerAuthorizes) reasons.push("PROVIDER_AUTHORITY_CLAIM");
  if (request.authorityClaims.productionWriteGranted) reasons.push("PRODUCTION_WRITE_CLAIM");
  return reasons;
}

function retentionReferenceMatches(operation, candidate) {
  if (candidate.handlingIntent.storage === "source_system_only") return false;
  if (candidate.historyProtection.kind !== "none" && operation !== "append" && operation !== "read") return false;
  if (operation === "write") return WRITE_ACTIONS.has(candidate.requestedAction);
  if (operation === "append") return APPEND_ACTIONS.has(candidate.requestedAction);
  if (operation === "read") return READ_ACTIONS.has(candidate.requestedAction);
  return operation === "delete_expired" && candidate.requestedAction === "scheduled_delete" && candidate.historyProtection.kind === "none";
}

function validAdapterResult(result) {
  if (!isPlainObject(result) || typeof result.ok !== "boolean") return false;
  if (!result.ok) return exactKeys(result, ["ok", "reasonCode"]) && ADAPTER_RESULT_REASONS.has(result.reasonCode);
  if (!exactKeys(result, ["ok", "status", "record"]) || !["found", "written", "appended", "deleted", "not_found"].includes(result.status)) return false;
  if (result.status === "not_found") return result.record === null;
  return exactKeys(result.record, ["schemaVersion", "recordId", "dataCategory", "artifactClass", "retentionAction", "contentDigest", "contentBytes", "revision"]) &&
    result.record.schemaVersion === "1.0.0" && IDENTIFIER.test(result.record.recordId) && typeof result.record.dataCategory === "string" && typeof result.record.artifactClass === "string" && typeof result.record.retentionAction === "string" && DIGEST.test(result.record.contentDigest) && Number.isSafeInteger(result.record.contentBytes) && result.record.contentBytes >= 0 && Number.isSafeInteger(result.record.revision) && result.record.revision >= 1;
}

function adapterResultMatchesRequest(result, operation, record, expectedRevision) {
  if (!result.ok) return true;
  const statuses = {
    read: new Set(["found", "not_found"]),
    write: new Set(["written"]),
    append: new Set(["appended"]),
    delete_expired: new Set(["deleted", "not_found"])
  };
  if (!statuses[operation]?.has(result.status)) return false;
  if (result.status === "not_found") return true;
  const identityMatches = result.record.recordId === record.recordId && result.record.dataCategory === record.dataCategory && result.record.artifactClass === record.artifactClass;
  if (!identityMatches) return false;
  if (operation === "delete_expired") return result.record.retentionAction !== "scheduled_delete" && result.record.contentDigest === record.contentDigest && result.record.contentBytes === record.contentBytes && result.record.revision === expectedRevision;
  return result.record.retentionAction === record.retentionAction && result.record.contentDigest === record.contentDigest && result.record.contentBytes === record.contentBytes;
}

function captureAdapter(adapter) {
  try {
    if (!exactKeys(adapter, ADAPTER_FIELDS) || typeof adapter.adapterId !== "string" || adapter.mode !== "fixture_only" || typeof adapter.execute !== "function") return null;
    const adapterId = `${adapter.adapterId}`;
    if (!IDENTIFIER.test(adapterId)) return null;
    const execute = adapter.execute.bind(adapter);
    return Object.freeze({ adapterId, execute });
  } catch {
    return null;
  }
}

function captureCapacitySource(source) {
  try {
    if (!exactKeys(source, CAPACITY_SOURCE_FIELDS) || typeof source.sourceId !== "string" || source.mode !== "fixture_only" || typeof source.observe !== "function") return null;
    const sourceId = `${source.sourceId}`;
    if (!IDENTIFIER.test(sourceId)) return null;
    const observe = source.observe.bind(source);
    return Object.freeze({ sourceId, observe });
  } catch {
    return null;
  }
}

function committedReferenceCapacitySource() {
  return Object.freeze({
    sourceId: "reference-capacity-v1",
    mode: "fixture_only",
    observe(query) {
      const dimension = REQUIRED_DIMENSION[query.operation];
      return {
        binding: guardedClone(query),
        observation: {
          schemaVersion: "1.0.0", observationId: "reference-capacity-observation", resourceDimension: dimension, unit: "bytes", workloadZone: "ai_workload",
          budgetAuthorityState: "available", configurationState: "valid", meterState: "fresh", usedUnits: 0, reservedUnits: query.contentBytes, hardLimitUnits: 1_000_000,
          observedAt: "2026-08-13T00:00:00Z", meterAgeSeconds: 0,
          workloadControls: { batchingMode: "bounded_batch", batchSize: 100, deduplicationRequired: true, idempotencyRequired: true, backpressureRequired: true, rateLimitPerMinute: 100, concurrencyLimit: 4, retryLimit: 3, retryAttempt: 0, deadLetterHandlingRequired: true, priorityQueueRequired: true, summaryMode: "scheduled_summary", perGuestInteractionUnitOfWork: false, perEventAiInvocation: false, safeToRequeue: true },
          bookingIsolation: { bookingWorkload: false, sharesQuotaWithBooking: false, sharesCredentialsWithBooking: false, sharesDeploymentWithBooking: false, sharesFailureBoundaryWithBooking: false },
          authorityClaims: { callerSuppliesPolicy: false, callerSuppliesThresholds: false, decisionAuthorizesScheduling: false, decisionAuthorizesExecution: false, decisionAuthorizesNotification: false, decisionAuthorizesProductionWrite: false, productionWriteGranted: false }
        }
      };
    }
  });
}

function capacityEnvelopeMatches(envelope, request, record) {
  if (!exactKeys(envelope, ["binding", "observation"]) || !exactKeys(envelope.binding, ["schemaVersion", "requestId", "operation", "recordId", "contentDigest", "contentBytes"])) return false;
  const binding = envelope.binding;
  return binding.schemaVersion === "1.0.0" && binding.requestId === request.requestId && binding.operation === request.operation && binding.recordId === record.recordId && binding.contentDigest === record.contentDigest && binding.contentBytes === record.contentBytes &&
    isPlainObject(envelope.observation) && envelope.observation.resourceDimension === REQUIRED_DIMENSION[request.operation] && envelope.observation.reservedUnits === record.contentBytes;
}

/**
 * Construct the provider-neutral PersistencePort deep module.
 * The returned object exposes one stable operation and captures its adapter.
 */
function buildPersistencePort(adapter, capacitySource) {
  const captured = captureAdapter(adapter);
  const capturedCapacity = captureCapacitySource(capacitySource);

  async function execute(untrustedRequest) {
    try {
      if (captured === null) return rejection(["PERSISTENCE_ADAPTER_UNAVAILABLE"]);
      if (capturedCapacity === null) return rejection(["CAPACITY_SOURCE_UNAVAILABLE"], captured.adapterId);
      let injected = false;
      try { injected = hasCallerAuthorityInjection(untrustedRequest); } catch { return rejection(["MALFORMED_REQUEST"], captured.adapterId); }
      if (injected) return rejection(["CALLER_AUTHORITY_INJECTION"], captured.adapterId);
      let request;
      try { request = guardedClone(untrustedRequest); } catch { return rejection(["MALFORMED_REQUEST"], captured.adapterId); }
      if (!requestShapeIsComplete(request)) return rejection(["MALFORMED_REQUEST"], captured.adapterId);
      const structural = structuralReasons(request);
      if (structural.length > 0) return rejection(structural, captured.adapterId);

      const governanceDecision = classifyDataGovernanceCandidate(request.governanceCandidate);
      if (!governanceDecision?.ok) return rejection(["DATA_GOVERNANCE_REJECTED", ...(governanceDecision?.rejection?.reasonCodes ?? ["INTERNAL_AUTHORITY_UNAVAILABLE"])], captured.adapterId);
      if (governanceDecision.value.eligibility === "source_only") return rejection(["RAW_SOURCE_ONLY_CATEGORY"], captured.adapterId);
      if (!retentionReferenceMatches(request.operation, governanceDecision.value.candidate)) return rejection(["RETENTION_REFERENCE_MISMATCH"], captured.adapterId);

      const record = deepFreeze({
        schemaVersion: "1.0.0",
        recordId: request.record.recordId,
        dataCategory: governanceDecision.value.candidate.dataCategory,
        artifactClass: governanceDecision.value.candidate.artifactClass,
        retentionAction: governanceDecision.value.candidate.requestedAction,
        contentDigest: request.record.contentDigest,
        contentBytes: request.record.contentBytes
      });
      const capacityQuery = deepFreeze({ schemaVersion: "1.0.0", requestId: request.requestId, operation: request.operation, recordId: record.recordId, contentDigest: record.contentDigest, contentBytes: record.contentBytes });
      let capacityEnvelope;
      try { capacityEnvelope = guardedClone(await capturedCapacity.observe(capacityQuery)); } catch { return rejection(["CAPACITY_SOURCE_UNAVAILABLE"], captured.adapterId); }
      if (!capacityEnvelopeMatches(capacityEnvelope, request, record)) return rejection(["CAPACITY_BINDING_MISMATCH"], captured.adapterId);
      const capacityDecision = evaluateResourceBudget(capacityEnvelope.observation);
      if (!capacityDecision?.ok) return rejection(["CAPACITY_GOVERNANCE_REJECTED", ...(capacityDecision?.rejection?.reasonCodes ?? ["INTERNAL_AUTHORITY_UNAVAILABLE"])], captured.adapterId);
      if (capacityDecision.value.failClosed || !ACCEPTABLE_CAPACITY_OUTCOMES.has(capacityDecision.value.outcome)) return rejection(["CAPACITY_NOT_AVAILABLE", capacityDecision.value.reasonCode], captured.adapterId);

      const adapterContext = deepFreeze({ idempotencyKey: request.requestId, expectedRevision: request.record.expectedRevision });
      let adapterResult;
      try { adapterResult = guardedClone(await captured.execute(request.operation, record, adapterContext)); } catch { return rejection(["PERSISTENCE_ADAPTER_UNAVAILABLE"], captured.adapterId); }
      if (!validAdapterResult(adapterResult) || !adapterResultMatchesRequest(adapterResult, request.operation, record, request.record.expectedRevision)) return rejection(["INVALID_ADAPTER_RESULT"], captured.adapterId);
      if (!adapterResult.ok) return rejection([adapterResult.reasonCode], captured.adapterId);
      return accepted(request, captured.adapterId, capturedCapacity.sourceId, adapterResult, governanceDecision, capacityDecision);
    } catch {
      return rejection(["INTERNAL_PERSISTENCE_FAILURE"], captured?.adapterId ?? null);
    }
  }

  return deepFreeze({ execute });
}

/** Construct the normal fixture-only port with committed internal capacity authority. */
export function createPersistencePort(adapter) {
  return buildPersistencePort(adapter, committedReferenceCapacitySource());
}

/** Test-only dependency injection; rejects every non-whitelisted fixture source identity. */
export function createPersistencePortForTesting(adapter, capacitySource) {
  let sourceId = null;
  try { sourceId = capacitySource?.sourceId; } catch { /* fail closed below */ }
  return buildPersistencePort(adapter, TEST_CAPACITY_SOURCE_IDS.has(sourceId) ? capacitySource : null);
}
