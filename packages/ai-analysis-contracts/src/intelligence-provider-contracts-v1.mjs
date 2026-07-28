/** Provider-neutral Phase 2 intelligence contract boundary. No provider is invoked here. */

const REQUEST_FIELDS = Object.freeze(["schemaVersion", "requestId", "taskId", "purpose", "analysisQuestion", "dataClassification", "analysisObjectives", "preparedEvidence", "allowedContext"]);
const EVIDENCE_FIELDS = Object.freeze(["evidenceId", "kind", "dataClassification", "summary", "facts", "integritySha256"]);
const CONTEXT_FIELDS = Object.freeze(["affectedSystems", "metricIds", "locale", "maxHypotheses", "allowedInterventions"]);
const RESULT_FIELDS = Object.freeze(["schemaVersion", "status", "requestId", "providerState", "providerIdentity", "nonAuthoritative", "failClosed", "analysis", "reasonCodes"]);
const ANALYSIS_FIELDS = Object.freeze(["explanation", "likelyCauses", "rankedHypotheses", "selectedIntervention", "confidence", "evidenceCitations", "additionalEvidenceNeeded"]);
const CAUSE_FIELDS = Object.freeze(["causeId", "statement", "supportingEvidenceIds", "counterEvidenceIds"]);
const HYPOTHESIS_FIELDS = Object.freeze(["hypothesisId", "rank", "statement", "supportingEvidenceIds", "counterEvidenceIds", "confidenceScore"]);
const INTERVENTION_FIELDS = Object.freeze(["kind", "rationale", "supportingHypothesisIds"]);
const CONFIDENCE_FIELDS = Object.freeze(["score", "band", "basis", "evidenceIds"]);
const IDENTITY_FIELDS = Object.freeze(["providerId", "modelId"]);
const OBJECTIVES = Object.freeze(["explain_likely_causes", "rank_hypotheses", "select_intervention", "estimate_confidence"]);
const PURPOSES = new Set(["technical", "operational", "seo", "commercial"]);
const CLASSIFICATIONS = new Set(["public", "internal"]);
const EVIDENCE_KINDS = new Set(["deterministic_analytics", "event_summary", "audit_excerpt", "technical_artifact", "operational_summary", "seo_measurement", "commercial_measurement"]);
const INTERVENTIONS = Object.freeze(["no_action", "continue_monitoring", "gather_more_evidence", "prepare_recommendation", "prepare_draft", "prepare_branch_or_pr", "escalate_to_human"]);
const PROVIDER_REASONS = Object.freeze({
  busy: "PROVIDER_BUSY",
  rate_limited: "PROVIDER_RATE_LIMITED",
  capacity_exhausted: "PROVIDER_CAPACITY_EXHAUSTED",
  authentication_required: "PROVIDER_AUTHENTICATION_REQUIRED",
  temporarily_unavailable: "PROVIDER_TEMPORARILY_UNAVAILABLE",
  disabled: "PROVIDER_DISABLED"
});
const REJECTION_PRECEDENCE = Object.freeze(["MALFORMED_REQUEST", "UNSUPPORTED_SCHEMA_VERSION", "UNSUPPORTED_DATA_CLASSIFICATION", "UNSUPPORTED_PURPOSE", "INVALID_PREPARED_EVIDENCE", "INVALID_ALLOWED_CONTEXT", "UNSUPPORTED_ANALYSIS_OBJECTIVES", "MALFORMED_PROVIDER_RESULT", "INTERNAL_AUTHORITY_UNAVAILABLE"]);
const IDENTIFIER = /^[a-z][a-z0-9-]{0,63}$/;
const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const TASK_ID = /^[A-Z][A-Z0-9-]{2,80}$/;
const SHA256 = /^[a-f0-9]{64}$/;
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

function text(value, minimum, maximum) {
  return typeof value === "string" && value === value.trim() && !FORBIDDEN_CONTROL.test(value) && [...value].length >= minimum && [...value].length <= maximum;
}

function orderedUnique(values, validItem) {
  if (!Array.isArray(values)) return false;
  for (let index = 0; index < values.length; index += 1) {
    if (!validItem(values[index])) return false;
    if (index > 0 && values[index - 1] >= values[index]) return false;
  }
  return true;
}

function unique(values) {
  return Array.isArray(values) && new Set(values).size === values.length;
}

async function loadAuthority() {
  try {
    const [{ default: requestSource }, { default: resultSource }, { default: Ajv2020 }] = await Promise.all([
      import("../../../schemas/intelligence-provider-request-v1.schema.json", { with: { type: "json" } }),
      import("../../../schemas/intelligence-provider-result-v1.schema.json", { with: { type: "json" } }),
      import("ajv/dist/2020.js")
    ]);
    const requestSchema = deepFreeze(guardedClone(requestSource));
    const resultSchema = deepFreeze(guardedClone(resultSource));
    const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
    if (!ajv.validateSchema(requestSchema) || !ajv.validateSchema(resultSchema)) return null;
    return Object.freeze({ validateRequest: ajv.compile(requestSchema), validateResult: ajv.compile(resultSchema) });
  } catch {
    return null;
  }
}

const authority = await loadAuthority();

function safeRequestId(value) {
  return typeof value === "string" && REQUEST_ID.test(value) ? value : null;
}

function rejection(reasonCodes, requestId = null) {
  return deepFreeze({
    schemaVersion: "1.0.0", status: "rejected", requestId, providerState: null,
    providerIdentity: null, nonAuthoritative: true, failClosed: true, analysis: null,
    reasonCodes: [...reasonCodes]
  });
}

function requestStructureIsComplete(request) {
  if (!exactKeys(request, REQUEST_FIELDS)) return false;
  if (typeof request.schemaVersion !== "string" || typeof request.requestId !== "string" || typeof request.taskId !== "string" ||
      typeof request.purpose !== "string" || typeof request.analysisQuestion !== "string" || typeof request.dataClassification !== "string") return false;
  if (!Array.isArray(request.analysisObjectives) || request.analysisObjectives.some((item) => typeof item !== "string")) return false;
  if (!Array.isArray(request.preparedEvidence)) return false;
  for (const item of request.preparedEvidence) {
    if (!exactKeys(item, EVIDENCE_FIELDS) || typeof item.evidenceId !== "string" || typeof item.kind !== "string" ||
        typeof item.dataClassification !== "string" || typeof item.summary !== "string" || typeof item.integritySha256 !== "string" ||
        !Array.isArray(item.facts) || item.facts.some((fact) => typeof fact !== "string")) return false;
  }
  const context = request.allowedContext;
  return exactKeys(context, CONTEXT_FIELDS) && Array.isArray(context.affectedSystems) && Array.isArray(context.metricIds) &&
    typeof context.locale === "string" && Number.isInteger(context.maxHypotheses) && Array.isArray(context.allowedInterventions) &&
    context.affectedSystems.every((item) => typeof item === "string") && context.metricIds.every((item) => typeof item === "string") &&
    context.allowedInterventions.every((item) => typeof item === "string");
}

function validEvidence(request) {
  if (request.preparedEvidence.length < 1 || request.preparedEvidence.length > 20) return false;
  const ids = new Set();
  for (const item of request.preparedEvidence) {
    if (!IDENTIFIER.test(item.evidenceId) || ids.has(item.evidenceId) || !EVIDENCE_KINDS.has(item.kind) || !CLASSIFICATIONS.has(item.dataClassification) ||
        !text(item.summary, 1, 500) || item.facts.length < 1 || item.facts.length > 20 || !unique(item.facts) ||
        item.facts.some((fact) => !text(fact, 1, 500)) || !SHA256.test(item.integritySha256)) return false;
    if (request.dataClassification === "public" && item.dataClassification !== "public") return false;
    ids.add(item.evidenceId);
  }
  return true;
}

function validAllowedContext(context) {
  if (context.affectedSystems.length < 1 || context.affectedSystems.length > 20 || !orderedUnique(context.affectedSystems, (item) => IDENTIFIER.test(item))) return false;
  if (context.metricIds.length > 20 || !orderedUnique(context.metricIds, (item) => IDENTIFIER.test(item))) return false;
  if (context.locale !== "en" && context.locale !== "th") return false;
  if (context.maxHypotheses < 1 || context.maxHypotheses > 5) return false;
  if (context.allowedInterventions.length < 1 || context.allowedInterventions.length > 7 || !unique(context.allowedInterventions)) return false;
  let previous = -1;
  for (const item of context.allowedInterventions) {
    const index = INTERVENTIONS.indexOf(item);
    if (index < 0 || index <= previous) return false;
    previous = index;
  }
  return true;
}

function inspectRequest(request) {
  const requestId = isPlainObject(request) ? safeRequestId(request.requestId) : null;
  if (!requestStructureIsComplete(request)) return rejection(["MALFORMED_REQUEST"], requestId);
  const reasons = [];
  if (!REQUEST_ID.test(request.requestId) || !TASK_ID.test(request.taskId) || !text(request.analysisQuestion, 1, 1000)) reasons.push("MALFORMED_REQUEST");
  if (request.schemaVersion !== "1.0.0") reasons.push("UNSUPPORTED_SCHEMA_VERSION");
  if (!CLASSIFICATIONS.has(request.dataClassification)) reasons.push("UNSUPPORTED_DATA_CLASSIFICATION");
  if (!PURPOSES.has(request.purpose)) reasons.push("UNSUPPORTED_PURPOSE");
  if (!validEvidence(request)) reasons.push("INVALID_PREPARED_EVIDENCE");
  if (!validAllowedContext(request.allowedContext)) reasons.push("INVALID_ALLOWED_CONTEXT");
  if (request.analysisObjectives.length !== OBJECTIVES.length || request.analysisObjectives.some((item, index) => item !== OBJECTIVES[index])) reasons.push("UNSUPPORTED_ANALYSIS_OBJECTIVES");
  if (reasons.length === 0) {
    try {
      if (!authority.validateRequest(request)) reasons.push("MALFORMED_REQUEST");
    } catch {
      return rejection(["INTERNAL_AUTHORITY_UNAVAILABLE"], requestId);
    }
  }
  reasons.sort((left, right) => REJECTION_PRECEDENCE.indexOf(left) - REJECTION_PRECEDENCE.indexOf(right));
  return reasons.length === 0 ? null : rejection([...new Set(reasons)], requestId);
}

function validProviderIdentity(identity) {
  return exactKeys(identity, IDENTITY_FIELDS) && text(identity.providerId, 1, 128) && text(identity.modelId, 1, 128);
}

function idsReference(values, authorityIds, minimum = 0, maximum = 20) {
  return Array.isArray(values) && values.length >= minimum && values.length <= maximum && unique(values) && values.every((id) => IDENTIFIER.test(id) && authorityIds.has(id));
}

function validConfidence(confidence, evidenceIds, insufficient = false) {
  if (!exactKeys(confidence, CONFIDENCE_FIELDS) || !text(confidence.basis, 1, 500) || !idsReference(confidence.evidenceIds, evidenceIds, insufficient ? 0 : 1, 20)) return false;
  if (typeof confidence.score !== "number" || !Number.isFinite(confidence.score) || confidence.score < 0 || confidence.score > 1) return false;
  if (insufficient) return confidence.score === 0 && confidence.band === "insufficient";
  const expected = confidence.score < 0.5 ? "low" : confidence.score < 0.8 ? "medium" : "high";
  return confidence.band === expected;
}

function validCompleted(analysis, request) {
  if (!exactKeys(analysis, ANALYSIS_FIELDS) || !text(analysis.explanation, 1, 2000) || analysis.additionalEvidenceNeeded.length !== 0) return false;
  const evidenceIds = new Set(request.preparedEvidence.map((item) => item.evidenceId));
  if (!Array.isArray(analysis.likelyCauses) || analysis.likelyCauses.length < 1 || analysis.likelyCauses.length > 5) return false;
  const causeIds = new Set();
  for (const cause of analysis.likelyCauses) {
    if (!exactKeys(cause, CAUSE_FIELDS) || !IDENTIFIER.test(cause.causeId) || causeIds.has(cause.causeId) || !text(cause.statement, 1, 500) ||
        !idsReference(cause.supportingEvidenceIds, evidenceIds, 1, 20) || !idsReference(cause.counterEvidenceIds, evidenceIds, 0, 20)) return false;
    causeIds.add(cause.causeId);
  }
  if (!Array.isArray(analysis.rankedHypotheses) || analysis.rankedHypotheses.length < 1 || analysis.rankedHypotheses.length > request.allowedContext.maxHypotheses) return false;
  const hypothesisIds = new Set();
  let previousConfidence = Infinity;
  for (let index = 0; index < analysis.rankedHypotheses.length; index += 1) {
    const hypothesis = analysis.rankedHypotheses[index];
    if (!exactKeys(hypothesis, HYPOTHESIS_FIELDS) || !IDENTIFIER.test(hypothesis.hypothesisId) || hypothesisIds.has(hypothesis.hypothesisId) ||
        hypothesis.rank !== index + 1 || !text(hypothesis.statement, 1, 500) || !idsReference(hypothesis.supportingEvidenceIds, evidenceIds, 1, 20) ||
        !idsReference(hypothesis.counterEvidenceIds, evidenceIds, 0, 20) || typeof hypothesis.confidenceScore !== "number" || !Number.isFinite(hypothesis.confidenceScore) ||
        hypothesis.confidenceScore < 0 || hypothesis.confidenceScore > 1 || hypothesis.confidenceScore > previousConfidence) return false;
    previousConfidence = hypothesis.confidenceScore;
    hypothesisIds.add(hypothesis.hypothesisId);
  }
  const selected = analysis.selectedIntervention;
  if (!exactKeys(selected, INTERVENTION_FIELDS) || !request.allowedContext.allowedInterventions.includes(selected.kind) || !text(selected.rationale, 1, 1000) ||
      !idsReference(selected.supportingHypothesisIds, hypothesisIds, 1, 5)) return false;
  return validConfidence(analysis.confidence, evidenceIds) && idsReference(analysis.evidenceCitations, evidenceIds, 1, 20);
}

function validInsufficient(analysis, request) {
  if (!exactKeys(analysis, ANALYSIS_FIELDS) || !text(analysis.explanation, 1, 2000) || !Array.isArray(analysis.likelyCauses) || analysis.likelyCauses.length !== 0 ||
      !Array.isArray(analysis.rankedHypotheses) || analysis.rankedHypotheses.length !== 0) return false;
  const selected = analysis.selectedIntervention;
  if (!exactKeys(selected, INTERVENTION_FIELDS) || selected.kind !== "gather_more_evidence" || !text(selected.rationale, 1, 1000) ||
      !Array.isArray(selected.supportingHypothesisIds) || selected.supportingHypothesisIds.length !== 0) return false;
  const evidenceIds = new Set(request.preparedEvidence.map((item) => item.evidenceId));
  return validConfidence(analysis.confidence, evidenceIds, true) && idsReference(analysis.evidenceCitations, evidenceIds, 0, 20) &&
    Array.isArray(analysis.additionalEvidenceNeeded) && analysis.additionalEvidenceNeeded.length >= 1 && analysis.additionalEvidenceNeeded.length <= 10 &&
    unique(analysis.additionalEvidenceNeeded) && analysis.additionalEvidenceNeeded.every((item) => text(item, 1, 500));
}

function resultSemanticsAreValid(result, request) {
  if (!exactKeys(result, RESULT_FIELDS) || result.schemaVersion !== "1.0.0" || result.nonAuthoritative !== true || result.requestId !== request.requestId) return false;
  if (result.status === "completed") {
    return result.providerState === "available" && validProviderIdentity(result.providerIdentity) && result.failClosed === false &&
      Array.isArray(result.reasonCodes) && result.reasonCodes.length === 0 && validCompleted(result.analysis, request);
  }
  if (result.status === "insufficient_evidence") {
    return result.providerState === "available" && validProviderIdentity(result.providerIdentity) && result.failClosed === true &&
      JSON.stringify(result.reasonCodes) === '["INSUFFICIENT_EVIDENCE"]' && validInsufficient(result.analysis, request);
  }
  if (result.status === "provider_unavailable") {
    return (result.providerIdentity === null || validProviderIdentity(result.providerIdentity)) && result.failClosed === true && result.analysis === null &&
      Object.hasOwn(PROVIDER_REASONS, result.providerState) && JSON.stringify(result.reasonCodes) === JSON.stringify([PROVIDER_REASONS[result.providerState]]);
  }
  if (result.status === "rejected") {
    if (result.providerState !== null || result.providerIdentity !== null || result.failClosed !== true || result.analysis !== null || !Array.isArray(result.reasonCodes) ||
        result.reasonCodes.length < 1 || !unique(result.reasonCodes)) return false;
    let previous = -1;
    for (const code of result.reasonCodes) {
      const index = REJECTION_PRECEDENCE.indexOf(code);
      if (index < 0 || index <= previous) return false;
      previous = index;
    }
    return true;
  }
  return false;
}

/** Validate and clone a bounded intelligence request against private committed authority. */
export function validateIntelligenceRequest(input) {
  try {
    if (authority === null) return deepFreeze({ ok: false, value: null, rejection: rejection(["INTERNAL_AUTHORITY_UNAVAILABLE"]) });
    const clone = guardedClone(input);
    const denied = inspectRequest(clone);
    return denied === null
      ? deepFreeze({ ok: true, value: clone, rejection: null })
      : deepFreeze({ ok: false, value: null, rejection: denied });
  } catch {
    return deepFreeze({ ok: false, value: null, rejection: rejection(["MALFORMED_REQUEST"]) });
  }
}

/** Validate and clone a provider result only after independently revalidating its request. */
export function validateIntelligenceResult(input, request) {
  try {
    if (authority === null) return deepFreeze({ ok: false, value: null, rejection: rejection(["INTERNAL_AUTHORITY_UNAVAILABLE"]) });
    const requestDecision = validateIntelligenceRequest(request);
    if (!requestDecision.ok) return requestDecision;
    let clone;
    try { clone = guardedClone(input); } catch { return deepFreeze({ ok: false, value: null, rejection: rejection(["MALFORMED_PROVIDER_RESULT"], requestDecision.value.requestId) }); }
    let schemaValid = false;
    try { schemaValid = authority.validateResult(clone); } catch { return deepFreeze({ ok: false, value: null, rejection: rejection(["INTERNAL_AUTHORITY_UNAVAILABLE"], requestDecision.value.requestId) }); }
    if (!schemaValid || !resultSemanticsAreValid(clone, requestDecision.value)) {
      return deepFreeze({ ok: false, value: null, rejection: rejection(["MALFORMED_PROVIDER_RESULT"], requestDecision.value.requestId) });
    }
    return deepFreeze({ ok: true, value: clone, rejection: null });
  } catch {
    let requestId = null;
    try { requestId = isPlainObject(request) ? safeRequestId(request.requestId) : null; } catch { requestId = null; }
    return deepFreeze({ ok: false, value: null, rejection: rejection(["MALFORMED_PROVIDER_RESULT"], requestId) });
  }
}
