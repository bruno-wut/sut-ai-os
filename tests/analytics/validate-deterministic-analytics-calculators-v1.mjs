import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const requestSchemaPath = path.join(root, "schemas/deterministic-analytics-calculator-request-v1.schema.json");
const resultSchemaPath = path.join(root, "schemas/deterministic-analytics-calculator-result-v1.schema.json");
const modulePath = path.join(root, "packages/analytics-sdk/src/deterministic-analytics-calculators-v1.mjs");
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const copy = (value) => JSON.parse(JSON.stringify(value));
const exactKeys = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

const RESULT_KEYS = [
  "schemaVersion", "metricId", "segmentId", "aggregation", "currentPeriod", "baselinePeriod",
  "status", "currentValue", "baselineValue", "absoluteMovement", "percentageMovement",
  "currentSampleSize", "baselineSampleSize", "confidenceBand", "context", "reasonCodes"
];
const CONTEXT_KEYS = ["anomalyDurationDays", "correlatedDeploymentIds", "correlatedCampaignIds", "seasonalityStatus"];
const INVALID_CODES = [
  "MALFORMED_REQUEST", "UNKNOWN_METRIC", "INVALID_SEGMENT", "AGGREGATION_MISMATCH",
  "INVALID_PERIOD", "EMPTY_OBSERVATIONS", "OBSERVATION_LIMIT_EXCEEDED",
  "NON_FINITE_OBSERVATION", "INVALID_CONTEXT", "NUMERIC_OVERFLOW"
];

const baseRequest = () => ({
  metricId: "event-count",
  segmentId: "hotel-direct",
  aggregation: "sum",
  currentPeriod: { start: "2026-02-01", end: "2026-02-02" },
  baselinePeriod: { start: "2026-01-01", end: "2026-01-02" },
  currentObservations: [10, 20],
  baselineObservations: [5, 5],
  context: {
    anomalyDurationDays: 2,
    correlatedDeploymentIds: ["deploy-a", "deploy-b"],
    correlatedCampaignIds: ["campaign-a"],
    seasonalityStatus: "caller-declared"
  }
});

function assertClosedObjectSchemas(node, location = "schema") {
  if (Array.isArray(node)) {
    node.forEach((child, index) => assertClosedObjectSchemas(child, `${location}[${index}]`));
    return;
  }
  if (node === null || typeof node !== "object") return;
  if (node.type === "object") expect(node.additionalProperties === false, `${location} object must be closed`);
  for (const [key, child] of Object.entries(node)) assertClosedObjectSchemas(child, `${location}.${key}`);
}

function assertSchemaAuthorities(requestSchema, resultSchema) {
  expect(requestSchema.$schema === "https://json-schema.org/draft/2020-12/schema", "request must use Draft 2020-12");
  expect(resultSchema.$schema === "https://json-schema.org/draft/2020-12/schema", "result must use Draft 2020-12");
  expect(requestSchema.$id.endsWith("deterministic-analytics-calculator-request-v1.schema.json"), "request schema identity must be canonical V1");
  expect(resultSchema.$id.endsWith("deterministic-analytics-calculator-result-v1.schema.json"), "result schema identity must be canonical V1");
  expect(requestSchema.additionalProperties === false, "request root must be closed");
  expect(requestSchema.required.length === 8 && Object.keys(requestSchema.properties).length === 8, "request root must require exactly eight fields");
  expect(requestSchema.$defs.observations.minItems === 1 && requestSchema.$defs.observations.maxItems === 366, "observation bounds must be 1-366");
  expect(requestSchema.$defs.observations.items.minimum === -1_000_000_000 && requestSchema.$defs.observations.items.maximum === 1_000_000_000, "observation numeric bounds must be fixed");
  expect(requestSchema.$defs.correlationIds.maxItems === 20 && requestSchema.$defs.correlationIds.uniqueItems === true, "correlation IDs must be bounded and unique");
  expect(resultSchema.oneOf.length === 5, "result authority must contain only the designed variants");
  expect(resultSchema.$defs.invalid.additionalProperties === false, "invalid result must be closed");
  expect(JSON.stringify(resultSchema.$defs.invalid.properties.reasonCodes.items.enum) === JSON.stringify(INVALID_CODES), "invalid reason-code authority must be exact and ordered");
  assertClosedObjectSchemas(requestSchema, "requestSchema");
  assertClosedObjectSchemas(resultSchema, "resultSchema");
}

function assertResult(result, label) {
  expect(exactKeys(result, RESULT_KEYS), `${label}: result fields must be exact`);
  expect(result.schemaVersion === "1.0.0", `${label}: schema version must be fixed`);
  expect(["ok", "non-comparable", "invalid"].includes(result.status), `${label}: status must be valid`);
  expect(exactKeys(result.context, CONTEXT_KEYS), `${label}: context fields must be exact`);
  expect(Array.isArray(result.reasonCodes), `${label}: reasons must be an array`);
  if (result.status === "invalid") {
    expect([result.metricId, result.segmentId, result.aggregation, result.currentPeriod, result.baselinePeriod].every((value) => value === null), `${label}: invalid identity must be null`);
    expect([result.currentValue, result.baselineValue, result.absoluteMovement, result.percentageMovement].every((value) => value === null), `${label}: invalid values must be null`);
    expect(result.currentSampleSize === 0 && result.baselineSampleSize === 0, `${label}: invalid sample sizes must be zero`);
    expect(result.confidenceBand === "not-applicable", `${label}: invalid confidence must be not-applicable`);
    expect(JSON.stringify(result.context) === JSON.stringify({ anomalyDurationDays: 0, correlatedDeploymentIds: [], correlatedCampaignIds: [], seasonalityStatus: "not-evaluated" }), `${label}: invalid context must be fixed safe context`);
    expect(result.reasonCodes.length > 0 && result.reasonCodes.every((code) => INVALID_CODES.includes(code)), `${label}: invalid reasons must be bounded`);
  } else {
    expect([result.currentValue, result.baselineValue, result.absoluteMovement].every(Number.isFinite), `${label}: valid values must be finite`);
    expect(result.currentSampleSize >= 1 && result.currentSampleSize <= 366 && result.baselineSampleSize >= 1 && result.baselineSampleSize <= 366, `${label}: sample sizes must be bounded`);
    if (result.status === "non-comparable") {
      expect(result.percentageMovement === null && result.confidenceBand === "not-applicable", `${label}: non-comparable values must be closed`);
      expect(JSON.stringify(result.reasonCodes) === '["ZERO_BASELINE"]', `${label}: zero baseline must be the sole reason`);
    } else {
      expect(Number.isFinite(result.percentageMovement), `${label}: ok percentage must be finite`);
      expect(["insufficient", "low", "medium", "high"].includes(result.confidenceBand), `${label}: ok confidence must be bounded`);
      expect(result.reasonCodes.length === 0, `${label}: ok result must have no reasons`);
    }
  }
  expect(Object.isFrozen(result) && Object.isFrozen(result.context) && Object.isFrozen(result.reasonCodes), `${label}: returned boundary must be frozen`);
}

try {
  const [requestText, resultText, moduleText] = await Promise.all([
    readFile(requestSchemaPath, "utf8"),
    readFile(resultSchemaPath, "utf8"),
    readFile(modulePath, "utf8")
  ]);
  const requestSchema = JSON.parse(requestText);
  const resultSchema = JSON.parse(resultText);
  assertSchemaAuthorities(requestSchema, resultSchema);

  expect(!/^\s*import\s/m.test(moduleText), "calculator core must not import infrastructure or providers");
  expect(!/(readFile|fetch\s*\(|process\.env|Date\.now|new Date|database|queue|provider sdk)/i.test(moduleText), "calculator core must not read mutable infrastructure authority");
  const calculatorModule = await import(pathToFileURL(modulePath).href);
  expect(JSON.stringify(Object.keys(calculatorModule)) === '["calculateMetricComparison"]', "module must expose only calculateMetricComparison");
  const { calculateMetricComparison } = calculatorModule;

  let testsRun = 0;
  const calculate = (request, label) => {
    let result;
    try { result = calculateMetricComparison(request); } catch (error) { throw new Error(`${label}: threw ${error.message}`); }
    assertResult(result, label);
    testsRun += 1;
    return result;
  };
  const expectReasons = (request, reasons, label) => {
    const result = calculate(request, label);
    expect(result.status === "invalid", `${label}: must be invalid`);
    expect(JSON.stringify(result.reasonCodes) === JSON.stringify(reasons), `${label}: expected ${JSON.stringify(reasons)}, received ${JSON.stringify(result.reasonCodes)}`);
  };

  let result = calculate(baseRequest(), "canonical sum");
  expect(result.currentValue === 30 && result.baselineValue === 10 && result.absoluteMovement === 20 && result.percentageMovement === 200, "sum arithmetic must be exact");
  expect(result.confidenceBand === "insufficient", "two observations must be insufficient confidence");

  for (const [metricId, aggregation] of [["event-count", "sum"], ["event-value-sum", "sum"], ["event-value-mean", "mean"], ["event-rate", "rate"]]) {
    const request = baseRequest();
    request.metricId = metricId;
    request.aggregation = aggregation;
    result = calculate(request, `mapping ${metricId}`);
    expect(result.status === "ok", `${metricId} mapping must be accepted`);
  }

  const mean = baseRequest();
  mean.metricId = "event-value-mean";
  mean.aggregation = "mean";
  mean.currentObservations = [1.23456789, 2.34567891, 3.45678912];
  mean.baselineObservations = [1, 1, 1];
  result = calculate(mean, "mean rounding");
  expect(result.currentValue === Number.parseFloat(((1.23456789 + 2.34567891 + 3.45678912) / 3).toFixed(6)), "mean must accumulate left-to-right and round to six places");
  expect(result.confidenceBand === "low", "three observations must be low confidence");

  for (const [size, confidence] of [[1, "insufficient"], [3, "low"], [7, "medium"], [30, "high"]]) {
    const request = baseRequest();
    request.currentObservations = Array(size).fill(2);
    request.baselineObservations = Array(size).fill(1);
    result = calculate(request, `confidence ${size}`);
    expect(result.confidenceBand === confidence, `sample size ${size} must map to ${confidence}`);
  }

  const zero = baseRequest();
  zero.baselineObservations = [0.0000001];
  result = calculate(zero, "rounded zero baseline");
  expect(result.status === "non-comparable" && result.baselineValue === 0 && result.percentageMovement === null, "rounded zero baseline must be non-comparable");

  const overflow = baseRequest();
  overflow.currentObservations = [1_000_000_000];
  overflow.baselineObservations = [1];
  expectReasons(overflow, ["NUMERIC_OVERFLOW"], "percentage overflow");

  expectReasons(null, ["MALFORMED_REQUEST"], "null root");
  expectReasons([], ["MALFORMED_REQUEST"], "array root");
  expectReasons({}, ["MALFORMED_REQUEST"], "missing root fields");
  const extra = baseRequest(); extra.extra = true;
  expectReasons(extra, ["MALFORMED_REQUEST"], "unknown root field");
  const unknown = baseRequest(); unknown.metricId = "unknown";
  expectReasons(unknown, ["UNKNOWN_METRIC"], "unknown metric");
  const segment = baseRequest(); segment.segmentId = "Bad Segment";
  expectReasons(segment, ["INVALID_SEGMENT"], "invalid segment");
  const mismatch = baseRequest(); mismatch.aggregation = "rate";
  expectReasons(mismatch, ["AGGREGATION_MISMATCH"], "aggregation mismatch");
  const wrongAggregation = baseRequest(); wrongAggregation.aggregation = "median";
  expectReasons(wrongAggregation, ["AGGREGATION_MISMATCH"], "unknown aggregation");
  const malformedPeriod = baseRequest(); delete malformedPeriod.currentPeriod.end;
  expectReasons(malformedPeriod, ["MALFORMED_REQUEST"], "malformed nested period");
  const impossibleDate = baseRequest(); impossibleDate.currentPeriod.start = "2026-02-30";
  expectReasons(impossibleDate, ["INVALID_PERIOD"], "impossible calendar date");
  const reversed = baseRequest(); reversed.currentPeriod = { start: "2026-02-03", end: "2026-02-01" };
  expectReasons(reversed, ["INVALID_PERIOD"], "reversed period");
  const overlap = baseRequest(); overlap.baselinePeriod.end = "2026-02-01";
  expectReasons(overlap, ["INVALID_PERIOD"], "overlapping periods");
  const empty = baseRequest(); empty.currentObservations = [];
  expectReasons(empty, ["EMPTY_OBSERVATIONS"], "empty observations");
  const tooMany = baseRequest(); tooMany.currentObservations = Array(367).fill(1);
  expectReasons(tooMany, ["OBSERVATION_LIMIT_EXCEEDED"], "observation limit");
  for (const [value, label] of [["1", "non-number"], [NaN, "NaN"], [Infinity, "Infinity"], [1_000_000_001, "out-of-range"]]) {
    const request = baseRequest(); request.currentObservations = [value];
    expectReasons(request, ["NON_FINITE_OBSERVATION"], `${label} observation`);
  }
  const malformedContext = baseRequest(); malformedContext.context.anomalyDurationDays = "2";
  expectReasons(malformedContext, ["MALFORMED_REQUEST"], "malformed nested context");
  const invalidContext = baseRequest(); invalidContext.context.correlatedDeploymentIds = ["deploy-b", "deploy-a"];
  expectReasons(invalidContext, ["INVALID_CONTEXT"], "unsorted context IDs");
  const duplicateContext = baseRequest(); duplicateContext.context.correlatedCampaignIds = ["campaign-a", "campaign-a"];
  expectReasons(duplicateContext, ["INVALID_CONTEXT"], "duplicate context IDs");

  const combined = baseRequest();
  combined.extra = true;
  combined.metricId = "unknown";
  combined.segmentId = "Bad";
  combined.aggregation = "median";
  combined.currentPeriod.start = "2026-02-30";
  combined.currentObservations = [];
  combined.baselineObservations = Array(367).fill(1);
  combined.baselineObservations[0] = NaN;
  combined.context.anomalyDurationDays = 367;
  expectReasons(combined, [
    "MALFORMED_REQUEST", "UNKNOWN_METRIC", "INVALID_SEGMENT", "AGGREGATION_MISMATCH",
    "INVALID_PERIOD", "EMPTY_OBSERVATIONS", "OBSERVATION_LIMIT_EXCEEDED",
    "NON_FINITE_OBSERVATION", "INVALID_CONTEXT"
  ], "combined precedence");

  const changedContext = baseRequest();
  changedContext.context = { anomalyDurationDays: 366, correlatedDeploymentIds: [], correlatedCampaignIds: [], seasonalityStatus: "not-evaluated" };
  const changedContextResult = calculate(changedContext, "display-only context");
  expect(changedContextResult.currentValue === 30 && changedContextResult.percentageMovement === 200, "context must not alter arithmetic");

  const authorityBaseline = calculate(baseRequest(), "authority baseline");
  requestSchema.properties.metricId.enum = ["replacement"];
  resultSchema.$defs.okSum.properties = { status: { const: "invalid" } };
  const afterReplacement = calculate(baseRequest(), "authority replacement rejection");
  expect(JSON.stringify(afterReplacement) === JSON.stringify(authorityBaseline), "caller-held schema replacement must not redirect runtime authority");

  const throwingGetter = baseRequest();
  Object.defineProperty(throwingGetter, "metricId", { enumerable: true, get() { throw new Error("hostile getter"); } });
  const throwingProxy = new Proxy({}, { ownKeys() { throw new Error("hostile proxy"); } });
  const malformedInputs = [undefined, true, 7, "request", throwingGetter, throwingProxy, Object.create({ inherited: true })];
  for (const [index, malformed] of malformedInputs.entries()) {
    const first = calculate(malformed, `malformed repeat ${index}a`);
    const second = calculate(malformed, `malformed repeat ${index}b`);
    expect(first.status === "invalid" && JSON.stringify(first) === JSON.stringify(second), `malformed input ${index} must deterministically fail closed`);
  }

  process.stdout.write(`${JSON.stringify({ name: "deterministic-analytics-calculators-v1", passed: true, testsRun, details: "Closed V1 authorities, pure stable API, finite mappings, ordered validation, deterministic arithmetic, fail-closed malformed input, and authority replacement rejection passed" })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ name: "deterministic-analytics-calculators-v1", passed: false, details: error.message })}\n`);
  process.exitCode = 1;
}
