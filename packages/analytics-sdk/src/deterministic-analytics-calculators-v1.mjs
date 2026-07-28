/**
 * Pure Phase 2 deterministic analytics boundary.
 * Prepared observations are the input port; the frozen comparison is the output port.
 */

const ROOT_FIELDS = Object.freeze([
  "metricId",
  "segmentId",
  "aggregation",
  "currentPeriod",
  "baselinePeriod",
  "currentObservations",
  "baselineObservations",
  "context"
]);
const PERIOD_FIELDS = Object.freeze(["start", "end"]);
const CONTEXT_FIELDS = Object.freeze([
  "anomalyDurationDays",
  "correlatedDeploymentIds",
  "correlatedCampaignIds",
  "seasonalityStatus"
]);
const METRIC_AGGREGATIONS = Object.freeze({
  "event-count": "sum",
  "event-value-sum": "sum",
  "event-value-mean": "mean",
  "event-rate": "rate"
});
const AGGREGATIONS = new Set(["sum", "mean", "rate"]);
const IDENTIFIER = /^[a-z][a-z0-9-]{0,63}$/;
const EMPTY_CONTEXT = Object.freeze({
  anomalyDurationDays: 0,
  correlatedDeploymentIds: Object.freeze([]),
  correlatedCampaignIds: Object.freeze([]),
  seasonalityStatus: "not-evaluated"
});
const INVALID_IDENTITY = Object.freeze({
  metricId: null,
  segmentId: null,
  aggregation: null,
  currentPeriod: null,
  baselinePeriod: null
});

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value, fields) {
  if (!isPlainObject(value)) return false;
  const keys = Object.keys(value);
  return keys.length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function addReason(reasons, reason) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function deepFreeze(value) {
  if (value === null || (typeof value !== "object" && typeof value !== "function")) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function invalid(reasonCodes) {
  return deepFreeze({
    schemaVersion: "1.0.0",
    ...INVALID_IDENTITY,
    status: "invalid",
    currentValue: null,
    baselineValue: null,
    absoluteMovement: null,
    percentageMovement: null,
    currentSampleSize: 0,
    baselineSampleSize: 0,
    confidenceBand: "not-applicable",
    context: {
      anomalyDurationDays: EMPTY_CONTEXT.anomalyDurationDays,
      correlatedDeploymentIds: [],
      correlatedCampaignIds: [],
      seasonalityStatus: EMPTY_CONTEXT.seasonalityStatus
    },
    reasonCodes
  });
}

function structurallyValidPeriod(period) {
  return hasExactKeys(period, PERIOD_FIELDS) &&
    typeof period.start === "string" && typeof period.end === "string";
}

function parseUtcDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) return null;
  return year * 372 + month * 31 + day;
}

function periodSemantics(period) {
  const start = parseUtcDate(period.start);
  const end = parseUtcDate(period.end);
  return start !== null && end !== null && start <= end ? { start, end } : null;
}

function structurallyValidContext(context) {
  return hasExactKeys(context, CONTEXT_FIELDS) &&
    typeof context.anomalyDurationDays === "number" && Number.isInteger(context.anomalyDurationDays) &&
    Array.isArray(context.correlatedDeploymentIds) &&
    Array.isArray(context.correlatedCampaignIds) &&
    typeof context.seasonalityStatus === "string";
}

function validIdentifierArray(values) {
  if (values.length > 20) return false;
  for (let index = 0; index < values.length; index += 1) {
    if (typeof values[index] !== "string" || !IDENTIFIER.test(values[index])) return false;
    if (index > 0 && values[index - 1] >= values[index]) return false;
  }
  return true;
}

function validContextSemantics(context) {
  return context.anomalyDurationDays >= 0 && context.anomalyDurationDays <= 366 &&
    (context.seasonalityStatus === "not-evaluated" || context.seasonalityStatus === "caller-declared") &&
    validIdentifierArray(context.correlatedDeploymentIds) &&
    validIdentifierArray(context.correlatedCampaignIds);
}

function inspectObservations(observations, reasons) {
  if (observations.length === 0) addReason(reasons, "EMPTY_OBSERVATIONS");
  if (observations.length > 366) addReason(reasons, "OBSERVATION_LIMIT_EXCEEDED");
  if (observations.some((value) => typeof value !== "number" || !Number.isFinite(value) || value < -1_000_000_000 || value > 1_000_000_000)) {
    addReason(reasons, "NON_FINITE_OBSERVATION");
  }
}

function round(value) {
  const rounded = Number.parseFloat(value.toFixed(6));
  return Object.is(rounded, -0) ? 0 : rounded;
}

function aggregate(values, aggregation) {
  let total = 0;
  for (const value of values) total += value;
  if (!Number.isFinite(total)) return null;
  return aggregation === "sum" ? total : total / values.length;
}

function inRange(value, minimum, maximum) {
  return Number.isFinite(value) && value >= minimum && value <= maximum;
}

function confidenceFor(currentSize, baselineSize) {
  const size = Math.min(currentSize, baselineSize);
  if (size <= 2) return "insufficient";
  if (size <= 6) return "low";
  if (size <= 29) return "medium";
  return "high";
}

function validResult(request, values, percentageMovement, status, confidenceBand, reasonCodes) {
  return deepFreeze({
    schemaVersion: "1.0.0",
    metricId: request.metricId,
    segmentId: request.segmentId,
    aggregation: request.aggregation,
    currentPeriod: { start: request.currentPeriod.start, end: request.currentPeriod.end },
    baselinePeriod: { start: request.baselinePeriod.start, end: request.baselinePeriod.end },
    status,
    currentValue: values.current,
    baselineValue: values.baseline,
    absoluteMovement: values.absolute,
    percentageMovement,
    currentSampleSize: request.currentObservations.length,
    baselineSampleSize: request.baselineObservations.length,
    confidenceBand,
    context: {
      anomalyDurationDays: request.context.anomalyDurationDays,
      correlatedDeploymentIds: [...request.context.correlatedDeploymentIds],
      correlatedCampaignIds: [...request.context.correlatedCampaignIds],
      seasonalityStatus: request.context.seasonalityStatus
    },
    reasonCodes
  });
}

function calculate(request) {
  if (!isPlainObject(request)) return invalid(["MALFORMED_REQUEST"]);

  const reasons = [];
  const rootShapeValid = hasExactKeys(request, ROOT_FIELDS);
  const metricTyped = typeof request.metricId === "string";
  const segmentTyped = typeof request.segmentId === "string";
  const aggregationTyped = typeof request.aggregation === "string";
  const currentPeriodStructured = structurallyValidPeriod(request.currentPeriod);
  const baselinePeriodStructured = structurallyValidPeriod(request.baselinePeriod);
  const currentObservationsStructured = Array.isArray(request.currentObservations);
  const baselineObservationsStructured = Array.isArray(request.baselineObservations);
  const contextStructured = structurallyValidContext(request.context);

  if (
    !rootShapeValid || !metricTyped || !segmentTyped || !aggregationTyped ||
    !currentPeriodStructured || !baselinePeriodStructured ||
    !currentObservationsStructured || !baselineObservationsStructured || !contextStructured
  ) addReason(reasons, "MALFORMED_REQUEST");

  const knownMetric = metricTyped && Object.hasOwn(METRIC_AGGREGATIONS, request.metricId);
  if (metricTyped && !knownMetric) addReason(reasons, "UNKNOWN_METRIC");
  if (segmentTyped && !IDENTIFIER.test(request.segmentId)) addReason(reasons, "INVALID_SEGMENT");

  const knownAggregation = aggregationTyped && AGGREGATIONS.has(request.aggregation);
  if (aggregationTyped && (!knownAggregation || (knownMetric && METRIC_AGGREGATIONS[request.metricId] !== request.aggregation))) {
    addReason(reasons, "AGGREGATION_MISMATCH");
  }

  let currentPeriod = null;
  let baselinePeriod = null;
  if (currentPeriodStructured) currentPeriod = periodSemantics(request.currentPeriod);
  if (baselinePeriodStructured) baselinePeriod = periodSemantics(request.baselinePeriod);
  if (
    (currentPeriodStructured && currentPeriod === null) ||
    (baselinePeriodStructured && baselinePeriod === null) ||
    (currentPeriod !== null && baselinePeriod !== null && baselinePeriod.end >= currentPeriod.start)
  ) addReason(reasons, "INVALID_PERIOD");

  if (currentObservationsStructured) inspectObservations(request.currentObservations, reasons);
  if (baselineObservationsStructured) inspectObservations(request.baselineObservations, reasons);
  if (contextStructured && !validContextSemantics(request.context)) addReason(reasons, "INVALID_CONTEXT");

  if (reasons.length > 0) return invalid(reasons);

  const rawCurrent = aggregate(request.currentObservations, request.aggregation);
  const rawBaseline = aggregate(request.baselineObservations, request.aggregation);
  const rawAbsolute = rawCurrent === null || rawBaseline === null ? null : rawCurrent - rawBaseline;
  const valueLimit = request.aggregation === "sum" ? 366_000_000_000 : 1_000_000_000;
  if (
    rawCurrent === null || rawBaseline === null || rawAbsolute === null ||
    !inRange(rawCurrent, -valueLimit, valueLimit) ||
    !inRange(rawBaseline, -valueLimit, valueLimit) ||
    !inRange(rawAbsolute, -732_000_000_000, 732_000_000_000)
  ) return invalid(["NUMERIC_OVERFLOW"]);

  const values = {
    current: round(rawCurrent),
    baseline: round(rawBaseline),
    absolute: round(rawAbsolute)
  };
  if (
    !inRange(values.current, -valueLimit, valueLimit) ||
    !inRange(values.baseline, -valueLimit, valueLimit) ||
    !inRange(values.absolute, -732_000_000_000, 732_000_000_000)
  ) return invalid(["NUMERIC_OVERFLOW"]);

  if (values.baseline === 0) {
    return validResult(request, values, null, "non-comparable", "not-applicable", ["ZERO_BASELINE"]);
  }

  const rawPercentage = (rawAbsolute / Math.abs(rawBaseline)) * 100;
  if (!inRange(rawPercentage, -1_000_000, 1_000_000)) return invalid(["NUMERIC_OVERFLOW"]);
  const percentage = round(rawPercentage);
  if (!inRange(percentage, -1_000_000, 1_000_000)) return invalid(["NUMERIC_OVERFLOW"]);

  return validResult(
    request,
    values,
    percentage,
    "ok",
    confidenceFor(request.currentObservations.length, request.baselineObservations.length),
    []
  );
}

/** Stable public API. Malformed or hostile input always returns a closed invalid result. */
export function calculateMetricComparison(request) {
  try {
    return calculate(request);
  } catch {
    return invalid(["MALFORMED_REQUEST"]);
  }
}
