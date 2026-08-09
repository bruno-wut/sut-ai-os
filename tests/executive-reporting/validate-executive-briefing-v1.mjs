import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { calculateMetricComparison } from "../../packages/analytics-sdk/src/deterministic-analytics-calculators-v1.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const modulePath = path.join(root, "services/executive-briefing/src/generate-executive-briefing-v1.mjs");
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const copy = (value) => JSON.parse(JSON.stringify(value));
const stable = (value) => Array.isArray(value) ? `[${value.map(stable).join(",")}]` : value !== null && typeof value === "object" ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}` : JSON.stringify(value);
function assertFrozen(value, label) {
  expect(Object.isFrozen(value), `${label} must be frozen`);
  if (value && typeof value === "object") Object.values(value).forEach((child) => assertFrozen(child, label));
}

const metricRequest = () => ({
  metricId: "event-count", segmentId: "direct-booking", aggregation: "sum",
  currentPeriod: { start: "2026-08-03", end: "2026-08-09" }, baselinePeriod: { start: "2026-07-27", end: "2026-08-02" },
  currentObservations: [10, 11, 12], baselineObservations: [8, 9, 10],
  context: { anomalyDurationDays: 0, correlatedDeploymentIds: [], correlatedCampaignIds: [], seasonalityStatus: "not-evaluated" }
});
const intelligenceRequest = (allowedInterventions = ["no_action", "prepare_recommendation"]) => ({
  schemaVersion: "1.0.0", requestId: "briefing-analysis-1", taskId: "SUT-AIOS-P2-003", purpose: "operational",
  analysisQuestion: "Summarize the approved aggregate movement.", dataClassification: "internal",
  analysisObjectives: ["explain_likely_causes", "rank_hypotheses", "select_intervention", "estimate_confidence"],
  preparedEvidence: [{ evidenceId: "metric-summary", kind: "deterministic_analytics", dataClassification: "internal", summary: "Approved aggregate comparison.", facts: ["Current aggregate exceeds baseline aggregate."], integritySha256: "a".repeat(64) }],
  allowedContext: { affectedSystems: ["reporting"], metricIds: ["event-count"], locale: "en", maxHypotheses: 1, allowedInterventions }
});
const completedResult = (request, kind = "no_action") => ({
  schemaVersion: "1.0.0", status: "completed", requestId: request.requestId, providerState: "available",
  providerIdentity: { providerId: "fixture-provider", modelId: "fixture-model" }, nonAuthoritative: true, failClosed: false,
  analysis: {
    explanation: "The approved aggregate has increased.",
    likelyCauses: [{ causeId: "aggregate-movement", statement: "The deterministic aggregate increased.", supportingEvidenceIds: ["metric-summary"], counterEvidenceIds: [] }],
    rankedHypotheses: [{ hypothesisId: "monitor-movement", rank: 1, statement: "Continue observation until more evidence is available.", supportingEvidenceIds: ["metric-summary"], counterEvidenceIds: [], confidenceScore: 0.4 }],
    selectedIntervention: { kind, rationale: "The evidence supports an observe-only next step.", supportingHypothesisIds: ["monitor-movement"] },
    confidence: { score: 0.4, band: "low", basis: "One approved aggregate source is available.", evidenceIds: ["metric-summary"] },
    evidenceCitations: ["metric-summary"], additionalEvidenceNeeded: []
  }, reasonCodes: []
});
const unavailableResult = (request) => ({ schemaVersion: "1.0.0", status: "provider_unavailable", requestId: request.requestId, providerState: "temporarily_unavailable", providerIdentity: null, nonAuthoritative: true, failClosed: true, analysis: null, reasonCodes: ["PROVIDER_TEMPORARILY_UNAVAILABLE"] });
const insufficientResult = (request) => ({ schemaVersion: "1.0.0", status: "insufficient_evidence", requestId: request.requestId, providerState: "available", providerIdentity: { providerId: "fixture-provider", modelId: "fixture-model" }, nonAuthoritative: true, failClosed: true, analysis: { explanation: "More approved evidence is required.", likelyCauses: [], rankedHypotheses: [], selectedIntervention: { kind: "gather_more_evidence", rationale: "The record is insufficient.", supportingHypothesisIds: [] }, confidence: { score: 0, band: "insufficient", basis: "No conclusion is supported.", evidenceIds: [] }, evidenceCitations: [], additionalEvidenceNeeded: ["An additional approved aggregate is required."] }, reasonCodes: ["INSUFFICIENT_EVIDENCE"] });
const proposalFor = (request, result, kind = "no_action") => ({
  schemaVersion: "1.0.0", proposalId: "briefing-proposal-1", taskId: request.taskId, sourceIntelligence: { requestId: request.requestId, status: result.status }, outcome: kind,
  diagnosis: { summary: "The aggregate evidence supports observation.", causeIds: kind === "gather_more_evidence" ? [] : ["aggregate-movement"], hypothesisIds: kind === "gather_more_evidence" ? [] : ["monitor-movement"] },
  evidenceReferences: kind === "gather_more_evidence" ? [] : ["metric-summary"], confidence: kind === "gather_more_evidence" ? { score: 0, band: "insufficient", basis: "No conclusion is supported." } : { score: 0.4, band: "low", basis: "One approved aggregate source is available." },
  recommendedAction: { kind, description: "Keep this item in observe-only reporting.", rationale: "No authority is granted by this proposal.", executionAuthorized: false }, alternatives: [], affectedSystems: ["reporting"], requestedCapabilities: [], riskClassification: "low",
  approvalRequirement: kind === "recommendation" ? { required: true, approvalClass: "human_review", reason: "Management review is required." } : { required: false, approvalClass: "none", reason: "No action is proposed." },
  verificationPlan: { independentReviewRequired: true, checks: ["Inspect approved aggregates."], successCriteria: ["No action is performed."] }, rollbackPlan: { required: false, trigger: null, steps: [] }, expectedOutcome: { summary: "Management receives a bounded briefing.", measurableSignals: ["Briefing remains observe-only."], observationWindow: "next briefing period" },
  authority: { nonAuthoritative: true, approved: false, authorized: false, executed: false, independentlyVerified: false, productionEligible: false }
});
const briefing = () => {
  const metric = metricRequest(); const request = intelligenceRequest(); const result = completedResult(request);
  return { schemaVersion: "1.0.0", briefingId: "briefing-2026-08-09", briefingPeriod: { start: "2026-08-03", end: "2026-08-09" }, metrics: [{ request: metric, result: calculateMetricComparison(metric) }], intelligence: [{ request, result }], proposals: [{ proposal: proposalFor(request, result), intelligenceRequest: request, intelligenceResult: result }] };
};

const source = await readFile(modulePath, "utf8");
expect(!/(?:from|import\s*\()[^\n]*(?:node:fs|node:http|node:https|child_process|cloudflare|supabase|openai|line|resend|database|queue|workflow|scheduler|policy|approval|executor|notification)/i.test(source), "briefing core must not import infrastructure or authority providers");
const { generateExecutiveBriefing } = await import(`${pathToFileURL(modulePath).href}?validator=${Date.now()}`);
expect(JSON.stringify(Object.keys(await import(pathToFileURL(modulePath).href))) === '["generateExecutiveBriefing"]', "briefing module must expose exactly one public function");
let cases = 0;
const check = (input, ok, reasons, label) => {
  let decision;
  try { decision = generateExecutiveBriefing(input); } catch (error) { throw new Error(`${label} threw: ${error.message}`); }
  cases += 1; assertFrozen(decision, label); expect(decision.ok === ok, `${label} unexpected decision: ${JSON.stringify(decision.rejection)}`);
  expect(stable(decision.rejection?.reasonCodes ?? null) === stable(reasons), `${label} unexpected reasons`);
  return decision;
};

const canonical = briefing();
const accepted = check(canonical, true, null, "canonical observe-only briefing");
expect(accepted.value.status === "complete", "canonical briefing must be complete");
expect(accepted.value.mode === "observe-only" && accepted.value.actionAuthority === "none" && accepted.value.productionWritePermission === false, "canonical briefing must stay non-authoritative");
expect(stable(accepted.value.sections.deterministicMetrics[0].currentPeriod) === stable(canonical.metrics[0].result.currentPeriod), "briefing must retain validated metric result");

const recommendation = briefing(); recommendation.intelligence[0].request.allowedContext.allowedInterventions = ["no_action", "prepare_recommendation"]; recommendation.intelligence[0].result = completedResult(recommendation.intelligence[0].request, "prepare_recommendation"); recommendation.proposals[0].intelligenceRequest = recommendation.intelligence[0].request; recommendation.proposals[0].intelligenceResult = recommendation.intelligence[0].result; recommendation.proposals[0].proposal = proposalFor(recommendation.intelligence[0].request, recommendation.intelligence[0].result, "recommendation");
const approvalDecision = check(recommendation, true, null, "approval-required proposal");
expect(approvalDecision.value.status === "limited" && stable(approvalDecision.value.pendingApprovalProposalIds) === '["briefing-proposal-1"]' && approvalDecision.value.reasonCodes.includes("APPROVAL_REQUIRED"), "approval must be surfaced without authorization");

const unavailable = briefing(); unavailable.intelligence[0].result = unavailableResult(unavailable.intelligence[0].request); unavailable.proposals = [];
const unavailableDecision = check(unavailable, true, null, "provider unavailable");
expect(unavailableDecision.value.reasonCodes.includes("PROVIDER_UNAVAILABLE"), "provider unavailability must remain visible");

const insufficient = briefing(); insufficient.intelligence[0].request.allowedContext.allowedInterventions = ["gather_more_evidence"]; insufficient.intelligence[0].result = insufficientResult(insufficient.intelligence[0].request); insufficient.proposals[0].intelligenceRequest = insufficient.intelligence[0].request; insufficient.proposals[0].intelligenceResult = insufficient.intelligence[0].result; insufficient.proposals[0].proposal = proposalFor(insufficient.intelligence[0].request, insufficient.intelligence[0].result, "gather_more_evidence");
const insufficientDecision = check(insufficient, true, null, "insufficient evidence");
expect(insufficientDecision.value.reasonCodes.includes("INSUFFICIENT_EVIDENCE"), "insufficient evidence must remain visible");

const raw = briefing(); raw.rawGuestInteractions = [];
check(raw, false, ["RAW_TELEMETRY_REJECTED"], "raw guest telemetry");
const perEvent = briefing(); perEvent.metrics[0].request.perEventTelemetry = [1];
check(perEvent, false, ["RAW_TELEMETRY_REJECTED"], "per-event metric telemetry");
const invalidMetric = briefing(); invalidMetric.metrics[0].result = copy(invalidMetric.metrics[0].result); invalidMetric.metrics[0].result.currentValue = 999;
check(invalidMetric, false, ["INVALID_DETERMINISTIC_METRIC"], "tampered metric result");
const invalidIntelligence = briefing(); invalidIntelligence.intelligence[0].result.status = "rejected";
check(invalidIntelligence, false, ["INVALID_STRUCTURED_INTELLIGENCE"], "rejected intelligence source");
const invalidProposal = briefing(); invalidProposal.proposals[0].proposal.authority.approved = true;
check(invalidProposal, false, ["INVALID_INTERVENTION_PROPOSAL"], "self-approval proposal");
const unsupported = briefing(); unsupported.schemaVersion = "2.0.0";
check(unsupported, false, ["UNSUPPORTED_SCHEMA_VERSION"], "unsupported briefing schema");
const malformed = briefing(); malformed.unexpected = true;
check(malformed, false, ["MALFORMED_BRIEFING_REQUEST"], "unknown request field");
const cyclic = briefing(); cyclic.self = cyclic;
check(cyclic, false, ["MALFORMED_BRIEFING_REQUEST"], "cyclic hostile input");
const accessor = briefing(); Object.defineProperty(accessor, "briefingId", { enumerable: true, get() { throw new Error("accessor"); } });
check(accessor, false, ["MALFORMED_BRIEFING_REQUEST"], "accessor hostile input");
const proxy = new Proxy({}, { getPrototypeOf() { throw new Error("proxy"); } });
check(proxy, false, ["MALFORMED_BRIEFING_REQUEST"], "proxy hostile input");
const noRecords = { schemaVersion: "1.0.0", briefingId: "empty-briefing", briefingPeriod: { start: "2026-08-03", end: "2026-08-09" }, metrics: [], intelligence: [], proposals: [] };
const empty = check(noRecords, true, null, "empty governed record set");
expect(stable(empty.value.reasonCodes) === stable(["NO_VALIDATED_METRICS", "NO_STRUCTURED_INTELLIGENCE", "NO_GOVERNED_PROPOSALS"]), "absence must be reported as limited evidence");
const deterministicA = check(briefing(), true, null, "deterministic A");
const reordered = Object.fromEntries(Object.entries(copy(canonical)).reverse());
const deterministicB = check(reordered, true, null, "deterministic B");
expect(stable(deterministicA) === stable(deterministicB), "equivalent input must be deterministic");

console.log(JSON.stringify({ validator: "executive-briefing-v1", status: "passed", cases }));
