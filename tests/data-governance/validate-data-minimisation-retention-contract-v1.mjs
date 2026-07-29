import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import Ajv2020 from "ajv/dist/2020.js";
import { classifyDataGovernanceCandidate } from "../../packages/data-governance-contracts/src/data-minimisation-retention-contract-v1.mjs";

const schemaUrl = new URL("../../schemas/data-minimisation-retention-contract-v1.schema.json", import.meta.url);
const policyUrl = new URL("../../policies/data-minimisation-retention-policy-v1.json", import.meta.url);
const moduleUrl = new URL("../../packages/data-governance-contracts/src/data-minimisation-retention-contract-v1.mjs", import.meta.url);
const [schema, policy, moduleSource] = await Promise.all([
  readFile(schemaUrl, "utf8").then(JSON.parse), readFile(policyUrl, "utf8").then(JSON.parse), readFile(moduleUrl, "utf8")
]);

let cases = 0;
function check(condition, message) { cases += 1; assert.ok(condition, message); }
function equal(actual, expected, message) { cases += 1; assert.deepEqual(actual, expected, message); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function mutate(value, path, replacement) { const copy = clone(value); let cursor = copy; for (const key of path.slice(0, -1)) cursor = cursor[key]; cursor[path.at(-1)] = replacement; return copy; }
function deeplyFrozen(value) { if (value === null || typeof value !== "object") return true; return Object.isFrozen(value) && Object.values(value).every(deeplyFrozen); }
function reasons(decision, expected, label) {
  check(decision && decision.ok === false, `${label} is rejected`);
  equal(decision?.rejection?.reasonCodes, expected, `${label} returns exact ordered reasons`);
  check(validateDecision(decision), `${label} returns a schema-valid decision: ${JSON.stringify(validateDecision.errors)}`);
  check(deeplyFrozen(decision), `${label} returns a recursively frozen decision`);
}

const RAW = ["raw_page_view", "raw_click", "raw_scroll", "raw_marketing_telemetry"];
const ELIGIBLE = ["hourly_analytics_aggregate", "daily_analytics_aggregate", "essential_booking_lifecycle_event", "anomaly", "incident", "investigation", "recommendation", "intervention_proposal", "approval", "execution", "outcome", "required_audit_evidence"];
const ARTIFACTS = ["source_system_managed", "temporary_ingestion_record", "debug_log", "ai_prompt", "ai_output", "workflow_execution_detail", "analytics_aggregate", "booking_lifecycle_record", "incident_record", "audit_evidence"];
const INTERVALS = ["source_only", "hourly", "daily", "not_applicable"];
const ACTIONS = ["retain_at_source", "aggregate", "scheduled_delete", "archive", "transfer_eligible", "retain"];
const REASONS = ["INTERNAL_AUTHORITY_UNAVAILABLE", "CALLER_AUTHORITY_INJECTION", "MALFORMED_CANDIDATE", "UNSUPPORTED_SCHEMA_VERSION", "UNKNOWN_DATA_CATEGORY", "UNKNOWN_SOURCE_CLASS", "UNKNOWN_ARTIFACT_CLASS", "RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION", "PROHIBITED_PER_INTERACTION_PERSISTENCE", "PROHIBITED_PER_INTERACTION_QUEUE", "PROHIBITED_PER_INTERACTION_WORKFLOW", "PROHIBITED_PER_INTERACTION_AI_INVOCATION", "PROHIBITED_PER_EVENT_AI_INVOCATION", "AGGREGATION_INTERVAL_MISMATCH", "CATEGORY_SOURCE_MISMATCH", "CATEGORY_ARTIFACT_MISMATCH", "RETENTION_ACTION_NOT_ELIGIBLE", "PROTECTED_HISTORY_CONFLICT", "APPEND_ONLY_AUDIT_CONFLICT", "FAILED_ATTEMPT_HISTORY_CONFLICT", "SELF_AUTHORIZATION_CLAIM", "PRODUCTION_WRITE_CLAIM"];
const EXPECTED_RULES = [
  ["raw_page_view", "analytics_source", ["source_system_managed"], "source_only", ["source_system_only"], ["retain_at_source"], "source_only"],
  ["raw_click", "analytics_source", ["source_system_managed"], "source_only", ["source_system_only"], ["retain_at_source"], "source_only"],
  ["raw_scroll", "analytics_source", ["source_system_managed"], "source_only", ["source_system_only"], ["retain_at_source"], "source_only"],
  ["raw_marketing_telemetry", "analytics_source", ["source_system_managed"], "source_only", ["source_system_only"], ["retain_at_source"], "source_only"],
  ["hourly_analytics_aggregate", "analytics_source", ["temporary_ingestion_record", "analytics_aggregate"], "hourly", ["temporary_ai_os", "durable_ai_os"], ["aggregate", "scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["daily_analytics_aggregate", "analytics_source", ["temporary_ingestion_record", "analytics_aggregate"], "daily", ["temporary_ai_os", "durable_ai_os"], ["scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["essential_booking_lifecycle_event", "booking_control_plane", ["temporary_ingestion_record", "booking_lifecycle_record"], "not_applicable", ["temporary_ai_os", "durable_ai_os"], ["scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["anomaly", "ai_os_control_plane", ["debug_log", "incident_record"], "not_applicable", ["temporary_ai_os", "durable_ai_os"], ["scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["incident", "ai_os_control_plane", ["debug_log", "incident_record"], "not_applicable", ["temporary_ai_os", "durable_ai_os"], ["scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["investigation", "ai_os_control_plane", ["ai_prompt", "ai_output"], "not_applicable", ["temporary_ai_os", "durable_ai_os"], ["scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["recommendation", "ai_os_control_plane", ["ai_prompt", "ai_output"], "not_applicable", ["temporary_ai_os", "durable_ai_os"], ["scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["intervention_proposal", "ai_os_control_plane", ["ai_prompt", "ai_output"], "not_applicable", ["temporary_ai_os", "durable_ai_os"], ["scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["approval", "ai_os_control_plane", ["workflow_execution_detail"], "not_applicable", ["temporary_ai_os", "durable_ai_os"], ["scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["execution", "ai_os_control_plane", ["workflow_execution_detail"], "not_applicable", ["temporary_ai_os", "durable_ai_os"], ["scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["outcome", "ai_os_control_plane", ["workflow_execution_detail"], "not_applicable", ["temporary_ai_os", "durable_ai_os"], ["scheduled_delete", "archive", "transfer_eligible", "retain"], "future_lifecycle_candidate"],
  ["required_audit_evidence", "repository_evidence", ["audit_evidence"], "not_applicable", ["durable_ai_os"], ["archive", "transfer_eligible", "retain"], "protected_preservation_only"]
].map(([dataCategory, sourceClass, artifactClasses, aggregationInterval, storageClasses, actionCandidates, eligibility]) => ({ dataCategory, sourceClass, artifactClasses, aggregationInterval, storageClasses, actionCandidates, eligibility }));

const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
check(ajv.validateSchema(schema), `schema is valid Draft 2020-12: ${JSON.stringify(ajv.errors)}`);
const validatePolicy = ajv.compile(schema);
const validateCandidate = ajv.compile({ $ref: `${schema.$id}#/$defs/dataGovernanceCandidate` });
const validateDecision = ajv.compile({ $ref: `${schema.$id}#/$defs/classificationDecision` });
const validateAcceptedVariant = ajv.compile({ $ref: `${schema.$id}#/$defs/classificationDecision/oneOf/0` });
const validateRejectedVariant = ajv.compile({ $ref: `${schema.$id}#/$defs/classificationDecision/oneOf/1` });
check(validatePolicy(policy), `canonical policy satisfies schema: ${JSON.stringify(validatePolicy.errors)}`);
equal(Object.keys(policy), ["schemaVersion", "policyId", "rawSourceOnlyCategories", "aiOsEligibleCategories", "artifactClasses", "aggregationIntervals", "actionCandidates", "categoryRules", "workloadRules", "retentionRules", "reasonPrecedence", "authority"], "canonical root field order is exact");
equal(policy.rawSourceOnlyCategories, RAW, "raw source-only categories are exact and ordered");
equal(policy.aiOsEligibleCategories, ELIGIBLE, "AI OS eligible categories are exact and ordered");
equal(policy.artifactClasses, ARTIFACTS, "artifact classes are exact and ordered");
equal(policy.aggregationIntervals, INTERVALS, "aggregation intervals are exact and ordered");
equal(policy.actionCandidates, ACTIONS, "action candidates are exact and ordered");
equal(policy.categoryRules, EXPECTED_RULES, "all sixteen canonical category mappings are exact and ordered");
equal(policy.workloadRules, { perInteractionPermanentRowAllowed: false, perInteractionQueueAllowed: false, perInteractionWorkflowAllowed: false, perInteractionAiInvocationAllowed: false, perSystemEventAiInvocationAllowed: false, scheduledSummaryOrGovernedCaseOnly: true }, "workload rules prohibit per-interaction and per-event work");
equal(policy.retentionRules, { eligibilityMode: "future_lifecycle_candidate_only", configuredDurationIncluded: false, dueStateEvaluated: false, legalComplianceEstablished: false, protectedHistoryActions: ["archive", "transfer_eligible", "retain"] }, "retention rules remain candidate-only");
equal(policy.reasonPrecedence, REASONS, "reason vocabulary and precedence are exact");
equal(policy.authority, { nonAuthoritative: true, classificationAuthorizesPersistence: false, classificationAuthorizesLifecycleAction: false, classificationAuthorizesAiInvocation: false, classificationEstablishesCompliance: false, productionWriteGranted: false }, "policy grants no authority");
equal(schema.$defs.dataCategory.enum, [...RAW, ...ELIGIBLE], "candidate taxonomy matches policy");
equal(schema.$defs.artifactClass.enum, ARTIFACTS, "candidate artifact enum matches policy");
equal(schema.$defs.aggregationInterval.enum, INTERVALS, "candidate interval enum matches policy");
equal(schema.$defs.actionCandidate.enum, ACTIONS, "candidate action enum matches policy");
equal(schema.$defs.reasonCode.enum, REASONS, "decision reasons match policy precedence");

function assertClosedObjects(node, path = "schema") {
  if (node === null || typeof node !== "object") return;
  if (node.type === "object") check(node.additionalProperties === false, `${path} object is closed`);
  for (const [key, child] of Object.entries(node)) assertClosedObjects(child, `${path}.${key}`);
}
assertClosedObjects(schema);

function canonicalCandidate(rule, overrides = {}) {
  const raw = rule.eligibility === "source_only";
  const audit = rule.eligibility === "protected_preservation_only";
  const candidate = {
    schemaVersion: "1.0.0", candidateId: `candidate-${rule.dataCategory}`, dataCategory: rule.dataCategory,
    sourceClass: rule.sourceClass, artifactClass: rule.artifactClasses[0], aggregationInterval: rule.aggregationInterval,
    requestedAction: rule.actionCandidates[0],
    handlingIntent: { storage: rule.storageClasses[0], queue: raw ? "none" : "batched_aggregate_or_lifecycle", workflow: raw ? "none" : "scheduled_summary_or_governed_case", aiInvocation: raw ? "none" : "scheduled_summary_or_governed_case", onePermanentRowPerInteraction: false },
    historyProtection: { kind: audit ? "append_only_audit" : "none", originalRecordPreserved: true, failedAttemptHistoryPreserved: true, rewriteRequested: false },
    authorityClaims: { callerSuppliesAuthority: false, classificationAuthorizesPersistence: false, classificationAuthorizesLifecycleAction: false, classificationAuthorizesAiInvocation: false, productionWriteGranted: false }
  };
  return Object.assign(candidate, overrides);
}

for (const rule of EXPECTED_RULES) {
  for (const artifactClass of rule.artifactClasses) {
    for (const storage of rule.storageClasses) {
      for (const requestedAction of rule.actionCandidates) {
        const candidate = canonicalCandidate(rule);
        candidate.artifactClass = artifactClass; candidate.handlingIntent.storage = storage; candidate.requestedAction = requestedAction;
        check(validateCandidate(candidate), `${rule.dataCategory}/${artifactClass}/${storage}/${requestedAction} candidate satisfies schema`);
        const decision = classifyDataGovernanceCandidate(candidate);
        check(decision.ok, `${rule.dataCategory}/${artifactClass}/${storage}/${requestedAction} is accepted`);
        equal(decision.value.eligibility, rule.eligibility, `${rule.dataCategory} has exact eligibility`);
        check(validateDecision(decision), `${rule.dataCategory} accepted decision satisfies schema`);
        check(Number(validateAcceptedVariant(decision)) + Number(validateRejectedVariant(decision)) === 1, `${rule.dataCategory} decision matches exactly one result variant`);
        check(decision.value.nonAuthoritative && !decision.value.actionAuthorized && !decision.value.productionWriteAuthorized, `${rule.dataCategory} success grants no action authority`);
      }
    }
  }
}

const canonical = canonicalCandidate(EXPECTED_RULES[4]);
const before = JSON.stringify(canonical);
const accepted = classifyDataGovernanceCandidate(canonical);
check(accepted.ok, "canonical hourly aggregate is accepted");
check(accepted.value.candidate !== canonical, "accepted candidate is a clone");
equal(JSON.stringify(canonical), before, "classification does not mutate input");
check(deeplyFrozen(accepted), "accepted decision is recursively frozen");
canonical.handlingIntent.storage = "durable_ai_os";
equal(accepted.value.candidate.handlingIntent.storage, "temporary_ai_os", "accepted clone is independent of later mutation");
equal(classifyDataGovernanceCandidate(canonicalCandidate(EXPECTED_RULES[5])), classifyDataGovernanceCandidate(canonicalCandidate(EXPECTED_RULES[5])), "repeated calls are deterministic");
const reversed = Object.fromEntries(Object.entries(canonicalCandidate(EXPECTED_RULES[5])).reverse());
equal(classifyDataGovernanceCandidate(reversed), classifyDataGovernanceCandidate(canonicalCandidate(EXPECTED_RULES[5])), "key order does not change classification");

for (const rawRule of EXPECTED_RULES.slice(0, 4)) {
  for (const [path, value, expected, label] of [
    [["handlingIntent", "storage"], "temporary_ai_os", ["RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION", "RETENTION_ACTION_NOT_ELIGIBLE"], "temporary storage"],
    [["handlingIntent", "storage"], "durable_ai_os", ["RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION", "RETENTION_ACTION_NOT_ELIGIBLE"], "durable storage"],
    [["handlingIntent", "queue"], "individual_guest_interaction", ["RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION", "PROHIBITED_PER_INTERACTION_QUEUE"], "individual queue"],
    [["handlingIntent", "workflow"], "individual_guest_interaction", ["RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION", "PROHIBITED_PER_INTERACTION_WORKFLOW"], "individual workflow"],
    [["handlingIntent", "aiInvocation"], "individual_guest_interaction", ["RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION", "PROHIBITED_PER_INTERACTION_AI_INVOCATION"], "individual AI"],
    [["handlingIntent", "onePermanentRowPerInteraction"], true, ["RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION", "PROHIBITED_PER_INTERACTION_PERSISTENCE"], "per-interaction row"]
  ]) reasons(classifyDataGovernanceCandidate(mutate(canonicalCandidate(rawRule), path, value)), expected, `${rawRule.dataCategory} ${label}`);
}

const booking = canonicalCandidate(EXPECTED_RULES[6]);
reasons(classifyDataGovernanceCandidate(mutate(booking, ["handlingIntent", "aiInvocation"], "individual_system_event")), ["PROHIBITED_PER_EVENT_AI_INVOCATION"], "booking event cannot invoke AI per system event");
reasons(classifyDataGovernanceCandidate(mutate(booking, ["handlingIntent", "queue"], "individual_guest_interaction")), ["PROHIBITED_PER_INTERACTION_QUEUE"], "eligible category cannot queue per guest interaction");
reasons(classifyDataGovernanceCandidate(mutate(booking, ["handlingIntent", "workflow"], "individual_guest_interaction")), ["PROHIBITED_PER_INTERACTION_WORKFLOW"], "eligible category cannot workflow per guest interaction");
reasons(classifyDataGovernanceCandidate(mutate(booking, ["handlingIntent", "aiInvocation"], "individual_guest_interaction")), ["PROHIBITED_PER_INTERACTION_AI_INVOCATION"], "eligible category cannot invoke AI per guest interaction");
reasons(classifyDataGovernanceCandidate(mutate(booking, ["handlingIntent", "onePermanentRowPerInteraction"], true)), ["PROHIBITED_PER_INTERACTION_PERSISTENCE"], "eligible category cannot create one permanent row per interaction");

const hourly = canonicalCandidate(EXPECTED_RULES[4]);
const daily = canonicalCandidate(EXPECTED_RULES[5]);
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["aggregationInterval"], "daily")), ["AGGREGATION_INTERVAL_MISMATCH"], "hourly/daily interval swap");
reasons(classifyDataGovernanceCandidate(mutate(daily, ["aggregationInterval"], "hourly")), ["AGGREGATION_INTERVAL_MISMATCH"], "daily/hourly interval swap");
reasons(classifyDataGovernanceCandidate(mutate(daily, ["requestedAction"], "aggregate")), ["RETENTION_ACTION_NOT_ELIGIBLE"], "daily aggregate cannot be re-aggregated");
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["sourceClass"], "ai_os_control_plane")), ["CATEGORY_SOURCE_MISMATCH"], "category/source mismatch");
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["artifactClass"], "debug_log")), ["CATEGORY_ARTIFACT_MISMATCH"], "category/artifact mismatch");
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["dataCategory"], "unknown_category")), ["UNKNOWN_DATA_CATEGORY"], "unknown category");
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["sourceClass"], "unknown_source")), ["UNKNOWN_SOURCE_CLASS", "CATEGORY_SOURCE_MISMATCH"], "unknown source");
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["artifactClass"], "unknown_artifact")), ["UNKNOWN_ARTIFACT_CLASS", "CATEGORY_ARTIFACT_MISMATCH"], "unknown artifact");
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["requestedAction"], "unknown_action")), ["RETENTION_ACTION_NOT_ELIGIBLE"], "unknown action");
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["schemaVersion"], "2.0.0")), ["UNSUPPORTED_SCHEMA_VERSION"], "unsupported schema version");

for (const kind of ["append_only_audit", "failed_attempt_history"]) {
  const audit = canonicalCandidate(EXPECTED_RULES[15]); audit.historyProtection.kind = kind;
  const kindReason = kind === "append_only_audit" ? "APPEND_ONLY_AUDIT_CONFLICT" : "FAILED_ATTEMPT_HISTORY_CONFLICT";
  reasons(classifyDataGovernanceCandidate(mutate(audit, ["requestedAction"], "scheduled_delete")), ["RETENTION_ACTION_NOT_ELIGIBLE", kindReason], `${kind} rejects scheduled delete`);
  reasons(classifyDataGovernanceCandidate(mutate(audit, ["requestedAction"], "aggregate")), ["RETENTION_ACTION_NOT_ELIGIBLE", kindReason], `${kind} rejects aggregate`);
  reasons(classifyDataGovernanceCandidate(mutate(audit, ["historyProtection", "rewriteRequested"], true)), ["PROTECTED_HISTORY_CONFLICT", kindReason], `${kind} rejects rewrite`);
  reasons(classifyDataGovernanceCandidate(mutate(audit, ["historyProtection", "originalRecordPreserved"], false)), ["PROTECTED_HISTORY_CONFLICT", kindReason], `${kind} requires original preservation`);
  reasons(classifyDataGovernanceCandidate(mutate(audit, ["historyProtection", "failedAttemptHistoryPreserved"], false)), ["PROTECTED_HISTORY_CONFLICT", kindReason], `${kind} requires failed-attempt preservation`);
}
reasons(classifyDataGovernanceCandidate(mutate(canonicalCandidate(EXPECTED_RULES[15]), ["historyProtection", "kind"], "none")), ["PROTECTED_HISTORY_CONFLICT"], "audit evidence requires a protection kind");
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["historyProtection", "kind"], "append_only_audit")), ["PROTECTED_HISTORY_CONFLICT", "APPEND_ONLY_AUDIT_CONFLICT"], "non-audit category cannot claim append-only history");

for (const field of ["classificationAuthorizesPersistence", "classificationAuthorizesLifecycleAction", "classificationAuthorizesAiInvocation"]) reasons(classifyDataGovernanceCandidate(mutate(hourly, ["authorityClaims", field], true)), ["SELF_AUTHORIZATION_CLAIM"], `${field} is rejected`);
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["authorityClaims", "productionWriteGranted"], true)), ["PRODUCTION_WRITE_CLAIM"], "production-write claim is rejected");
reasons(classifyDataGovernanceCandidate(mutate(hourly, ["authorityClaims", "callerSuppliesAuthority"], true)), ["CALLER_AUTHORITY_INJECTION"], "caller authority claim is rejected before ordinary structure");

for (const field of ["schema", "policy", "contract", "validator", "configuration", "retentionConfiguration", "adapter", "dependencies"]) {
  const injected = canonicalCandidate(EXPECTED_RULES[4]); injected[field] = {};
  reasons(classifyDataGovernanceCandidate(injected), ["CALLER_AUTHORITY_INJECTION"], `${field} root injection is exclusive`);
}
const weakSchema = clone(schema); weakSchema.$defs.candidateAuthorityClaims.properties.productionWriteGranted = { type: "boolean" };
const relabelledWrite = mutate(hourly, ["authorityClaims", "productionWriteGranted"], true);
reasons(classifyDataGovernanceCandidate(relabelledWrite, weakSchema, { policy: { productionWriteGranted: true } }), ["PRODUCTION_WRITE_CLAIM"], "weakened caller authority cannot relabel production write into success");
check(classifyDataGovernanceCandidate(canonicalCandidate(EXPECTED_RULES[4]), weakSchema, { policy: {} }).ok, "extra dependency arguments are ignored for canonical input");
const weakenedPolicy = clone(policy); weakenedPolicy.categoryRules[0].storageClasses = ["source_system_only", "durable_ai_os"];
check(validatePolicy(weakenedPolicy), "weakened finite mapping retains expected structural root shape");
check(JSON.stringify(weakenedPolicy.categoryRules) !== JSON.stringify(EXPECTED_RULES), "weakened finite mapping is not the canonical policy");
reasons(classifyDataGovernanceCandidate(mutate(canonicalCandidate(EXPECTED_RULES[0]), ["handlingIntent", "storage"], "durable_ai_os"), weakenedPolicy), ["RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION", "RETENTION_ACTION_NOT_ELIGIBLE"], "weakened look-alike policy cannot permit raw telemetry storage");

const malformed = [null, undefined, true, false, 0, 1, "candidate", [], Symbol("candidate"), 1n, NaN, Infinity, new Date(), /candidate/u, () => {}, Object.create({ inherited: true }), { ...canonicalCandidate(EXPECTED_RULES[4]), payload: { guestId: "guest" } }];
for (const input of malformed) {
  let decision; let threw = false;
  try { decision = classifyDataGovernanceCandidate(input); } catch { threw = true; }
  check(!threw, `malformed ${String(input)} never throws`);
  reasons(decision, ["MALFORMED_CANDIDATE"], `malformed ${String(input)}`);
}
const cyclic = canonicalCandidate(EXPECTED_RULES[4]); cyclic.cycle = cyclic;
reasons(classifyDataGovernanceCandidate(cyclic), ["MALFORMED_CANDIDATE"], "cyclic input never throws");
const accessor = canonicalCandidate(EXPECTED_RULES[4]); Object.defineProperty(accessor, "candidateId", { enumerable: true, get() { throw new Error("must not escape"); } });
reasons(classifyDataGovernanceCandidate(accessor), ["MALFORMED_CANDIDATE"], "throwing getter never escapes");
const proxied = new Proxy(canonicalCandidate(EXPECTED_RULES[4]), { ownKeys() { throw new Error("must not escape"); } });
reasons(classifyDataGovernanceCandidate(proxied), ["MALFORMED_CANDIDATE"], "throwing proxy never escapes");
const deep = canonicalCandidate(EXPECTED_RULES[4]); deep.payload = {}; let cursor = deep.payload; for (let index = 0; index < 40; index += 1) { cursor.child = {}; cursor = cursor.child; }
reasons(classifyDataGovernanceCandidate(deep), ["MALFORMED_CANDIDATE"], "deep hostile input never throws");

const rejectedVariant = classifyDataGovernanceCandidate(null);
check(Number(validateAcceptedVariant(accepted)) + Number(validateRejectedVariant(accepted)) === 1, "accepted shape matches exactly one result variant");
check(Number(validateAcceptedVariant(rejectedVariant)) + Number(validateRejectedVariant(rejectedVariant)) === 1, "rejected shape matches exactly one result variant");
for (const invalidResult of [
  { ok: true, value: null, rejection: null },
  { ok: false, value: null, rejection: { schemaVersion: "1.0.0", failClosed: false, reasonCodes: ["MALFORMED_CANDIDATE"] } },
  { ok: false, value: null, rejection: { schemaVersion: "1.0.0", failClosed: true, reasonCodes: [] } },
  { ...accepted, extra: true }
]) check(!validateDecision(invalidResult), "malformed result variant is rejected");

check(!/from\s+["'](?:cloudflare|supabase|github|openai|line|@?aws|pg|postgres|mysql|redis|bullmq|wrangler)/iu.test(moduleSource), "core imports no provider or infrastructure SDK");
check(!/scripts[\\/]verify|scripts[\\/]github|scripts[\\/]task/iu.test(moduleSource), "core imports no repository verification script");
check(!/\bfetch\s*\(|from\s+["']node:(?:https?|fs|net|tls|child_process|os)|process\.(?:env|cwd)|Date\.now|new\s+Date/iu.test(moduleSource), "core has no network, filesystem, environment, clock, process, or execution dependency");
equal([...moduleSource.matchAll(/\bexport\s+function\s+([A-Za-z0-9_]+)/gu)].map((match) => match[1]), ["classifyDataGovernanceCandidate"], "module declares exactly one public function");
check(!/\b(?:deleteExpired|archiveRecord|transferRecord|enqueue|startWorkflow)\s*\(/u.test(moduleSource), "module performs no lifecycle, queue, or workflow action");

console.log(`P2-006 data minimisation and retention contract V1 validation passed (${cases} cases).`);
