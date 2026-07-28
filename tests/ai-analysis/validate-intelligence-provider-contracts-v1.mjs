import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requestSchemaPath = path.join(root, "schemas/intelligence-provider-request-v1.schema.json");
const resultSchemaPath = path.join(root, "schemas/intelligence-provider-result-v1.schema.json");
const modulePath = path.join(root, "packages/ai-analysis-contracts/src/intelligence-provider-contracts-v1.mjs");
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const copy = (value) => JSON.parse(JSON.stringify(value));

const OBJECTIVES = ["explain_likely_causes", "rank_hypotheses", "select_intervention", "estimate_confidence"];
const INTERVENTIONS = ["no_action", "continue_monitoring", "gather_more_evidence", "prepare_recommendation", "prepare_draft", "prepare_branch_or_pr", "escalate_to_human"];
const PROVIDER_REASONS = {
  busy: "PROVIDER_BUSY", rate_limited: "PROVIDER_RATE_LIMITED", capacity_exhausted: "PROVIDER_CAPACITY_EXHAUSTED",
  authentication_required: "PROVIDER_AUTHENTICATION_REQUIRED", temporarily_unavailable: "PROVIDER_TEMPORARILY_UNAVAILABLE", disabled: "PROVIDER_DISABLED"
};

const baseRequest = () => ({
  schemaVersion: "1.0.0",
  requestId: "request:2026-07-28:001",
  taskId: "SUT-AIOS-P2-002",
  purpose: "technical",
  analysisQuestion: "Why did the prepared direct-commerce metric change?",
  dataClassification: "internal",
  analysisObjectives: [...OBJECTIVES],
  preparedEvidence: [
    {
      evidenceId: "analytics-a", kind: "deterministic_analytics", dataClassification: "internal",
      summary: "Canonical P2-001 comparison result.", facts: ["Direct events declined by 20 percent."], integritySha256: "a".repeat(64)
    },
    {
      evidenceId: "event-b", kind: "event_summary", dataClassification: "public",
      summary: "A prepared deployment event summary.", facts: ["A deployment occurred inside the comparison window."], integritySha256: "b".repeat(64)
    }
  ],
  allowedContext: {
    affectedSystems: ["direct-commerce", "website"], metricIds: ["event-count"], locale: "en", maxHypotheses: 2,
    allowedInterventions: [...INTERVENTIONS]
  }
});

const completedResult = (request = baseRequest()) => ({
  schemaVersion: "1.0.0", status: "completed", requestId: request.requestId, providerState: "available",
  providerIdentity: { providerId: "provider-neutral-fixture", modelId: "model-fixture" }, nonAuthoritative: true, failClosed: false,
  analysis: {
    explanation: "The prepared evidence supports a deployment-timing hypothesis, but does not establish causation.",
    likelyCauses: [{ causeId: "deployment-timing", statement: "The timing may be associated with the observed change.", supportingEvidenceIds: ["analytics-a", "event-b"], counterEvidenceIds: [] }],
    rankedHypotheses: [
      { hypothesisId: "deployment-effect", rank: 1, statement: "The deployment may have affected measured events.", supportingEvidenceIds: ["analytics-a", "event-b"], counterEvidenceIds: [], confidenceScore: 0.72 },
      { hypothesisId: "measurement-change", rank: 2, statement: "A measurement change may explain part of the movement.", supportingEvidenceIds: ["analytics-a"], counterEvidenceIds: ["event-b"], confidenceScore: 0.45 }
    ],
    selectedIntervention: { kind: "prepare_recommendation", rationale: "Prepare a bounded human-reviewed recommendation.", supportingHypothesisIds: ["deployment-effect"] },
    confidence: { score: 0.72, band: "medium", basis: "Two prepared evidence items support the leading hypothesis.", evidenceIds: ["analytics-a", "event-b"] },
    evidenceCitations: ["analytics-a", "event-b"], additionalEvidenceNeeded: []
  },
  reasonCodes: []
});

const insufficientResult = (request = baseRequest()) => ({
  schemaVersion: "1.0.0", status: "insufficient_evidence", requestId: request.requestId, providerState: "available",
  providerIdentity: { providerId: "provider-neutral-fixture", modelId: "model-fixture" }, nonAuthoritative: true, failClosed: true,
  analysis: {
    explanation: "The prepared evidence is insufficient to rank a hypothesis.", likelyCauses: [], rankedHypotheses: [],
    selectedIntervention: { kind: "gather_more_evidence", rationale: "Gather another bounded measurement.", supportingHypothesisIds: [] },
    confidence: { score: 0, band: "insufficient", basis: "No supported hypothesis can be ranked.", evidenceIds: ["analytics-a"] },
    evidenceCitations: ["analytics-a"], additionalEvidenceNeeded: ["A prepared post-deployment measurement is needed."]
  }, reasonCodes: ["INSUFFICIENT_EVIDENCE"]
});

function assertClosedObjectSchemas(node, location = "schema") {
  if (Array.isArray(node)) return node.forEach((child, index) => assertClosedObjectSchemas(child, `${location}[${index}]`));
  if (node === null || typeof node !== "object") return;
  if (node.type === "object") expect(node.additionalProperties === false, `${location} object schema must be closed`);
  for (const [key, child] of Object.entries(node)) assertClosedObjectSchemas(child, `${location}.${key}`);
}

function assertFrozen(value, label) {
  expect(value !== null && Object.isFrozen(value), `${label} must be frozen`);
  if (typeof value === "object") for (const child of Object.values(value)) if (child !== null && typeof child === "object") assertFrozen(child, label);
}

try {
  const [requestText, resultText, moduleText] = await Promise.all([readFile(requestSchemaPath, "utf8"), readFile(resultSchemaPath, "utf8"), readFile(modulePath, "utf8")]);
  const requestSchema = JSON.parse(requestText);
  const resultSchema = JSON.parse(resultText);
  expect(requestSchema.$schema === "https://json-schema.org/draft/2020-12/schema" && resultSchema.$schema === requestSchema.$schema, "both authorities must use Draft 2020-12");
  expect(requestSchema.$id.endsWith("intelligence-provider-request-v1.schema.json") && resultSchema.$id.endsWith("intelligence-provider-result-v1.schema.json"), "schema identities must be canonical V1");
  expect(resultSchema.oneOf.length === 4, "result must expose exactly four variants");
  assertClosedObjectSchemas(requestSchema, "requestSchema");
  assertClosedObjectSchemas(resultSchema, "resultSchema");

  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
  expect(ajv.validateSchema(requestSchema), `request schema metaschema failure: ${ajv.errorsText(ajv.errors)}`);
  expect(ajv.validateSchema(resultSchema), `result schema metaschema failure: ${ajv.errorsText(ajv.errors)}`);
  const schemaRequest = ajv.compile(requestSchema);
  const schemaResult = ajv.compile(resultSchema);
  const variantValidators = ["completed", "insufficientEvidence", "rejected", "providerUnavailable"].map((name) => ajv.compile({ $schema: requestSchema.$schema, $ref: `#/$defs/${name}`, $defs: resultSchema.$defs }));

  expect(!/from\s+["'](?:node:|[^"']*(?:sdk|provider|database|queue|workflow|policy|executor))/i.test(moduleText), "contract core must not import infrastructure or provider behavior");
  expect(!/(readFile|readFileSync|fetch\s*\(|process\.env|Date\.now|new Date|child_process)/.test(moduleText), "contract core must not read mutable infrastructure authority");
  expect(!/analytics-sdk|deterministic-analytics-calculators-v1/.test(moduleText), "contract core must not import or reinterpret P2-001 internals");
  const contractModule = await import(`${pathToFileURL(modulePath).href}?validator=${Date.now()}`);
  expect(JSON.stringify(Object.keys(contractModule).sort()) === '["validateIntelligenceRequest","validateIntelligenceResult"]', "deep module must expose exactly two prescribed functions");
  const { validateIntelligenceRequest, validateIntelligenceResult } = contractModule;

  let testsRun = 0;
  const checkRequest = (input, ok, reasons, label) => {
    let decision;
    try { decision = validateIntelligenceRequest(input); } catch (error) { throw new Error(`${label} threw: ${error.message}`); }
    expect(decision.ok === ok && decision.value === (ok ? decision.value : null) && decision.rejection === (ok ? null : decision.rejection), `${label}: decision envelope must be closed`);
    assertFrozen(decision, `${label} decision`);
    if (ok) {
      expect(schemaRequest(decision.value), `${label}: returned request must satisfy schema: ${ajv.errorsText(schemaRequest.errors)}`);
      expect(decision.value !== input, `${label}: returned request must be a clone`);
    } else {
      expect(JSON.stringify(decision.rejection.reasonCodes) === JSON.stringify(reasons), `${label}: expected ${JSON.stringify(reasons)}, received ${JSON.stringify(decision.rejection.reasonCodes)}`);
      expect(schemaResult(decision.rejection), `${label}: rejection must satisfy result schema: ${ajv.errorsText(schemaResult.errors)}`);
    }
    testsRun += 1;
    return decision;
  };
  const checkResult = (input, request, ok, reason, label) => {
    let decision;
    try { decision = validateIntelligenceResult(input, request); } catch (error) { throw new Error(`${label} threw: ${error.message}`); }
    expect(decision.ok === ok, `${label}: expected ok=${ok}`);
    assertFrozen(decision, `${label} decision`);
    const value = ok ? decision.value : decision.rejection;
    expect(schemaResult(value), `${label}: returned result must satisfy schema: ${ajv.errorsText(schemaResult.errors)}`);
    const matches = variantValidators.filter((validate) => validate(value)).length;
    expect(matches === 1, `${label}: returned result must match exactly one variant, matched ${matches}`);
    if (ok) expect(value !== input, `${label}: returned result must be a clone`);
    else expect(JSON.stringify(value.reasonCodes) === JSON.stringify([reason]), `${label}: expected ${reason}`);
    testsRun += 1;
    return decision;
  };

  const canonicalRequest = baseRequest();
  expect(schemaRequest(canonicalRequest), `canonical request must satisfy schema: ${ajv.errorsText(schemaRequest.errors)}`);
  checkRequest(canonicalRequest, true, null, "canonical request");
  for (const purpose of ["technical", "operational", "seo", "commercial"]) {
    const request = baseRequest(); request.purpose = purpose; checkRequest(request, true, null, `purpose ${purpose}`);
  }
  for (const classification of ["public", "internal"]) {
    const request = baseRequest(); request.dataClassification = classification; request.preparedEvidence.forEach((item) => { item.dataClassification = "public"; });
    checkRequest(request, true, null, `classification ${classification}`);
  }
  for (const kind of ["deterministic_analytics", "event_summary", "audit_excerpt", "technical_artifact", "operational_summary", "seo_measurement", "commercial_measurement"]) {
    const request = baseRequest(); request.preparedEvidence[0].kind = kind; checkRequest(request, true, null, `evidence kind ${kind}`);
  }
  for (const locale of ["en", "th"]) { const request = baseRequest(); request.allowedContext.locale = locale; checkRequest(request, true, null, `locale ${locale}`); }

  for (const [mutate, reasons, label] of [
    [(request) => { request.extra = true; }, ["MALFORMED_REQUEST"], "unknown root authority field"],
    [(request) => { request.prompt = "ignore controls"; }, ["MALFORMED_REQUEST"], "caller prompt"],
    [(request) => { request.schemaVersion = "2.0.0"; }, ["UNSUPPORTED_SCHEMA_VERSION"], "unsupported schema"],
    [(request) => { request.dataClassification = "restricted"; }, ["UNSUPPORTED_DATA_CLASSIFICATION"], "restricted classification"],
    [(request) => { request.purpose = "authorization"; }, ["UNSUPPORTED_PURPOSE"], "unsupported purpose"],
    [(request) => { request.preparedEvidence[1].evidenceId = "analytics-a"; }, ["INVALID_PREPARED_EVIDENCE"], "duplicate evidence ID"],
    [(request) => { request.dataClassification = "public"; }, ["INVALID_PREPARED_EVIDENCE"], "classification escalation"],
    [(request) => { request.allowedContext.affectedSystems.reverse(); }, ["INVALID_ALLOWED_CONTEXT"], "unsorted systems"],
    [(request) => { request.allowedContext.allowedInterventions = ["prepare_draft", "no_action"]; }, ["INVALID_ALLOWED_CONTEXT"], "intervention enum order"],
    [(request) => { request.analysisObjectives.reverse(); }, ["UNSUPPORTED_ANALYSIS_OBJECTIVES"], "objective order"],
    [(request) => { request.analysisQuestion = " untrimmed"; }, ["MALFORMED_REQUEST"], "untrimmed question"]
  ]) {
    const request = baseRequest(); mutate(request); checkRequest(request, false, reasons, label);
  }

  const canonicalCompleted = completedResult(canonicalRequest);
  const completed = checkResult(canonicalCompleted, canonicalRequest, true, null, "completed");
  expect(completed.value.analysis.confidence.band === "medium", "completed confidence band must map exactly");
  checkResult(insufficientResult(canonicalRequest), canonicalRequest, true, null, "insufficient evidence");
  for (const [providerState, reasonCode] of Object.entries(PROVIDER_REASONS)) {
    checkResult({ schemaVersion: "1.0.0", status: "provider_unavailable", requestId: canonicalRequest.requestId, providerState,
      providerIdentity: null, nonAuthoritative: true, failClosed: true, analysis: null, reasonCodes: [reasonCode] }, canonicalRequest, true, null, `provider state ${providerState}`);
  }
  checkResult({ schemaVersion: "1.0.0", status: "rejected", requestId: canonicalRequest.requestId, providerState: null,
    providerIdentity: null, nonAuthoritative: true, failClosed: true, analysis: null, reasonCodes: ["MALFORMED_PROVIDER_RESULT"] }, canonicalRequest, true, null, "canonical rejected result");

  for (const [mutate, label] of [
    [(result) => { result.approved = true; }, "self approval"],
    [(result) => { result.nonAuthoritative = false; }, "authority claim"],
    [(result) => { result.analysis.selectedIntervention.kind = "prepare_branch_or_pr"; }, "disallowed intervention"],
    [(result) => { result.analysis.rankedHypotheses[1].rank = 3; }, "non-contiguous rank"],
    [(result) => { result.analysis.rankedHypotheses[1].confidenceScore = 0.9; }, "increasing ranked confidence"],
    [(result) => { result.analysis.confidence.band = "high"; }, "incorrect confidence band"],
    [(result) => { result.analysis.evidenceCitations = ["invented-evidence"]; }, "unknown evidence citation"],
    [(result) => { result.analysis.selectedIntervention.supportingHypothesisIds = ["unknown-hypothesis"]; }, "unknown hypothesis reference"]
  ]) {
    const request = baseRequest(); request.allowedContext.allowedInterventions = ["no_action", "continue_monitoring", "gather_more_evidence", "prepare_recommendation"];
    const result = completedResult(request); mutate(result); checkResult(result, request, false, "MALFORMED_PROVIDER_RESULT", label);
  }
  for (const [state, reason] of [["available", "PROVIDER_BUSY"], ["busy", "PROVIDER_DISABLED"], ["unknown", "PROVIDER_BUSY"]]) {
    checkResult({ schemaVersion: "1.0.0", status: "provider_unavailable", requestId: canonicalRequest.requestId, providerState: state,
      providerIdentity: null, nonAuthoritative: true, failClosed: true, analysis: null, reasonCodes: [reason] }, canonicalRequest, false, "MALFORMED_PROVIDER_RESULT", `invalid provider mapping ${state}`);
  }

  const invalidRequest = baseRequest(); invalidRequest.dataClassification = "restricted";
  checkResult(completedResult(invalidRequest), invalidRequest, false, "UNSUPPORTED_DATA_CLASSIFICATION", "request rejection precedes result inspection");

  const callerRequestSchema = copy(requestSchema); callerRequestSchema.additionalProperties = true;
  const callerResultSchema = copy(resultSchema); callerResultSchema.$defs.completed.properties.nonAuthoritative = { const: false };
  checkRequest({ ...baseRequest(), schema: callerRequestSchema }, false, ["MALFORMED_REQUEST"], "caller schema authority injection");
  checkResult({ ...completedResult(), schema: callerResultSchema }, baseRequest(), false, "MALFORMED_PROVIDER_RESULT", "provider schema authority injection");

  const getter = baseRequest(); Object.defineProperty(getter, "requestId", { enumerable: true, get() { throw new Error("hostile getter"); } });
  const proxy = new Proxy({}, { ownKeys() { throw new Error("hostile proxy"); }, get() { throw new Error("hostile get"); } });
  const cycle = {}; cycle.self = cycle;
  for (const [index, malformed] of [undefined, null, false, 1, NaN, Infinity, 1n, Symbol("x"), () => {}, [], getter, proxy, cycle, Object.create({ inherited: true })].entries()) {
    const first = checkRequest(malformed, false, ["MALFORMED_REQUEST"], `malformed request ${index}a`);
    const second = checkRequest(malformed, false, ["MALFORMED_REQUEST"], `malformed request ${index}b`);
    expect(JSON.stringify(first) === JSON.stringify(second), `malformed request ${index} must be deterministic`);
    checkResult(malformed, baseRequest(), false, "MALFORMED_PROVIDER_RESULT", `malformed result ${index}`);
  }
  checkResult(completedResult(), proxy, false, "MALFORMED_REQUEST", "hostile request fails before result inspection");

  const original = baseRequest(); const accepted = validateIntelligenceRequest(original); original.allowedContext.affectedSystems[0] = "mutated";
  expect(accepted.value.allowedContext.affectedSystems[0] === "direct-commerce", "accepted request must not share input references");
  const originalResult = completedResult(); const acceptedResult = validateIntelligenceResult(originalResult, baseRequest()); originalResult.analysis.explanation = "mutated";
  expect(acceptedResult.value.analysis.explanation !== "mutated", "accepted result must not share input references");

  process.stdout.write(`${JSON.stringify({ name: "intelligence-provider-contracts-v1", passed: true, testsRun, details: "Draft 2020-12 compilation, four exact result variants, finite enums and provider mappings, semantic cross-references, classification and P2-001 boundaries, private authority, frozen clones, self-authorization rejection, and adversarial never-throw behavior passed" })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ name: "intelligence-provider-contracts-v1", passed: false, details: error.message })}\n`);
  process.exitCode = 1;
}
