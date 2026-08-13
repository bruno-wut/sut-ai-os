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
const check = (decision, ok, reasons, label) => { assertions += 1; frozen(decision); expect(decision.ok === ok, `${label}: unexpected ${JSON.stringify(decision)}`); expect(JSON.stringify(decision.reasonCodes) === JSON.stringify(reasons), `${label}: reasons`); return decision; };

const fixtureStore = store(); const delivery = createEventDelivery(ports({ storage: fixtureStore }));
expect(Object.isFrozen(delivery) && Object.keys(delivery).sort().join(",") === "runDue,submit", "small frozen interface");
const queued = check(delivery.submit(request()), true, [], "normalized event queues");
expect(queued.value.outcome === "queued" && fixtureStore.snapshot()[0].status === "queued", "durable fixture record created");
check(delivery.submit(request({ workId: "work-renamed" })), true, [], "same idempotency is safe");
expect(fixtureStore.snapshot().length === 1, "duplicate is not persisted twice");
check(delivery.submit(request({ payload: { eventId: "event-conflict", eventType: "analytics.aggregate.hourly", aggregateRef: "aggregate-001" } })), false, ["IDEMPOTENCY_CONFLICT"], "idempotency conflict");
const processed = check(delivery.runDue({ nowEpochSeconds: 1_700_000_000 }), true, [], "due event dispatched");
expect(processed.value.delivered === 1 && fixtureStore.snapshot()[0].status === "delivered", "delivered preserved in durable record");

for (const [kind, payload] of [["scheduled_check", { checkId: "check-001", target: "aggregate-health" }], ["scheduled_summary", { summaryId: "summary-001", cadence: "hourly" }]]) {
  const persistent = store(); const core = createEventDelivery(ports({ storage: persistent }));
  check(core.submit(request({ workId: `work-${kind}`, idempotencyKey: `idem-${kind}`, kind, payload, priority: "high" })), true, [], `${kind} queues`);
  check(core.runDue({ nowEpochSeconds: 1_700_000_000 }), true, [], `${kind} runs`);
}
const orderedStore = store(); const seen = []; const ordered = createEventDelivery(ports({ storage: orderedStore, limits: { maxQueued: 10, batchSize: 5, rateLimitPerRun: 2, concurrencyLimit: 3, retryLimit: 2, safeRequeue: true }, dispatcher: { deliver: (batch) => { seen.push(...batch.map((item) => item.workId)); return batch.map((item) => ({ workId: item.workId, state: "delivered", failureReason: null })); } } }));
for (const [workId, priority] of [["low", "low"], ["critical", "critical"], ["high", "high"]]) check(ordered.submit(request({ workId, idempotencyKey: `idem-${workId}`, priority })), true, [], `queue ${priority}`);
const bounded = check(ordered.runDue({ nowEpochSeconds: 1_700_000_000 }), true, [], "batch rate concurrency bounds");
expect(bounded.value.dispatched === 2 && JSON.stringify(seen) === JSON.stringify(["critical", "high"]), "priority and capacity enforced before dispatch");

const retryStore = store(); const retry = createEventDelivery(ports({ storage: retryStore, dispatcher: { deliver: (batch) => batch.map((item) => ({ workId: item.workId, state: "retryable_failure", failureReason: "TRANSIENT_FAILURE" })) } }));
check(retry.submit(request()), true, [], "retry request queues"); check(retry.runDue({ nowEpochSeconds: 1_700_000_000 }), true, [], "retry one");
expect(retryStore.snapshot()[0].status === "requeued" && retryStore.snapshot()[0].attempt === 1 && retryStore.snapshot()[0].failureReasons[0] === "TRANSIENT_FAILURE", "safe requeue preserves failure");
check(retry.runDue({ nowEpochSeconds: 1_700_000_001 }), true, [], "retry two"); check(retry.runDue({ nowEpochSeconds: 1_700_000_002 }), true, [], "retry exhausted");
expect(retryStore.snapshot()[0].status === "dead_letter" && retryStore.snapshot()[0].failureReasons.includes("RETRY_EXHAUSTED"), "exhaustion reaches DLQ");
const permanentStore = store(); const permanent = createEventDelivery(ports({ storage: permanentStore, dispatcher: { deliver: (batch) => batch.map((item) => ({ workId: item.workId, state: "permanent_failure", failureReason: "INVALID_DESTINATION" })) } }));
check(permanent.submit(request()), true, [], "permanent queue"); check(permanent.runDue({ nowEpochSeconds: 1_700_000_000 }), true, [], "permanent DLQ"); expect(permanentStore.snapshot()[0].status === "dead_letter" && permanentStore.snapshot()[0].failureReasons.includes("INVALID_DESTINATION"), "permanent failure retains reason");
const providerStore = store(); const provider = createEventDelivery(ports({ storage: providerStore, limits: { maxQueued: 10, batchSize: 3, rateLimitPerRun: 2, concurrencyLimit: 2, retryLimit: 2, safeRequeue: false }, dispatcher: { deliver: (batch) => batch.map((item) => ({ workId: item.workId, state: "provider_unavailable", failureReason: null })) } }));
check(provider.submit(request()), true, [], "provider queue"); check(provider.runDue({ nowEpochSeconds: 1_700_000_000 }), true, [], "provider unavailable pauses"); expect(providerStore.snapshot()[0].status === "paused" && providerStore.snapshot()[0].failureReasons.includes("PROVIDER_UNAVAILABLE"), "unavailable provider fails closed without drop");
const fullStore = store([ { workId: "already", fingerprint: "x", kind: "scheduled_check", idempotencyKey: "already", priority: "normal", scheduledForEpochSeconds: 0, payload: { checkId: "check", target: "target" }, status: "queued", attempt: 0, failureReasons: [], updatedAtEpochSeconds: 0 } ]);
check(createEventDelivery(ports({ storage: fullStore, limits: { maxQueued: 1, batchSize: 1, rateLimitPerRun: 1, concurrencyLimit: 1, retryLimit: 0, safeRequeue: true } })).submit(request()), false, ["BACKPRESSURE_LIMIT_REACHED"], "backpressure prevents capacity exhaustion");
const invalidDispatchStore = store(); const invalidDispatch = createEventDelivery(ports({ storage: invalidDispatchStore, dispatcher: { deliver: () => [{ workId: "wrong", state: "delivered", failureReason: null }] } })); check(invalidDispatch.submit(request()), true, [], "invalid dispatch queues"); check(invalidDispatch.runDue({ nowEpochSeconds: 1_700_000_000 }), false, ["DISPATCH_RESULT_INVALID"], "invalid adapter output fails closed"); expect(invalidDispatchStore.snapshot()[0].status === "queued", "invalid adapter cannot lose work");

for (const candidate of [null, undefined, [], "work", 1, true, { ...request(), rawClicks: [] }, { ...request(), payload: { eventId: "x", eventType: "x", aggregateRef: "x", guestEmail: "x" } }, { ...request(), kind: "ai_request" }, { ...request(), priority: "urgent" }, { ...request(), schema: {} }]) check(delivery.submit(candidate), false, ["MALFORMED_WORK_REQUEST"], "malformed work never throws");
const cyclic = {}; cyclic.self = cyclic; check(delivery.submit(cyclic), false, ["MALFORMED_WORK_REQUEST"], "cyclic work never throws");
const accessor = {}; Object.defineProperty(accessor, "workId", { enumerable: true, get() { throw new Error("hostile"); } }); check(delivery.submit(accessor), false, ["MALFORMED_WORK_REQUEST"], "accessor never throws");
for (const candidate of [null, {}, { nowEpochSeconds: -1 }, { nowEpochSeconds: "now" }, { nowEpochSeconds: 1, extra: true }]) check(delivery.runDue(candidate), false, ["MALFORMED_RUN_REQUEST"], "malformed run never throws");
check(createEventDelivery(null).submit(request()), false, ["DELIVERY_AUTHORITY_UNAVAILABLE"], "missing ports fail closed");
const brokenStorage = { list: () => { throw new Error("offline"); }, save: () => {} }; check(createEventDelivery(ports({ storage: brokenStorage })).submit(request()), false, ["PERSISTENCE_UNAVAILABLE"], "unavailable persistence fails closed");
console.log(JSON.stringify({ validator: "event-delivery-v1", status: "passed", assertions }));
