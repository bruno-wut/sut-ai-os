const ROOT_FIELDS = Object.freeze([
  "schemaVersion", "proposalId", "taskId", "sourceIntelligence", "outcome",
  "diagnosis", "evidenceReferences", "confidence", "recommendedAction",
  "alternatives", "affectedSystems", "requestedCapabilities",
  "riskClassification", "approvalRequirement", "verificationPlan",
  "rollbackPlan", "expectedOutcome", "authority"
]);
const SOURCE_FIELDS = Object.freeze(["requestId", "status"]);
const DIAGNOSIS_FIELDS = Object.freeze(["summary", "causeIds", "hypothesisIds"]);
const CONFIDENCE_FIELDS = Object.freeze(["score", "band", "basis"]);
const ACTION_FIELDS = Object.freeze(["kind", "description", "rationale", "executionAuthorized"]);
const ALTERNATIVE_FIELDS = Object.freeze(["alternativeId", "description", "tradeoff"]);
const APPROVAL_FIELDS = Object.freeze(["required", "approvalClass", "reason"]);
const VERIFICATION_FIELDS = Object.freeze(["independentReviewRequired", "checks", "successCriteria"]);
const ROLLBACK_FIELDS = Object.freeze(["required", "trigger", "steps"]);
const EXPECTED_FIELDS = Object.freeze(["summary", "measurableSignals", "observationWindow"]);
const AUTHORITY_FIELDS = Object.freeze(["nonAuthoritative", "approved", "authorized", "executed", "independentlyVerified", "productionEligible"]);

const OUTCOMES = Object.freeze(["no_action", "gather_more_evidence", "recommendation", "prepare_draft", "prepare_branch_or_pr", "escalate_to_human"]);
const CAPABILITIES = Object.freeze(["analytics_read", "repository_read", "repository_write", "content_draft", "branch_create", "pull_request_create", "staff_notification"]);
const RISKS = new Set(["low", "medium", "high", "critical"]);
const BANDS = new Set(["insufficient", "low", "medium", "high"]);
const APPROVAL_CLASSES = new Set(["none", "human_review"]);
const ELIGIBLE_SOURCE_STATUSES = new Set(["completed", "insufficient_evidence"]);
const OUTCOME_FOR_INTERVENTION = Object.freeze({
  no_action: "no_action",
  continue_monitoring: "no_action",
  gather_more_evidence: "gather_more_evidence",
  prepare_recommendation: "recommendation",
  prepare_draft: "prepare_draft",
  prepare_branch_or_pr: "prepare_branch_or_pr",
  escalate_to_human: "escalate_to_human"
});
const FIELD_REASON_PRECEDENCE = Object.freeze([
  "UNSUPPORTED_OUTCOME", "INVALID_DIAGNOSIS", "INVALID_EVIDENCE_REFERENCES",
  "INVALID_CONFIDENCE", "INVALID_RECOMMENDED_ACTION", "INVALID_ALTERNATIVES",
  "INVALID_AFFECTED_SYSTEMS", "UNKNOWN_REQUESTED_CAPABILITY",
  "UNSUPPORTED_RISK_CLASSIFICATION", "INVALID_APPROVAL_REQUIREMENT",
  "INVALID_VERIFICATION_PLAN", "INVALID_ROLLBACK_PLAN", "INVALID_EXPECTED_OUTCOME"
]);
const IDENTIFIER = /^[a-z][a-z0-9-]{0,63}$/;
const PROPOSAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TASK_ID = /^[A-Z][A-Z0-9-]{2,80}$/;
const FORBIDDEN_CONTROL = /[\u0000-\u0009\u000b-\u001f\u007f]/u;

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

async function loadAuthority() {
  try {
    const [{ default: schemaSource }, { default: Ajv2020 }, intelligenceModule] = await Promise.all([
      import("../../../schemas/intervention-proposal-contract-v1.schema.json", { with: { type: "json" } }),
      import("ajv/dist/2020.js"),
      import("../../ai-analysis-contracts/src/intelligence-provider-contracts-v1.mjs")
    ]);
    if (Object.keys(intelligenceModule).sort().join(",") !== "validateIntelligenceRequest,validateIntelligenceResult") return null;
    const schema = deepFreeze(guardedClone(schemaSource));
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
    if (!ajv.validateSchema(schema)) return null;
    return Object.freeze({
      validateProposalSchema: ajv.compile(schema),
      validateIntelligenceRequest: intelligenceModule.validateIntelligenceRequest,
      validateIntelligenceResult: intelligenceModule.validateIntelligenceResult
    });
  } catch {
    return null;
  }
}

const authority = await loadAuthority();

function rejection(reasonCodes) {
  return deepFreeze({ schemaVersion: "1.0.0", failClosed: true, reasonCodes: [...reasonCodes] });
}

function denied(reasonCodes) {
  return deepFreeze({ ok: false, value: null, rejection: rejection(reasonCodes) });
}

function text(value, minimum, maximum) {
  return typeof value === "string" && value === value.trim() && !FORBIDDEN_CONTROL.test(value) && [...value].length >= minimum && [...value].length <= maximum;
}

function unique(values) {
  return Array.isArray(values) && new Set(values).size === values.length;
}

function arrayOfStrings(values) {
  return Array.isArray(values) && values.every((value) => typeof value === "string");
}

function validIdentifiers(values, minimum, maximum) {
  return arrayOfStrings(values) && values.length >= minimum && values.length <= maximum && unique(values) && values.every((value) => IDENTIFIER.test(value));
}

function validTextArray(values, minimum, maximum) {
  return arrayOfStrings(values) && values.length >= minimum && values.length <= maximum && unique(values) && values.every((value) => text(value, 1, 500));
}

function orderedByAuthority(values, authorityValues) {
  let priorIndex = -1;
  for (const value of values) {
    const index = authorityValues.indexOf(value);
    if (index < 0 || index <= priorIndex) return false;
    priorIndex = index;
  }
  return true;
}

function equalArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function broadStructureIsComplete(proposal) {
  if (!exactKeys(proposal, ROOT_FIELDS)) return false;
  if (typeof proposal.schemaVersion !== "string" || typeof proposal.proposalId !== "string" || typeof proposal.taskId !== "string" || typeof proposal.outcome !== "string" || typeof proposal.riskClassification !== "string") return false;
  if (!exactKeys(proposal.sourceIntelligence, SOURCE_FIELDS) || typeof proposal.sourceIntelligence.requestId !== "string" || typeof proposal.sourceIntelligence.status !== "string") return false;
  if (!exactKeys(proposal.diagnosis, DIAGNOSIS_FIELDS) || typeof proposal.diagnosis.summary !== "string" || !arrayOfStrings(proposal.diagnosis.causeIds) || !arrayOfStrings(proposal.diagnosis.hypothesisIds)) return false;
  if (!arrayOfStrings(proposal.evidenceReferences)) return false;
  if (!exactKeys(proposal.confidence, CONFIDENCE_FIELDS) || typeof proposal.confidence.score !== "number" || typeof proposal.confidence.band !== "string" || typeof proposal.confidence.basis !== "string") return false;
  if (!exactKeys(proposal.recommendedAction, ACTION_FIELDS) || typeof proposal.recommendedAction.kind !== "string" || typeof proposal.recommendedAction.description !== "string" || typeof proposal.recommendedAction.rationale !== "string" || typeof proposal.recommendedAction.executionAuthorized !== "boolean") return false;
  if (!Array.isArray(proposal.alternatives)) return false;
  for (const alternative of proposal.alternatives) {
    if (!exactKeys(alternative, ALTERNATIVE_FIELDS) || typeof alternative.alternativeId !== "string" || typeof alternative.description !== "string" || typeof alternative.tradeoff !== "string") return false;
  }
  if (!arrayOfStrings(proposal.affectedSystems) || !arrayOfStrings(proposal.requestedCapabilities)) return false;
  if (!exactKeys(proposal.approvalRequirement, APPROVAL_FIELDS) || typeof proposal.approvalRequirement.required !== "boolean" || typeof proposal.approvalRequirement.approvalClass !== "string" || typeof proposal.approvalRequirement.reason !== "string") return false;
  if (!exactKeys(proposal.verificationPlan, VERIFICATION_FIELDS) || typeof proposal.verificationPlan.independentReviewRequired !== "boolean" || !arrayOfStrings(proposal.verificationPlan.checks) || !arrayOfStrings(proposal.verificationPlan.successCriteria)) return false;
  if (!exactKeys(proposal.rollbackPlan, ROLLBACK_FIELDS) || typeof proposal.rollbackPlan.required !== "boolean" || (proposal.rollbackPlan.trigger !== null && typeof proposal.rollbackPlan.trigger !== "string") || !arrayOfStrings(proposal.rollbackPlan.steps)) return false;
  if (!exactKeys(proposal.expectedOutcome, EXPECTED_FIELDS) || typeof proposal.expectedOutcome.summary !== "string" || !arrayOfStrings(proposal.expectedOutcome.measurableSignals) || typeof proposal.expectedOutcome.observationWindow !== "string") return false;
  if (!exactKeys(proposal.authority, AUTHORITY_FIELDS) || AUTHORITY_FIELDS.some((field) => typeof proposal.authority[field] !== "boolean")) return false;
  return true;
}

function structuralFieldReasons(proposal) {
  const reasons = [];
  if (!OUTCOMES.includes(proposal.outcome)) reasons.push("UNSUPPORTED_OUTCOME");
  if (!text(proposal.diagnosis.summary, 1, 2000) || !validIdentifiers(proposal.diagnosis.causeIds, 0, 5) || !validIdentifiers(proposal.diagnosis.hypothesisIds, 0, 5)) reasons.push("INVALID_DIAGNOSIS");
  if (!validIdentifiers(proposal.evidenceReferences, 0, 20)) reasons.push("INVALID_EVIDENCE_REFERENCES");
  if (!Number.isFinite(proposal.confidence.score) || proposal.confidence.score < 0 || proposal.confidence.score > 1 || !BANDS.has(proposal.confidence.band) || !text(proposal.confidence.basis, 1, 500)) reasons.push("INVALID_CONFIDENCE");
  if (!OUTCOMES.includes(proposal.recommendedAction.kind) || !text(proposal.recommendedAction.description, 1, 1000) || !text(proposal.recommendedAction.rationale, 1, 1000)) reasons.push("INVALID_RECOMMENDED_ACTION");
  const alternativeIds = proposal.alternatives.map((alternative) => alternative.alternativeId);
  if (proposal.alternatives.length > 5 || !unique(alternativeIds) || proposal.alternatives.some((alternative) => !IDENTIFIER.test(alternative.alternativeId) || !text(alternative.description, 1, 1000) || !text(alternative.tradeoff, 1, 1000))) reasons.push("INVALID_ALTERNATIVES");
  if (!validIdentifiers(proposal.affectedSystems, 1, 20) || !orderedByAuthority(proposal.affectedSystems, [...proposal.affectedSystems].sort())) reasons.push("INVALID_AFFECTED_SYSTEMS");
  if (proposal.requestedCapabilities.length > 7 || !unique(proposal.requestedCapabilities) || !orderedByAuthority(proposal.requestedCapabilities, CAPABILITIES)) reasons.push("UNKNOWN_REQUESTED_CAPABILITY");
  if (!RISKS.has(proposal.riskClassification)) reasons.push("UNSUPPORTED_RISK_CLASSIFICATION");
  if (!APPROVAL_CLASSES.has(proposal.approvalRequirement.approvalClass) || !text(proposal.approvalRequirement.reason, 1, 500) || proposal.approvalRequirement.required !== (proposal.approvalRequirement.approvalClass === "human_review")) reasons.push("INVALID_APPROVAL_REQUIREMENT");
  if (proposal.verificationPlan.independentReviewRequired !== true || !validTextArray(proposal.verificationPlan.checks, 1, 10) || !validTextArray(proposal.verificationPlan.successCriteria, 1, 10)) reasons.push("INVALID_VERIFICATION_PLAN");
  if ((proposal.rollbackPlan.trigger !== null && !text(proposal.rollbackPlan.trigger, 1, 500)) || !validTextArray(proposal.rollbackPlan.steps, 0, 10)) reasons.push("INVALID_ROLLBACK_PLAN");
  if (!text(proposal.expectedOutcome.summary, 1, 1000) || !validTextArray(proposal.expectedOutcome.measurableSignals, 1, 10) || !text(proposal.expectedOutcome.observationWindow, 1, 200)) reasons.push("INVALID_EXPECTED_OUTCOME");
  return FIELD_REASON_PRECEDENCE.filter((reason) => reasons.includes(reason));
}

function hasSelfAuthorizationClaim(proposal) {
  return proposal.recommendedAction.executionAuthorized !== false ||
    proposal.authority.nonAuthoritative !== true || proposal.authority.approved !== false ||
    proposal.authority.authorized !== false || proposal.authority.executed !== false ||
    proposal.authority.independentlyVerified !== false || proposal.authority.productionEligible !== false;
}

function provenanceIsValid(proposal, request, result) {
  const analysis = result.analysis;
  if (proposal.taskId !== request.taskId || proposal.sourceIntelligence.requestId !== request.requestId || proposal.sourceIntelligence.status !== result.status) return false;
  if (!equalArrays(proposal.evidenceReferences, analysis.evidenceCitations)) return false;
  const sourceCauseIds = analysis.likelyCauses.map((cause) => cause.causeId);
  const sourceHypothesisIds = analysis.rankedHypotheses.map((hypothesis) => hypothesis.hypothesisId);
  if (!orderedByAuthority(proposal.diagnosis.causeIds, sourceCauseIds) || !orderedByAuthority(proposal.diagnosis.hypothesisIds, sourceHypothesisIds)) return false;
  if (result.status === "completed" && proposal.diagnosis.hypothesisIds.length < 1) return false;
  if (result.status === "insufficient_evidence" && (proposal.diagnosis.causeIds.length !== 0 || proposal.diagnosis.hypothesisIds.length !== 0)) return false;
  if (proposal.confidence.score !== analysis.confidence.score || proposal.confidence.band !== analysis.confidence.band) return false;
  if (!orderedByAuthority(proposal.affectedSystems, request.allowedContext.affectedSystems)) return false;
  return true;
}

function crossFieldsAreValid(proposal, result) {
  const expectedOutcome = OUTCOME_FOR_INTERVENTION[result.analysis.selectedIntervention.kind];
  if (proposal.outcome !== expectedOutcome || proposal.recommendedAction.kind !== proposal.outcome) return false;
  if (result.status === "insufficient_evidence" && proposal.outcome !== "gather_more_evidence") return false;

  const noApprovalOutcomes = new Set(["no_action", "gather_more_evidence"]);
  const humanReviewOutcomes = new Set(["recommendation", "prepare_draft", "prepare_branch_or_pr", "escalate_to_human"]);
  if (noApprovalOutcomes.has(proposal.outcome) && (proposal.approvalRequirement.required || proposal.approvalRequirement.approvalClass !== "none")) return false;
  if (humanReviewOutcomes.has(proposal.outcome) && (!proposal.approvalRequirement.required || proposal.approvalRequirement.approvalClass !== "human_review")) return false;
  if (proposal.requestedCapabilities.length > 0 && !proposal.approvalRequirement.required) return false;

  if (["no_action", "gather_more_evidence", "recommendation"].includes(proposal.outcome) && proposal.requestedCapabilities.length !== 0) return false;
  if (proposal.outcome === "prepare_draft" && proposal.requestedCapabilities.some((capability) => !["repository_read", "repository_write", "content_draft"].includes(capability))) return false;
  if (proposal.outcome === "prepare_branch_or_pr" && !equalArrays(proposal.requestedCapabilities, ["repository_read", "repository_write", "branch_create", "pull_request_create"])) return false;
  if (proposal.outcome === "escalate_to_human" && proposal.requestedCapabilities.some((capability) => capability !== "staff_notification")) return false;

  const mutationPreparation = proposal.outcome === "prepare_draft" || proposal.outcome === "prepare_branch_or_pr";
  if (mutationPreparation) {
    if (!proposal.rollbackPlan.required || proposal.rollbackPlan.trigger === null || proposal.rollbackPlan.steps.length < 1) return false;
  } else if (proposal.rollbackPlan.required || proposal.rollbackPlan.trigger !== null || proposal.rollbackPlan.steps.length !== 0) return false;

  if (proposal.riskClassification === "critical" && proposal.outcome !== "escalate_to_human") return false;
  if ((proposal.riskClassification === "high" || proposal.riskClassification === "critical") && !proposal.approvalRequirement.required) return false;
  return true;
}

function sourceAuthorityUnavailable(decision) {
  try {
    return decision?.ok === false && decision.rejection?.reasonCodes?.includes("INTERNAL_AUTHORITY_UNAVAILABLE");
  } catch {
    return false;
  }
}

/** Validate one untrusted proposal against private committed V1 authority and canonical P2-002 provenance. */
export function validateInterventionProposal(proposal, intelligenceRequest, intelligenceResult) {
  try {
    if (authority === null) return denied(["INTERNAL_AUTHORITY_UNAVAILABLE"]);

    const requestDecision = authority.validateIntelligenceRequest(intelligenceRequest);
    if (!requestDecision.ok) return denied([sourceAuthorityUnavailable(requestDecision) ? "INTERNAL_AUTHORITY_UNAVAILABLE" : "INVALID_SOURCE_INTELLIGENCE"]);
    const resultDecision = authority.validateIntelligenceResult(intelligenceResult, requestDecision.value);
    if (!resultDecision.ok) return denied([sourceAuthorityUnavailable(resultDecision) ? "INTERNAL_AUTHORITY_UNAVAILABLE" : "INVALID_SOURCE_INTELLIGENCE"]);
    if (!ELIGIBLE_SOURCE_STATUSES.has(resultDecision.value.status)) return denied(["INVALID_SOURCE_INTELLIGENCE"]);

    let clone;
    try { clone = guardedClone(proposal); } catch { return denied(["MALFORMED_PROPOSAL"]); }
    if (!broadStructureIsComplete(clone)) return denied(["MALFORMED_PROPOSAL"]);
    if (!PROPOSAL_ID.test(clone.proposalId) || !TASK_ID.test(clone.taskId)) return denied(["MALFORMED_PROPOSAL"]);
    if (clone.schemaVersion !== "1.0.0") return denied(["UNSUPPORTED_SCHEMA_VERSION"]);

    const structuralReasons = structuralFieldReasons(clone);
    if (structuralReasons.length > 0) return denied(structuralReasons);
    if (hasSelfAuthorizationClaim(clone)) return denied(["SELF_AUTHORIZATION_CLAIM"]);

    let schemaValid = false;
    try { schemaValid = authority.validateProposalSchema(clone); } catch { return denied(["INTERNAL_AUTHORITY_UNAVAILABLE"]); }
    if (!schemaValid) return denied(["MALFORMED_PROPOSAL"]);
    if (!provenanceIsValid(clone, requestDecision.value, resultDecision.value)) return denied(["INVALID_PROVENANCE"]);
    if (!crossFieldsAreValid(clone, resultDecision.value)) return denied(["CROSS_FIELD_INCONSISTENCY"]);
    return deepFreeze({ ok: true, value: clone, rejection: null });
  } catch {
    return denied(["MALFORMED_PROPOSAL"]);
  }
}
