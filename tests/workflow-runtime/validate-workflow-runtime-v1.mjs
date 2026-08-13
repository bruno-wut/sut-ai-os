import assert from "node:assert/strict";
import {
  createWorkflowRuntime,
  PROVIDER_STATES,
  WORKFLOW_STATES
} from "../../packages/workflow-contracts/src/workflow-runtime-v1.mjs";

let assertions = 0;
function check(value, message) {
  assert.ok(value, message);
  assertions += 1;
}
function equal(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
}
async function neverThrows(call, message) {
  let value;
  await assert.doesNotReject(async () => { value = await call(); }, message);
  assertions += 1;
  return value;
}

const ACTIONS = new Set(["persist", "continue", "policy_check", "await_approval", "pause", "safe_requeue",
  "resume", "verify", "monitor", "stop", "none", "recover", "deny"]);
function validDecision(value) {
  return value && Object.keys(value).sort().join(",") === ["action", "authoritative", "contractVersion", "failClosed",
    "productionWritePermission", "reasonCode", "state", "workflowId"].sort().join(",")
    && value.contractVersion === "workflow-runtime.v1"
    && (value.workflowId === null || /^[a-z][a-z0-9-]{0,63}$/.test(value.workflowId))
    && WORKFLOW_STATES.includes(value.state) && ACTIONS.has(value.action)
    && /^[A-Z][A-Z0-9_]{0,63}$/.test(value.reasonCode)
    && typeof value.failClosed === "boolean"
    && value.authoritative === false && value.productionWritePermission === false;
}

function makeHarness(overrides = {}) {
  const records = new Map();
  const calls = { quota: 0, status: 0, analyze: 0, propose: 0, policy: 0, approval: 0, execute: 0, verify: 0, outcome: 0, save: 0 };
  let currentTime = 1_800_000_000;
  let providerState = overrides.providerState ?? "available";
  let quotaState = overrides.quotaState ?? "below_warning";
  let approvalDecision = overrides.approvalDecision ?? "approved";
  const ports = {
    clock: { now() { return overrides.clockResult ?? currentTime; } },
    storage: {
      load(id) {
        if (overrides.loadThrows) throw new Error("hostile load");
        if (overrides.loadResult !== undefined) return overrides.loadResult;
        return records.has(id) ? structuredClone(records.get(id)) : null;
      },
      save(record, expectedRevision) {
        calls.save += 1;
        if (overrides.saveThrows) throw new Error("hostile save");
        if (overrides.saveResult !== undefined) return overrides.saveResult;
        if (overrides.saveConflictAt === calls.save) {
          return { saved: false, revision: expectedRevision, previousRevision: expectedRevision };
        }
        const current = records.get(record.workflowId);
        const currentRevision = current?.revision ?? null;
        if (currentRevision !== expectedRevision) return { saved: false, revision: currentRevision, previousRevision: currentRevision };
        records.set(record.workflowId, structuredClone(record));
        return { saved: true, revision: record.revision, previousRevision: expectedRevision };
      }
    },
    quota: {
      read(input) {
        calls.quota += 1;
        if (overrides.quotaThrows) throw new Error("hostile quota");
        if (overrides.quotaResult !== undefined) return overrides.quotaResult;
        return { zone: "ai_workload", bookingIsolated: true, state: quotaState, received: input };
      }
    },
    provider: {
      status(input) {
        calls.status += 1;
        if (overrides.statusThrows) throw new Error("hostile status");
        if (overrides.statusResult !== undefined) return overrides.statusResult;
        return { state: providerState, received: input };
      },
      analyze(input) {
        calls.analyze += 1;
        if (overrides.analyzeThrows) throw new Error("hostile analyze");
        return Object.hasOwn(overrides, "analyzeResult") ? overrides.analyzeResult : { analysisRef: "analysis:canonical" };
      },
      propose(input) {
        calls.propose += 1;
        if (overrides.proposeThrows) throw new Error("hostile propose");
        return Object.hasOwn(overrides, "proposeResult") ? overrides.proposeResult : { proposalRef: "proposal:canonical" };
      }
    },
    policy: {
      evaluate(input) {
        calls.policy += 1;
        if (overrides.policyThrows) throw new Error("hostile policy");
        return Object.hasOwn(overrides, "policyResult") ? overrides.policyResult : {
          decision: "allow",
          reasonCode: "POLICY_ALLOWED",
          approvalRequired: overrides.requiresApproval ?? true
        };
      }
    },
    approval: {
      read(input) {
        calls.approval += 1;
        if (overrides.approvalThrows) throw new Error("hostile approval");
        return Object.hasOwn(overrides, "approvalResult") ? overrides.approvalResult : { decision: approvalDecision, reasonCode: `APPROVAL_${approvalDecision.toUpperCase()}` };
      }
    },
    executor: {
      execute(input) {
        calls.execute += 1;
        if (overrides.executeThrows) throw new Error("hostile executor");
        return Object.hasOwn(overrides, "executeResult") ? overrides.executeResult : { status: "succeeded", reasonCode: "SHADOW_EXECUTION_SUCCEEDED", executionRef: "execution:canonical" };
      }
    },
    verification: {
      verify(input) {
        calls.verify += 1;
        if (overrides.verifyThrows) throw new Error("hostile verifier");
        return Object.hasOwn(overrides, "verifyResult") ? overrides.verifyResult : { status: "passed", reasonCode: "VERIFICATION_PASSED", verificationRef: "verification:canonical" };
      },
      observeOutcome(input) {
        calls.outcome += 1;
        if (overrides.outcomeThrows) throw new Error("hostile outcome");
        return Object.hasOwn(overrides, "outcomeResult") ? overrides.outcomeResult : { status: "completed", reasonCode: "OUTCOME_COMPLETED", outcomeRef: "outcome:canonical" };
      }
    }
  };
  return {
    ports,
    records,
    calls,
    runtime: createWorkflowRuntime(ports),
    setTime(value) { currentTime = value; },
    setProviderState(value) { providerState = value; },
    setQuotaState(value) { quotaState = value; },
    setApproval(value) { approvalDecision = value; }
  };
}

function request(id = "workflow-canonical", maxRecoveries = 2) {
  return { workflowId: id, triggerRef: "event:aggregate-hourly", deadlineEpochSeconds: 1_800_001_000, maxRecoveries };
}

async function progressTo(runtime, id, target) {
  for (let index = 0; index < 20; index += 1) {
    const result = await runtime.advance(id);
    check(validDecision(result), `valid decision while progressing to ${target}`);
    if (result.state === target) return result;
    if (["failed", "rejected", "cancelled", "expired", "inconclusive"].includes(result.state)) break;
  }
  throw new Error(`did not reach ${target}`);
}

function hostileProxy(trap = "get") {
  return new Proxy({}, {
    get() { if (trap === "get") throw new Error("hostile getter"); return undefined; },
    ownKeys() { if (trap === "ownKeys") throw new Error("hostile ownKeys"); return []; },
    getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; }
  });
}

function hostileAccessor(key) {
  const value = {};
  Object.defineProperty(value, key, { enumerable: true, get() { throw new Error("hostile accessor"); } });
  return value;
}

function padHistory(harness, id, targetLength) {
  const record = structuredClone(harness.records.get(id));
  while (record.history.length < targetLength) {
    record.history.push({
      state: record.state,
      atEpochSeconds: record.updatedAtEpochSeconds,
      reasonCode: "BOUNDARY_FIXTURE"
    });
  }
  record.revision = record.history.length - 1;
  harness.records.set(id, record);
  return record;
}

// Exported finite authorities and closed public surface.
equal(PROVIDER_STATES, ["available", "busy", "rate_limited", "capacity_exhausted", "authentication_required", "temporarily_unavailable", "disabled"], "provider states are exact");
equal(new Set(WORKFLOW_STATES).size, WORKFLOW_STATES.length, "workflow states are unique");
check(Object.isFrozen(PROVIDER_STATES) && Object.isFrozen(WORKFLOW_STATES), "finite authorities are frozen");
{
  const harness = makeHarness();
  equal(Object.keys(harness.runtime).sort(), ["advance", "cancel", "recover", "start"], "deep module exposes four cohesive use cases");
  check(Object.isFrozen(harness.runtime), "public surface is frozen");
}

// Canonical full lifecycle persists every authority boundary and ends non-authoritatively.
{
  const harness = makeHarness();
  const started = await harness.runtime.start(request());
  check(validDecision(started), "start returns valid decision");
  equal([started.state, started.action, started.failClosed], ["detected", "persist", false], "start persists detected state");
  const terminal = await progressTo(harness.runtime, "workflow-canonical", "completed");
  equal([terminal.action, terminal.reasonCode, terminal.authoritative, terminal.productionWritePermission], ["stop", "OUTCOME_COMPLETED", false, false], "canonical lifecycle completes without authority");
  const stored = harness.records.get("workflow-canonical");
  for (const state of ["detected", "analysis_running", "proposal_running", "policy_pending", "awaiting_approval", "executing", "verification_running", "outcome_monitoring", "completed"]) {
    check(stored.history.some((entry) => entry.state === state), `${state} was durably persisted`);
  }
  equal([harness.calls.analyze, harness.calls.propose, harness.calls.policy, harness.calls.approval, harness.calls.execute, harness.calls.verify, harness.calls.outcome], [1, 1, 1, 1, 1, 1, 1], "each authority invoked exactly once");
  const terminalAgain = await harness.runtime.advance("workflow-canonical");
  equal([terminalAgain.state, terminalAgain.action, terminalAgain.failClosed], ["completed", "none", true], "terminal workflow cannot advance");
}

// Approval can be omitted only by the trusted workflow request; policy remains mandatory.
{
  const harness = makeHarness({ requiresApproval: false });
  await harness.runtime.start(request("workflow-no-approval"));
  await progressTo(harness.runtime, "workflow-no-approval", "ready_to_execute");
  equal([harness.calls.policy, harness.calls.approval, harness.calls.execute], [1, 0, 0], "policy gates no-approval workflow before execution");
  const executed = await harness.runtime.advance("workflow-no-approval");
  equal(executed.state, "verification_pending", "bounded shadow executor runs after policy allow");
}

// Every non-available provider state fails closed without provider invocation.
for (const state of PROVIDER_STATES.filter((value) => value !== "available")) {
  const harness = makeHarness({ providerState: state });
  const id = `provider-${state.replaceAll("_", "-")}`;
  await harness.runtime.start(request(id));
  await harness.runtime.advance(id);
  const blocked = await harness.runtime.advance(id);
  check(validDecision(blocked), `${state} returns valid decision`);
  equal(blocked.state, "provider_wait", `${state} enters durable provider wait`);
  equal(blocked.action, ["busy", "rate_limited", "temporarily_unavailable"].includes(state) ? "safe_requeue" : "pause", `${state} chooses deterministic wait action`);
  equal([blocked.reasonCode, blocked.failClosed], [`PROVIDER_${state.toUpperCase()}`, true], `${state} records fail-closed reason`);
  equal([harness.calls.analyze, harness.calls.propose, harness.calls.execute], [0, 0, 0], `${state} cannot invoke provider work or executor`);
  harness.setProviderState("available");
  const resumed = await harness.runtime.advance(id);
  equal([resumed.state, resumed.action], ["analysis_pending", "resume"], `${state} resumes one bounded stage when available`);
}

// Malformed and unavailable provider status is treated as disabled authority.
for (const overrides of [{ statusResult: null }, { statusResult: {} }, { statusResult: { state: "mystery" } }, { statusThrows: true }]) {
  const harness = makeHarness(overrides);
  const id = `hostile-status-${assertions}`;
  await harness.runtime.start(request(id));
  await harness.runtime.advance(id);
  const result = await neverThrows(() => harness.runtime.advance(id), "hostile provider status never throws");
  equal([result.state, result.action, result.failClosed], ["provider_wait", "pause", true], "hostile provider status pauses fail closed");
  equal(harness.calls.analyze, 0, "hostile provider status cannot invoke analysis");
}

// Quota warning-90, hard limits, unknown, malformed, unisolated and unavailable authority all block before provider/executor.
const quotaCases = [
  [{ quotaState: "warning_90" }, "QUOTA_WARNING_90"],
  [{ quotaState: "hard_limit_reached" }, "QUOTA_HARD_LIMIT_REACHED"],
  [{ quotaState: "hard_limit_exceeded" }, "QUOTA_HARD_LIMIT_EXCEEDED"],
  [{ quotaState: "unknown" }, "QUOTA_STATE_UNKNOWN"],
  [{ quotaResult: null }, "QUOTA_AUTHORITY_INVALID"],
  [{ quotaResult: { zone: "booking", bookingIsolated: false, state: "below_warning" } }, "BOOKING_CAPACITY_NOT_ISOLATED"],
  [{ quotaThrows: true }, "QUOTA_AUTHORITY_UNAVAILABLE"]
];
for (const [overrides, reason] of quotaCases) {
  const harness = makeHarness(overrides);
  const id = `quota-${assertions}`;
  await harness.runtime.start(request(id));
  await harness.runtime.advance(id);
  const result = await neverThrows(() => harness.runtime.advance(id), "hostile quota never throws");
  equal([result.state, result.action, result.reasonCode, result.failClosed], ["quota_wait", "pause", reason, true], `${reason} blocks deterministically`);
  equal([harness.calls.status, harness.calls.analyze, harness.calls.execute], [0, 0, 0], `${reason} blocks before provider and executor`);
}
for (const quotaState of ["below_warning", "warning_50", "warning_75"]) {
  const harness = makeHarness({ quotaState });
  const id = `allowed-${quotaState.replace("_", "-")}`;
  await harness.runtime.start(request(id));
  await harness.runtime.advance(id);
  const result = await harness.runtime.advance(id);
  equal(result.state, "proposal_pending", `${quotaState} remains an allowed candidate`);
}

// A wait repeats safely and resumes only when the captured authority reports recovery.
{
  const harness = makeHarness({ quotaState: "warning_90" });
  const id = "quota-recovery";
  await harness.runtime.start(request(id)); await harness.runtime.advance(id); await harness.runtime.advance(id);
  const repeated = await harness.runtime.advance(id);
  equal([repeated.state, repeated.reasonCode], ["quota_wait", "QUOTA_WARNING_90"], "quota wait remains durable while saturated");
  harness.setQuotaState("below_warning");
  const resumed = await harness.runtime.advance(id);
  equal([resumed.state, resumed.action], ["analysis_pending", "resume"], "quota wait safely resumes original stage");
}

// The durable 64-entry history contract fails closed without deleting or compacting audit history.
{
  const harness = makeHarness({ providerState: "busy" });
  const id = "provider-history-boundary";
  await harness.runtime.start(request(id));
  await harness.runtime.advance(id);
  await harness.runtime.advance(id);
  padHistory(harness, id, 63);
  const saveCount = harness.calls.save;
  const sixtyFourth = await harness.runtime.advance(id);
  equal([sixtyFourth.state, sixtyFourth.reasonCode], ["provider_wait", "PROVIDER_BUSY"], "provider wait transitions from 63 to 64 entries");
  equal([harness.records.get(id).history.length, harness.records.get(id).revision], [64, 63], "provider wait persists a valid 64-entry record");
  equal(harness.calls.save, saveCount + 1, "63 to 64 provider wait persists exactly once");
  const roundTrip = await neverThrows(() => harness.runtime.advance(id), "64-entry provider record round-trips without self-invalidating");
  equal([roundTrip.state, roundTrip.action, roundTrip.reasonCode, roundTrip.failClosed],
    ["provider_wait", "pause", "WORKFLOW_HISTORY_LIMIT_REACHED", true], "provider outage at 64 fails closed deterministically");
  equal([harness.records.get(id).history.length, harness.records.get(id).revision, harness.calls.save],
    [64, 63, saveCount + 1], "provider outage at 64 neither appends nor persists");
  const repeated = await harness.runtime.advance(id);
  equal([repeated.reasonCode, harness.records.get(id).history.length, harness.calls.save],
    ["WORKFLOW_HISTORY_LIMIT_REACHED", 64, saveCount + 1], "repeated provider outage preserves the exact boundary");
}
{
  const harness = makeHarness({ quotaState: "warning_90" });
  const id = "quota-history-boundary";
  await harness.runtime.start(request(id));
  await harness.runtime.advance(id);
  await harness.runtime.advance(id);
  padHistory(harness, id, 63);
  const saveCount = harness.calls.save;
  const sixtyFourth = await harness.runtime.advance(id);
  equal([sixtyFourth.state, sixtyFourth.reasonCode], ["quota_wait", "QUOTA_WARNING_90"], "quota wait transitions from 63 to 64 entries");
  equal([harness.records.get(id).history.length, harness.records.get(id).revision], [64, 63], "quota wait persists a valid 64-entry record");
  equal(harness.calls.save, saveCount + 1, "63 to 64 quota wait persists exactly once");
  const roundTrip = await neverThrows(() => harness.runtime.advance(id), "64-entry quota record round-trips without self-invalidating");
  equal([roundTrip.state, roundTrip.action, roundTrip.reasonCode, roundTrip.failClosed],
    ["quota_wait", "pause", "WORKFLOW_HISTORY_LIMIT_REACHED", true], "quota outage at 64 fails closed deterministically");
  equal([harness.records.get(id).history.length, harness.records.get(id).revision, harness.calls.save],
    [64, 63, saveCount + 1], "quota outage at 64 neither appends nor persists");
}
{
  const harness = makeHarness();
  const id = "ordinary-history-boundary";
  await harness.runtime.start(request(id));
  padHistory(harness, id, 63);
  const transitioned = await harness.runtime.advance(id);
  equal([transitioned.state, harness.records.get(id).history.length, harness.records.get(id).revision],
    ["analysis_pending", 64, 63], "ordinary pre-boundary transition persists valid 64-entry state");
  const saveCount = harness.calls.save;
  const blocked = await harness.runtime.advance(id);
  equal([blocked.state, blocked.reasonCode, blocked.failClosed],
    ["analysis_pending", "WORKFLOW_HISTORY_LIMIT_REACHED", true], "ordinary transition at 64 fails closed");
  equal([harness.calls.quota, harness.calls.status, harness.calls.analyze, harness.calls.save],
    [0, 0, 0, saveCount], "history boundary blocks before downstream ports and persistence");
  const cancelled = await harness.runtime.cancel(id, "OPERATOR_CANCELLED");
  equal([cancelled.state, cancelled.reasonCode, cancelled.failClosed],
    ["analysis_pending", "WORKFLOW_HISTORY_LIMIT_REACHED", true], "cancellation at 64 preserves immutable audit history");
  equal(harness.calls.save, saveCount, "history-bound cancellation does not persist invalid state");
}

// Two-entry stages reserve both durable slots before their first save or capability call.
for (const [stage, nextState, capability] of [
  ["analysis_pending", "proposal_pending", "analyze"],
  ["proposal_pending", "policy_pending", "propose"],
  ["ready_to_execute", "verification_pending", "execute"],
  ["verification_pending", "outcome_pending", "verify"],
  ["outcome_pending", "completed", "outcome"]
]) {
  const harness = makeHarness();
  const id = `two-slot-block-${stage.replaceAll("_", "-")}`;
  await harness.runtime.start(request(id));
  await progressTo(harness.runtime, id, stage);
  padHistory(harness, id, 63);
  const callsBefore = structuredClone(harness.calls);
  const recordBefore = structuredClone(harness.records.get(id));
  const blocked = await neverThrows(() => harness.runtime.advance(id), `${stage} at 63 never throws`);
  equal([blocked.state, blocked.action, blocked.reasonCode, blocked.failClosed],
    [stage, "pause", "WORKFLOW_HISTORY_LIMIT_REACHED", true], `${stage} at 63 reserves two history slots fail closed`);
  equal(harness.calls, callsBefore, `${stage} at 63 invokes no quota, provider, save, or capability port`);
  equal(harness.records.get(id), recordBefore, `${stage} at 63 leaves durable state byte-for-byte equivalent`);
  equal(harness.calls[capability], callsBefore[capability], `${stage} at 63 does not invoke ${capability}`);

  const successHarness = makeHarness();
  const successId = `two-slot-success-${stage.replaceAll("_", "-")}`;
  await successHarness.runtime.start(request(successId));
  await progressTo(successHarness.runtime, successId, stage);
  padHistory(successHarness, successId, 62);
  const saveCount = successHarness.calls.save;
  const capabilityCount = successHarness.calls[capability];
  const succeeded = await successHarness.runtime.advance(successId);
  equal([succeeded.state, succeeded.failClosed], [nextState, false], `${stage} succeeds from 62 through its two-entry transition`);
  equal([successHarness.records.get(successId).history.length, successHarness.records.get(successId).revision],
    [64, 63], `${stage} 62-to-64 result satisfies the history/revision contract`);
  equal(successHarness.calls.save, saveCount + 2, `${stage} 62-to-64 transition persists running and result states`);
  equal(successHarness.calls[capability], capabilityCount + 1, `${stage} 62-to-64 transition invokes ${capability} once`);
}
{
  const harness = makeHarness();
  const id = "recovery-history-boundary";
  await harness.runtime.start(request(id, 2));
  const record = padHistory(harness, id, 64);
  record.state = "analysis_running";
  record.history.at(-1).state = "analysis_running";
  harness.records.set(id, record);
  const recovered = await harness.runtime.recover(id);
  equal([recovered.state, recovered.reasonCode, recovered.failClosed],
    ["analysis_running", "WORKFLOW_HISTORY_LIMIT_REACHED", true], "recovery at 64 fails closed without corrupting history");
  equal([harness.records.get(id).history.length, harness.records.get(id).revision], [64, 63], "recovery retains the valid 64-entry record");
}
{
  const overLimitHarness = makeHarness();
  const id = "over-limit-history";
  await overLimitHarness.runtime.start(request(id));
  padHistory(overLimitHarness, id, 65);
  const invalid = await neverThrows(() => overLimitHarness.runtime.advance(id), "65-entry persisted history never throws");
  equal([invalid.action, invalid.reasonCode, invalid.failClosed], ["deny", "INTERNAL_STATE_INVALID", true], "65-entry persisted history remains invalid");

  const hostileHistory = hostileAccessor("history");
  const hostileHarness = makeHarness({ loadResult: hostileHistory });
  const hostile = await neverThrows(() => hostileHarness.runtime.advance("hostile-history"), "hostile history accessor never throws");
  equal([hostile.action, hostile.reasonCode, hostile.failClosed], ["deny", "INTERNAL_STATE_INVALID", true], "hostile history accessor fails closed");
}

// The provider can return references only; attempts to inject policy or approval authority fail closed.
for (const [name, overrides] of [
  ["analysis", { analyzeResult: { analysisRef: "analysis:ok", policyDecision: "allow" } }],
  ["proposal", { proposeResult: { proposalRef: "proposal:ok", approvalDecision: "approved" } }],
  ["analysis-null", { analyzeResult: null }],
  ["proposal-throw", { proposeThrows: true }]
]) {
  const harness = makeHarness(overrides);
  const id = `provider-output-${name}`;
  await harness.runtime.start(request(id)); await harness.runtime.advance(id);
  const result = name.startsWith("proposal")
    ? (await harness.runtime.advance(id), await harness.runtime.advance(id))
    : await harness.runtime.advance(id);
  equal([result.state, result.reasonCode, result.failClosed], ["failed", "MALFORMED_PROVIDER_RESULT", true], `${name} provider authority injection/malformation is rejected`);
  equal([harness.calls.policy, harness.calls.approval, harness.calls.execute], [0, 0, 0], `${name} cannot cross policy/approval boundary`);
}

// Policy and approval gates are deterministic and separate.
for (const [policyResult, state] of [
  [{ decision: "deny", reasonCode: "POLICY_DENIED", approvalRequired: true }, "rejected"],
  [{ decision: "allow", reasonCode: "POLICY_ALLOWED", approvalRequired: true, extra: true }, "failed"],
  [{ decision: "maybe", reasonCode: "POLICY_UNKNOWN", approvalRequired: true }, "failed"]
]) {
  const harness = makeHarness({ policyResult });
  const id = `policy-${assertions}`;
  await harness.runtime.start(request(id)); await progressTo(harness.runtime, id, "policy_pending");
  const result = await harness.runtime.advance(id);
  equal(result.state, state, `policy result reaches ${state}`);
  equal([harness.calls.approval, harness.calls.execute], [0, 0], "non-allow policy cannot reach approval or execution");
}
for (const [approvalDecision, state, action] of [
  ["pending", "awaiting_approval", "pause"],
  ["denied", "rejected", "stop"],
  ["expired", "expired", "stop"],
  ["approved", "ready_to_execute", "continue"]
]) {
  const harness = makeHarness({ approvalDecision });
  const id = `approval-${approvalDecision}`;
  await harness.runtime.start(request(id)); await progressTo(harness.runtime, id, "awaiting_approval");
  const result = await harness.runtime.advance(id);
  equal([result.state, result.action], [state, action], `${approvalDecision} approval is deterministic`);
  if (approvalDecision !== "approved") equal(harness.calls.execute, 0, `${approvalDecision} approval cannot execute`);
}

// Quota is checked again immediately before executor invocation.
{
  const harness = makeHarness();
  const id = "executor-quota";
  await harness.runtime.start(request(id)); await progressTo(harness.runtime, id, "ready_to_execute");
  harness.setQuotaState("warning_90");
  const result = await harness.runtime.advance(id);
  equal([result.state, result.reasonCode], ["quota_wait", "QUOTA_WARNING_90"], "saturation immediately before execution pauses");
  equal(harness.calls.execute, 0, "saturation prevents executor invocation");
}

// Executor, verification and outcome outputs are closed and fail closed.
const hostileStageCases = [
  ["executor", { executeResult: { status: "succeeded", reasonCode: "OK", executionRef: "x", approved: true } }, "ready_to_execute", "MALFORMED_EXECUTOR_RESULT"],
  ["executor-throw", { executeThrows: true }, "ready_to_execute", "MALFORMED_EXECUTOR_RESULT"],
  ["verify", { verifyResult: { status: "passed", reasonCode: "OK", verificationRef: null } }, "verification_pending", "MALFORMED_VERIFICATION_RESULT"],
  ["verify-throw", { verifyThrows: true }, "verification_pending", "MALFORMED_VERIFICATION_RESULT"],
  ["outcome", { outcomeResult: { status: "completed", reasonCode: "OK", outcomeRef: null } }, "outcome_pending", "MALFORMED_OUTCOME_RESULT"],
  ["outcome-throw", { outcomeThrows: true }, "outcome_pending", "MALFORMED_OUTCOME_RESULT"]
];
for (const [name, overrides, target, reason] of hostileStageCases) {
  const harness = makeHarness(overrides);
  const id = `hostile-${name}`;
  await harness.runtime.start(request(id)); await progressTo(harness.runtime, id, target);
  const result = await neverThrows(() => harness.runtime.advance(id), `${name} adapter never throws outward`);
  equal([result.state, result.reasonCode, result.failClosed], ["failed", reason, true], `${name} adapter fails closed`);
}

// Bounded timeout and cancellation are durable terminal outcomes.
{
  const harness = makeHarness();
  const id = "workflow-timeout";
  await harness.runtime.start(request(id));
  harness.setTime(1_800_001_000);
  const result = await harness.runtime.advance(id);
  equal([result.state, result.reasonCode, result.failClosed], ["expired", "WORKFLOW_DEADLINE_REACHED", true], "authoritative clock expires workflow");
  equal([harness.calls.analyze, harness.calls.execute], [0, 0], "expired workflow invokes nothing");
}
{
  const harness = makeHarness();
  const id = "workflow-cancel";
  await harness.runtime.start(request(id));
  const cancelled = await harness.runtime.cancel(id, "OPERATOR_CANCELLED");
  equal([cancelled.state, cancelled.reasonCode], ["cancelled", "OPERATOR_CANCELLED"], "cancellation is persisted");
  const advanced = await harness.runtime.advance(id);
  equal([advanced.state, advanced.action], ["cancelled", "none"], "cancelled workflow cannot advance");
}

// Interruption recovery is explicit, bounded and reuses the workflow idempotency key.
{
  const harness = makeHarness();
  const id = "workflow-recovery";
  await harness.runtime.start(request(id, 1)); await progressTo(harness.runtime, id, "ready_to_execute");
  const record = harness.records.get(id);
  record.state = "executing"; record.revision += 1; record.updatedAtEpochSeconds = 1_800_000_000;
  record.history.push({ state: "executing", atEpochSeconds: 1_800_000_000, reasonCode: "SHADOW_EXECUTION_STARTED" });
  harness.records.set(id, record);
  const advanceBlocked = await harness.runtime.advance(id);
  equal([advanceBlocked.action, advanceBlocked.reasonCode], ["recover", "RECOVERY_REQUIRED"], "interrupted state requires recovery");
  const recovered = await harness.runtime.recover(id);
  equal([recovered.state, recovered.action, recovered.failClosed], ["ready_to_execute", "resume", true], "interrupted execution recovers to safe boundary");
  await harness.runtime.advance(id);
  equal(harness.records.get(id).executionRef, "execution:canonical", "recovered execution records result");
}
{
  const harness = makeHarness();
  const id = "recovery-exhausted";
  await harness.runtime.start(request(id, 0)); await progressTo(harness.runtime, id, "ready_to_execute");
  const record = harness.records.get(id);
  record.state = "executing"; record.revision += 1;
  record.history.push({ state: "executing", atEpochSeconds: 1_800_000_000, reasonCode: "SHADOW_EXECUTION_STARTED" });
  harness.records.set(id, record);
  const result = await harness.runtime.recover(id);
  equal([result.state, result.reasonCode], ["failed", "RECOVERY_LIMIT_EXCEEDED"], "recovery exhaustion fails terminally");
}

// Construction captures exact callables: later replacement cannot redefine authority.
{
  const harness = makeHarness({ providerState: "disabled" });
  const id = "captured-ports";
  harness.ports.provider.status = () => ({ state: "available" });
  harness.ports.executor.execute = () => ({ status: "succeeded", reasonCode: "BYPASS", executionRef: "bypass" });
  await harness.runtime.start(request(id)); await harness.runtime.advance(id);
  const result = await harness.runtime.advance(id);
  equal([result.state, result.reasonCode], ["provider_wait", "PROVIDER_DISABLED"], "replaced caller adapter cannot redefine captured authority");
  equal(harness.calls.analyze, 0, "captured disabled provider remains fail closed");
}

// Malformed public inputs and unavailable internal authorities never throw and always return a valid deterministic deny.
const malformedStarts = [null, undefined, [], {}, { workflowId: "Bad" }, request("workflow-extra"), { ...request("workflow-fields"), extra: true },
  { ...request("workflow-deadline"), deadlineEpochSeconds: "soon" }, { ...request("workflow-recovery-limit"), maxRecoveries: 4 }];
malformedStarts[5].triggerRef = "contains space";
for (const input of malformedStarts) {
  const harness = makeHarness();
  const result = await neverThrows(() => harness.runtime.start(input), "malformed start never throws");
  check(validDecision(result), "malformed start returns valid decision");
  equal([result.state, result.action, result.failClosed], ["failed", "deny", true], "malformed start denies fail closed");
}

// Hostile Proxy and accessor traps at every untrusted boundary are contained.
for (const hostile of [hostileProxy("ownKeys"), hostileProxy("get"), hostileAccessor("workflowId")]) {
  const harness = makeHarness();
  const result = await neverThrows(() => harness.runtime.start(hostile), "hostile start object never throws");
  equal([result.state, result.action, result.reasonCode, result.failClosed],
    ["failed", "deny", "MALFORMED_START_REQUEST", true], "hostile start object deterministically fails closed");
}
for (const hostile of [hostileProxy("get"), hostileAccessor("contractVersion")]) {
  const harness = makeHarness({ loadResult: hostile });
  const result = await neverThrows(() => harness.runtime.advance("hostile-record"), "hostile stored record never throws");
  equal([result.action, result.reasonCode, result.failClosed], ["deny", "INTERNAL_STATE_INVALID", true], "hostile stored record deterministically fails closed");
}
{
  const harness = makeHarness({ saveResult: hostileProxy("ownKeys") });
  const result = await neverThrows(() => harness.runtime.start(request("hostile-save")), "hostile save response never throws");
  equal([result.action, result.reasonCode, result.failClosed], ["deny", "INTERNAL_STATE_UNAVAILABLE", true], "hostile save response deterministically fails closed");
}
for (const [name, overrides, expectedState, reason] of [
  ["quota", { quotaResult: hostileProxy("get") }, "quota_wait", "QUOTA_AUTHORITY_UNAVAILABLE"],
  ["provider-status", { statusResult: hostileAccessor("state") }, "provider_wait", "PROVIDER_STATE_INVALID"]
]) {
  const harness = makeHarness(overrides);
  const id = `hostile-boundary-${name}`;
  await harness.runtime.start(request(id)); await harness.runtime.advance(id);
  const result = await neverThrows(() => harness.runtime.advance(id), `${name} hostile result never throws`);
  equal([result.state, result.reasonCode, result.failClosed], [expectedState, reason, true], `${name} hostile result deterministically fails closed`);
}
for (const [name, overrides, target, reason] of [
  ["analysis-proxy", { analyzeResult: hostileProxy("ownKeys") }, "analysis_pending", "MALFORMED_PROVIDER_RESULT"],
  ["proposal-accessor", { proposeResult: hostileAccessor("proposalRef") }, "proposal_pending", "MALFORMED_PROVIDER_RESULT"],
  ["policy-proxy", { policyResult: hostileProxy("ownKeys") }, "policy_pending", "MALFORMED_POLICY_DECISION"],
  ["approval-accessor", { approvalResult: hostileAccessor("decision") }, "awaiting_approval", "MALFORMED_APPROVAL_DECISION"],
  ["executor-proxy", { executeResult: hostileProxy("ownKeys") }, "ready_to_execute", "MALFORMED_EXECUTOR_RESULT"],
  ["verification-accessor", { verifyResult: hostileAccessor("status") }, "verification_pending", "MALFORMED_VERIFICATION_RESULT"],
  ["outcome-proxy", { outcomeResult: hostileProxy("ownKeys") }, "outcome_pending", "MALFORMED_OUTCOME_RESULT"]
]) {
  const harness = makeHarness(overrides);
  const id = `hostile-boundary-${name}`;
  await harness.runtime.start(request(id)); await progressTo(harness.runtime, id, target);
  const result = await neverThrows(() => harness.runtime.advance(id), `${name} never throws`);
  equal([result.state, result.reasonCode, result.failClosed], ["failed", reason, true], `${name} deterministically fails closed`);
}
for (const input of [null, undefined, "", "UPPER", {}, [], "a".repeat(65)]) {
  const harness = makeHarness();
  for (const operation of [() => harness.runtime.advance(input), () => harness.runtime.cancel(input, "OPERATOR_CANCELLED"), () => harness.runtime.recover(input)]) {
    const result = await neverThrows(operation, "malformed workflow id never throws");
    check(validDecision(result), "malformed workflow id returns valid decision");
    equal([result.action, result.failClosed], ["deny", true], "malformed workflow id denies fail closed");
  }
}

{
  const harness = makeHarness({ saveConflictAt: 3 });
  const id = "concurrent-transition";
  await harness.runtime.start(request(id));
  await harness.runtime.advance(id);
  const result = await neverThrows(() => harness.runtime.advance(id), "compare-and-save conflict never throws");
  equal([result.action, result.reasonCode, result.failClosed], ["deny", "INTERNAL_STATE_UNAVAILABLE", true], "compare-and-save conflict fails closed");
  equal([harness.calls.analyze, harness.calls.propose, harness.calls.execute], [0, 0, 0], "compare-and-save conflict prevents capability invocation");
}

const authorityFailures = [
  [null, "INTERNAL_AUTHORITY_UNAVAILABLE"],
  [{}, "INTERNAL_AUTHORITY_UNAVAILABLE"],
  [makeHarness({ clockResult: "now" }).ports, "CLOCK_UNAVAILABLE"],
  [makeHarness({ loadThrows: true }).ports, "INTERNAL_STATE_INVALID"],
  [makeHarness({ saveThrows: true }).ports, "INTERNAL_STATE_UNAVAILABLE"],
  [makeHarness({ saveResult: { saved: false, revision: 0, previousRevision: null } }).ports, "INTERNAL_STATE_UNAVAILABLE"]
];
for (const [ports, reason] of authorityFailures) {
  const runtime = createWorkflowRuntime(ports);
  const result = await neverThrows(() => runtime.start(request(`authority-${assertions}`)), "unavailable authority never throws");
  check(validDecision(result), "unavailable authority returns valid decision");
  equal([result.reasonCode, result.failClosed], [reason, true], `${reason} is deterministic`);
}

// Hostile persisted state never invokes downstream capabilities.
for (const hostile of [
  {},
  { contractVersion: "workflow-runtime.v2" },
  { ...makeHarness().records, state: "ready_to_execute" },
  { contractVersion: "workflow-runtime.v1", workflowId: "crafted", state: "ready_to_execute" }
]) {
  const harness = makeHarness({ loadResult: hostile });
  const result = await neverThrows(() => harness.runtime.advance("crafted"), "hostile persisted state never throws");
  equal([result.state, result.action, result.reasonCode], ["failed", "deny", "INTERNAL_STATE_INVALID"], "hostile persisted state fails closed");
  equal([harness.calls.analyze, harness.calls.policy, harness.calls.approval, harness.calls.execute], [0, 0, 0, 0], "hostile persisted state invokes no capability");
}

// Failed and inconclusive terminal variants remain finite and non-authoritative.
for (const [overrides, target, expected] of [
  [{ executeResult: { status: "failed", reasonCode: "EXECUTION_FAILED", executionRef: null } }, "ready_to_execute", "failed"],
  [{ executeResult: { status: "timed_out", reasonCode: "EXECUTION_TIMED_OUT", executionRef: null } }, "ready_to_execute", "expired"],
  [{ verifyResult: { status: "failed", reasonCode: "VERIFICATION_FAILED", verificationRef: null } }, "verification_pending", "failed"],
  [{ verifyResult: { status: "inconclusive", reasonCode: "VERIFICATION_INCONCLUSIVE", verificationRef: null } }, "verification_pending", "inconclusive"],
  [{ outcomeResult: { status: "failed", reasonCode: "OUTCOME_FAILED", outcomeRef: null } }, "outcome_pending", "failed"],
  [{ outcomeResult: { status: "inconclusive", reasonCode: "OUTCOME_INCONCLUSIVE", outcomeRef: null } }, "outcome_pending", "inconclusive"]
]) {
  const harness = makeHarness(overrides);
  const id = `terminal-${assertions}`;
  await harness.runtime.start(request(id)); await progressTo(harness.runtime, id, target);
  const result = await harness.runtime.advance(id);
  equal([result.state, result.authoritative, result.productionWritePermission], [expected, false, false], `${expected} terminal result is non-authoritative`);
}

console.log(`workflow-runtime-v1 validation passed (${assertions} assertions)`);
