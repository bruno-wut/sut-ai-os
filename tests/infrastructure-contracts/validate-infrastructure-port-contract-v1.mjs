import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import * as contractModule from "../../packages/infrastructure-contracts/src/infrastructure-port-contract-v1.mjs";

const schemaUrl = new URL("../../schemas/infrastructure-port-contract-v1.schema.json", import.meta.url);
const policyUrl = new URL("../../policies/infrastructure-trust-zone-policy-v1.json", import.meta.url);
const moduleUrl = new URL("../../packages/infrastructure-contracts/src/infrastructure-port-contract-v1.mjs", import.meta.url);
const [schema, policy, moduleSource] = await Promise.all([
  readFile(schemaUrl, "utf8").then(JSON.parse),
  readFile(policyUrl, "utf8").then(JSON.parse),
  readFile(moduleUrl, "utf8")
]);

let cases = 0;
function check(condition, message) { cases += 1; assert.ok(condition, message); }
function equal(actual, expected, message) { cases += 1; assert.deepEqual(actual, expected, message); }
function reasons(decision, expected, message) {
  cases += 1;
  assert.equal(decision.ok, false, `${message}: expected denial`);
  assert.deepEqual(decision.rejection?.reasonCodes, expected, `${message}: wrong reasons`);
  assert.equal(decision.rejection?.failClosed, true, `${message}: must fail closed`);
  assert.ok(deeplyFrozen(decision), `${message}: denial must be deeply frozen`);
  assert.ok(validateDecisionSchema(decision), `${message}: denial must satisfy decision schema: ${JSON.stringify(validateDecisionSchema.errors)}`);
}
function clone(value) { return structuredClone(value); }
function mutate(base, path, value) {
  const copy = clone(base);
  let target = copy;
  for (const key of path.slice(0, -1)) target = target[key];
  target[path.at(-1)] = value;
  return copy;
}
function deeplyFrozen(value) {
  if (value === null || typeof value !== "object" || !Object.isFrozen(value)) return value === null || typeof value !== "object";
  return Object.values(value).every(deeplyFrozen);
}

const expectedZones = [
  { zone: "guest_public", exposure: "public_guest_only", credentialBoundaryId: "guest-credential", quotaBoundaryId: "guest-quota", deploymentBoundaryId: "guest-deployment", failureBoundaryId: "guest-failure" },
  { zone: "staff_control", exposure: "authenticated_staff_only", credentialBoundaryId: "staff-credential", quotaBoundaryId: "staff-quota", deploymentBoundaryId: "staff-deployment", failureBoundaryId: "staff-failure" },
  { zone: "ai_workload", exposure: "non_public_workload_only", credentialBoundaryId: "ai-credential", quotaBoundaryId: "ai-quota", deploymentBoundaryId: "ai-deployment", failureBoundaryId: "ai-failure" }
];
const expectedRoutes = [
  { routeClass: "aggregate_or_lifecycle_ingest", sourceZone: "guest_public", targetZone: "staff_control", port: "EventIngestionPort", operation: "ingest_batch" },
  { routeClass: "prepared_analytics_read", sourceZone: "staff_control", targetZone: "guest_public", port: "AnalyticsSourcePort", operation: "read_aggregate" },
  { routeClass: "bounded_work_request", sourceZone: "staff_control", targetZone: "ai_workload", port: "SchedulingQueuePort", operation: "enqueue" },
  { routeClass: "bounded_work_result", sourceZone: "ai_workload", targetZone: "staff_control", port: "WorkflowExecutionPort", operation: "read_state" },
  { routeClass: "staff_notification", sourceZone: "ai_workload", targetZone: "staff_control", port: "NotificationPort", operation: "send" }
];
const expectedPorts = [
  ["PersistencePort", ["read", "write", "append", "delete_expired"]],
  ["EventIngestionPort", ["ingest_batch"]], ["AnalyticsSourcePort", ["read_aggregate"]],
  ["SchedulingQueuePort", ["enqueue", "lease", "acknowledge", "requeue", "dead_letter"]],
  ["WorkflowExecutionPort", ["start", "resume", "cancel", "read_state"]],
  ["ObjectStoragePort", ["put", "get", "delete_expired"]], ["NotificationPort", ["send"]],
  ["IntelligenceProvider", ["analyze"]], ["DeploymentProvider", ["prepare", "read_status", "rollback"]],
  ["AuthenticationPort", ["verify_identity"]], ["ProposalGenerator", ["generate"]], ["ExecutorAdapter", ["execute"]], ["VerificationProvider", ["verify"]]
];
const expectedPortNames = expectedPorts.map(([port]) => port);
const expectedReasons = ["INTERNAL_AUTHORITY_UNAVAILABLE", "CALLER_AUTHORITY_INJECTION", "MALFORMED_REQUEST", "UNSUPPORTED_SCHEMA_VERSION", "UNKNOWN_ZONE", "ZONE_CONFUSION", "UNSUPPORTED_ROUTE", "UNSUPPORTED_PORT", "ROUTE_PORT_MISMATCH", "INSECURE_TRANSPORT", "UNAUTHENTICATED_CALLER", "INVALID_AUDIENCE", "CREDENTIAL_EXPIRED", "INVALID_TIMESTAMP", "REPLAY_DETECTED", "MISSING_IDEMPOTENCY_KEY", "IDEMPOTENCY_CONFLICT", "DUPLICATE_ACCEPTED_REQUEST", "REQUEST_BODY_LIMIT_EXCEEDED", "RESPONSE_BODY_LIMIT_EXCEEDED", "TIMEOUT_LIMIT_EXCEEDED", "CALLER_RATE_LIMITED", "ROUTE_RATE_LIMITED", "UNKNOWN_LIMIT_STATE", "SHARED_CREDENTIAL_BOUNDARY", "SHARED_QUOTA_BOUNDARY", "SHARED_DEPLOYMENT_BOUNDARY", "SHARED_FAILURE_BOUNDARY", "BOOKING_CAPACITY_DEPENDENCY", "PROVIDER_AUTHORITY_CLAIM", "SELF_AUTHORIZATION_CLAIM"];

const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
check(ajv.validateSchema(schema), `schema must compile: ${JSON.stringify(ajv.errors)}`);
const validatePolicy = ajv.compile(schema);
check(validatePolicy(policy), `canonical policy must validate: ${JSON.stringify(validatePolicy.errors)}`);
const validateRequestSchema = ajv.compile({ $ref: `${schema.$id}#/$defs/boundaryRequest` });
const validateDecisionSchema = ajv.compile({ $ref: `${schema.$id}#/$defs/validationDecision` });

equal(Object.keys(contractModule), ["validateInfrastructureBoundaryRequest"], "module has one stable public export");
const { validateInfrastructureBoundaryRequest } = contractModule;
check(validateInfrastructureBoundaryRequest.length === 1, "public interface accepts one authority-free argument");
equal(Object.keys(policy), ["schemaVersion", "policyId", "zones", "crossZoneProtocol", "routes", "ports", "coreDependencyRules", "bookingIsolation", "authority"], "policy root is closed and exact");
equal(policy.schemaVersion, "1.0.0", "policy version is fixed");
equal(policy.policyId, "infrastructure-trust-zone-policy-v1", "policy identifier is fixed");
equal(policy.zones, expectedZones, "zones and exposures are exact and ordered");
equal(policy.routes, expectedRoutes, "route registry is exact and ordered");
equal(policy.ports.map(({ port, operations }) => [port, operations]), expectedPorts, "port and operation registry is exact and ordered");
for (const entry of policy.ports) {
  equal(Object.keys(entry), ["port", "operations", "providerNeutral", "coreOwnsInterface", "adapterOwnsProviderBehavior", "authorizationAuthority", "workflowAuthority", "auditAuthority"], `${entry.port} declaration fields are exact`);
  equal([entry.providerNeutral, entry.coreOwnsInterface, entry.adapterOwnsProviderBehavior, entry.authorizationAuthority, entry.workflowAuthority, entry.auditAuthority], [true, true, true, false, false, false], `${entry.port} preserves inward authority`);
}
equal(policy.crossZoneProtocol, {
  protocol: "https", method: "POST", credentialMode: "short_lived", credentialLifetimeMaxSeconds: 300, audienceBound: true,
  recipientChecks: ["credential", "expiry", "audience", "timestamp", "nonce", "replay", "idempotency", "caller_limit", "route_limit"],
  timestampSkewMaxSeconds: 60, replayWindowSeconds: 300, nonceRequired: true, idempotencyRequired: true,
  duplicateDisposition: "return_prior_result_without_dispatch", requestBodyMaxBytes: 65536, responseBodyMaxBytes: 262144,
  timeoutMinMs: 100, timeoutMaxMs: 10000, rateLimitScopes: ["authenticated_caller", "route"]
}, "cross-zone protocol is exact");
equal(policy.coreDependencyRules, { forbiddenProviderFamilies: ["cloudflare", "supabase", "github", "openai", "line", "local_server"], providerSdkImportsAllowedInCore: false, providerConfigurationAllowedInCore: false, compositionLocation: "outside_core", providerReplacementMode: "adapter_and_configuration_only" }, "core dependency rule is exact");
equal(policy.bookingIsolation, { guestBookingDependsOnStaffAvailability: false, guestBookingDependsOnAiAvailability: false, sharedCredentials: false, sharedQuotas: false, sharedDeployments: false, sharedFailureBoundaries: false }, "booking isolation is exact");
equal(policy.authority, { nonAuthoritative: true, providerMayAuthorize: false, requestMayAuthorize: false, validationMayDispatch: false, policyBypassAllowed: false, productionWriteGranted: false }, "policy is non-authoritative and cannot dispatch");
const boundaryIds = policy.zones.flatMap((zone) => [zone.credentialBoundaryId, zone.quotaBoundaryId, zone.deploymentBoundaryId, zone.failureBoundaryId]);
check(new Set(boundaryIds).size === 12, "all credential, quota, deployment, and failure boundary identifiers are distinct");
equal(schema.$defs.zoneName.enum, ["guest_public", "staff_control", "ai_workload"], "zone enum is finite");
equal(schema.$defs.routeClass.enum, expectedRoutes.map(({ routeClass }) => routeClass), "route enum is finite");
equal(schema.$defs.boundaryRequest.properties.port.enum, expectedPortNames, "boundary request port enum is the exact thirteen-name registry");
equal(schema.$defs.securityEvidence.properties.credentialStatus.enum, ["valid", "missing", "invalid", "expired", "audience_mismatch"], "credential states are finite");
equal(schema.$defs.securityEvidence.properties.timestampStatus.enum, ["within_window", "missing", "outside_window", "invalid"], "timestamp states are finite");
equal(schema.$defs.securityEvidence.properties.nonceStatus.enum, ["fresh", "missing", "reused", "invalid"], "nonce states are finite");
equal(schema.$defs.deliveryEvidence.properties.idempotencyStatus.enum, ["new", "missing", "duplicate_same_request", "conflict"], "idempotency states are finite");
equal(schema.$defs.limitEvidence.properties.callerLimitStatus.enum, ["within_limit", "exceeded", "unknown"], "limit states are finite");
equal(schema.$defs.reasonCode.enum, expectedReasons, "rejection vocabulary and precedence are exact");

function assertClosedObjects(node, path = "schema") {
  if (node === null || typeof node !== "object") return;
  if (node.type === "object") check(node.additionalProperties === false, `${path} object must be closed`);
  for (const [key, child] of Object.entries(node)) assertClosedObjects(child, `${path}.${key}`);
}
assertClosedObjects(schema);

function canonicalRequest(route = expectedRoutes[2]) {
  return {
    schemaVersion: "1.0.0", requestId: "request-001", routeClass: route.routeClass, sourceZone: route.sourceZone, targetZone: route.targetZone,
    port: route.port, operation: route.operation,
    transport: { protocol: "https", method: "POST", requestBodyBytes: 1024, responseBodyLimitBytes: 4096, timeoutMs: 1000 },
    securityEvidence: { factSource: "recipient_adapter", credentialStatus: "valid", credentialAudience: route.targetZone, credentialLifetimeSeconds: 300, credentialAgeSeconds: 1, timestampStatus: "within_window", nonceStatus: "fresh" },
    deliveryEvidence: { idempotencyKey: "idempotency-001", idempotencyStatus: "new" },
    limitEvidence: { authenticatedCallerId: "staff-service", callerLimitStatus: "within_limit", routeLimitStatus: "within_limit" },
    isolationEvidence: { credentialsSharedWithGuest: false, quotasSharedWithGuest: false, deploymentsSharedWithGuest: false, failureBoundariesSharedWithGuest: false, bookingAvailabilityDependsOnInternalServices: false },
    authorityClaims: { providerAuthorizes: false, callerAuthorizes: false, requestAuthorizes: false, policyBypassed: false, productionWriteGranted: false }
  };
}

for (const route of expectedRoutes) {
  const request = canonicalRequest(route);
  check(validateRequestSchema(request), `${route.routeClass} canonical request satisfies schema: ${JSON.stringify(validateRequestSchema.errors)}`);
  const decision = validateInfrastructureBoundaryRequest(request);
  check(decision.ok, `${route.routeClass} canonical request validates`);
  check(validateDecisionSchema(decision), `${route.routeClass} decision satisfies committed schema`);
}

const canonical = canonicalRequest();
check(!validateRequestSchema(mutate(canonical, ["port"], "UnknownPort")), "request schema rejects an unknown port name");
check(!validateRequestSchema(mutate(canonical, ["port"], "CloudflareQueue")), "request schema rejects a provider-specific port name");
const canonicalBefore = JSON.stringify(canonical);
const accepted = validateInfrastructureBoundaryRequest(canonical);
check(accepted.ok, "canonical request is accepted");
check(accepted.value !== canonical, "accepted value is a clone");
equal(JSON.stringify(canonical), canonicalBefore, "input is not mutated");
check(deeplyFrozen(accepted), "accepted decision is deeply frozen");
check(validateDecisionSchema(accepted), "accepted decision validates under decision schema");
canonical.transport.timeoutMs = 2000;
equal(accepted.value.transport.timeoutMs, 1000, "accepted clone is independent of later input mutation");
const repeatedInput = canonicalRequest();
equal(validateInfrastructureBoundaryRequest(repeatedInput), validateInfrastructureBoundaryRequest(repeatedInput), "equivalent repeated calls are deterministic");
const reordered = Object.fromEntries(Object.entries(canonicalRequest()).reverse());
equal(validateInfrastructureBoundaryRequest(reordered), validateInfrastructureBoundaryRequest(canonicalRequest()), "key order does not change the decision");
for (const [path, value, label] of [
  [["transport", "requestBodyBytes"], 0, "zero-byte request"], [["transport", "requestBodyBytes"], 65536, "maximum request body"],
  [["transport", "responseBodyLimitBytes"], 1, "minimum response body"], [["transport", "responseBodyLimitBytes"], 262144, "maximum response body"],
  [["transport", "timeoutMs"], 100, "minimum timeout"], [["transport", "timeoutMs"], 10000, "maximum timeout"],
  [["securityEvidence", "credentialLifetimeSeconds"], 1, "minimum credential lifetime"], [["securityEvidence", "credentialAgeSeconds"], 0, "zero credential age"]
]) check(validateInfrastructureBoundaryRequest(mutate(canonicalRequest(), path, value)).ok, `${label} is accepted at the bound`);

const structuralCases = [
  [mutate(canonicalRequest(), ["schemaVersion"], "2.0.0"), ["UNSUPPORTED_SCHEMA_VERSION"], "unsupported version"],
  [mutate(canonicalRequest(), ["sourceZone"], "unknown_zone"), ["UNKNOWN_ZONE"], "unknown zone"],
  [mutate(canonicalRequest(), ["targetZone"], "staff_control"), ["ZONE_CONFUSION"], "same-zone confusion"],
  [mutate(canonicalRequest(), ["sourceZone"], "guest_public"), ["ZONE_CONFUSION"], "route-zone mismatch"],
  [mutate(mutate(canonicalRequest(), ["sourceZone"], "ai_workload"), ["targetZone"], "staff_control"), ["ZONE_CONFUSION"], "unlisted route direction"],
  [mutate(canonicalRequest(), ["routeClass"], "unknown_route"), ["UNSUPPORTED_ROUTE"], "unsupported route"],
  [mutate(canonicalRequest(), ["port"], "CloudflareQueue"), ["UNSUPPORTED_PORT"], "provider-specific unsupported port"],
  [mutate(canonicalRequest(), ["operation"], "write"), ["UNSUPPORTED_PORT"], "operation unsupported for selected port"],
  [mutate(mutate(canonicalRequest(), ["port"], "WorkflowExecutionPort"), ["operation"], "read_state"), ["ROUTE_PORT_MISMATCH"], "supported port mismatched to route"],
  [mutate(canonicalRequest(), ["transport", "protocol"], "http"), ["INSECURE_TRANSPORT"], "insecure protocol"],
  [mutate(canonicalRequest(), ["transport", "method"], "GET"), ["INSECURE_TRANSPORT"], "unsupported method"]
];
for (const [input, expected, label] of structuralCases) reasons(validateInfrastructureBoundaryRequest(input), expected, label);
const combined = canonicalRequest();
combined.schemaVersion = "2.0.0"; combined.sourceZone = "unknown_zone"; combined.routeClass = "unknown_route"; combined.port = "UnknownPort"; combined.transport.protocol = "http";
reasons(validateInfrastructureBoundaryRequest(combined), ["UNSUPPORTED_SCHEMA_VERSION", "UNKNOWN_ZONE", "UNSUPPORTED_ROUTE", "UNSUPPORTED_PORT", "INSECURE_TRANSPORT"], "structural reasons combine in fixed precedence");

const singletonCases = [
  [["securityEvidence", "credentialStatus"], "missing", "UNAUTHENTICATED_CALLER"],
  [["securityEvidence", "credentialStatus"], "invalid", "UNAUTHENTICATED_CALLER"],
  [["securityEvidence", "credentialStatus"], "audience_mismatch", "INVALID_AUDIENCE"],
  [["securityEvidence", "credentialAudience"], "guest_public", "INVALID_AUDIENCE"],
  [["securityEvidence", "credentialAudience"], null, "INVALID_AUDIENCE"],
  [["securityEvidence", "credentialStatus"], "expired", "CREDENTIAL_EXPIRED"],
  [["securityEvidence", "credentialLifetimeSeconds"], 301, "CREDENTIAL_EXPIRED"],
  [["securityEvidence", "credentialAgeSeconds"], 301, "CREDENTIAL_EXPIRED"],
  [["securityEvidence", "timestampStatus"], "missing", "INVALID_TIMESTAMP"],
  [["securityEvidence", "timestampStatus"], "outside_window", "INVALID_TIMESTAMP"],
  [["securityEvidence", "nonceStatus"], "missing", "REPLAY_DETECTED"],
  [["securityEvidence", "nonceStatus"], "reused", "REPLAY_DETECTED"],
  [["deliveryEvidence", "idempotencyKey"], null, "MISSING_IDEMPOTENCY_KEY"],
  [["deliveryEvidence", "idempotencyKey"], "INVALID KEY", "MISSING_IDEMPOTENCY_KEY"],
  [["deliveryEvidence", "idempotencyStatus"], "missing", "MISSING_IDEMPOTENCY_KEY"],
  [["deliveryEvidence", "idempotencyStatus"], "conflict", "IDEMPOTENCY_CONFLICT"],
  [["deliveryEvidence", "idempotencyStatus"], "duplicate_same_request", "DUPLICATE_ACCEPTED_REQUEST"],
  [["transport", "requestBodyBytes"], 65537, "REQUEST_BODY_LIMIT_EXCEEDED"],
  [["transport", "responseBodyLimitBytes"], 262145, "RESPONSE_BODY_LIMIT_EXCEEDED"],
  [["transport", "timeoutMs"], 99, "TIMEOUT_LIMIT_EXCEEDED"],
  [["transport", "timeoutMs"], 10001, "TIMEOUT_LIMIT_EXCEEDED"],
  [["limitEvidence", "callerLimitStatus"], "exceeded", "CALLER_RATE_LIMITED"],
  [["limitEvidence", "routeLimitStatus"], "exceeded", "ROUTE_RATE_LIMITED"],
  [["limitEvidence", "callerLimitStatus"], "unknown", "UNKNOWN_LIMIT_STATE"],
  [["limitEvidence", "routeLimitStatus"], "unknown", "UNKNOWN_LIMIT_STATE"],
  [["isolationEvidence", "credentialsSharedWithGuest"], true, "SHARED_CREDENTIAL_BOUNDARY"],
  [["isolationEvidence", "quotasSharedWithGuest"], true, "SHARED_QUOTA_BOUNDARY"],
  [["isolationEvidence", "deploymentsSharedWithGuest"], true, "SHARED_DEPLOYMENT_BOUNDARY"],
  [["isolationEvidence", "failureBoundariesSharedWithGuest"], true, "SHARED_FAILURE_BOUNDARY"],
  [["isolationEvidence", "bookingAvailabilityDependsOnInternalServices"], true, "BOOKING_CAPACITY_DEPENDENCY"],
  [["authorityClaims", "providerAuthorizes"], true, "PROVIDER_AUTHORITY_CLAIM"],
  [["authorityClaims", "callerAuthorizes"], true, "SELF_AUTHORIZATION_CLAIM"],
  [["authorityClaims", "requestAuthorizes"], true, "SELF_AUTHORIZATION_CLAIM"],
  [["authorityClaims", "policyBypassed"], true, "SELF_AUTHORIZATION_CLAIM"],
  [["authorityClaims", "productionWriteGranted"], true, "SELF_AUTHORIZATION_CLAIM"]
];
for (const [path, value, reason] of singletonCases) reasons(validateInfrastructureBoundaryRequest(mutate(canonicalRequest(), path, value)), [reason], reason);
const saturatedAndUnsafe = canonicalRequest(); saturatedAndUnsafe.limitEvidence.callerLimitStatus = "exceeded"; saturatedAndUnsafe.authorityClaims.productionWriteGranted = true;
reasons(validateInfrastructureBoundaryRequest(saturatedAndUnsafe), ["CALLER_RATE_LIMITED"], "first dispatch blocker is singleton");

const malformed = [null, undefined, true, false, 0, 1, "request", [], Symbol("request"), 1n, NaN, Infinity, new Date(), /request/u, () => {}, Object.create({ inherited: true }), { ...canonicalRequest(), unexpected: true }];
for (const input of malformed) {
  let decision; let threw = false;
  try { decision = validateInfrastructureBoundaryRequest(input); } catch { threw = true; }
  check(!threw, `malformed ${String(input)} never throws`);
  reasons(decision, ["MALFORMED_REQUEST"], `malformed ${String(input)}`);
  check(deeplyFrozen(decision), "malformed denial is deeply frozen");
  check(validateDecisionSchema(decision), "malformed denial validates under decision schema");
}
const cyclic = canonicalRequest(); cyclic.cycle = cyclic;
reasons(validateInfrastructureBoundaryRequest(cyclic), ["MALFORMED_REQUEST"], "cyclic input never throws");
const accessor = canonicalRequest(); Object.defineProperty(accessor, "requestId", { enumerable: true, get() { throw new Error("must not escape"); } });
reasons(validateInfrastructureBoundaryRequest(accessor), ["MALFORMED_REQUEST"], "throwing accessor never escapes");
const proxied = new Proxy(canonicalRequest(), { ownKeys() { throw new Error("must not escape"); } });
reasons(validateInfrastructureBoundaryRequest(proxied), ["MALFORMED_REQUEST"], "throwing proxy never escapes");

for (const field of ["schema", "policy", "contract", "adapter", "configuration", "validator", "dependencies"]) {
  const injected = canonicalRequest(); injected[field] = {};
  reasons(validateInfrastructureBoundaryRequest(injected), ["CALLER_AUTHORITY_INJECTION"], `${field} root injection is exclusive`);
}
const weakenedSchema = clone(schema);
weakenedSchema.$defs.authorityClaims.properties.productionWriteGranted = { type: "boolean" };
const relabelledWrite = canonicalRequest(); relabelledWrite.port = "PersistencePort"; relabelledWrite.operation = "write"; relabelledWrite.authorityClaims.productionWriteGranted = true;
reasons(validateInfrastructureBoundaryRequest(relabelledWrite, weakenedSchema, { policy: { validationMayDispatch: true } }), ["ROUTE_PORT_MISMATCH"], "extra dependency arguments cannot relabel production write into allow");
check(validateInfrastructureBoundaryRequest(canonicalRequest(), weakenedSchema, { policy: {} }).ok, "extra dependency arguments are ignored for a canonical request");
const candidatePolicy = clone(policy); candidatePolicy.authority.validationMayDispatch = true;
check(!validatePolicy(candidatePolicy), "mutated candidate policy cannot satisfy committed schema");
check(validateInfrastructureBoundaryRequest(canonicalRequest(), candidatePolicy).ok, "caller policy argument is never runtime authority");

check(!/from\s+["'](?:cloudflare|supabase|github|openai|line|@?aws|pg|postgres|mysql|redis|bullmq|wrangler)/iu.test(moduleSource), "core module imports no provider or infrastructure SDK");
check(!/scripts[\\/]verify|scripts[\\/]github|scripts[\\/]task/iu.test(moduleSource), "runtime does not import repository verification scripts");
equal([...moduleSource.matchAll(/\bexport\s+function\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]), ["validateInfrastructureBoundaryRequest"], "source declares exactly one public function");
check(!/\bfetch\s*\(|from\s+["']node:https?/u.test(moduleSource), "runtime performs no network call");

console.log(`P2-005 infrastructure contract V1 validation passed (${cases} cases).`);
