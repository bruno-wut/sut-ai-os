/** Static P2-006 metadata classification. This module performs no lifecycle action. */

const ROOT_FIELDS = Object.freeze(["schemaVersion", "candidateId", "dataCategory", "sourceClass", "artifactClass", "aggregationInterval", "requestedAction", "handlingIntent", "historyProtection", "authorityClaims"]);
const HANDLING_FIELDS = Object.freeze(["storage", "queue", "workflow", "aiInvocation", "onePermanentRowPerInteraction"]);
const HISTORY_FIELDS = Object.freeze(["kind", "originalRecordPreserved", "failedAttemptHistoryPreserved", "rewriteRequested"]);
const AUTHORITY_FIELDS = Object.freeze(["callerSuppliesAuthority", "classificationAuthorizesPersistence", "classificationAuthorizesLifecycleAction", "classificationAuthorizesAiInvocation", "productionWriteGranted"]);
const INJECTED_AUTHORITY_FIELDS = new Set(["schema", "policy", "contract", "validator", "configuration", "retentionConfiguration", "adapter", "dependencies"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

const RAW_CATEGORIES = Object.freeze(["raw_page_view", "raw_click", "raw_scroll", "raw_marketing_telemetry"]);
const ELIGIBLE_CATEGORIES = Object.freeze(["hourly_analytics_aggregate", "daily_analytics_aggregate", "essential_booking_lifecycle_event", "anomaly", "incident", "investigation", "recommendation", "intervention_proposal", "approval", "execution", "outcome", "required_audit_evidence"]);
const ARTIFACT_CLASSES = Object.freeze(["source_system_managed", "temporary_ingestion_record", "debug_log", "ai_prompt", "ai_output", "workflow_execution_detail", "analytics_aggregate", "booking_lifecycle_record", "incident_record", "audit_evidence"]);
const INTERVALS = Object.freeze(["source_only", "hourly", "daily", "not_applicable"]);
const ACTIONS = Object.freeze(["retain_at_source", "aggregate", "scheduled_delete", "archive", "transfer_eligible", "retain"]);
const SOURCE_CLASSES = new Set(["analytics_source", "booking_control_plane", "ai_os_control_plane", "repository_evidence"]);
const STORAGE_CLASSES = new Set(["source_system_only", "temporary_ai_os", "durable_ai_os"]);
const QUEUE_CLASSES = new Set(["none", "batched_aggregate_or_lifecycle", "individual_guest_interaction"]);
const WORKFLOW_CLASSES = new Set(["none", "scheduled_summary_or_governed_case", "individual_guest_interaction"]);
const AI_CLASSES = new Set(["none", "scheduled_summary_or_governed_case", "individual_guest_interaction", "individual_system_event"]);
const HISTORY_KINDS = new Set(["none", "append_only_audit", "failed_attempt_history"]);
const REASON_PRECEDENCE = Object.freeze(["INTERNAL_AUTHORITY_UNAVAILABLE", "CALLER_AUTHORITY_INJECTION", "MALFORMED_CANDIDATE", "UNSUPPORTED_SCHEMA_VERSION", "UNKNOWN_DATA_CATEGORY", "UNKNOWN_SOURCE_CLASS", "UNKNOWN_ARTIFACT_CLASS", "RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION", "PROHIBITED_PER_INTERACTION_PERSISTENCE", "PROHIBITED_PER_INTERACTION_QUEUE", "PROHIBITED_PER_INTERACTION_WORKFLOW", "PROHIBITED_PER_INTERACTION_AI_INVOCATION", "PROHIBITED_PER_EVENT_AI_INVOCATION", "AGGREGATION_INTERVAL_MISMATCH", "CATEGORY_SOURCE_MISMATCH", "CATEGORY_ARTIFACT_MISMATCH", "RETENTION_ACTION_NOT_ELIGIBLE", "PROTECTED_HISTORY_CONFLICT", "APPEND_ONLY_AUDIT_CONFLICT", "FAILED_ATTEMPT_HISTORY_CONFLICT", "SELF_AUTHORIZATION_CLAIM", "PRODUCTION_WRITE_CLAIM"]);

const RULES = Object.freeze([
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
].map(([dataCategory, sourceClass, artifactClasses, aggregationInterval, storageClasses, actionCandidates, eligibility]) => Object.freeze({ dataCategory, sourceClass, artifactClasses: Object.freeze(artifactClasses), aggregationInterval, storageClasses: Object.freeze(storageClasses), actionCandidates: Object.freeze(actionCandidates), eligibility })));
const RULE_BY_CATEGORY = new Map(RULES.map((rule) => [rule.dataCategory, rule]));

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

function rejection(reasonCodes) {
  return deepFreeze({ ok: false, value: null, rejection: { schemaVersion: "1.0.0", failClosed: true, reasonCodes: [...reasonCodes] } });
}

function arraysEqual(left, right) {
  return Array.isArray(left) && left.length === right.length && left.every((value, index) => value === right[index]);
}

function policySemanticsAreExact(policy) {
  if (!exactKeys(policy, ["schemaVersion", "policyId", "rawSourceOnlyCategories", "aiOsEligibleCategories", "artifactClasses", "aggregationIntervals", "actionCandidates", "categoryRules", "workloadRules", "retentionRules", "reasonPrecedence", "authority"])) return false;
  if (policy.schemaVersion !== "1.0.0" || policy.policyId !== "data-minimisation-retention-policy-v1") return false;
  if (!arraysEqual(policy.rawSourceOnlyCategories, RAW_CATEGORIES) || !arraysEqual(policy.aiOsEligibleCategories, ELIGIBLE_CATEGORIES) || !arraysEqual(policy.artifactClasses, ARTIFACT_CLASSES) || !arraysEqual(policy.aggregationIntervals, INTERVALS) || !arraysEqual(policy.actionCandidates, ACTIONS) || !arraysEqual(policy.reasonPrecedence, REASON_PRECEDENCE)) return false;
  if (!Array.isArray(policy.categoryRules) || policy.categoryRules.length !== RULES.length) return false;
  for (let index = 0; index < RULES.length; index += 1) {
    const actual = policy.categoryRules[index];
    const expected = RULES[index];
    if (!exactKeys(actual, ["dataCategory", "sourceClass", "artifactClasses", "aggregationInterval", "storageClasses", "actionCandidates", "eligibility"])) return false;
    if (actual.dataCategory !== expected.dataCategory || actual.sourceClass !== expected.sourceClass || actual.aggregationInterval !== expected.aggregationInterval || actual.eligibility !== expected.eligibility || !arraysEqual(actual.artifactClasses, expected.artifactClasses) || !arraysEqual(actual.storageClasses, expected.storageClasses) || !arraysEqual(actual.actionCandidates, expected.actionCandidates)) return false;
  }
  return exactKeys(policy.workloadRules, ["perInteractionPermanentRowAllowed", "perInteractionQueueAllowed", "perInteractionWorkflowAllowed", "perInteractionAiInvocationAllowed", "perSystemEventAiInvocationAllowed", "scheduledSummaryOrGovernedCaseOnly"]) &&
    Object.values(policy.workloadRules).every((value, index) => value === (index === 5)) &&
    exactKeys(policy.retentionRules, ["eligibilityMode", "configuredDurationIncluded", "dueStateEvaluated", "legalComplianceEstablished", "protectedHistoryActions"]) &&
    policy.retentionRules.eligibilityMode === "future_lifecycle_candidate_only" && policy.retentionRules.configuredDurationIncluded === false && policy.retentionRules.dueStateEvaluated === false && policy.retentionRules.legalComplianceEstablished === false && arraysEqual(policy.retentionRules.protectedHistoryActions, ["archive", "transfer_eligible", "retain"]) &&
    exactKeys(policy.authority, ["nonAuthoritative", "classificationAuthorizesPersistence", "classificationAuthorizesLifecycleAction", "classificationAuthorizesAiInvocation", "classificationEstablishesCompliance", "productionWriteGranted"]) && policy.authority.nonAuthoritative === true && Object.entries(policy.authority).every(([key, value]) => key === "nonAuthoritative" ? value === true : value === false);
}

function schemaSemanticsAreExpected(schema) {
  return isPlainObject(schema) && schema.$schema === "https://json-schema.org/draft/2020-12/schema" && schema.$id === "https://sut-ai-os.local/schemas/data-minimisation-retention-contract-v1.schema.json" && schema.additionalProperties === false && isPlainObject(schema.$defs) && schema.$defs.dataGovernanceCandidate?.additionalProperties === false && Array.isArray(schema.$defs.classificationDecision?.oneOf) && schema.$defs.classificationDecision.oneOf.length === 2;
}

async function loadAuthority() {
  try {
    const [{ default: schemaSource }, { default: policySource }, { default: Ajv2020 }] = await Promise.all([
      import("../../../schemas/data-minimisation-retention-contract-v1.schema.json", { with: { type: "json" } }),
      import("../../../policies/data-minimisation-retention-policy-v1.json", { with: { type: "json" } }),
      import("ajv/dist/2020.js")
    ]);
    const schema = deepFreeze(guardedClone(schemaSource));
    const policy = deepFreeze(guardedClone(policySource));
    if (!schemaSemanticsAreExpected(schema) || !policySemanticsAreExact(policy)) return null;
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
    if (!ajv.validateSchema(schema)) return null;
    const validatePolicy = ajv.compile(schema);
    if (!validatePolicy(policy)) return null;
    const validateCandidate = ajv.compile({ $ref: `${schema.$id}#/$defs/dataGovernanceCandidate` });
    return Object.freeze({ validateCandidate });
  } catch {
    return null;
  }
}

const authority = await loadAuthority();

function hasCallerAuthorityInjection(input) {
  if (!isPlainObject(input)) return false;
  const keys = Reflect.ownKeys(input);
  if (keys.some((key) => typeof key === "string" && INJECTED_AUTHORITY_FIELDS.has(key))) return true;
  const authorityDescriptor = Object.getOwnPropertyDescriptor(input, "authorityClaims");
  if (!authorityDescriptor || !Object.hasOwn(authorityDescriptor, "value") || !isPlainObject(authorityDescriptor.value)) return false;
  const callerDescriptor = Object.getOwnPropertyDescriptor(authorityDescriptor.value, "callerSuppliesAuthority");
  return Boolean(callerDescriptor && Object.hasOwn(callerDescriptor, "value") && callerDescriptor.value === true);
}

function shapeIsComplete(candidate) {
  if (!exactKeys(candidate, ROOT_FIELDS) || typeof candidate.schemaVersion !== "string" || typeof candidate.candidateId !== "string" || typeof candidate.dataCategory !== "string" || typeof candidate.sourceClass !== "string" || typeof candidate.artifactClass !== "string" || typeof candidate.aggregationInterval !== "string" || typeof candidate.requestedAction !== "string") return false;
  if (!exactKeys(candidate.handlingIntent, HANDLING_FIELDS) || typeof candidate.handlingIntent.storage !== "string" || typeof candidate.handlingIntent.queue !== "string" || typeof candidate.handlingIntent.workflow !== "string" || typeof candidate.handlingIntent.aiInvocation !== "string" || typeof candidate.handlingIntent.onePermanentRowPerInteraction !== "boolean") return false;
  if (!exactKeys(candidate.historyProtection, HISTORY_FIELDS) || typeof candidate.historyProtection.kind !== "string" || typeof candidate.historyProtection.originalRecordPreserved !== "boolean" || typeof candidate.historyProtection.failedAttemptHistoryPreserved !== "boolean" || typeof candidate.historyProtection.rewriteRequested !== "boolean") return false;
  return exactKeys(candidate.authorityClaims, AUTHORITY_FIELDS) && AUTHORITY_FIELDS.every((field) => typeof candidate.authorityClaims[field] === "boolean");
}

function semanticReasons(candidate) {
  const reasons = new Set();
  if (!IDENTIFIER.test(candidate.candidateId) || !STORAGE_CLASSES.has(candidate.handlingIntent.storage) || !QUEUE_CLASSES.has(candidate.handlingIntent.queue) || !WORKFLOW_CLASSES.has(candidate.handlingIntent.workflow) || !AI_CLASSES.has(candidate.handlingIntent.aiInvocation)) reasons.add("MALFORMED_CANDIDATE");
  if (candidate.schemaVersion !== "1.0.0") reasons.add("UNSUPPORTED_SCHEMA_VERSION");
  const rule = RULE_BY_CATEGORY.get(candidate.dataCategory);
  if (!rule) reasons.add("UNKNOWN_DATA_CATEGORY");
  if (!SOURCE_CLASSES.has(candidate.sourceClass)) reasons.add("UNKNOWN_SOURCE_CLASS");
  if (!ARTIFACT_CLASSES.includes(candidate.artifactClass)) reasons.add("UNKNOWN_ARTIFACT_CLASS");

  const handling = candidate.handlingIntent;
  if (rule?.eligibility === "source_only" && (candidate.sourceClass !== rule.sourceClass || candidate.artifactClass !== "source_system_managed" || candidate.aggregationInterval !== "source_only" || candidate.requestedAction !== "retain_at_source" || handling.storage !== "source_system_only" || handling.queue !== "none" || handling.workflow !== "none" || handling.aiInvocation !== "none" || handling.onePermanentRowPerInteraction)) reasons.add("RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION");
  if (handling.onePermanentRowPerInteraction) reasons.add("PROHIBITED_PER_INTERACTION_PERSISTENCE");
  if (handling.queue === "individual_guest_interaction") reasons.add("PROHIBITED_PER_INTERACTION_QUEUE");
  if (handling.workflow === "individual_guest_interaction") reasons.add("PROHIBITED_PER_INTERACTION_WORKFLOW");
  if (handling.aiInvocation === "individual_guest_interaction") reasons.add("PROHIBITED_PER_INTERACTION_AI_INVOCATION");
  if (handling.aiInvocation === "individual_system_event") reasons.add("PROHIBITED_PER_EVENT_AI_INVOCATION");

  if (!INTERVALS.includes(candidate.aggregationInterval) || (rule && candidate.aggregationInterval !== rule.aggregationInterval)) reasons.add("AGGREGATION_INTERVAL_MISMATCH");
  if (rule && candidate.sourceClass !== rule.sourceClass) reasons.add("CATEGORY_SOURCE_MISMATCH");
  if (rule && !rule.artifactClasses.includes(candidate.artifactClass)) reasons.add("CATEGORY_ARTIFACT_MISMATCH");
  if (!ACTIONS.includes(candidate.requestedAction) || (rule && !rule.actionCandidates.includes(candidate.requestedAction)) || (rule && !rule.storageClasses.includes(handling.storage))) reasons.add("RETENTION_ACTION_NOT_ELIGIBLE");

  const history = candidate.historyProtection;
  const isAudit = candidate.dataCategory === "required_audit_evidence";
  const preservationConflict = !HISTORY_KINDS.has(history.kind) || !history.originalRecordPreserved || !history.failedAttemptHistoryPreserved || history.rewriteRequested || (isAudit ? history.kind === "none" : history.kind !== "none");
  if (preservationConflict) reasons.add("PROTECTED_HISTORY_CONFLICT");
  const destructiveProtectedAction = candidate.requestedAction === "scheduled_delete" || candidate.requestedAction === "aggregate";
  if (history.kind === "append_only_audit" && (preservationConflict || destructiveProtectedAction)) reasons.add("APPEND_ONLY_AUDIT_CONFLICT");
  if (history.kind === "failed_attempt_history" && (preservationConflict || destructiveProtectedAction)) reasons.add("FAILED_ATTEMPT_HISTORY_CONFLICT");
  if (candidate.authorityClaims.classificationAuthorizesPersistence || candidate.authorityClaims.classificationAuthorizesLifecycleAction || candidate.authorityClaims.classificationAuthorizesAiInvocation) reasons.add("SELF_AUTHORIZATION_CLAIM");
  if (candidate.authorityClaims.productionWriteGranted) reasons.add("PRODUCTION_WRITE_CLAIM");
  return REASON_PRECEDENCE.filter((reason) => reasons.has(reason));
}

/** Classify an untrusted metadata-only candidate against private committed V1 authority. */
export function classifyDataGovernanceCandidate(candidate) {
  try {
    if (authority === null) return rejection(["INTERNAL_AUTHORITY_UNAVAILABLE"]);
    if (hasCallerAuthorityInjection(candidate)) return rejection(["CALLER_AUTHORITY_INJECTION"]);
    let clone;
    try { clone = guardedClone(candidate); } catch { return rejection(["MALFORMED_CANDIDATE"]); }
    if (!shapeIsComplete(clone)) return rejection(["MALFORMED_CANDIDATE"]);
    const reasons = semanticReasons(clone);
    if (reasons.length > 0) return rejection(reasons);
    let schemaValid = false;
    try { schemaValid = authority.validateCandidate(clone); } catch { return rejection(["INTERNAL_AUTHORITY_UNAVAILABLE"]); }
    if (!schemaValid) return rejection(["MALFORMED_CANDIDATE"]);
    const eligibility = RULE_BY_CATEGORY.get(clone.dataCategory).eligibility;
    return deepFreeze({ ok: true, value: { schemaVersion: "1.0.0", candidate: clone, eligibility, nonAuthoritative: true, actionAuthorized: false, productionWriteAuthorized: false }, rejection: null });
  } catch {
    return rejection(["MALFORMED_CANDIDATE"]);
  }
}
