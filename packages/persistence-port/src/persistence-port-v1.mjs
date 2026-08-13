import { classifyDataGovernanceCandidate } from "../../data-governance-contracts/src/data-minimisation-retention-contract-v1.mjs";
import { evaluateResourceBudget } from "../../resource-governance-contracts/src/resource-budget-contract-v1.mjs";

const ROOT_FIELDS = Object.freeze(["schemaVersion", "requestId", "operation", "record", "governanceCandidate", "capacityObservation", "authorityClaims"]);
const RECORD_FIELDS = Object.freeze(["recordId", "contentDigest", "contentBytes"]);
const AUTHORITY_FIELDS = Object.freeze(["callerSuppliesAuthority", "providerAuthorizes", "productionWriteGranted"]);
const ADAPTER_FIELDS = Object.freeze(["adapterId", "mode", "execute"]);
const OPERATIONS = new Set(["read", "write", "append", "delete_expired"]);
const WRITE_ACTIONS = new Set(["aggregate", "archive", "transfer_eligible", "retain"]);
const APPEND_ACTIONS = new Set(["archive", "transfer_eligible", "retain"]);
const READ_ACTIONS = new Set(["aggregate", "archive", "transfer_eligible", "retain"]);
const REQUIRED_DIMENSION = Object.freeze({ read: "persistence_egress_bytes", write: "persistence_growth_bytes", append: "persistence_growth_bytes", delete_expired: "persistence_size_bytes" });
const ACCEPTABLE_CAPACITY_OUTCOMES = new Set(["continue_candidate", "warn_continue_candidate", "throttle_candidate"]);
const INJECTED_AUTHORITY_FIELDS = new Set(["schema", "policy", "contract", "validator", "configuration", "thresholds", "retentionConfiguration", "adapter", "dependencies"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DIGEST = /^sha256:[a-f0-9]{64}$/;
const ADAPTER_RESULT_REASONS = new Set(["RECORD_ALREADY_EXISTS", "RECORD_IDENTITY_CONFLICT", "PROTECTED_RECORD_DELETE_FORBIDDEN", "RECORD_NOT_FOUND", "REVISION_CONFLICT", "REFERENCE_CAPACITY_REACHED", "ADAPTER_CONFIGURATION_MISSING", "UNSUPPORTED_ADAPTER_CONFIGURATION"]);

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

function accepted(request, adapterId, adapterResult, governanceDecision, capacityDecision) {
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
        observationId: capacityDecision.value.observationId,
        resourceDimension: capacityDecision.value.resourceDimension,
        budgetState: capacityDecision.value.budgetState,
        reasonCode: capacityDecision.value.reasonCode
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
  if (!exactKeys(request.record, RECORD_FIELDS) || typeof request.record.recordId !== "string" || typeof request.record.contentDigest !== "string" || !Number.isSafeInteger(request.record.contentBytes)) return false;
  return exactKeys(request.authorityClaims, AUTHORITY_FIELDS) && AUTHORITY_FIELDS.every((field) => typeof request.authorityClaims[field] === "boolean");
}

function structuralReasons(request) {
  const reasons = [];
  if (request.schemaVersion !== "1.0.0") reasons.push("UNSUPPORTED_SCHEMA_VERSION");
  if (!IDENTIFIER.test(request.requestId) || !IDENTIFIER.test(request.record.recordId) || !DIGEST.test(request.record.contentDigest) || request.record.contentBytes < 0 || request.record.contentBytes > 65_536) reasons.push("INVALID_RECORD_REFERENCE");
  if (!OPERATIONS.has(request.operation)) reasons.push("UNSUPPORTED_OPERATION");
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

function adapterResultMatchesRequest(result, operation, record) {
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
  if (!identityMatches || operation === "delete_expired") return identityMatches;
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

/**
 * Construct the provider-neutral PersistencePort deep module.
 * The returned object exposes one stable operation and captures its adapter.
 */
export function createPersistencePort(adapter) {
  const captured = captureAdapter(adapter);

  async function execute(untrustedRequest) {
    try {
      if (captured === null) return rejection(["PERSISTENCE_ADAPTER_UNAVAILABLE"]);
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

      const capacityDecision = evaluateResourceBudget(request.capacityObservation);
      if (!capacityDecision?.ok) return rejection(["CAPACITY_GOVERNANCE_REJECTED", ...(capacityDecision?.rejection?.reasonCodes ?? ["INTERNAL_AUTHORITY_UNAVAILABLE"])], captured.adapterId);
      if (capacityDecision.value.resourceDimension !== REQUIRED_DIMENSION[request.operation]) return rejection(["CAPACITY_DIMENSION_MISMATCH"], captured.adapterId);
      if (capacityDecision.value.failClosed || !ACCEPTABLE_CAPACITY_OUTCOMES.has(capacityDecision.value.outcome)) return rejection(["CAPACITY_NOT_AVAILABLE", capacityDecision.value.reasonCode], captured.adapterId);

      const record = deepFreeze({
        schemaVersion: "1.0.0",
        recordId: request.record.recordId,
        dataCategory: governanceDecision.value.candidate.dataCategory,
        artifactClass: governanceDecision.value.candidate.artifactClass,
        retentionAction: governanceDecision.value.candidate.requestedAction,
        contentDigest: request.record.contentDigest,
        contentBytes: request.record.contentBytes
      });
      let adapterResult;
      try { adapterResult = guardedClone(await captured.execute(request.operation, record)); } catch { return rejection(["PERSISTENCE_ADAPTER_UNAVAILABLE"], captured.adapterId); }
      if (!validAdapterResult(adapterResult) || !adapterResultMatchesRequest(adapterResult, request.operation, record)) return rejection(["INVALID_ADAPTER_RESULT"], captured.adapterId);
      if (!adapterResult.ok) return rejection([adapterResult.reasonCode], captured.adapterId);
      return accepted(request, captured.adapterId, adapterResult, governanceDecision, capacityDecision);
    } catch {
      return rejection(["INTERNAL_PERSISTENCE_FAILURE"], captured?.adapterId ?? null);
    }
  }

  return deepFreeze({ execute });
}
