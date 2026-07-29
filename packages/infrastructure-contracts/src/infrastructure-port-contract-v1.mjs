/** Static P2-005 boundary validation. This module authenticates and dispatches nothing. */

const ROOT_FIELDS = Object.freeze(["schemaVersion", "requestId", "routeClass", "sourceZone", "targetZone", "port", "operation", "transport", "securityEvidence", "deliveryEvidence", "limitEvidence", "isolationEvidence", "authorityClaims"]);
const TRANSPORT_FIELDS = Object.freeze(["protocol", "method", "requestBodyBytes", "responseBodyLimitBytes", "timeoutMs"]);
const SECURITY_FIELDS = Object.freeze(["factSource", "credentialStatus", "credentialAudience", "credentialLifetimeSeconds", "credentialAgeSeconds", "timestampStatus", "nonceStatus"]);
const DELIVERY_FIELDS = Object.freeze(["idempotencyKey", "idempotencyStatus"]);
const LIMIT_FIELDS = Object.freeze(["authenticatedCallerId", "callerLimitStatus", "routeLimitStatus"]);
const ISOLATION_FIELDS = Object.freeze(["credentialsSharedWithGuest", "quotasSharedWithGuest", "deploymentsSharedWithGuest", "failureBoundariesSharedWithGuest", "bookingAvailabilityDependsOnInternalServices"]);
const AUTHORITY_FIELDS = Object.freeze(["providerAuthorizes", "callerAuthorizes", "requestAuthorizes", "policyBypassed", "productionWriteGranted"]);
const INJECTED_AUTHORITY_FIELDS = new Set(["schema", "policy", "contract", "adapter", "configuration", "validator", "dependencies"]);
const ZONES = new Set(["guest_public", "staff_control", "ai_workload"]);
const CREDENTIAL_STATES = new Set(["valid", "missing", "invalid", "expired", "audience_mismatch"]);
const TIMESTAMP_STATES = new Set(["within_window", "missing", "outside_window", "invalid"]);
const NONCE_STATES = new Set(["fresh", "missing", "reused", "invalid"]);
const IDEMPOTENCY_STATES = new Set(["new", "missing", "duplicate_same_request", "conflict"]);
const LIMIT_STATES = new Set(["within_limit", "exceeded", "unknown"]);
const IDENTIFIER = /^[a-z][a-z0-9-]{0,63}$/;
const REQUEST_IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const PORTS = Object.freeze({
  PersistencePort: Object.freeze(["read", "write", "append", "delete_expired"]),
  EventIngestionPort: Object.freeze(["ingest_batch"]),
  AnalyticsSourcePort: Object.freeze(["read_aggregate"]),
  SchedulingQueuePort: Object.freeze(["enqueue", "lease", "acknowledge", "requeue", "dead_letter"]),
  WorkflowExecutionPort: Object.freeze(["start", "resume", "cancel", "read_state"]),
  ObjectStoragePort: Object.freeze(["put", "get", "delete_expired"]),
  NotificationPort: Object.freeze(["send"]),
  IntelligenceProvider: Object.freeze(["analyze"]),
  DeploymentProvider: Object.freeze(["prepare", "read_status", "rollback"]),
  AuthenticationPort: Object.freeze(["verify_identity"]),
  ProposalGenerator: Object.freeze(["generate"]),
  ExecutorAdapter: Object.freeze(["execute"]),
  VerificationProvider: Object.freeze(["verify"])
});

const ROUTES = Object.freeze({
  aggregate_or_lifecycle_ingest: Object.freeze({ sourceZone: "guest_public", targetZone: "staff_control", port: "EventIngestionPort", operation: "ingest_batch" }),
  prepared_analytics_read: Object.freeze({ sourceZone: "staff_control", targetZone: "guest_public", port: "AnalyticsSourcePort", operation: "read_aggregate" }),
  bounded_work_request: Object.freeze({ sourceZone: "staff_control", targetZone: "ai_workload", port: "SchedulingQueuePort", operation: "enqueue" }),
  bounded_work_result: Object.freeze({ sourceZone: "ai_workload", targetZone: "staff_control", port: "WorkflowExecutionPort", operation: "read_state" }),
  staff_notification: Object.freeze({ sourceZone: "ai_workload", targetZone: "staff_control", port: "NotificationPort", operation: "send" })
});

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, fields) {
  return isPlainObject(value) && Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function guardedClone(value, seen = new Set()) {
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
        clone.push(guardedClone(descriptor.value, seen));
      }
      return clone;
    }
    if (!isPlainObject(value)) throw new TypeError("non-plain object");
    const clone = {};
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") throw new TypeError("symbol key");
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) throw new TypeError("accessor");
      Object.defineProperty(clone, key, { value: guardedClone(descriptor.value, seen), enumerable: true, writable: true, configurable: true });
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

function rejection(reasonCodes) {
  return deepFreeze({ ok: false, value: null, rejection: { schemaVersion: "1.0.0", failClosed: true, reasonCodes: [...reasonCodes] } });
}

function policySemanticsAreExact(policy) {
  if (!exactKeys(policy, ["schemaVersion", "policyId", "zones", "crossZoneProtocol", "routes", "ports", "coreDependencyRules", "bookingIsolation", "authority"])) return false;
  if (policy.schemaVersion !== "1.0.0" || policy.policyId !== "infrastructure-trust-zone-policy-v1") return false;
  const boundaryIds = policy.zones.flatMap((zone) => [zone.credentialBoundaryId, zone.quotaBoundaryId, zone.deploymentBoundaryId, zone.failureBoundaryId]);
  if (new Set(boundaryIds).size !== 12) return false;
  if (policy.ports.length !== Object.keys(PORTS).length || policy.ports.some((entry, index) => entry.port !== Object.keys(PORTS)[index] || JSON.stringify(entry.operations) !== JSON.stringify(PORTS[entry.port]))) return false;
  if (policy.routes.length !== Object.keys(ROUTES).length || policy.routes.some((entry, index) => {
    const routeClass = Object.keys(ROUTES)[index];
    const expected = ROUTES[routeClass];
    return entry.routeClass !== routeClass || entry.sourceZone !== expected.sourceZone || entry.targetZone !== expected.targetZone || entry.port !== expected.port || entry.operation !== expected.operation;
  })) return false;
  return true;
}

function schemaSemanticsAreExpected(schema) {
  return isPlainObject(schema) && schema.$schema === "https://json-schema.org/draft/2020-12/schema" &&
    schema.$id === "https://sut-ai-os.local/schemas/infrastructure-port-contract-v1.schema.json" &&
    schema.additionalProperties === false && isPlainObject(schema.$defs) &&
    isPlainObject(schema.$defs.boundaryRequest) && schema.$defs.boundaryRequest.additionalProperties === false &&
    isPlainObject(schema.$defs.validationDecision) && Array.isArray(schema.$defs.validationDecision.oneOf) && schema.$defs.validationDecision.oneOf.length === 2;
}

async function loadAuthority() {
  try {
    const [{ default: schemaSource }, { default: policySource }, { default: Ajv2020 }] = await Promise.all([
      import("../../../schemas/infrastructure-port-contract-v1.schema.json", { with: { type: "json" } }),
      import("../../../policies/infrastructure-trust-zone-policy-v1.json", { with: { type: "json" } }),
      import("ajv/dist/2020.js")
    ]);
    const schema = deepFreeze(guardedClone(schemaSource));
    const policy = deepFreeze(guardedClone(policySource));
    if (!schemaSemanticsAreExpected(schema) || !policySemanticsAreExact(policy)) return null;
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
    if (!ajv.validateSchema(schema)) return null;
    const validatePolicy = ajv.compile(schema);
    if (!validatePolicy(policy)) return null;
    const validateRequest = ajv.compile({ $ref: `${schema.$id}#/$defs/boundaryRequest` });
    return Object.freeze({ validateRequest });
  } catch {
    return null;
  }
}

const authority = await loadAuthority();

function hasCallerAuthorityInjection(input) {
  if (!isPlainObject(input)) return false;
  return Reflect.ownKeys(input).some((key) => typeof key === "string" && INJECTED_AUTHORITY_FIELDS.has(key));
}

function shapeIsComplete(request) {
  if (!exactKeys(request, ROOT_FIELDS) || typeof request.schemaVersion !== "string" || typeof request.requestId !== "string" ||
      typeof request.routeClass !== "string" || typeof request.sourceZone !== "string" || typeof request.targetZone !== "string" ||
      typeof request.port !== "string" || typeof request.operation !== "string") return false;
  if (!exactKeys(request.transport, TRANSPORT_FIELDS) || typeof request.transport.protocol !== "string" || typeof request.transport.method !== "string" ||
      !Number.isInteger(request.transport.requestBodyBytes) || !Number.isInteger(request.transport.responseBodyLimitBytes) || !Number.isInteger(request.transport.timeoutMs)) return false;
  if (!exactKeys(request.securityEvidence, SECURITY_FIELDS) || typeof request.securityEvidence.factSource !== "string" || typeof request.securityEvidence.credentialStatus !== "string" ||
      (request.securityEvidence.credentialAudience !== null && typeof request.securityEvidence.credentialAudience !== "string") ||
      !Number.isInteger(request.securityEvidence.credentialLifetimeSeconds) || !Number.isInteger(request.securityEvidence.credentialAgeSeconds) ||
      typeof request.securityEvidence.timestampStatus !== "string" || typeof request.securityEvidence.nonceStatus !== "string") return false;
  if (!exactKeys(request.deliveryEvidence, DELIVERY_FIELDS) || (request.deliveryEvidence.idempotencyKey !== null && typeof request.deliveryEvidence.idempotencyKey !== "string") || typeof request.deliveryEvidence.idempotencyStatus !== "string") return false;
  if (!exactKeys(request.limitEvidence, LIMIT_FIELDS) || typeof request.limitEvidence.authenticatedCallerId !== "string" || typeof request.limitEvidence.callerLimitStatus !== "string" || typeof request.limitEvidence.routeLimitStatus !== "string") return false;
  if (!exactKeys(request.isolationEvidence, ISOLATION_FIELDS) || ISOLATION_FIELDS.some((field) => typeof request.isolationEvidence[field] !== "boolean")) return false;
  return exactKeys(request.authorityClaims, AUTHORITY_FIELDS) && AUTHORITY_FIELDS.every((field) => typeof request.authorityClaims[field] === "boolean");
}

function structurallyMalformed(request) {
  const security = request.securityEvidence;
  return !REQUEST_IDENTIFIER.test(request.requestId) ||
    request.transport.requestBodyBytes < 0 || request.transport.responseBodyLimitBytes < 1 ||
    security.factSource !== "recipient_adapter" || !CREDENTIAL_STATES.has(security.credentialStatus) ||
    security.credentialLifetimeSeconds < 1 || security.credentialAgeSeconds < 0 ||
    !TIMESTAMP_STATES.has(security.timestampStatus) || !NONCE_STATES.has(security.nonceStatus) ||
    !IDEMPOTENCY_STATES.has(request.deliveryEvidence.idempotencyStatus) ||
    !IDENTIFIER.test(request.limitEvidence.authenticatedCallerId) || !LIMIT_STATES.has(request.limitEvidence.callerLimitStatus) || !LIMIT_STATES.has(request.limitEvidence.routeLimitStatus);
}

function structuralReasons(request) {
  const reasons = [];
  if (structurallyMalformed(request)) reasons.push("MALFORMED_REQUEST");
  if (request.schemaVersion !== "1.0.0") reasons.push("UNSUPPORTED_SCHEMA_VERSION");
  const sourceKnown = ZONES.has(request.sourceZone);
  const targetKnown = ZONES.has(request.targetZone);
  if (!sourceKnown || !targetKnown) reasons.push("UNKNOWN_ZONE");
  const route = ROUTES[request.routeClass];
  if (sourceKnown && targetKnown) {
    const directGuestAi = (request.sourceZone === "guest_public" && request.targetZone === "ai_workload") || (request.sourceZone === "ai_workload" && request.targetZone === "guest_public");
    const directionListed = Object.values(ROUTES).some((candidate) => candidate.sourceZone === request.sourceZone && candidate.targetZone === request.targetZone);
    if (request.sourceZone === request.targetZone || directGuestAi || !directionListed || (route && (route.sourceZone !== request.sourceZone || route.targetZone !== request.targetZone))) reasons.push("ZONE_CONFUSION");
  }
  if (!route) reasons.push("UNSUPPORTED_ROUTE");
  const portOperations = PORTS[request.port];
  const supportedPortOperation = Array.isArray(portOperations) && portOperations.includes(request.operation);
  if (!supportedPortOperation) reasons.push("UNSUPPORTED_PORT");
  if (route && supportedPortOperation && (route.port !== request.port || route.operation !== request.operation)) reasons.push("ROUTE_PORT_MISMATCH");
  if (request.transport.protocol !== "https" || request.transport.method !== "POST") reasons.push("INSECURE_TRANSPORT");
  return [...new Set(reasons)];
}

function firstDispatchBlockingReason(request) {
  const security = request.securityEvidence;
  if (security.credentialStatus === "missing" || security.credentialStatus === "invalid") return "UNAUTHENTICATED_CALLER";
  if (security.credentialStatus === "audience_mismatch" || security.credentialAudience === null || security.credentialAudience !== request.targetZone) return "INVALID_AUDIENCE";
  if (security.credentialStatus === "expired" || security.credentialLifetimeSeconds > 300 || security.credentialAgeSeconds > security.credentialLifetimeSeconds) return "CREDENTIAL_EXPIRED";
  if (security.timestampStatus !== "within_window") return "INVALID_TIMESTAMP";
  if (security.nonceStatus !== "fresh") return "REPLAY_DETECTED";
  const delivery = request.deliveryEvidence;
  if (delivery.idempotencyKey === null || !REQUEST_IDENTIFIER.test(delivery.idempotencyKey) || delivery.idempotencyStatus === "missing") return "MISSING_IDEMPOTENCY_KEY";
  if (delivery.idempotencyStatus === "conflict") return "IDEMPOTENCY_CONFLICT";
  if (delivery.idempotencyStatus === "duplicate_same_request") return "DUPLICATE_ACCEPTED_REQUEST";
  if (request.transport.requestBodyBytes > 65536) return "REQUEST_BODY_LIMIT_EXCEEDED";
  if (request.transport.responseBodyLimitBytes > 262144) return "RESPONSE_BODY_LIMIT_EXCEEDED";
  if (request.transport.timeoutMs < 100 || request.transport.timeoutMs > 10000) return "TIMEOUT_LIMIT_EXCEEDED";
  if (request.limitEvidence.callerLimitStatus === "exceeded") return "CALLER_RATE_LIMITED";
  if (request.limitEvidence.routeLimitStatus === "exceeded") return "ROUTE_RATE_LIMITED";
  if (request.limitEvidence.callerLimitStatus === "unknown" || request.limitEvidence.routeLimitStatus === "unknown") return "UNKNOWN_LIMIT_STATE";
  if (request.isolationEvidence.credentialsSharedWithGuest) return "SHARED_CREDENTIAL_BOUNDARY";
  if (request.isolationEvidence.quotasSharedWithGuest) return "SHARED_QUOTA_BOUNDARY";
  if (request.isolationEvidence.deploymentsSharedWithGuest) return "SHARED_DEPLOYMENT_BOUNDARY";
  if (request.isolationEvidence.failureBoundariesSharedWithGuest) return "SHARED_FAILURE_BOUNDARY";
  if (request.isolationEvidence.bookingAvailabilityDependsOnInternalServices) return "BOOKING_CAPACITY_DEPENDENCY";
  if (request.authorityClaims.providerAuthorizes) return "PROVIDER_AUTHORITY_CLAIM";
  if (AUTHORITY_FIELDS.some((field) => field !== "providerAuthorizes" && request.authorityClaims[field] !== false)) return "SELF_AUTHORIZATION_CLAIM";
  return null;
}

/** Validate an untrusted static descriptor against private committed V1 authority. */
export function validateInfrastructureBoundaryRequest(request) {
  try {
    if (authority === null) return rejection(["INTERNAL_AUTHORITY_UNAVAILABLE"]);
    if (hasCallerAuthorityInjection(request)) return rejection(["CALLER_AUTHORITY_INJECTION"]);
    let clone;
    try { clone = guardedClone(request); } catch { return rejection(["MALFORMED_REQUEST"]); }
    if (!shapeIsComplete(clone)) return rejection(["MALFORMED_REQUEST"]);
    const reasons = structuralReasons(clone);
    if (reasons.length > 0) return rejection(reasons);
    const blockingReason = firstDispatchBlockingReason(clone);
    if (blockingReason !== null) return rejection([blockingReason]);
    let schemaValid = false;
    try { schemaValid = authority.validateRequest(clone); } catch { return rejection(["INTERNAL_AUTHORITY_UNAVAILABLE"]); }
    if (!schemaValid) return rejection(["MALFORMED_REQUEST"]);
    return deepFreeze({ ok: true, value: clone, rejection: null });
  } catch {
    return rejection(["MALFORMED_REQUEST"]);
  }
}
