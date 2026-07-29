import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(root, "schemas/intervention-proposal-contract-v1.schema.json");
const modulePath = path.join(root, "packages/intervention-proposal-contracts/src/intervention-proposal-contract-v1.mjs");
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const copy = (value) => JSON.parse(JSON.stringify(value));
const stable = (value) => Array.isArray(value)
  ? value.map(stable)
  : value !== null && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;

const OUTCOMES = ["no_action", "gather_more_evidence", "recommendation", "prepare_draft", "prepare_branch_or_pr", "escalate_to_human"];
const CAPABILITIES = ["analytics_read", "repository_read", "repository_write", "content_draft", "branch_create", "pull_request_create", "staff_notification"];
const RISKS = ["low", "medium", "high", "critical"];
const OBJECTIVES = ["explain_likely_causes", "rank_hypotheses", "select_intervention", "estimate_confidence"];
const INTERVENTIONS = ["no_action", "continue_monitoring", "gather_more_evidence", "prepare_recommendation", "prepare_draft", "prepare_branch_or_pr", "escalate_to_human"];
const OUTCOME_FOR_INTERVENTION = {
  no_action: "no_action", continue_monitoring: "no_action", gather_more_evidence: "gather_more_evidence",
  prepare_recommendation: "recommendation", prepare_draft: "prepare_draft",
  prepare_branch_or_pr: "prepare_branch_or_pr", escalate_to_human: "escalate_to_human"
};
const CAPS_FOR_OUTCOME = {
  no_action: [], gather_more_evidence: [], recommendation: [],
  prepare_draft: ["repository_read", "repository_write", "content_draft"],
  prepare_branch_or_pr: ["repository_read", "repository_write", "branch_create", "pull_request_create"],
  escalate_to_human: ["staff_notification"]
};

const baseRequest = () => ({
  schemaVersion: "1.0.0", requestId: "request:2026-07-29:001", taskId: "SUT-AIOS-P2-004", purpose: "technical",
  analysisQuestion: "Which bounded intervention should follow from the prepared evidence?", dataClassification: "internal",
  analysisObjectives: [...OBJECTIVES],
  preparedEvidence: [
    { evidenceId: "analytics-a", kind: "deterministic_analytics", dataClassification: "internal", summary: "A prepared deterministic comparison.", facts: ["The prepared metric declined."], integritySha256: "a".repeat(64) },
    { evidenceId: "event-b", kind: "event_summary", dataClassification: "public", summary: "A prepared deployment event.", facts: ["A deployment occurred in the comparison window."], integritySha256: "b".repeat(64) }
  ],
  allowedContext: { affectedSystems: ["direct-commerce", "website"], metricIds: ["event-count"], locale: "en", maxHypotheses: 2, allowedInterventions: [...INTERVENTIONS] }
});

const completedResult = (request = baseRequest(), selectedKind = "prepare_recommendation") => ({
  schemaVersion: "1.0.0", status: "completed", requestId: request.requestId, providerState: "available",
  providerIdentity: { providerId: "provider-neutral-fixture", modelId: "model-fixture" }, nonAuthoritative: true, failClosed: false,
  analysis: {
    explanation: "The prepared evidence supports a bounded deployment-timing hypothesis.",
    likelyCauses: [
      { causeId: "deployment-timing", statement: "Deployment timing may be associated with the change.", supportingEvidenceIds: ["analytics-a", "event-b"], counterEvidenceIds: [] },
      { causeId: "measurement-change", statement: "Measurement behavior may explain part of the change.", supportingEvidenceIds: ["analytics-a"], counterEvidenceIds: ["event-b"] }
    ],
    rankedHypotheses: [
      { hypothesisId: "deployment-effect", rank: 1, statement: "The deployment may have affected measured events.", supportingEvidenceIds: ["analytics-a", "event-b"], counterEvidenceIds: [], confidenceScore: 0.72 },
      { hypothesisId: "measurement-effect", rank: 2, statement: "Measurement changes may explain the movement.", supportingEvidenceIds: ["analytics-a"], counterEvidenceIds: ["event-b"], confidenceScore: 0.45 }
    ],
    selectedIntervention: { kind: selectedKind, rationale: "Use only the bounded intervention selected from prepared evidence.", supportingHypothesisIds: ["deployment-effect"] },
    confidence: { score: 0.72, band: "medium", basis: "Two prepared items support the leading hypothesis.", evidenceIds: ["analytics-a", "event-b"] },
    evidenceCitations: ["analytics-a", "event-b"], additionalEvidenceNeeded: []
  }, reasonCodes: []
});

const insufficientResult = (request = baseRequest()) => ({
  schemaVersion: "1.0.0", status: "insufficient_evidence", requestId: request.requestId, providerState: "available",
  providerIdentity: { providerId: "provider-neutral-fixture", modelId: "model-fixture" }, nonAuthoritative: true, failClosed: true,
  analysis: {
    explanation: "The prepared evidence is insufficient to rank a hypothesis.", likelyCauses: [], rankedHypotheses: [],
    selectedIntervention: { kind: "gather_more_evidence", rationale: "Gather one more bounded measurement.", supportingHypothesisIds: [] },
    confidence: { score: 0, band: "insufficient", basis: "No supported hypothesis can be ranked.", evidenceIds: ["analytics-a"] },
    evidenceCitations: ["analytics-a"], additionalEvidenceNeeded: ["A prepared post-deployment measurement is needed."]
  }, reasonCodes: ["INSUFFICIENT_EVIDENCE"]
});

const proposalFor = (request = baseRequest(), result = completedResult(request)) => {
  const outcome = OUTCOME_FOR_INTERVENTION[result.analysis.selectedIntervention.kind];
  const humanReview = ["recommendation", "prepare_draft", "prepare_branch_or_pr", "escalate_to_human"].includes(outcome);
  const mutationPreparation = outcome === "prepare_draft" || outcome === "prepare_branch_or_pr";
  return {
    schemaVersion: "1.0.0", proposalId: "proposal:2026-07-29:001", taskId: request.taskId,
    sourceIntelligence: { requestId: request.requestId, status: result.status }, outcome,
    diagnosis: {
      summary: result.analysis.explanation,
      causeIds: result.status === "completed" ? ["deployment-timing", "measurement-change"] : [],
      hypothesisIds: result.status === "completed" ? ["deployment-effect", "measurement-effect"] : []
    },
    evidenceReferences: [...result.analysis.evidenceCitations],
    confidence: { score: result.analysis.confidence.score, band: result.analysis.confidence.band, basis: result.analysis.confidence.basis },
    recommendedAction: { kind: outcome, description: "Prepare only the bounded non-authoritative intervention.", rationale: result.analysis.selectedIntervention.rationale, executionAuthorized: false },
    alternatives: [{ alternativeId: "continue-observation", description: "Continue bounded observation.", tradeoff: "This delays the proposed intervention." }],
    affectedSystems: ["direct-commerce", "website"], requestedCapabilities: [...CAPS_FOR_OUTCOME[outcome]],
    riskClassification: outcome === "escalate_to_human" ? "critical" : "low",
    approvalRequirement: { required: humanReview, approvalClass: humanReview ? "human_review" : "none", reason: humanReview ? "A human must review this advisory proposal." : "This outcome requests no action or capability." },
    verificationPlan: { independentReviewRequired: true, checks: ["Run the bounded deterministic checks."], successCriteria: ["The independent checks pass."] },
    rollbackPlan: mutationPreparation
      ? { required: true, trigger: "A bounded check fails.", steps: ["Discard the prepared change."] }
      : { required: false, trigger: null, steps: [] },
    expectedOutcome: { summary: "A bounded and reviewable next step is prepared.", measurableSignals: ["The declared check result is recorded."], observationWindow: "One deterministic review cycle." },
    authority: { nonAuthoritative: true, approved: false, authorized: false, executed: false, independentlyVerified: false, productionEligible: false }
  };
};

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
  const [schemaText, moduleText] = await Promise.all([readFile(schemaPath, "utf8"), readFile(modulePath, "utf8")]);
  const schema = JSON.parse(schemaText);
  expect(schema.$schema === "https://json-schema.org/draft/2020-12/schema", "proposal authority must use Draft 2020-12");
  expect(schema.$id.endsWith("intervention-proposal-contract-v1.schema.json"), "proposal authority must have the canonical V1 identity");
  assertClosedObjectSchemas(schema);
  expect(JSON.stringify(schema.$defs.outcome.enum) === JSON.stringify(OUTCOMES), "schema must declare all outcomes in exact precedence order");
  expect(JSON.stringify(schema.$defs.requestedCapability.enum) === JSON.stringify(CAPABILITIES), "schema must declare all capabilities in exact order");
  expect(JSON.stringify(schema.$defs.riskClassification.enum) === JSON.stringify(RISKS), "schema must declare all risk values");
  expect(schema.$defs.authority.properties.nonAuthoritative.const === true, "authority posture must remain non-authoritative");
  for (const flag of ["approved", "authorized", "executed", "independentlyVerified", "productionEligible"]) expect(schema.$defs.authority.properties[flag].const === false, `${flag} must be fixed false`);

  const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
  expect(ajv.validateSchema(schema), `proposal metaschema failure: ${ajv.errorsText(ajv.errors)}`);
  const validateSchema = ajv.compile(schema);

  expect(!/(?:from|import\s*\()[^\n]*(?:cloudflare|supabase|github|openai|line|database|queue|workflow|scheduler|policy|approval|executor|audit|notification|node:fs|node:http|node:https|child_process)/i.test(moduleText), "contract core must not import infrastructure or authority providers");
  expect(!/(fetch\s*\(|process\.env|Date\.now|new Date|readFile|writeFile|setTimeout|setInterval)/.test(moduleText), "contract core must not use mutable infrastructure, clock, or environment authority");
  expect(moduleText.includes("../../ai-analysis-contracts/src/intelligence-provider-contracts-v1.mjs"), "contract core must use the public P2-002 boundary");
  expect(!moduleText.includes("intelligence-provider-request-v1.schema.json") && !moduleText.includes("intelligence-provider-result-v1.schema.json"), "P2-004 must not reinterpret P2-002 schemas");

  const contractModule = await import(`${pathToFileURL(modulePath).href}?validator=${Date.now()}`);
  expect(JSON.stringify(Object.keys(contractModule)) === '["validateInterventionProposal"]', "deep module must expose exactly one function");
  const { validateInterventionProposal } = contractModule;
  let testsRun = 0;

  const check = (proposal, request, result, ok, reasons, label, injectedAuthority) => {
    let decision;
    try { decision = validateInterventionProposal(proposal, request, result, injectedAuthority); } catch (error) { throw new Error(`${label} threw: ${error.message}`); }
    expect(JSON.stringify(Object.keys(decision)) === '["ok","value","rejection"]', `${label}: decision envelope must be closed`);
    expect(decision.ok === ok && decision.value === (ok ? decision.value : null) && decision.rejection === (ok ? null : decision.rejection), `${label}: decision envelope values are inconsistent`);
    assertFrozen(decision, `${label} decision`);
    if (ok) {
      expect(validateSchema(decision.value), `${label}: returned proposal must satisfy schema: ${ajv.errorsText(validateSchema.errors)}`);
      expect(decision.value !== proposal, `${label}: proposal must be cloned`);
    } else {
      expect(JSON.stringify(Object.keys(decision.rejection)) === '["schemaVersion","failClosed","reasonCodes"]', `${label}: rejection must be closed`);
      expect(decision.rejection.schemaVersion === "1.0.0" && decision.rejection.failClosed === true, `${label}: rejection must fail closed`);
      expect(JSON.stringify(decision.rejection.reasonCodes) === JSON.stringify(reasons), `${label}: expected ${JSON.stringify(reasons)}, received ${JSON.stringify(decision.rejection.reasonCodes)}`);
    }
    testsRun += 1;
    return decision;
  };

  const request = baseRequest();
  const result = completedResult(request);
  const canonical = proposalFor(request, result);
  expect(validateSchema(canonical), `canonical proposal must satisfy schema: ${ajv.errorsText(validateSchema.errors)}`);
  const accepted = check(canonical, request, result, true, null, "canonical recommendation");
  canonical.diagnosis.summary = "Mutated caller object.";
  expect(accepted.value.diagnosis.summary !== canonical.diagnosis.summary, "accepted value must be a detached deep clone");

  for (const intervention of INTERVENTIONS) {
    const finiteRequest = baseRequest();
    const finiteResult = completedResult(finiteRequest, intervention);
    const finiteProposal = proposalFor(finiteRequest, finiteResult);
    check(finiteProposal, finiteRequest, finiteResult, true, null, `intervention ${intervention}`);
  }
  const insufficientRequest = baseRequest();
  const insufficient = insufficientResult(insufficientRequest);
  check(proposalFor(insufficientRequest, insufficient), insufficientRequest, insufficient, true, null, "insufficient evidence proposal");

  for (const risk of RISKS) {
    const riskRequest = baseRequest();
    const kind = risk === "critical" ? "escalate_to_human" : "prepare_recommendation";
    const riskResult = completedResult(riskRequest, kind);
    const riskProposal = proposalFor(riskRequest, riskResult); riskProposal.riskClassification = risk;
    check(riskProposal, riskRequest, riskResult, true, null, `risk ${risk}`);
  }
  for (const capability of CAPABILITIES) {
    const capabilityProposal = proposalFor(request, result); capabilityProposal.requestedCapabilities = [capability];
    const decision = check(capabilityProposal, request, result, false, ["CROSS_FIELD_INCONSISTENCY"], `recognized capability ${capability}`);
    expect(!decision.rejection.reasonCodes.includes("UNKNOWN_REQUESTED_CAPABILITY"), `${capability} must be recognized by the finite authority`);
  }
  const allCapabilities = proposalFor(request, result); allCapabilities.requestedCapabilities = [...CAPABILITIES];
  check(allCapabilities, request, result, false, ["CROSS_FIELD_INCONSISTENCY"], "requested capabilities maximum");
  const tooManyCapabilities = proposalFor(request, result); tooManyCapabilities.requestedCapabilities = [...CAPABILITIES, "analytics_read"];
  check(tooManyCapabilities, request, result, false, ["UNKNOWN_REQUESTED_CAPABILITY"], "requested capabilities above maximum");
  for (const [score, band] of [[0.2, "low"], [0.5, "medium"], [1, "high"]]) {
    const confidenceRequest = baseRequest(); const confidenceResult = completedResult(confidenceRequest);
    confidenceResult.analysis.confidence.score = score; confidenceResult.analysis.confidence.band = band;
    const confidenceProposal = proposalFor(confidenceRequest, confidenceResult);
    check(confidenceProposal, confidenceRequest, confidenceResult, true, null, `confidence ${band} at ${score}`);
  }

  const textBoundaries = [
    ["diagnosis summary", 2000, "INVALID_DIAGNOSIS", (value, text) => { value.diagnosis.summary = text; }],
    ["confidence basis", 500, "INVALID_CONFIDENCE", (value, text) => { value.confidence.basis = text; }],
    ["action description", 1000, "INVALID_RECOMMENDED_ACTION", (value, text) => { value.recommendedAction.description = text; }],
    ["action rationale", 1000, "INVALID_RECOMMENDED_ACTION", (value, text) => { value.recommendedAction.rationale = text; }],
    ["alternative description", 1000, "INVALID_ALTERNATIVES", (value, text) => { value.alternatives[0].description = text; }],
    ["alternative tradeoff", 1000, "INVALID_ALTERNATIVES", (value, text) => { value.alternatives[0].tradeoff = text; }],
    ["approval reason", 500, "INVALID_APPROVAL_REQUIREMENT", (value, text) => { value.approvalRequirement.reason = text; }],
    ["verification check", 500, "INVALID_VERIFICATION_PLAN", (value, text) => { value.verificationPlan.checks = [text]; }],
    ["success criterion", 500, "INVALID_VERIFICATION_PLAN", (value, text) => { value.verificationPlan.successCriteria = [text]; }],
    ["expected summary", 1000, "INVALID_EXPECTED_OUTCOME", (value, text) => { value.expectedOutcome.summary = text; }],
    ["measurable signal", 500, "INVALID_EXPECTED_OUTCOME", (value, text) => { value.expectedOutcome.measurableSignals = [text]; }],
    ["observation window", 200, "INVALID_EXPECTED_OUTCOME", (value, text) => { value.expectedOutcome.observationWindow = text; }]
  ];
  for (const [label, maximum, reason, mutate] of textBoundaries) {
    for (const [textValue, bound] of [["x", "minimum"], ["x".repeat(maximum), "maximum"], ["😀".repeat(maximum), "Unicode maximum"]]) {
      const candidate = proposalFor(request, result); mutate(candidate, textValue);
      check(candidate, request, result, true, null, `${label} ${bound}`);
    }
    for (const [textValue, bound] of [["", "below minimum"], ["x".repeat(maximum + 1), "above maximum"], [" x", "untrimmed"], ["x\u0000", "control character"]]) {
      const candidate = proposalFor(request, result); mutate(candidate, textValue);
      check(candidate, request, result, false, [reason], `${label} ${bound}`);
    }
  }

  for (const [count, ok, label] of [[0, true, "minimum"], [5, true, "maximum"], [6, false, "above maximum"]]) {
    const candidate = proposalFor(request, result);
    candidate.alternatives = Array.from({ length: count }, (_, index) => ({ alternativeId: `alternative-${index}`, description: `Alternative ${index}.`, tradeoff: `Tradeoff ${index}.` }));
    check(candidate, request, result, ok, ok ? null : ["INVALID_ALTERNATIVES"], `alternatives ${label}`);
  }
  for (const [field, reason] of [["checks", "INVALID_VERIFICATION_PLAN"], ["successCriteria", "INVALID_VERIFICATION_PLAN"]]) {
    for (const [count, ok, label] of [[1, true, "minimum"], [10, true, "maximum"], [0, false, "below minimum"], [11, false, "above maximum"]]) {
      const candidate = proposalFor(request, result); candidate.verificationPlan[field] = Array.from({ length: count }, (_, index) => `${field} ${index}.`);
      check(candidate, request, result, ok, ok ? null : [reason], `${field} collection ${label}`);
    }
  }
  for (const [count, ok, label] of [[1, true, "minimum"], [10, true, "maximum"], [0, false, "below minimum"], [11, false, "above maximum"]]) {
    const candidate = proposalFor(request, result); candidate.expectedOutcome.measurableSignals = Array.from({ length: count }, (_, index) => `Signal ${index}.`);
    check(candidate, request, result, ok, ok ? null : ["INVALID_EXPECTED_OUTCOME"], `measurableSignals ${label}`);
  }
  const draftRequest = baseRequest(); const draftResult = completedResult(draftRequest, "prepare_draft");
  for (const [count, ok, label] of [[1, true, "minimum"], [10, true, "maximum"], [0, false, "below minimum"], [11, false, "above maximum"]]) {
    const candidate = proposalFor(draftRequest, draftResult); candidate.rollbackPlan.steps = Array.from({ length: count }, (_, index) => `Rollback step ${index}.`);
    check(candidate, draftRequest, draftResult, ok, ok ? null : [count === 0 ? "CROSS_FIELD_INCONSISTENCY" : "INVALID_ROLLBACK_PLAN"], `rollback steps ${label}`);
  }
  for (const [textValue, ok, reasons, label] of [["x", true, null, "minimum"], ["x".repeat(500), true, null, "maximum"], ["", false, ["INVALID_ROLLBACK_PLAN"], "below minimum"], ["x".repeat(501), false, ["INVALID_ROLLBACK_PLAN"], "above maximum"]]) {
    const candidate = proposalFor(draftRequest, draftResult); candidate.rollbackPlan.trigger = textValue;
    check(candidate, draftRequest, draftResult, ok, reasons, `rollback trigger ${label}`);
  }

  const maximumSystemsRequest = baseRequest();
  maximumSystemsRequest.allowedContext.affectedSystems = Array.from({ length: 20 }, (_, index) => `system-${String(index).padStart(2, "0")}`);
  const maximumSystemsResult = completedResult(maximumSystemsRequest);
  const maximumSystemsProposal = proposalFor(maximumSystemsRequest, maximumSystemsResult);
  maximumSystemsProposal.affectedSystems = [...maximumSystemsRequest.allowedContext.affectedSystems];
  check(maximumSystemsProposal, maximumSystemsRequest, maximumSystemsResult, true, null, "affected systems maximum");
  const noSystems = proposalFor(request, result); noSystems.affectedSystems = [];
  check(noSystems, request, result, false, ["INVALID_AFFECTED_SYSTEMS"], "affected systems below minimum");
  const tooManySystems = proposalFor(maximumSystemsRequest, maximumSystemsResult); tooManySystems.affectedSystems = [...maximumSystemsRequest.allowedContext.affectedSystems, "system-20"];
  check(tooManySystems, maximumSystemsRequest, maximumSystemsResult, false, ["INVALID_AFFECTED_SYSTEMS"], "affected systems above maximum");

  const maximumSourceRequest = baseRequest(); maximumSourceRequest.allowedContext.maxHypotheses = 5;
  const maximumSourceResult = completedResult(maximumSourceRequest);
  maximumSourceResult.analysis.likelyCauses = Array.from({ length: 5 }, (_, index) => ({
    causeId: `cause-${index}`, statement: `Cause ${index}.`, supportingEvidenceIds: ["analytics-a"], counterEvidenceIds: []
  }));
  maximumSourceResult.analysis.rankedHypotheses = Array.from({ length: 5 }, (_, index) => ({
    hypothesisId: `hypothesis-${index}`, rank: index + 1, statement: `Hypothesis ${index}.`, supportingEvidenceIds: ["analytics-a"], counterEvidenceIds: [], confidenceScore: 0.7 - index * 0.1
  }));
  maximumSourceResult.analysis.selectedIntervention.supportingHypothesisIds = ["hypothesis-0"];
  const maximumSourceProposal = proposalFor(maximumSourceRequest, maximumSourceResult);
  maximumSourceProposal.diagnosis.causeIds = maximumSourceResult.analysis.likelyCauses.map((item) => item.causeId);
  maximumSourceProposal.diagnosis.hypothesisIds = maximumSourceResult.analysis.rankedHypotheses.map((item) => item.hypothesisId);
  check(maximumSourceProposal, maximumSourceRequest, maximumSourceResult, true, null, "cause and hypothesis maximum");
  const tooManyDiagnosis = proposalFor(request, result); tooManyDiagnosis.diagnosis.causeIds = Array.from({ length: 6 }, (_, index) => `cause-${index}`);
  check(tooManyDiagnosis, request, result, false, ["INVALID_DIAGNOSIS"], "diagnosis identifiers above maximum");

  const maximumEvidenceRequest = baseRequest();
  for (let index = 2; index < 20; index += 1) maximumEvidenceRequest.preparedEvidence.push({
    evidenceId: `evidence-${String(index).padStart(2, "0")}`, kind: "technical_artifact", dataClassification: "public",
    summary: `Prepared evidence ${index}.`, facts: [`Bounded fact ${index}.`], integritySha256: index.toString(16).padStart(64, "0")
  });
  const maximumEvidenceResult = completedResult(maximumEvidenceRequest);
  maximumEvidenceResult.analysis.evidenceCitations = maximumEvidenceRequest.preparedEvidence.map((item) => item.evidenceId);
  maximumEvidenceResult.analysis.confidence.evidenceIds = [...maximumEvidenceResult.analysis.evidenceCitations];
  const maximumEvidenceProposal = proposalFor(maximumEvidenceRequest, maximumEvidenceResult);
  check(maximumEvidenceProposal, maximumEvidenceRequest, maximumEvidenceResult, true, null, "evidence references maximum");
  const tooManyEvidence = proposalFor(maximumEvidenceRequest, maximumEvidenceResult); tooManyEvidence.evidenceReferences.push("evidence-20");
  check(tooManyEvidence, maximumEvidenceRequest, maximumEvidenceResult, false, ["INVALID_EVIDENCE_REFERENCES"], "evidence references above maximum");
  const zeroEvidenceResult = insufficientResult(insufficientRequest); zeroEvidenceResult.analysis.evidenceCitations = []; zeroEvidenceResult.analysis.confidence.evidenceIds = [];
  check(proposalFor(insufficientRequest, zeroEvidenceResult), insufficientRequest, zeroEvidenceResult, true, null, "evidence references minimum");

  const maximumAlternativeIdentifier = proposalFor(request, result); maximumAlternativeIdentifier.alternatives[0].alternativeId = `a${"b".repeat(63)}`;
  check(maximumAlternativeIdentifier, request, result, true, null, "alternative identifier maximum");
  const oversizedAlternativeIdentifier = proposalFor(request, result); oversizedAlternativeIdentifier.alternatives[0].alternativeId = `a${"b".repeat(64)}`;
  check(oversizedAlternativeIdentifier, request, result, false, ["INVALID_ALTERNATIVES"], "alternative identifier above maximum");

  for (const [field, minimum, maximum, below, above] of [
    ["proposalId", "A", `A${"b".repeat(127)}`, "", `A${"b".repeat(128)}`],
    ["taskId", "ABC", `A${"B".repeat(80)}`, "AB", `A${"B".repeat(81)}`]
  ]) {
    for (const [value, label] of [[minimum, "minimum"], [maximum, "maximum"]]) {
      const candidate = proposalFor(request, result); candidate[field] = value;
      if (field === "taskId") { const alignedRequest = baseRequest(); alignedRequest.taskId = value; const alignedResult = completedResult(alignedRequest); candidate.sourceIntelligence.requestId = alignedRequest.requestId; check(candidate, alignedRequest, alignedResult, true, null, `${field} ${label}`); }
      else check(candidate, request, result, true, null, `${field} ${label}`);
    }
    for (const [value, label] of [[below, "below minimum"], [above, "above maximum"]]) {
      const candidate = proposalFor(request, result); candidate[field] = value;
      check(candidate, request, result, false, ["MALFORMED_PROPOSAL"], `${field} ${label}`);
    }
  }

  const malformedCases = [
    [null, "null root"], [[], "array root"], ["proposal", "string root"], [{}, "empty root"],
    [{ ...proposalFor(request, result), unknown: true }, "unknown root property"],
    [(() => { const value = proposalFor(request, result); delete value.outcome; return value; })(), "missing property"],
    [(() => { const value = proposalFor(request, result); value.confidence = []; return value; })(), "wrong nested container"],
    [(() => { const value = proposalFor(request, result); value.confidence.extra = true; return value; })(), "unknown nested property"],
    [(() => { const value = proposalFor(request, result); value.confidence.score = NaN; return value; })(), "non-finite number"],
    [(() => { const value = proposalFor(request, result); value.outcome = 1; return value; })(), "wrong primitive type"]
  ];
  for (const [candidate, label] of malformedCases) check(candidate, request, result, false, ["MALFORMED_PROPOSAL"], label);

  const unsupportedVersion = proposalFor(request, result); unsupportedVersion.schemaVersion = "2.0.0";
  check(unsupportedVersion, request, result, false, ["UNSUPPORTED_SCHEMA_VERSION"], "unsupported version");
  const unsupportedVersionWithFieldDefect = proposalFor(request, result); unsupportedVersionWithFieldDefect.schemaVersion = "2.0.0"; unsupportedVersionWithFieldDefect.diagnosis.summary = "";
  check(unsupportedVersionWithFieldDefect, request, result, false, ["UNSUPPORTED_SCHEMA_VERSION"], "version precedence over field defects");

  const fieldCases = [
    ["UNSUPPORTED_OUTCOME", (value) => { value.outcome = "deploy"; }],
    ["INVALID_DIAGNOSIS", (value) => { value.diagnosis.summary = ""; }],
    ["INVALID_EVIDENCE_REFERENCES", (value) => { value.evidenceReferences = ["analytics-a", "analytics-a"]; }],
    ["INVALID_CONFIDENCE", (value) => { value.confidence.score = 2; }],
    ["INVALID_RECOMMENDED_ACTION", (value) => { value.recommendedAction.description = "\u0000"; }],
    ["INVALID_ALTERNATIVES", (value) => { value.alternatives.push(copy(value.alternatives[0])); }],
    ["INVALID_AFFECTED_SYSTEMS", (value) => { value.affectedSystems.reverse(); }],
    ["UNKNOWN_REQUESTED_CAPABILITY", (value) => { value.requestedCapabilities = ["production_write"]; }],
    ["UNSUPPORTED_RISK_CLASSIFICATION", (value) => { value.riskClassification = "unbounded"; }],
    ["INVALID_APPROVAL_REQUIREMENT", (value) => { value.approvalRequirement.approvalClass = "none"; }],
    ["INVALID_VERIFICATION_PLAN", (value) => { value.verificationPlan.independentReviewRequired = false; }],
    ["INVALID_ROLLBACK_PLAN", (value) => { value.rollbackPlan.steps = [""]; }],
    ["INVALID_EXPECTED_OUTCOME", (value) => { value.expectedOutcome.measurableSignals = []; }]
  ];
  for (const [reason, mutate] of fieldCases) {
    const candidate = proposalFor(request, result); mutate(candidate);
    check(candidate, request, result, false, [reason], reason);
  }
  const combinedFields = proposalFor(request, result);
  combinedFields.outcome = "deploy"; combinedFields.diagnosis.summary = ""; combinedFields.confidence.score = 2; combinedFields.expectedOutcome.measurableSignals = [];
  check(combinedFields, request, result, false, ["UNSUPPORTED_OUTCOME", "INVALID_DIAGNOSIS", "INVALID_CONFIDENCE", "INVALID_EXPECTED_OUTCOME"], "field reason precedence");
  const structuralBeforeAuthority = proposalFor(request, result); structuralBeforeAuthority.diagnosis.summary = ""; structuralBeforeAuthority.authority.approved = true;
  check(structuralBeforeAuthority, request, result, false, ["INVALID_DIAGNOSIS"], "structural pass suppresses authority claim");

  for (const [label, mutate] of [
    ["execution authorized", (value) => { value.recommendedAction.executionAuthorized = true; }],
    ["self approved", (value) => { value.authority.approved = true; }],
    ["self authorized", (value) => { value.authority.authorized = true; }],
    ["already executed", (value) => { value.authority.executed = true; }],
    ["already verified", (value) => { value.authority.independentlyVerified = true; }],
    ["production eligible", (value) => { value.authority.productionEligible = true; }],
    ["authoritative claim", (value) => { value.authority.nonAuthoritative = false; }]
  ]) {
    const candidate = proposalFor(request, result); mutate(candidate);
    check(candidate, request, result, false, ["SELF_AUTHORIZATION_CLAIM"], label);
  }

  for (const [label, mutate] of [
    ["task mismatch", (value) => { value.taskId = "SUT-AIOS-P2-999"; }],
    ["request mismatch", (value) => { value.sourceIntelligence.requestId = "request:other"; }],
    ["status mismatch", (value) => { value.sourceIntelligence.status = "insufficient_evidence"; }],
    ["citation order mismatch", (value) => { value.evidenceReferences.reverse(); }],
    ["unknown cause", (value) => { value.diagnosis.causeIds = ["unknown-cause"]; }],
    ["cause order mismatch", (value) => { value.diagnosis.causeIds.reverse(); }],
    ["unknown hypothesis", (value) => { value.diagnosis.hypothesisIds = ["unknown-hypothesis"]; }],
    ["missing completed hypothesis", (value) => { value.diagnosis.hypothesisIds = []; }],
    ["raised confidence", (value) => { value.confidence.score = 0.9; value.confidence.band = "high"; }],
    ["relabelled confidence", (value) => { value.confidence.band = "high"; }],
    ["unknown affected system", (value) => { value.affectedSystems = ["database"]; }]
  ]) {
    const candidate = proposalFor(request, result); mutate(candidate);
    check(candidate, request, result, false, ["INVALID_PROVENANCE"], label);
  }
  const insufficientWithCause = proposalFor(insufficientRequest, insufficient); insufficientWithCause.diagnosis.causeIds = ["deployment-timing"];
  check(insufficientWithCause, insufficientRequest, insufficient, false, ["INVALID_PROVENANCE"], "insufficient evidence cause claim");

  for (const [label, mutate] of [
    ["outcome relabelling", (value) => { value.outcome = "prepare_draft"; value.recommendedAction.kind = "prepare_draft"; value.requestedCapabilities = ["repository_read"]; value.rollbackPlan = { required: true, trigger: "Failure.", steps: ["Discard."] }; }],
    ["action kind mismatch", (value) => { value.recommendedAction.kind = "prepare_draft"; }],
    ["capability on recommendation", (value) => { value.requestedCapabilities = ["repository_read"]; }],
    ["missing human review", (value) => { value.approvalRequirement = { required: false, approvalClass: "none", reason: "Incorrectly waived." }; }],
    ["rollback on recommendation", (value) => { value.rollbackPlan = { required: true, trigger: "Failure.", steps: ["Discard."] }; }],
    ["critical non-escalation", (value) => { value.riskClassification = "critical"; }]
  ]) {
    const candidate = proposalFor(request, result); mutate(candidate);
    check(candidate, request, result, false, ["CROSS_FIELD_INCONSISTENCY"], label);
  }
  const branchRequest = baseRequest(); const branchResult = completedResult(branchRequest, "prepare_branch_or_pr");
  for (const [label, mutate] of [
    ["missing branch capability", (value) => { value.requestedCapabilities.pop(); }],
    ["misordered branch capabilities", (value) => { [value.requestedCapabilities[0], value.requestedCapabilities[1]] = [value.requestedCapabilities[1], value.requestedCapabilities[0]]; }],
    ["missing branch rollback", (value) => { value.rollbackPlan = { required: false, trigger: null, steps: [] }; }]
  ]) {
    const candidate = proposalFor(branchRequest, branchResult); mutate(candidate);
    const reason = label === "misordered branch capabilities" ? "UNKNOWN_REQUESTED_CAPABILITY" : "CROSS_FIELD_INCONSISTENCY";
    check(candidate, branchRequest, branchResult, false, [reason], label);
  }

  const unavailable = {
    schemaVersion: "1.0.0", status: "provider_unavailable", requestId: request.requestId, providerState: "busy",
    providerIdentity: null, nonAuthoritative: true, failClosed: true, analysis: null, reasonCodes: ["PROVIDER_BUSY"]
  };
  check(proposalFor(request, result), request, unavailable, false, ["INVALID_SOURCE_INTELLIGENCE"], "provider unavailable source");
  const invalidRequest = baseRequest(); invalidRequest.dataClassification = "restricted";
  check({}, invalidRequest, result, false, ["INVALID_SOURCE_INTELLIGENCE"], "invalid request source precedence");
  const invalidResult = completedResult(request); invalidResult.status = "rejected";
  check({}, request, invalidResult, false, ["INVALID_SOURCE_INTELLIGENCE"], "invalid result source precedence");

  const weakenedDependencies = {
    validateProposalSchema: () => true,
    validateIntelligenceRequest: () => ({ ok: true, value: request, rejection: null }),
    validateIntelligenceResult: () => ({ ok: true, value: result, rejection: null })
  };
  const authorityAttack = proposalFor(request, result); authorityAttack.authority.approved = true;
  check(authorityAttack, request, result, false, ["SELF_AUTHORIZATION_CLAIM"], "caller authority injection ignored", weakenedDependencies);

  const cyclic = proposalFor(request, result); cyclic.self = cyclic;
  check(cyclic, request, result, false, ["MALFORMED_PROPOSAL"], "cyclic proposal");
  const accessor = proposalFor(request, result); Object.defineProperty(accessor, "outcome", { enumerable: true, get() { throw new Error("accessor read"); } });
  check(accessor, request, result, false, ["MALFORMED_PROPOSAL"], "throwing accessor");
  const symbolValue = proposalFor(request, result); symbolValue[Symbol("authority")] = true;
  check(symbolValue, request, result, false, ["MALFORMED_PROPOSAL"], "symbol property");
  for (const [value, label] of [[1n, "bigint"], [() => true, "function"], [Symbol("x"), "symbol"], [new Date(), "non-plain object"]]) {
    const candidate = proposalFor(request, result); candidate.diagnosis.summary = value;
    check(candidate, request, result, false, ["MALFORMED_PROPOSAL"], label);
  }
  const throwingProxy = new Proxy({}, { getPrototypeOf() { throw new Error("proxy trap"); } });
  check(throwingProxy, request, result, false, ["MALFORMED_PROPOSAL"], "throwing proxy");
  const sourceProxy = new Proxy({}, { getPrototypeOf() { throw new Error("source proxy trap"); } });
  check({}, sourceProxy, result, false, ["INVALID_SOURCE_INTELLIGENCE"], "hostile source never throws");

  const deterministicA = check(proposalFor(request, result), request, result, true, null, "determinism A");
  const reordered = proposalFor(request, result);
  const reorderedRoot = Object.fromEntries(Object.entries(reordered).reverse());
  const deterministicB = check(reorderedRoot, copy(request), copy(result), true, null, "determinism B");
  expect(JSON.stringify(stable(deterministicA)) === JSON.stringify(stable(deterministicB)), "equivalent plain data must produce deterministic decisions independent of object-key order");

  const unavailableRoot = await mkdtemp(path.join(tmpdir(), "sut-ai-os-p2-004-unavailable-"));
  try {
    const isolatedModulePath = path.join(unavailableRoot, "packages/intervention-proposal-contracts/src/intervention-proposal-contract-v1.mjs");
    await mkdir(path.dirname(isolatedModulePath), { recursive: true });
    await copyFile(modulePath, isolatedModulePath);
    const isolatedModule = await import(`${pathToFileURL(isolatedModulePath).href}?unavailable=${Date.now()}`);
    const decision = isolatedModule.validateInterventionProposal({}, {}, {});
    expect(JSON.stringify(decision.rejection.reasonCodes) === '["INTERNAL_AUTHORITY_UNAVAILABLE"]', "missing committed authority must fail closed with the exclusive internal reason");
    assertFrozen(decision, "unavailable authority decision");
    testsRun += 1;
  } finally {
    await rm(unavailableRoot, { recursive: true, force: true });
  }

  console.log(`P2-004 intervention proposal contract validation passed (${testsRun} focused cases).`);
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
