import { cp, copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requestSchemaPath = path.join(root, "schemas/intelligence-provider-request-v1.schema.json");
const resultSchemaPath = path.join(root, "schemas/intelligence-provider-result-v1.schema.json");
const modulePath = path.join(root, "packages/ai-analysis-contracts/src/intelligence-provider-contracts-v1.mjs");
const packageJsonPath = path.join(root, "package.json");
const packageLockPath = path.join(root, "package-lock.json");
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const copy = (value) => JSON.parse(JSON.stringify(value));

const OBJECTIVES = ["explain_likely_causes", "rank_hypotheses", "select_intervention", "estimate_confidence"];
const INTERVENTIONS = ["no_action", "continue_monitoring", "gather_more_evidence", "prepare_recommendation", "prepare_draft", "prepare_branch_or_pr", "escalate_to_human"];
const PROVIDER_REASONS = {
  busy: "PROVIDER_BUSY", rate_limited: "PROVIDER_RATE_LIMITED", capacity_exhausted: "PROVIDER_CAPACITY_EXHAUSTED",
  authentication_required: "PROVIDER_AUTHENTICATION_REQUIRED", temporarily_unavailable: "PROVIDER_TEMPORARILY_UNAVAILABLE", disabled: "PROVIDER_DISABLED"
};
const REJECTION_CODES = [
  "MALFORMED_REQUEST", "UNSUPPORTED_SCHEMA_VERSION", "UNSUPPORTED_DATA_CLASSIFICATION", "UNSUPPORTED_PURPOSE",
  "INVALID_PREPARED_EVIDENCE", "INVALID_ALLOWED_CONTEXT", "UNSUPPORTED_ANALYSIS_OBJECTIVES",
  "MALFORMED_PROVIDER_RESULT", "INTERNAL_AUTHORITY_UNAVAILABLE"
];

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

const rejectedResult = (request, reasonCodes) => ({
  schemaVersion: "1.0.0", status: "rejected", requestId: request.requestId, providerState: null,
  providerIdentity: null, nonAuthoritative: true, failClosed: true, analysis: null, reasonCodes
});

function requestWithEvidence(count) {
  const request = baseRequest();
  request.preparedEvidence = request.preparedEvidence.slice(0, Math.min(count, 2));
  for (let index = request.preparedEvidence.length; index < count; index += 1) {
    request.preparedEvidence.push({
      evidenceId: `evidence-${String(index).padStart(2, "0")}`, kind: "technical_artifact", dataClassification: "public",
      summary: `Prepared evidence ${index}.`, facts: [`Bounded fact ${index}.`], integritySha256: index.toString(16).padStart(64, "0")
    });
  }
  return request;
}

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

function productionDependencyNames(packageJson, packageLock) {
  expect(packageJson.dependencies?.ajv === "8.17.1", "Ajv 8.17.1 must be a pinned runtime dependency");
  expect(packageJson.devDependencies?.ajv === undefined, "Ajv must not remain development-only");
  expect(packageLock.packages?.[""]?.dependencies?.ajv === "8.17.1", "lockfile root must retain Ajv for production installs");
  expect(packageLock.packages?.[""]?.devDependencies?.ajv === undefined, "lockfile root must not classify Ajv as development-only");
  const names = new Set();
  const pending = Object.keys(packageJson.dependencies ?? {});
  while (pending.length > 0) {
    const name = pending.shift();
    if (names.has(name)) continue;
    const entry = packageLock.packages?.[`node_modules/${name}`];
    expect(entry !== undefined, `production dependency ${name} must exist in the lockfile`);
    expect(entry.dev !== true, `production dependency ${name} must not be marked development-only`);
    names.add(name);
    pending.push(...Object.keys(entry.dependencies ?? {}));
  }
  return [...names].sort();
}

async function verifyProductionOnlyRuntime(packageJson, packageLock, canonicalRequest) {
  const dependencyNames = productionDependencyNames(packageJson, packageLock);
  const productionRoot = await mkdtemp(path.join(tmpdir(), "sut-ai-os-p2-002-production-"));
  try {
    const isolatedModulePath = path.join(productionRoot, "packages/ai-analysis-contracts/src/intelligence-provider-contracts-v1.mjs");
    await mkdir(path.dirname(isolatedModulePath), { recursive: true });
    await mkdir(path.join(productionRoot, "schemas"), { recursive: true });
    await mkdir(path.join(productionRoot, "node_modules"), { recursive: true });
    await copyFile(modulePath, isolatedModulePath);
    await copyFile(requestSchemaPath, path.join(productionRoot, "schemas/intelligence-provider-request-v1.schema.json"));
    await copyFile(resultSchemaPath, path.join(productionRoot, "schemas/intelligence-provider-result-v1.schema.json"));
    for (const name of dependencyNames) {
      const destination = path.join(productionRoot, "node_modules", ...name.split("/"));
      await mkdir(path.dirname(destination), { recursive: true });
      await cp(path.join(root, "node_modules", ...name.split("/")), destination, { recursive: true });
    }
    const isolatedModule = await import(`${pathToFileURL(isolatedModulePath).href}?production=${Date.now()}`);
    const decision = isolatedModule.validateIntelligenceRequest(canonicalRequest);
    expect(decision.ok === true, "production-only dependency installation must load committed authority and validate a canonical request");
  } finally {
    await rm(productionRoot, { recursive: true, force: true });
  }
}

try {
  const [requestText, resultText, moduleText, packageText, packageLockText] = await Promise.all([
    readFile(requestSchemaPath, "utf8"), readFile(resultSchemaPath, "utf8"), readFile(modulePath, "utf8"),
    readFile(packageJsonPath, "utf8"), readFile(packageLockPath, "utf8")
  ]);
  const requestSchema = JSON.parse(requestText);
  const resultSchema = JSON.parse(resultText);
  const packageJson = JSON.parse(packageText);
  const packageLock = JSON.parse(packageLockText);
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
  await verifyProductionOnlyRuntime(packageJson, packageLock, canonicalRequest);
  testsRun += 1;
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
  expect(JSON.stringify(requestSchema.properties.analysisObjectives.prefixItems.map((item) => item.const)) === JSON.stringify(OBJECTIVES), "schema must contain every objective in exact order");

  for (const [field, validMinimum, validMaximum, invalidBelow, invalidAbove] of [
    ["requestId", "A", `A${"b".repeat(127)}`, "", `A${"b".repeat(128)}`],
    ["taskId", "ABC", `A${"B".repeat(80)}`, "AB", `A${"B".repeat(81)}`],
    ["analysisQuestion", "x", "x".repeat(1000), "", "x".repeat(1001)]
  ]) {
    for (const [value, label] of [[validMinimum, "minimum"], [validMaximum, "maximum"]]) {
      const request = baseRequest(); request[field] = value; checkRequest(request, true, null, `${field} ${label}`);
    }
    for (const [value, label] of [[invalidBelow, "below minimum"], [invalidAbove, "above maximum"]]) {
      const request = baseRequest(); request[field] = value; checkRequest(request, false, ["MALFORMED_REQUEST"], `${field} ${label}`);
    }
  }

  for (const [field, validMinimum, validMaximum, invalidBelow, invalidAbove] of [
    ["summary", "x", "x".repeat(500), "", "x".repeat(501)],
    ["facts", ["x"], ["x".repeat(500)], [""], ["x".repeat(501)]]
  ]) {
    for (const [value, label] of [[validMinimum, "minimum"], [validMaximum, "maximum"]]) {
      const request = baseRequest(); request.preparedEvidence[0][field] = value; checkRequest(request, true, null, `evidence ${field} ${label}`);
    }
    for (const [value, label] of [[invalidBelow, "below minimum"], [invalidAbove, "above maximum"]]) {
      const request = baseRequest(); request.preparedEvidence[0][field] = value; checkRequest(request, false, ["INVALID_PREPARED_EVIDENCE"], `evidence ${field} ${label}`);
    }
  }

  for (const [count, ok, reason, label] of [[1, true, null, "minimum"], [20, true, null, "maximum"], [0, false, "INVALID_PREPARED_EVIDENCE", "below minimum"], [21, false, "INVALID_PREPARED_EVIDENCE", "above maximum"]]) {
    const request = requestWithEvidence(count); checkRequest(request, ok, ok ? null : [reason], `preparedEvidence ${label}`);
  }
  for (const [count, ok, label] of [[1, true, "minimum"], [20, true, "maximum"], [0, false, "below minimum"], [21, false, "above maximum"]]) {
    const request = baseRequest(); request.preparedEvidence[0].facts = Array.from({ length: count }, (_, index) => `fact-${String(index).padStart(2, "0")}`);
    checkRequest(request, ok, ok ? null : ["INVALID_PREPARED_EVIDENCE"], `facts collection ${label}`);
  }
  for (const [count, ok, label] of [[1, true, "minimum"], [20, true, "maximum"], [0, false, "below minimum"], [21, false, "above maximum"]]) {
    const request = baseRequest(); request.allowedContext.affectedSystems = Array.from({ length: count }, (_, index) => `system-${String(index).padStart(2, "0")}`);
    checkRequest(request, ok, ok ? null : ["INVALID_ALLOWED_CONTEXT"], `affectedSystems ${label}`);
  }
  for (const [count, ok, label] of [[0, true, "minimum"], [20, true, "maximum"], [21, false, "above maximum"]]) {
    const request = baseRequest(); request.allowedContext.metricIds = Array.from({ length: count }, (_, index) => `metric-${String(index).padStart(2, "0")}`);
    checkRequest(request, ok, ok ? null : ["INVALID_ALLOWED_CONTEXT"], `metricIds ${label}`);
  }
  for (const [count, ok, label] of [[1, true, "minimum"], [7, true, "maximum"], [0, false, "below minimum"]]) {
    const request = baseRequest(); request.allowedContext.allowedInterventions = INTERVENTIONS.slice(0, count);
    checkRequest(request, ok, ok ? null : ["INVALID_ALLOWED_CONTEXT"], `allowedInterventions ${label}`);
  }
  for (const [value, ok, label] of [[1, true, "minimum"], [5, true, "maximum"], [0, false, "below minimum"], [6, false, "above maximum"]]) {
    const request = baseRequest(); request.allowedContext.maxHypotheses = value;
    checkRequest(request, ok, ok ? null : ["INVALID_ALLOWED_CONTEXT"], `maxHypotheses ${label}`);
  }
  for (const [value, ok, label] of [["a", true, "minimum"], [`a${"b".repeat(63)}`, true, "maximum"], ["", false, "below minimum"], [`a${"b".repeat(64)}`, false, "above maximum"]]) {
    const request = baseRequest(); request.preparedEvidence[0].evidenceId = value;
    checkRequest(request, ok, ok ? null : ["INVALID_PREPARED_EVIDENCE"], `evidence identifier ${label}`);
  }
  for (const [value, ok, label] of [["a".repeat(64), true, "exact length"], ["a".repeat(63), false, "below length"], ["a".repeat(65), false, "above length"], ["A".repeat(64), false, "non-lowercase hex"]]) {
    const request = baseRequest(); request.preparedEvidence[0].integritySha256 = value;
    checkRequest(request, ok, ok ? null : ["INVALID_PREPARED_EVIDENCE"], `digest ${label}`);
  }

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
    providerIdentity: null, nonAuthoritative: true, failClosed: true, analysis: null, reasonCodes: ["MALFORMED_PROVIDER_RESULT"] }, canonicalRequest, false, "MALFORMED_PROVIDER_RESULT", "provider-supplied rejected result");

  for (const intervention of INTERVENTIONS) {
    const result = completedResult(canonicalRequest); result.analysis.selectedIntervention.kind = intervention;
    checkResult(result, canonicalRequest, true, null, `selected intervention ${intervention}`);
  }
  for (const [score, band, label] of [[0, "low", "low minimum"], [0.499, "low", "low maximum"], [0.5, "medium", "medium minimum"], [0.799, "medium", "medium maximum"], [0.8, "high", "high minimum"], [1, "high", "high maximum"]]) {
    const result = completedResult(canonicalRequest); result.analysis.confidence.score = score; result.analysis.confidence.band = band;
    checkResult(result, canonicalRequest, true, null, `confidence ${label}`);
  }
  for (const [score, ok, label] of [[0, true, "minimum"], [1, true, "maximum"], [-0.001, false, "below minimum"], [1.001, false, "above maximum"]]) {
    const result = completedResult(canonicalRequest); result.analysis.rankedHypotheses[0].confidenceScore = score;
    if (ok && score === 0) result.analysis.rankedHypotheses[1].confidenceScore = 0;
    checkResult(result, canonicalRequest, ok, ok ? null : "MALFORMED_PROVIDER_RESULT", `hypothesis confidence ${label}`);
  }
  for (const reasonCode of REJECTION_CODES) {
    const result = rejectedResult(canonicalRequest, [reasonCode]);
    expect(schemaResult(result), `rejected reason ${reasonCode} remains a structurally valid trusted decision`);
    checkResult(result, canonicalRequest, false, "MALFORMED_PROVIDER_RESULT", `provider cannot supply rejected reason ${reasonCode}`);
  }
  checkResult(rejectedResult(canonicalRequest, REJECTION_CODES.slice(0, 7)), canonicalRequest, false, "MALFORMED_PROVIDER_RESULT", "provider cannot supply combined request rejection reasons");
  for (const fatalCode of ["MALFORMED_PROVIDER_RESULT", "INTERNAL_AUTHORITY_UNAVAILABLE"]) {
    const combined = rejectedResult(canonicalRequest, ["MALFORMED_REQUEST", fatalCode]);
    expect(schemaResult(combined), `${fatalCode} combination remains structurally valid for semantic rejection`);
    checkResult(combined, canonicalRequest, false, "MALFORMED_PROVIDER_RESULT", `${fatalCode} must be exclusive`);
  }

  for (const [mutate, label] of [
    [(result) => { result.providerIdentity.providerId = "x"; }, "providerId minimum"],
    [(result) => { result.providerIdentity.providerId = "x".repeat(128); }, "providerId maximum"],
    [(result) => { result.providerIdentity.modelId = "x"; }, "modelId minimum"],
    [(result) => { result.providerIdentity.modelId = "x".repeat(128); }, "modelId maximum"],
    [(result) => { result.analysis.explanation = "x"; }, "explanation minimum"],
    [(result) => { result.analysis.explanation = "x".repeat(2000); }, "explanation maximum"],
    [(result) => { result.analysis.likelyCauses[0].statement = "x"; }, "cause statement minimum"],
    [(result) => { result.analysis.likelyCauses[0].statement = "x".repeat(500); }, "cause statement maximum"],
    [(result) => { result.analysis.rankedHypotheses[0].statement = "x"; }, "hypothesis statement minimum"],
    [(result) => { result.analysis.rankedHypotheses[0].statement = "x".repeat(500); }, "hypothesis statement maximum"],
    [(result) => { result.analysis.selectedIntervention.rationale = "x"; }, "rationale minimum"],
    [(result) => { result.analysis.selectedIntervention.rationale = "x".repeat(1000); }, "rationale maximum"],
    [(result) => { result.analysis.confidence.basis = "x"; }, "confidence basis minimum"],
    [(result) => { result.analysis.confidence.basis = "x".repeat(500); }, "confidence basis maximum"]
  ]) {
    const result = completedResult(canonicalRequest); mutate(result); checkResult(result, canonicalRequest, true, null, label);
  }
  for (const [mutate, label] of [
    [(result) => { result.providerIdentity.providerId = ""; }, "providerId below minimum"],
    [(result) => { result.providerIdentity.providerId = "x".repeat(129); }, "providerId above maximum"],
    [(result) => { result.providerIdentity.modelId = ""; }, "modelId below minimum"],
    [(result) => { result.providerIdentity.modelId = "x".repeat(129); }, "modelId above maximum"],
    [(result) => { result.analysis.explanation = ""; }, "explanation below minimum"],
    [(result) => { result.analysis.explanation = "x".repeat(2001); }, "explanation above maximum"],
    [(result) => { result.analysis.likelyCauses[0].statement = ""; }, "cause statement below minimum"],
    [(result) => { result.analysis.likelyCauses[0].statement = "x".repeat(501); }, "cause statement above maximum"],
    [(result) => { result.analysis.rankedHypotheses[0].statement = ""; }, "hypothesis statement below minimum"],
    [(result) => { result.analysis.rankedHypotheses[0].statement = "x".repeat(501); }, "hypothesis statement above maximum"],
    [(result) => { result.analysis.selectedIntervention.rationale = ""; }, "rationale below minimum"],
    [(result) => { result.analysis.selectedIntervention.rationale = "x".repeat(1001); }, "rationale above maximum"],
    [(result) => { result.analysis.confidence.basis = ""; }, "confidence basis below minimum"],
    [(result) => { result.analysis.confidence.basis = "x".repeat(501); }, "confidence basis above maximum"]
  ]) {
    const result = completedResult(canonicalRequest); mutate(result); checkResult(result, canonicalRequest, false, "MALFORMED_PROVIDER_RESULT", label);
  }

  for (const [value, ok, label] of [["a", true, "minimum"], [`a${"b".repeat(63)}`, true, "maximum"], ["", false, "below minimum"], [`a${"b".repeat(64)}`, false, "above maximum"]]) {
    const result = completedResult(canonicalRequest);
    result.analysis.likelyCauses[0].causeId = value;
    checkResult(result, canonicalRequest, ok, ok ? null : "MALFORMED_PROVIDER_RESULT", `result identifier ${label}`);
  }

  const maximumRequest = requestWithEvidence(20);
  maximumRequest.allowedContext.maxHypotheses = 5;
  const allEvidenceIds = maximumRequest.preparedEvidence.map((item) => item.evidenceId);
  const maximumResult = completedResult(maximumRequest);
  maximumResult.analysis.likelyCauses = Array.from({ length: 5 }, (_, index) => ({
    causeId: `cause-${index}`, statement: `Cause ${index}.`, supportingEvidenceIds: [...allEvidenceIds], counterEvidenceIds: [...allEvidenceIds]
  }));
  maximumResult.analysis.rankedHypotheses = Array.from({ length: 5 }, (_, index) => ({
    hypothesisId: `hypothesis-${index}`, rank: index + 1, statement: `Hypothesis ${index}.`,
    supportingEvidenceIds: [...allEvidenceIds], counterEvidenceIds: [...allEvidenceIds], confidenceScore: 1 - (index * 0.1)
  }));
  maximumResult.analysis.selectedIntervention.supportingHypothesisIds = maximumResult.analysis.rankedHypotheses.map((item) => item.hypothesisId);
  maximumResult.analysis.confidence.score = 1;
  maximumResult.analysis.confidence.band = "high";
  maximumResult.analysis.confidence.evidenceIds = [...allEvidenceIds];
  maximumResult.analysis.evidenceCitations = [...allEvidenceIds];
  checkResult(maximumResult, maximumRequest, true, null, "completed collection maxima");
  for (const [mutate, label] of [
    [(result) => { result.analysis.likelyCauses.push({ ...copy(result.analysis.likelyCauses[0]), causeId: "cause-overflow" }); }, "likelyCauses above maximum"],
    [(result) => { result.analysis.rankedHypotheses.push({ ...copy(result.analysis.rankedHypotheses[4]), hypothesisId: "hypothesis-overflow", rank: 6 }); }, "rankedHypotheses above maximum"],
    [(result) => { result.analysis.likelyCauses[0].supportingEvidenceIds.push("unknown-overflow"); }, "cause supportingEvidenceIds above maximum"],
    [(result) => { result.analysis.likelyCauses[0].counterEvidenceIds.push("unknown-overflow"); }, "cause counterEvidenceIds above maximum"],
    [(result) => { result.analysis.rankedHypotheses[0].supportingEvidenceIds.push("unknown-overflow"); }, "hypothesis supportingEvidenceIds above maximum"],
    [(result) => { result.analysis.rankedHypotheses[0].counterEvidenceIds.push("unknown-overflow"); }, "hypothesis counterEvidenceIds above maximum"],
    [(result) => { result.analysis.selectedIntervention.supportingHypothesisIds.push("hypothesis-overflow"); }, "supportingHypothesisIds above maximum"],
    [(result) => { result.analysis.confidence.evidenceIds.push("unknown-overflow"); }, "confidence evidenceIds above maximum"],
    [(result) => { result.analysis.evidenceCitations.push("unknown-overflow"); }, "evidenceCitations above maximum"],
    [(result) => { result.analysis.additionalEvidenceNeeded.push("unexpected"); }, "completed additionalEvidenceNeeded above exact empty"]
  ]) {
    const result = copy(maximumResult); mutate(result);
    checkResult(result, maximumRequest, false, "MALFORMED_PROVIDER_RESULT", label);
  }

  const minimumResult = completedResult(canonicalRequest);
  minimumResult.analysis.rankedHypotheses = minimumResult.analysis.rankedHypotheses.slice(0, 1);
  minimumResult.analysis.selectedIntervention.supportingHypothesisIds = [minimumResult.analysis.rankedHypotheses[0].hypothesisId];
  minimumResult.analysis.likelyCauses[0].supportingEvidenceIds = [canonicalRequest.preparedEvidence[0].evidenceId];
  minimumResult.analysis.likelyCauses[0].counterEvidenceIds = [];
  minimumResult.analysis.rankedHypotheses[0].supportingEvidenceIds = [canonicalRequest.preparedEvidence[0].evidenceId];
  minimumResult.analysis.rankedHypotheses[0].counterEvidenceIds = [];
  minimumResult.analysis.confidence.evidenceIds = [canonicalRequest.preparedEvidence[0].evidenceId];
  minimumResult.analysis.evidenceCitations = [canonicalRequest.preparedEvidence[0].evidenceId];
  checkResult(minimumResult, canonicalRequest, true, null, "completed collection minima");

  for (const [mutate, label] of [
    [(result) => { result.analysis.likelyCauses = []; }, "likelyCauses below minimum"],
    [(result) => { result.analysis.likelyCauses = Array.from({ length: 6 }, (_, index) => ({ ...copy(result.analysis.likelyCauses[0]), causeId: `cause-${index}` })); }, "likelyCauses above maximum"],
    [(result) => { result.analysis.rankedHypotheses = []; }, "rankedHypotheses below minimum"],
    [(result) => { result.analysis.likelyCauses[0].supportingEvidenceIds = []; }, "supportingEvidenceIds below minimum"],
    [(result) => { result.analysis.selectedIntervention.supportingHypothesisIds = []; }, "supportingHypothesisIds below minimum"],
    [(result) => { result.analysis.evidenceCitations = []; }, "evidenceCitations below minimum"]
  ]) {
    const result = completedResult(canonicalRequest); mutate(result); checkResult(result, canonicalRequest, false, "MALFORMED_PROVIDER_RESULT", label);
  }

  for (const [count, ok, label] of [[1, true, "minimum"], [10, true, "maximum"], [0, false, "below minimum"], [11, false, "above maximum"]]) {
    const result = insufficientResult(canonicalRequest);
    result.analysis.additionalEvidenceNeeded = Array.from({ length: count }, (_, index) => `Additional evidence ${index}.`);
    checkResult(result, canonicalRequest, ok, ok ? null : "MALFORMED_PROVIDER_RESULT", `additionalEvidenceNeeded ${label}`);
  }
  for (const [count, ok, label] of [[0, true, "minimum"], [2, true, "request maximum"], [3, false, "unknown reference"]]) {
    const result = insufficientResult(canonicalRequest);
    result.analysis.evidenceCitations = count === 0 ? [] : count === 2 ? ["analytics-a", "event-b"] : ["analytics-a", "event-b", "unknown"];
    checkResult(result, canonicalRequest, ok, ok ? null : "MALFORMED_PROVIDER_RESULT", `insufficient evidenceCitations ${label}`);
  }
  const maximumInsufficient = insufficientResult(maximumRequest);
  maximumInsufficient.analysis.confidence.evidenceIds = [...allEvidenceIds];
  maximumInsufficient.analysis.evidenceCitations = [...allEvidenceIds];
  checkResult(maximumInsufficient, maximumRequest, true, null, "insufficient optional evidence collections maximum");
  for (const field of ["evidenceIds", "evidenceCitations"]) {
    const result = copy(maximumInsufficient);
    if (field === "evidenceIds") result.analysis.confidence.evidenceIds.push("unknown-overflow");
    else result.analysis.evidenceCitations.push("unknown-overflow");
    checkResult(result, maximumRequest, false, "MALFORMED_PROVIDER_RESULT", `insufficient ${field} above maximum`);
  }
  for (const [value, ok, label] of [["x", true, "minimum"], ["x".repeat(500), true, "maximum"], ["", false, "below minimum"], ["x".repeat(501), false, "above maximum"]]) {
    const result = insufficientResult(canonicalRequest); result.analysis.additionalEvidenceNeeded = [value];
    checkResult(result, canonicalRequest, ok, ok ? null : "MALFORMED_PROVIDER_RESULT", `additional evidence text ${label}`);
  }

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

  process.stdout.write(`${JSON.stringify({ name: "intelligence-provider-contracts-v1", passed: true, testsRun, details: "Draft 2020-12 compilation, production-only runtime dependency installation, four exact result variants, trusted rejection provenance, finite enums and provider mappings, semantic cross-references, classification and P2-001 boundaries, private authority, frozen clones, self-authorization rejection, and adversarial never-throw behavior passed" })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ name: "intelligence-provider-contracts-v1", passed: false, details: error.message })}\n`);
  process.exitCode = 1;
}
