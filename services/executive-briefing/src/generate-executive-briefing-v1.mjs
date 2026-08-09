/**
 * Tier-0 executive-briefing composition boundary.  It accepts only data that
 * can be revalidated through the committed P2 public contracts and returns an
 * inert, observe-only briefing.  It has no adapter or external dependency.
 */
import { calculateMetricComparison } from "../../../packages/analytics-sdk/src/deterministic-analytics-calculators-v1.mjs";
import { validateIntelligenceRequest, validateIntelligenceResult } from "../../../packages/ai-analysis-contracts/src/intelligence-provider-contracts-v1.mjs";
import { validateInterventionProposal } from "../../../packages/intervention-proposal-contracts/src/intervention-proposal-contract-v1.mjs";

const ROOT_FIELDS = Object.freeze(["schemaVersion", "briefingId", "briefingPeriod", "metrics", "intelligence", "proposals"]);
const METRIC_FIELDS = Object.freeze(["request", "result"]);
const INTELLIGENCE_FIELDS = Object.freeze(["request", "result"]);
const PROPOSAL_FIELDS = Object.freeze(["proposal", "intelligenceRequest", "intelligenceResult"]);
const PERIOD_FIELDS = Object.freeze(["start", "end"]);
const BRIEFING_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const RAW_TELEMETRY_KEYS = new Set(["rawGuestInteraction", "rawGuestInteractions", "rawTelemetry", "perEventTelemetry", "guestEvents"]);
const LIMITATION_ORDER = Object.freeze([
  "NO_VALIDATED_METRICS",
  "METRIC_CONFIDENCE_INSUFFICIENT",
  "NO_STRUCTURED_INTELLIGENCE",
  "INSUFFICIENT_EVIDENCE",
  "PROVIDER_UNAVAILABLE",
  "NO_GOVERNED_PROPOSALS",
  "APPROVAL_REQUIRED"
]);

function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function guardedClone(value, seen = new WeakMap(), active = new WeakSet()) {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("non-finite number");
    return value;
  }
  if (typeof value !== "object") throw new TypeError("unsafe value");
  if (active.has(value)) throw new TypeError("cyclic value");
  if (seen.has(value)) return seen.get(value);
  active.add(value);
  const prototype = Object.getPrototypeOf(value);
  if (Array.isArray(value)) {
    const clone = [];
    seen.set(value, clone);
    const keys = Reflect.ownKeys(value);
    if (keys.some((key) => key !== "length" && (!Number.isInteger(Number(key)) || Number(key) < 0 || String(Number(key)) !== key))) throw new TypeError("unsafe array key");
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new TypeError("unsafe array item");
      clone.push(guardedClone(descriptor.value, seen, active));
    }
    active.delete(value);
    return clone;
  }
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError("non-plain object");
  const clone = {};
  seen.set(value, clone);
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") throw new TypeError("symbol key");
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) throw new TypeError("unsafe object property");
    clone[key] = guardedClone(descriptor.value, seen, active);
  }
  active.delete(value);
  return clone;
}

function hasExactKeys(value, fields) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value !== null && typeof value === "object") return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function validPeriod(period) {
  return hasExactKeys(period, PERIOD_FIELDS) && validDate(period.start) && validDate(period.end) && period.start <= period.end;
}

function containsRawTelemetryKey(value) {
  if (Array.isArray(value)) return value.some(containsRawTelemetryKey);
  if (value === null || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) => RAW_TELEMETRY_KEYS.has(key) || containsRawTelemetryKey(child));
}

function denial(reasonCode) {
  return deepFreeze({
    ok: false,
    value: null,
    rejection: { schemaVersion: "1.0.0", failClosed: true, reasonCodes: [reasonCode] }
  });
}

function addLimitation(limitations, code) {
  if (!limitations.includes(code)) limitations.push(code);
}

function orderedLimitations(limitations) {
  return LIMITATION_ORDER.filter((code) => limitations.includes(code));
}

function metricSnapshot(metric) {
  const result = metric.result;
  return {
    metricId: result.metricId,
    segmentId: result.segmentId,
    aggregation: result.aggregation,
    currentPeriod: result.currentPeriod,
    baselinePeriod: result.baselinePeriod,
    status: result.status,
    currentValue: result.currentValue,
    baselineValue: result.baselineValue,
    absoluteMovement: result.absoluteMovement,
    percentageMovement: result.percentageMovement,
    confidenceBand: result.confidenceBand,
    reasonCodes: result.reasonCodes
  };
}

function intelligenceSnapshot(result) {
  const analysis = result.analysis;
  return {
    requestId: result.requestId,
    status: result.status,
    providerState: result.providerState,
    providerIdentity: result.providerIdentity,
    summary: analysis === null ? null : analysis.explanation,
    additionalEvidenceNeeded: analysis === null ? [] : analysis.additionalEvidenceNeeded,
    reasonCodes: result.reasonCodes
  };
}

function proposalSnapshot(proposal) {
  return {
    proposalId: proposal.proposalId,
    taskId: proposal.taskId,
    outcome: proposal.outcome,
    riskClassification: proposal.riskClassification,
    approvalRequired: proposal.approvalRequirement.required,
    approvalClass: proposal.approvalRequirement.approvalClass,
    recommendedAction: proposal.recommendedAction.description,
    executionAuthorized: false,
    authority: proposal.authority
  };
}

/**
 * Compose a deterministic briefing from P2-001, P2-002, and P2-004 records.
 * Invalid, raw, or authority-claiming input is rejected and this function never
 * writes, invokes a provider, schedules work, or authorizes an action.
 */
export function generateExecutiveBriefing(input) {
  try {
    const request = guardedClone(input);
    if (containsRawTelemetryKey(request)) return denial("RAW_TELEMETRY_REJECTED");
    if (!hasExactKeys(request, ROOT_FIELDS) || !Array.isArray(request.metrics) || !Array.isArray(request.intelligence) || !Array.isArray(request.proposals)) return denial("MALFORMED_BRIEFING_REQUEST");
    if (request.schemaVersion !== "1.0.0") return denial("UNSUPPORTED_SCHEMA_VERSION");
    if (typeof request.briefingId !== "string" || !BRIEFING_ID.test(request.briefingId) || !validPeriod(request.briefingPeriod)) return denial("MALFORMED_BRIEFING_REQUEST");
    if (request.metrics.length > 20 || request.intelligence.length > 20 || request.proposals.length > 20) return denial("MALFORMED_BRIEFING_REQUEST");

    const limitations = [];
    const metrics = [];
    for (const metric of request.metrics) {
      if (!hasExactKeys(metric, METRIC_FIELDS)) return denial("INVALID_DETERMINISTIC_METRIC");
      const calculated = calculateMetricComparison(metric.request);
      if (calculated.status === "invalid" || stable(calculated) !== stable(metric.result)) return denial("INVALID_DETERMINISTIC_METRIC");
      metrics.push(metricSnapshot(metric));
      if (calculated.confidenceBand === "insufficient" || calculated.status === "non-comparable") addLimitation(limitations, "METRIC_CONFIDENCE_INSUFFICIENT");
    }
    if (metrics.length === 0) addLimitation(limitations, "NO_VALIDATED_METRICS");

    const intelligence = [];
    for (const record of request.intelligence) {
      if (!hasExactKeys(record, INTELLIGENCE_FIELDS)) return denial("INVALID_STRUCTURED_INTELLIGENCE");
      const requestDecision = validateIntelligenceRequest(record.request);
      const resultDecision = validateIntelligenceResult(record.result, requestDecision.ok ? requestDecision.value : record.request);
      if (!requestDecision.ok || !resultDecision.ok || resultDecision.value.status === "rejected") return denial("INVALID_STRUCTURED_INTELLIGENCE");
      intelligence.push(intelligenceSnapshot(resultDecision.value));
      if (resultDecision.value.status === "insufficient_evidence") addLimitation(limitations, "INSUFFICIENT_EVIDENCE");
      if (resultDecision.value.status === "provider_unavailable") addLimitation(limitations, "PROVIDER_UNAVAILABLE");
    }
    if (intelligence.length === 0) addLimitation(limitations, "NO_STRUCTURED_INTELLIGENCE");

    const proposals = [];
    const pendingApprovalProposalIds = [];
    for (const record of request.proposals) {
      if (!hasExactKeys(record, PROPOSAL_FIELDS)) return denial("INVALID_INTERVENTION_PROPOSAL");
      const proposalDecision = validateInterventionProposal(record.proposal, record.intelligenceRequest, record.intelligenceResult);
      if (!proposalDecision.ok) return denial("INVALID_INTERVENTION_PROPOSAL");
      proposals.push(proposalSnapshot(proposalDecision.value));
      if (proposalDecision.value.approvalRequirement.required) pendingApprovalProposalIds.push(proposalDecision.value.proposalId);
    }
    if (proposals.length === 0) addLimitation(limitations, "NO_GOVERNED_PROPOSALS");
    if (pendingApprovalProposalIds.length > 0) addLimitation(limitations, "APPROVAL_REQUIRED");

    const reasonCodes = orderedLimitations(limitations);
    return deepFreeze({
      ok: true,
      value: {
        schemaVersion: "1.0.0",
        briefingId: request.briefingId,
        briefingPeriod: request.briefingPeriod,
        mode: "observe-only",
        status: reasonCodes.length === 0 ? "complete" : "limited",
        nonAuthoritative: true,
        productionWritePermission: false,
        actionAuthority: "none",
        sections: {
          deterministicMetrics: metrics,
          structuredIntelligence: intelligence,
          interventionProposals: proposals
        },
        pendingApprovalProposalIds,
        reasonCodes
      },
      rejection: null
    });
  } catch {
    return denial("MALFORMED_BRIEFING_REQUEST");
  }
}
