const VERSION = "1.0.0";
const PRIORITY = Object.freeze({ critical: 0, high: 1, normal: 2, low: 3 });
const KINDS = new Set(["normalized_event", "scheduled_check", "scheduled_summary"]);
const TERMINAL = new Set(["delivered", "dead_letter"]);
const MAX_TEXT = 128;

const plain = (value) => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  try { return Object.getPrototypeOf(value) === Object.prototype; } catch { return false; }
};
const own = (value, keys) => plain(value) && Object.keys(value).every((key) => keys.includes(key));
const text = (value, limit = MAX_TEXT) => typeof value === "string" && value.length > 0 && value.length <= limit && /^[a-zA-Z0-9._:/-]+$/.test(value);
const integer = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => Number.isSafeInteger(value) && value >= min && value <= max;
const freeze = (value) => {
  if (value && ["object", "function"].includes(typeof value) && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const stable = (value) => Array.isArray(value)
  ? `[${value.map(stable).join(",")}]`
  : plain(value)
    ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(",")}}`
    : JSON.stringify(value);
const clone = (value) => {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  if (Array.isArray(value)) return value.map(clone);
  if (!plain(value)) throw new Error("not a plain value");
  const result = {};
  for (const key of Object.keys(value)) result[key] = clone(value[key]);
  return result;
};
const deny = (reasonCodes) => freeze({ ok: false, status: "denied", actionAuthority: "none", productionWritePermission: false, reasonCodes });
const success = (value) => freeze({ ok: true, status: "accepted", actionAuthority: "none", productionWritePermission: false, reasonCodes: [], value });

function validPayload(kind, payload) {
  if (!plain(payload)) return false;
  if (Object.keys(payload).some((key) => /(?:raw|click|scroll|guest|payment|credential|secret|policy|approval|ai|provider|command)/i.test(key))) return false;
  if (kind === "normalized_event") return own(payload, ["eventId", "eventType", "aggregateRef"]) && text(payload.eventId) && text(payload.eventType) && text(payload.aggregateRef);
  if (kind === "scheduled_check") return own(payload, ["checkId", "target"]) && text(payload.checkId) && text(payload.target);
  return own(payload, ["summaryId", "cadence"]) && text(payload.summaryId) && ["hourly", "daily"].includes(payload.cadence);
}

function validRequest(value) {
  return own(value, ["schemaVersion", "workId", "kind", "idempotencyKey", "priority", "scheduledForEpochSeconds", "payload"])
    && value.schemaVersion === VERSION && text(value.workId) && text(value.idempotencyKey)
    && KINDS.has(value.kind) && Object.hasOwn(PRIORITY, value.priority)
    && integer(value.scheduledForEpochSeconds, 0) && validPayload(value.kind, value.payload);
}

function validPorts(ports) {
  return plain(ports) && own(ports, ["clock", "storage", "dispatcher", "limits"])
    && plain(ports.clock) && typeof ports.clock.nowEpochSeconds === "function"
    && plain(ports.storage) && typeof ports.storage.list === "function" && typeof ports.storage.save === "function"
    && plain(ports.dispatcher) && typeof ports.dispatcher.deliver === "function"
    && plain(ports.limits) && own(ports.limits, ["maxQueued", "batchSize", "rateLimitPerRun", "concurrencyLimit", "retryLimit", "safeRequeue"])
    && integer(ports.limits.maxQueued, 1, 1000) && integer(ports.limits.batchSize, 1, 100)
    && integer(ports.limits.rateLimitPerRun, 1, 1000) && integer(ports.limits.concurrencyLimit, 1, 100)
    && integer(ports.limits.retryLimit, 0, 20) && typeof ports.limits.safeRequeue === "boolean";
}

function snapshotPorts(ports) {
  try {
    if (!validPorts(ports)) return null;
    return freeze({
      nowEpochSeconds: ports.clock.nowEpochSeconds.bind(ports.clock),
      list: ports.storage.list.bind(ports.storage),
      save: ports.storage.save.bind(ports.storage),
      deliver: ports.dispatcher.deliver.bind(ports.dispatcher),
      limits: freeze(clone(ports.limits))
    });
  } catch { return null; }
}

function validRecord(record) {
  return plain(record) && own(record, ["workId", "fingerprint", "kind", "idempotencyKey", "priority", "scheduledForEpochSeconds", "payload", "status", "attempt", "failureReasons", "updatedAtEpochSeconds"])
    && text(record.workId) && typeof record.fingerprint === "string" && KINDS.has(record.kind)
    && text(record.idempotencyKey) && Object.hasOwn(PRIORITY, record.priority) && integer(record.scheduledForEpochSeconds)
    && validPayload(record.kind, record.payload) && ["queued", "requeued", "paused", "delivered", "dead_letter"].includes(record.status)
    && integer(record.attempt, 0, 20) && Array.isArray(record.failureReasons) && record.failureReasons.every((reason) => text(reason));
}

function safeList(list) {
  try {
    const records = list();
    if (!Array.isArray(records) || !records.every(validRecord)) return { ok: false, reason: "PERSISTENCE_UNAVAILABLE" };
    const copied = records.map(clone);
    if (new Set(copied.map((record) => record.workId)).size !== copied.length) return { ok: false, reason: "PERSISTENCE_STATE_INVALID" };
    return { ok: true, records: copied };
  } catch { return { ok: false, reason: "PERSISTENCE_UNAVAILABLE" }; }
}
function safeSave(save, records) {
  try { save(records.map(clone)); return true; } catch { return false; }
}
function canonicalRecord(request, now) {
  const fingerprint = stable({ kind: request.kind, priority: request.priority, scheduledForEpochSeconds: request.scheduledForEpochSeconds, payload: request.payload });
  return { workId: request.workId, fingerprint, kind: request.kind, idempotencyKey: request.idempotencyKey, priority: request.priority, scheduledForEpochSeconds: request.scheduledForEpochSeconds, payload: clone(request.payload), status: "queued", attempt: 0, failureReasons: [], updatedAtEpochSeconds: now };
}
function deliveryInput(record) {
  return freeze({ workId: record.workId, idempotencyKey: record.idempotencyKey, kind: record.kind, priority: record.priority, attempt: record.attempt, payload: clone(record.payload), executionAuthority: "none", productionWritePermission: false });
}
function appendReason(record, reason, status, now, attempt = record.attempt) {
  return { ...record, status, attempt, failureReasons: [...record.failureReasons, reason], updatedAtEpochSeconds: now };
}

/**
 * Creates the bounded application-core event-delivery module. All persistence,
 * time, and dispatch behavior is supplied through explicit ports; this module
 * neither imports nor selects a provider, transport, database, queue, or AI.
 */
export function createEventDelivery(ports) {
  const trusted = snapshotPorts(ports);
  const unavailable = () => deny(["DELIVERY_AUTHORITY_UNAVAILABLE"]);
  const now = () => {
    try { const value = trusted.nowEpochSeconds(); return integer(value) ? value : null; } catch { return null; }
  };
  const submit = (input) => {
    if (!trusted) return unavailable();
    let request;
    try { request = clone(input); } catch { return deny(["MALFORMED_WORK_REQUEST"]); }
    if (!validRequest(request)) return deny(["MALFORMED_WORK_REQUEST"]);
    const timestamp = now(); if (timestamp === null) return deny(["CLOCK_UNAVAILABLE"]);
    const loaded = safeList(trusted.list); if (!loaded.ok) return deny([loaded.reason]);
    const records = loaded.records;
    const existing = records.find((record) => record.idempotencyKey === request.idempotencyKey);
    const candidate = canonicalRecord(request, timestamp);
    if (existing) {
      if (existing.workId === candidate.workId && existing.fingerprint === candidate.fingerprint) return success({ outcome: "idempotent", workId: existing.workId, queueStatus: existing.status, batchEligible: !TERMINAL.has(existing.status) });
      return deny(["IDEMPOTENCY_CONFLICT"]);
    }
    if (records.some((record) => record.workId === candidate.workId)) return deny(["WORK_ID_CONFLICT"]);
    const queued = records.filter((record) => ["queued", "requeued", "paused"].includes(record.status)).length;
    if (queued >= trusted.limits.maxQueued) return deny(["BACKPRESSURE_LIMIT_REACHED"]);
    if (!safeSave(trusted.save, [...records, candidate])) return deny(["PERSISTENCE_UNAVAILABLE"]);
    return success({ outcome: "queued", workId: candidate.workId, queueStatus: candidate.status, batchEligible: candidate.scheduledForEpochSeconds <= timestamp });
  };
  const runDue = (input = {}) => {
    if (!trusted) return unavailable();
    let request;
    try { request = clone(input); } catch { return deny(["MALFORMED_RUN_REQUEST"]); }
    if (!own(request, [])) return deny(["MALFORMED_RUN_REQUEST"]);
    const timestamp = now(); if (timestamp === null) return deny(["CLOCK_UNAVAILABLE"]);
    const loaded = safeList(trusted.list); if (!loaded.ok) return deny([loaded.reason]);
    const records = loaded.records;
    const due = records.map((record, index) => ({ record, index }))
      .filter(({ record }) => ["queued", "requeued"].includes(record.status) && record.scheduledForEpochSeconds <= timestamp)
      .sort((a, b) => PRIORITY[a.record.priority] - PRIORITY[b.record.priority] || a.record.scheduledForEpochSeconds - b.record.scheduledForEpochSeconds || a.record.workId.localeCompare(b.record.workId));
    const capacity = Math.min(trusted.limits.batchSize, trusted.limits.rateLimitPerRun, trusted.limits.concurrencyLimit);
    const batch = due.slice(0, capacity);
    if (batch.length === 0) return success({ outcome: "idle", dispatched: 0, queued: records.filter((record) => ["queued", "requeued"].includes(record.status)).length, limitedBy: capacity });
    let outcomes;
    try {
      const candidate = trusted.deliver(batch.map(({ record }) => deliveryInput(record)));
      if (!Array.isArray(candidate) || candidate.length !== batch.length || !candidate.every((outcome, index) => plain(outcome) && own(outcome, ["workId", "state", "failureReason"]) && outcome.workId === batch[index].record.workId && ["delivered", "retryable_failure", "permanent_failure", "provider_unavailable"].includes(outcome.state) && (outcome.failureReason === null || text(outcome.failureReason)))) return deny(["DISPATCH_RESULT_INVALID"]);
      outcomes = candidate.map((outcome) => ({ workId: outcome.workId, state: outcome.state, failureReason: outcome.failureReason }));
    } catch { return deny(["DISPATCH_RESULT_INVALID"]); }
    const updated = records.slice();
    batch.forEach(({ record, index }, outcomeIndex) => {
      const outcome = outcomes[outcomeIndex];
      if (outcome.state === "delivered") { updated[index] = { ...record, status: "delivered", updatedAtEpochSeconds: timestamp }; return; }
      const reason = outcome.failureReason ?? (outcome.state === "provider_unavailable" ? "PROVIDER_UNAVAILABLE" : "DISPATCH_FAILURE");
      if (outcome.state === "permanent_failure") { updated[index] = appendReason(record, reason, "dead_letter", timestamp); return; }
      const attempt = record.attempt + 1;
      if (attempt > trusted.limits.retryLimit) { updated[index] = { ...appendReason(record, reason, "dead_letter", timestamp, trusted.limits.retryLimit), failureReasons: [...record.failureReasons, reason, "RETRY_EXHAUSTED"] }; return; }
      if (outcome.state === "provider_unavailable" && !trusted.limits.safeRequeue) { updated[index] = appendReason(record, reason, "paused", timestamp, attempt); return; }
      updated[index] = appendReason(record, reason, "requeued", timestamp, attempt);
    });
    if (!safeSave(trusted.save, updated)) return deny(["PERSISTENCE_UNAVAILABLE"]);
    const states = outcomes.map((outcome) => outcome.state);
    const processed = batch.map(({ index }) => updated[index]);
    return success({ outcome: "processed", dispatched: batch.length, delivered: states.filter((state) => state === "delivered").length, requeued: processed.filter((record) => record.status === "requeued").length, paused: processed.filter((record) => record.status === "paused").length, deadLettered: processed.filter((record) => record.status === "dead_letter").length, limitedBy: capacity });
  };
  return freeze({ submit, runDue });
}
