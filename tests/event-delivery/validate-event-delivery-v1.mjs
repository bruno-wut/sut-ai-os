import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const modulePath = path.join(root, "services/event-delivery/src/event-delivery-v1.mjs");
const source = await readFile(modulePath, "utf8");
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const clone = (value) => JSON.parse(JSON.stringify(value));
const frozen = (value) => { expect(Object.isFrozen(value), "decision must be frozen"); if (value && typeof value === "object") Object.values(value).forEach(frozen); };
expect(!/(?:from|import\s*\()[^\n]*(?:node:fs|node:http|node:https|child_process|cloudflare|supabase|openai|github|line|database|queue|workflow|scheduler|fetch)/i.test(source), "event delivery core must not import infrastructure providers");
const api = await import(`${pathToFileURL(modulePath).href}?validator=${Date.now()}`);
expect(JSON.stringify(Object.keys(api)) === '["createEventDelivery"]', "one deep public factory only");
const { createEventDelivery } = api;
let assertions = 0;
const store = (initial = []) => { let records = clone(initial); return { list: () => clone(records), save: (next) => { records = clone(next); }, snapshot: () => clone(records) }; };
const ports = (overrides = {}) => {
  const persistence = overrides.storage ?? store();
  return { storage: persistence, clock: { nowEpochSeconds: () => 1_700_000_000 }, dispatcher: { deliver: (batch) => batch.map((work) => ({ workId: work.workId, state: "delivered", failureReason: null })) }, limits: { maxQueued: 10, batchSize: 3, rateLimitPerRun: 2, concurrencyLimit: 2, retryLimit: 2, safeRequeue: true }, ...overrides, storage: persistence };
};
const request = (overrides = {}) => ({ schemaVersion: "1.0.0", workId: "work-001", kind: "normalized_event", idempotencyKey: "idem-001", priority: "normal", scheduledForEpochSeconds: 1_700_000_000, payload: { eventId: "event-001", eventType: "analytics.aggregate.hourly", aggregateRef: "aggregate-001" }, ...overrides });
const record = (overrides = {}) => ({ workId: "stored-work", fingerprint: "fixture", kind: "scheduled_check", idempotencyKey: "stored-idem", priority: "normal", scheduledForEpochSeconds: 1_700_000_000, payload: { checkId: "stored-check", target: "aggregate-health" }, status: "queued", attempt: 0, failureReasons: [], updatedAtEpochSeconds: 1_700_000_000, ...overrides });
const check = (decision, ok, reasons, label) => { assertions += 1; frozen(decision); expect(decision.ok === ok, `${label}: unexpected ${JSON.stringify(decision)}`); expect(JSON.stringify(decision.reasonCodes) === JSON.stringify(reasons), `${label}: reasons`); return decision; };

const fixtureStore = store(); const delivery = createEventDelivery(ports({ storage: fixtureStore }));
expect(Object.isFrozen(delivery) && Object.keys(delivery).sort().join(",") === "runDue,submit", "small frozen interface");
expect(Object.isFrozen(delivery.submit) && Object.isFrozen(delivery.runDue), "captured public callables are frozen");
const queued = check(delivery.submit(request()), true, [], "normalized event queues");
expect(queued.value.outcome === "queued" && fixtureStore.snapshot()[0].status === "queued", "durable fixture record created");
check(delivery.submit(request()), true, [], "exact idempotency replay is safe");
expect(fixtureStore.snapshot().length === 1, "duplicate is not persisted twice");
check(delivery.submit(request({ workId: "work-renamed" })), false, ["IDEMPOTENCY_CONFLICT"], "idempotency cannot rename work identity");
check(delivery.submit(request({ payload: { eventId: "event-conflict", eventType: "analytics.aggregate.hourly", aggregateRef: "aggregate-001" } })), false, ["IDEMPOTENCY_CONFLICT"], "idempotency conflict");
check(delivery.submit(request({ idempotencyKey: "idem-work-conflict" })), false, ["WORK_ID_CONFLICT"], "duplicate work identity rejected");
const processed = check(delivery.runDue(), true, [], "due event dispatched");
expect(processed.value.delivered === 1 && fixtureStore.snapshot()[0].status === "delivered", "delivered preserved in durable record");

for (const [kind, payload] of [["scheduled_check", { checkId: "check-001", target: "aggregate-health" }], ["scheduled_summary", { summaryId: "summary-001", cadence: "hourly" }]]) {
  const persistent = store(); const core = createEventDelivery(ports({ storage: persistent }));
  check(core.submit(request({ workId: `work-${kind}`, idempotencyKey: `idem-${kind}`, kind, payload, priority: "high" })), true, [], `${kind} queues`);
  check(core.runDue(), true, [], `${kind} runs`);
}
const orderedStore = store(); const seen = []; const ordered = createEventDelivery(ports({ storage: orderedStore, limits: { maxQueued: 10, batchSize: 5, rateLimitPerRun: 2, concurrencyLimit: 3, retryLimit: 2, safeRequeue: true }, dispatcher: { deliver: (batch) => { seen.push(...batch.map((item) => item.workId)); return batch.map((item) => ({ workId: item.workId, state: "delivered", failureReason: null })); } } }));
for (const [workId, priority] of [["low", "low"], ["critical", "critical"], ["high", "high"]]) check(ordered.submit(request({ workId, idempotencyKey: `idem-${workId}`, priority })), true, [], `queue ${priority}`);
const bounded = check(ordered.runDue(), true, [], "batch rate concurrency bounds");
expect(bounded.value.dispatched === 2 && JSON.stringify(seen) === JSON.stringify(["critical", "high"]), "priority and capacity enforced before dispatch");
expect(orderedStore.snapshot().find((record) => record.workId === "low").status === "queued", "out-of-batch work remains unchanged");

const retryStore = store(); const retry = createEventDelivery(ports({ storage: retryStore, dispatcher: { deliver: (batch) => batch.map((item) => ({ workId: item.workId, state: "retryable_failure", failureReason: "TRANSIENT_FAILURE" })) } }));
check(retry.submit(request()), true, [], "retry request queues"); check(retry.runDue(), true, [], "retry one");
expect(retryStore.snapshot()[0].status === "requeued" && retryStore.snapshot()[0].attempt === 1 && retryStore.snapshot()[0].failureReasons[0] === "TRANSIENT_FAILURE", "safe requeue preserves failure");
check(retry.runDue(), true, [], "retry two"); check(retry.runDue(), true, [], "retry exhausted");
expect(retryStore.snapshot()[0].status === "dead_letter" && retryStore.snapshot()[0].failureReasons.includes("TRANSIENT_FAILURE") && retryStore.snapshot()[0].failureReasons.includes("RETRY_EXHAUSTED"), "exhaustion reaches DLQ without losing adapter reason");
const zeroRetryStore = store(); const zeroRetry = createEventDelivery(ports({ storage: zeroRetryStore, limits: { maxQueued: 10, batchSize: 3, rateLimitPerRun: 2, concurrencyLimit: 2, retryLimit: 0, safeRequeue: true }, dispatcher: { deliver: (batch) => batch.map((item) => ({ workId: item.workId, state: "retryable_failure", failureReason: "FIRST_FAILURE" })) } }));
check(zeroRetry.submit(request()), true, [], "zero retry queue"); check(zeroRetry.runDue(), true, [], "zero retry dead letters"); expect(zeroRetryStore.snapshot()[0].status === "dead_letter" && zeroRetryStore.snapshot()[0].attempt === 0 && JSON.stringify(zeroRetryStore.snapshot()[0].failureReasons) === JSON.stringify(["FIRST_FAILURE", "RETRY_EXHAUSTED"]), "zero retry preserves first failure and bounded attempt");
const maximumRetryStore = store([{ workId: "maximum-retry", fingerprint: "fixture", kind: "scheduled_check", idempotencyKey: "maximum-retry", priority: "normal", scheduledForEpochSeconds: 0, payload: { checkId: "maximum-check", target: "aggregate-health" }, status: "queued", attempt: 20, failureReasons: ["PREVIOUS_FAILURE"], updatedAtEpochSeconds: 0 }]); const maximumRetry = createEventDelivery(ports({ storage: maximumRetryStore, limits: { maxQueued: 10, batchSize: 3, rateLimitPerRun: 2, concurrencyLimit: 2, retryLimit: 20, safeRequeue: true }, dispatcher: { deliver: (batch) => batch.map((item) => ({ workId: item.workId, state: "retryable_failure", failureReason: "FINAL_FAILURE" })) } }));
check(maximumRetry.runDue(), true, [], "maximum retry dead letters"); expect(maximumRetryStore.snapshot()[0].status === "dead_letter" && maximumRetryStore.snapshot()[0].attempt === 20 && maximumRetryStore.snapshot()[0].failureReasons.includes("FINAL_FAILURE") && maximumRetryStore.snapshot()[0].failureReasons.includes("RETRY_EXHAUSTED"), "maximum retry preserves valid bounded record");
const permanentStore = store(); const permanent = createEventDelivery(ports({ storage: permanentStore, dispatcher: { deliver: (batch) => batch.map((item) => ({ workId: item.workId, state: "permanent_failure", failureReason: "INVALID_DESTINATION" })) } }));
check(permanent.submit(request()), true, [], "permanent queue"); check(permanent.runDue(), true, [], "permanent DLQ"); expect(permanentStore.snapshot()[0].status === "dead_letter" && permanentStore.snapshot()[0].failureReasons.includes("INVALID_DESTINATION"), "permanent failure retains reason");
const providerStore = store(); const provider = createEventDelivery(ports({ storage: providerStore, limits: { maxQueued: 10, batchSize: 3, rateLimitPerRun: 2, concurrencyLimit: 2, retryLimit: 2, safeRequeue: false }, dispatcher: { deliver: (batch) => batch.map((item) => ({ workId: item.workId, state: "provider_unavailable", failureReason: null })) } }));
check(provider.submit(request()), true, [], "provider queue"); check(provider.runDue(), true, [], "provider unavailable pauses"); expect(providerStore.snapshot()[0].status === "paused" && providerStore.snapshot()[0].failureReasons.includes("PROVIDER_UNAVAILABLE"), "unavailable provider fails closed without drop");
const fullStore = store([ { workId: "already", fingerprint: "x", kind: "scheduled_check", idempotencyKey: "already", priority: "normal", scheduledForEpochSeconds: 0, payload: { checkId: "check", target: "target" }, status: "queued", attempt: 0, failureReasons: [], updatedAtEpochSeconds: 0 } ]);
check(createEventDelivery(ports({ storage: fullStore, limits: { maxQueued: 1, batchSize: 1, rateLimitPerRun: 1, concurrencyLimit: 1, retryLimit: 0, safeRequeue: true } })).submit(request()), false, ["BACKPRESSURE_LIMIT_REACHED"], "backpressure prevents capacity exhaustion");
const invalidDispatchStore = store(); const invalidDispatch = createEventDelivery(ports({ storage: invalidDispatchStore, dispatcher: { deliver: () => [{ workId: "wrong", state: "delivered", failureReason: null }] } })); check(invalidDispatch.submit(request()), true, [], "invalid dispatch queues"); check(invalidDispatch.runDue(), false, ["DISPATCH_RESULT_INVALID"], "invalid adapter output fails closed"); expect(invalidDispatchStore.snapshot()[0].status === "queued", "invalid adapter cannot lose work");
for (const hostileResult of [Object.defineProperty({}, "workId", { enumerable: true, get() { throw new Error("hostile outcome"); } }), new Proxy([], { get() { throw new Error("hostile proxy outcome"); } })]) { const hostileStore = store(); const hostile = createEventDelivery(ports({ storage: hostileStore, dispatcher: { deliver: () => [hostileResult] } })); check(hostile.submit(request()), true, [], "hostile outcome queues"); check(hostile.runDue(), false, ["DISPATCH_RESULT_INVALID"], "hostile dispatch output never throws"); expect(hostileStore.snapshot()[0].status === "queued", "hostile dispatch output preserves queued work"); }

let duplicateDispatches = 0;
const duplicateRecords = [record(), record({ idempotencyKey: "stored-idem-two", scheduledForEpochSeconds: 1_700_000_500 })];
const duplicateStore = store(duplicateRecords);
const duplicateCore = createEventDelivery(ports({ storage: duplicateStore, dispatcher: { deliver: () => { duplicateDispatches += 1; return []; } } }));
check(duplicateCore.runDue(), false, ["PERSISTENCE_STATE_INVALID"], "stored duplicate work identity fails closed");
check(duplicateCore.submit(request({ workId: "new-work", idempotencyKey: "new-idem" })), false, ["PERSISTENCE_STATE_INVALID"], "submit rejects ambiguous stored identity");
expect(duplicateDispatches === 0 && JSON.stringify(duplicateStore.snapshot()) === JSON.stringify(duplicateRecords), "duplicate persisted identity cannot dispatch or mutate any record");

let trustedNow = 1_700_000_000; let clockDispatches = 0;
const clockStore = store();
const clockCore = createEventDelivery(ports({ storage: clockStore, clock: { nowEpochSeconds: () => trustedNow }, dispatcher: { deliver: (batch) => { clockDispatches += batch.length; return batch.map((item) => ({ workId: item.workId, state: "delivered", failureReason: null })); } } }));
check(clockCore.submit(request({ scheduledForEpochSeconds: 1_700_000_100 })), true, [], "future work queues under trusted clock");
check(clockCore.runDue({ nowEpochSeconds: 1_800_000_000 }), false, ["MALFORMED_RUN_REQUEST"], "caller timestamp has no scheduling authority");
const beforeDue = check(clockCore.runDue(), true, [], "trusted clock keeps future work in queue");
expect(beforeDue.value.outcome === "idle" && clockDispatches === 0 && clockStore.snapshot()[0].status === "queued", "far-future caller cannot make work due");
trustedNow = 1_700_000_100;
check(clockCore.runDue(), true, [], "trusted clock makes work due");
expect(clockDispatches === 1 && clockStore.snapshot()[0].status === "delivered", "only trusted clock controls eligibility");

const mutableStore = store(); let capturedDispatches = 0;
const mutablePorts = ports({ storage: mutableStore, dispatcher: { deliver: (batch) => { capturedDispatches += batch.length; return batch.map((item) => ({ workId: item.workId, state: "delivered", failureReason: null })); } } });
const immutableCore = createEventDelivery(mutablePorts);
check(immutableCore.submit(request({ workId: "immutable-one", idempotencyKey: "immutable-idem-one" })), true, [], "first immutable-port work queues");
check(immutableCore.submit(request({ workId: "immutable-two", idempotencyKey: "immutable-idem-two" })), true, [], "second immutable-port work queues");
mutablePorts.limits.batchSize = 1; mutablePorts.limits.rateLimitPerRun = 1; mutablePorts.limits.concurrencyLimit = 1;
mutablePorts.clock.nowEpochSeconds = () => { throw new Error("mutated clock"); };
mutablePorts.storage.list = () => { throw new Error("mutated list"); }; mutablePorts.storage.save = () => { throw new Error("mutated save"); };
mutablePorts.dispatcher.deliver = () => { throw new Error("mutated dispatcher"); };
const immutableRun = check(immutableCore.runDue(), true, [], "captured ports ignore post-construction mutation");
expect(immutableRun.value.dispatched === 2 && capturedDispatches === 2 && mutableStore.snapshot().every((item) => item.status === "delivered"), "callables and limits are snapshotted at construction");

let persistenceRecords = []; let saveCalls = 0; let dispatchInput;
const failAfterDispatchStorage = {
  list: () => clone(persistenceRecords),
  save: (next) => { saveCalls += 1; if (saveCalls > 1) throw new Error("save unavailable after dispatch"); persistenceRecords = clone(next); }
};
const failAfterDispatch = createEventDelivery(ports({ storage: failAfterDispatchStorage, dispatcher: { deliver: (batch) => { dispatchInput = clone(batch); return batch.map((item) => ({ workId: item.workId, state: "delivered", failureReason: null })); } } }));
check(failAfterDispatch.submit(request()), true, [], "dispatch persistence fixture queues");
check(failAfterDispatch.runDue(), false, ["PERSISTENCE_UNAVAILABLE"], "post-dispatch persistence failure fails closed");
expect(dispatchInput[0].idempotencyKey === "idem-001", "dispatcher receives queue idempotency identity");
expect(persistenceRecords[0].status === "queued", "dispatch-before-persist failure retains queued record for at-least-once retry");

for (const invalidClock of [() => -1, () => "now", () => { throw new Error("clock unavailable"); }]) {
  const clockFailure = createEventDelivery(ports({ clock: { nowEpochSeconds: invalidClock } }));
  check(clockFailure.submit(request()), false, ["CLOCK_UNAVAILABLE"], "invalid trusted clock fails submit closed");
  check(clockFailure.runDue(), false, ["CLOCK_UNAVAILABLE"], "invalid trusted clock fails run closed");
}

for (const candidate of [null, undefined, [], "work", 1, true, { ...request(), rawClicks: [] }, { ...request(), payload: { eventId: "x", eventType: "x", aggregateRef: "x", guestEmail: "x" } }, { ...request(), kind: "ai_request" }, { ...request(), priority: "urgent" }, { ...request(), schema: {} }]) check(delivery.submit(candidate), false, ["MALFORMED_WORK_REQUEST"], "malformed work never throws");
const cyclic = {}; cyclic.self = cyclic; check(delivery.submit(cyclic), false, ["MALFORMED_WORK_REQUEST"], "cyclic work never throws");
const accessor = {}; Object.defineProperty(accessor, "workId", { enumerable: true, get() { throw new Error("hostile"); } }); check(delivery.submit(accessor), false, ["MALFORMED_WORK_REQUEST"], "accessor never throws");
for (const candidate of [null, [], "run", -1, { nowEpochSeconds: -1 }, { nowEpochSeconds: "now" }, { nowEpochSeconds: 1 }, { extra: true }]) check(delivery.runDue(candidate), false, ["MALFORMED_RUN_REQUEST"], "malformed run never throws");
const cyclicRun = {}; cyclicRun.self = cyclicRun; check(delivery.runDue(cyclicRun), false, ["MALFORMED_RUN_REQUEST"], "cyclic run input never throws");
const accessorRun = {}; Object.defineProperty(accessorRun, "nowEpochSeconds", { enumerable: true, get() { throw new Error("hostile run"); } }); check(delivery.runDue(accessorRun), false, ["MALFORMED_RUN_REQUEST"], "run accessor never throws");
check(createEventDelivery(null).submit(request()), false, ["DELIVERY_AUTHORITY_UNAVAILABLE"], "missing ports fail closed");
const hostilePorts = new Proxy({}, { getPrototypeOf() { throw new Error("hostile ports"); } }); check(createEventDelivery(hostilePorts).runDue(), false, ["DELIVERY_AUTHORITY_UNAVAILABLE"], "hostile ports fail closed");
const brokenStorage = { list: () => { throw new Error("offline"); }, save: () => {} }; check(createEventDelivery(ports({ storage: brokenStorage })).submit(request()), false, ["PERSISTENCE_UNAVAILABLE"], "unavailable persistence fails closed");
console.log(JSON.stringify({ validator: "event-delivery-v1", status: "passed", assertions }));
