const CONTRACT_VERSION = "workflow-runtime.v1";

export const WORKFLOW_STATES = Object.freeze([
  "detected",
  "analysis_pending",
  "analysis_running",
  "proposal_pending",
  "proposal_running",
  "policy_pending",
  "awaiting_approval",
  "provider_wait",
  "quota_wait",
  "ready_to_execute",
  "executing",
  "verification_pending",
  "verification_running",
  "outcome_pending",
  "outcome_monitoring",
  "completed",
  "rejected",
  "failed",
  "cancelled",
  "expired",
  "inconclusive"
]);

export const PROVIDER_STATES = Object.freeze([
  "available",
  "busy",
  "rate_limited",
  "capacity_exhausted",
  "authentication_required",
  "temporarily_unavailable",
  "disabled"
]);

const TERMINAL = new Set(["completed", "rejected", "failed", "cancelled", "expired", "inconclusive"]);
const INTERRUPTED = new Map([
  ["analysis_running", "analysis_pending"],
  ["proposal_running", "proposal_pending"],
  ["executing", "ready_to_execute"],
  ["verification_running", "verification_pending"],
  ["outcome_monitoring", "outcome_pending"]
]);
const PROVIDER_STAGES = new Set(["analysis_pending", "proposal_pending"]);
const QUOTA_ALLOWED = new Set(["below_warning", "warning_50", "warning_75"]);
const ID = /^[a-z][a-z0-9-]{0,63}$/;
const REF = /^[a-z][a-z0-9:._/-]{0,127}$/;
const REASON = /^[A-Z][A-Z0-9_]{0,63}$/;

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, keys) {
  if (!object(value)) return false;
  const actual = Object.keys(value).sort();
  return actual.length === keys.length && keys.slice().sort().every((key, index) => key === actual[index]);
}

function integer(value, minimum = 0) {
  return Number.isSafeInteger(value) && value >= minimum;
}

function reference(value) {
  return typeof value === "string" && REF.test(value);
}

function decision(workflowId, state, action, reasonCode, failClosed = false) {
  return Object.freeze({
    contractVersion: CONTRACT_VERSION,
    workflowId: typeof workflowId === "string" && ID.test(workflowId) ? workflowId : null,
    state: WORKFLOW_STATES.includes(state) ? state : "failed",
    action,
    reasonCode,
    failClosed,
    authoritative: false,
    productionWritePermission: false
  });
}

function invalid(reasonCode, workflowId = null) {
  return decision(workflowId, "failed", "deny", reasonCode, true);
}

function snapshotPorts(ports) {
  if (!object(ports)) return null;
  const required = {
    clock: ["now"],
    storage: ["load", "save"],
    quota: ["read"],
    provider: ["status", "analyze", "propose"],
    policy: ["evaluate"],
    approval: ["read"],
    executor: ["execute"],
    verification: ["verify", "observeOutcome"]
  };
  const captured = {};
  for (const [portName, methods] of Object.entries(required)) {
    const source = ports[portName];
    if (!object(source)) return null;
    captured[portName] = {};
    for (const method of methods) {
      if (typeof source[method] !== "function") return null;
      captured[portName][method] = source[method].bind(source);
    }
    Object.freeze(captured[portName]);
  }
  return Object.freeze(captured);
}

async function guarded(call) {
  try {
    return { ok: true, value: await call() };
  } catch {
    return { ok: false, value: null };
  }
}

function validRequest(value) {
  return exactKeys(value, ["workflowId", "triggerRef", "deadlineEpochSeconds", "maxRecoveries"])
    && typeof value.workflowId === "string" && ID.test(value.workflowId)
    && typeof value.triggerRef === "string" && REF.test(value.triggerRef)
    && integer(value.deadlineEpochSeconds, 1)
    && integer(value.maxRecoveries, 0) && value.maxRecoveries <= 3;
}

function validRecord(value) {
  if (!object(value) || value.contractVersion !== CONTRACT_VERSION || typeof value.workflowId !== "string" || !ID.test(value.workflowId)
    || !WORKFLOW_STATES.includes(value.state) || !reference(value.triggerRef)
    || ![null, true, false].includes(value.approvalRequired) || !integer(value.deadlineEpochSeconds, 1)
    || !integer(value.maxRecoveries) || value.maxRecoveries > 3 || !integer(value.recoveryCount)
    || value.recoveryCount > value.maxRecoveries || !integer(value.revision)
    || !integer(value.createdAtEpochSeconds, 1) || !integer(value.updatedAtEpochSeconds, 1)
    || !Array.isArray(value.history) || value.history.length < 1 || value.history.length > 64
    || value.revision !== value.history.length - 1) return false;
  if (!value.history.every((entry) => object(entry) && WORKFLOW_STATES.includes(entry.state)
    && integer(entry.atEpochSeconds, 1) && typeof entry.reasonCode === "string" && REASON.test(entry.reasonCode))
    || value.history.at(-1).state !== value.state) return false;

  const analysisStates = new Set(["proposal_pending", "proposal_running", "policy_pending", "awaiting_approval",
    "provider_wait", "quota_wait", "ready_to_execute", "executing", "verification_pending", "verification_running",
    "outcome_pending", "outcome_monitoring", "completed", "rejected", "failed", "cancelled", "expired", "inconclusive"]);
  const proposalStates = new Set(["policy_pending", "awaiting_approval", "ready_to_execute", "executing",
    "verification_pending", "verification_running", "outcome_pending", "outcome_monitoring", "completed"]);
  const executionStates = new Set(["verification_pending", "verification_running", "outcome_pending", "outcome_monitoring", "completed"]);
  const verificationStates = new Set(["outcome_pending", "outcome_monitoring", "completed"]);
  if (analysisStates.has(value.state) && !reference(value.analysisRef)
    && !["provider_wait", "quota_wait", "failed", "cancelled", "expired", "rejected", "inconclusive"].includes(value.state)) return false;
  if (proposalStates.has(value.state) && !reference(value.proposalRef)) return false;
  if (["ready_to_execute", "executing", ...executionStates].includes(value.state) && value.policyDecision !== "allow") return false;
  if (["awaiting_approval"].includes(value.state) && value.approvalRequired !== true) return false;
  if (["ready_to_execute", "executing", ...executionStates].includes(value.state)
    && value.approvalRequired === true && value.approvalDecision !== "approved") return false;
  if (executionStates.has(value.state) && !reference(value.executionRef)) return false;
  if (verificationStates.has(value.state) && !reference(value.verificationRef)) return false;
  if (value.state === "completed" && !reference(value.outcomeRef)) return false;
  if (value.state === "provider_wait" && !PROVIDER_STAGES.has(value.resumeState)) return false;
  if (value.state === "quota_wait" && !PROVIDER_STAGES.has(value.resumeState) && value.resumeState !== "ready_to_execute") return false;
  if (["provider_wait", "quota_wait"].includes(value.state) && value.resumeState === "proposal_pending"
    && !reference(value.analysisRef)) return false;
  if (value.state === "quota_wait" && value.resumeState === "ready_to_execute"
    && (!reference(value.proposalRef) || value.policyDecision !== "allow"
      || (value.approvalRequired === true && value.approvalDecision !== "approved"))) return false;
  return true;
}

function nextRecord(record, now, state, reasonCode, fields = {}) {
  return {
    ...record,
    ...fields,
    state,
    revision: record.revision + 1,
    updatedAtEpochSeconds: now,
    history: [...record.history, { state, atEpochSeconds: now, reasonCode }]
  };
}

function publicActionForProvider(state) {
  return ["busy", "rate_limited", "temporarily_unavailable"].includes(state) ? "safe_requeue" : "pause";
}

function providerReason(state) {
  return `PROVIDER_${state.toUpperCase()}`;
}

function quotaReason(value) {
  if (!object(value)) return "QUOTA_AUTHORITY_INVALID";
  if (value.bookingIsolated !== true || value.zone !== "ai_workload") return "BOOKING_CAPACITY_NOT_ISOLATED";
  if (typeof value.state !== "string") return "QUOTA_STATE_UNKNOWN";
  if (value.state === "warning_90") return "QUOTA_WARNING_90";
  if (value.state === "hard_limit_reached") return "QUOTA_HARD_LIMIT_REACHED";
  if (value.state === "hard_limit_exceeded") return "QUOTA_HARD_LIMIT_EXCEEDED";
  return "QUOTA_STATE_UNKNOWN";
}

/**
 * Creates the bounded Workflow V1 application core. All infrastructure is
 * supplied through captured outbound ports. The returned use cases never throw.
 */
export function createWorkflowRuntime(ports) {
  const trusted = snapshotPorts(ports);

  async function now() {
    if (!trusted) return null;
    const result = await guarded(() => trusted.clock.now());
    return result.ok && integer(result.value, 1) ? result.value : null;
  }

  async function load(workflowId) {
    const result = await guarded(() => trusted.storage.load(workflowId));
    if (!result.ok) return { ok: false, record: null };
    if (result.value === null) return { ok: true, record: null };
    return validRecord(result.value) ? { ok: true, record: result.value } : { ok: false, record: null };
  }

  async function save(record) {
    const expectedRevision = record.revision === 0 ? null : record.revision - 1;
    const result = await guarded(() => trusted.storage.save(record, expectedRevision));
    return result.ok && exactKeys(result.value, ["saved", "revision", "previousRevision"])
      && result.value.saved === true && result.value.revision === record.revision
      && result.value.previousRevision === expectedRevision;
  }

  async function persist(record, action, reasonCode, failClosed = false) {
    if (!await save(record)) return invalid("INTERNAL_STATE_UNAVAILABLE", record.workflowId);
    return decision(record.workflowId, record.state, action, reasonCode, failClosed);
  }

  async function checkedContext(workflowId) {
    if (!trusted) return { error: invalid("INTERNAL_AUTHORITY_UNAVAILABLE", workflowId) };
    if (typeof workflowId !== "string" || !ID.test(workflowId)) return { error: invalid("MALFORMED_WORKFLOW_ID") };
    const currentTime = await now();
    if (currentTime === null) return { error: invalid("CLOCK_UNAVAILABLE", workflowId) };
    const loaded = await load(workflowId);
    if (!loaded.ok) return { error: invalid("INTERNAL_STATE_INVALID", workflowId) };
    if (loaded.record === null) return { error: invalid("WORKFLOW_NOT_FOUND", workflowId) };
    return { record: loaded.record, now: currentTime };
  }

  async function expireIfDue(record, currentTime) {
    if (!TERMINAL.has(record.state) && currentTime >= record.deadlineEpochSeconds) {
      const expired = nextRecord(record, currentTime, "expired", "WORKFLOW_DEADLINE_REACHED");
      return persist(expired, "stop", "WORKFLOW_DEADLINE_REACHED", true);
    }
    return null;
  }

  async function quotaGate(record, currentTime, resumeState) {
    const observed = await guarded(() => trusted.quota.read(Object.freeze({
      workflowId: record.workflowId,
      stage: resumeState,
      zone: "ai_workload",
      bookingCapacityAllowed: false
    })));
    if (observed.ok && object(observed.value) && observed.value.zone === "ai_workload"
      && observed.value.bookingIsolated === true && QUOTA_ALLOWED.has(observed.value.state)) return null;
    const reasonCode = observed.ok ? quotaReason(observed.value) : "QUOTA_AUTHORITY_UNAVAILABLE";
    const waiting = nextRecord(record, currentTime, "quota_wait", reasonCode, { resumeState, waitReasonCode: reasonCode });
    return persist(waiting, "pause", reasonCode, true);
  }

  async function providerGate(record, currentTime, resumeState) {
    const observed = await guarded(() => trusted.provider.status(Object.freeze({
      workflowId: record.workflowId,
      stage: resumeState
    })));
    const state = observed.ok && object(observed.value) ? observed.value.state : null;
    if (state === "available") return null;
    const known = PROVIDER_STATES.includes(state);
    const reasonCode = known ? providerReason(state) : "PROVIDER_STATE_INVALID";
    const waiting = nextRecord(record, currentTime, "provider_wait", reasonCode, {
      resumeState,
      providerState: known ? state : "disabled",
      waitReasonCode: reasonCode
    });
    return persist(waiting, known ? publicActionForProvider(state) : "pause", reasonCode, true);
  }

  async function start(request) {
    if (!trusted) return invalid("INTERNAL_AUTHORITY_UNAVAILABLE");
    if (!validRequest(request)) return invalid("MALFORMED_START_REQUEST", object(request) ? request.workflowId : null);
    const currentTime = await now();
    if (currentTime === null) return invalid("CLOCK_UNAVAILABLE", request.workflowId);
    if (request.deadlineEpochSeconds <= currentTime) return invalid("INVALID_DEADLINE", request.workflowId);
    const existing = await load(request.workflowId);
    if (!existing.ok) return invalid("INTERNAL_STATE_INVALID", request.workflowId);
    if (existing.record !== null) return decision(request.workflowId, existing.record.state, "none", "WORKFLOW_ALREADY_EXISTS", true);
    const record = {
      contractVersion: CONTRACT_VERSION,
      workflowId: request.workflowId,
      triggerRef: request.triggerRef,
      approvalRequired: null,
      deadlineEpochSeconds: request.deadlineEpochSeconds,
      maxRecoveries: request.maxRecoveries,
      recoveryCount: 0,
      state: "detected",
      revision: 0,
      createdAtEpochSeconds: currentTime,
      updatedAtEpochSeconds: currentTime,
      history: [{ state: "detected", atEpochSeconds: currentTime, reasonCode: "WORKFLOW_STARTED" }]
    };
    return persist(record, "persist", "WORKFLOW_STARTED");
  }

  async function advance(workflowId) {
    const context = await checkedContext(workflowId);
    if (context.error) return context.error;
    let { record } = context;
    const currentTime = context.now;
    if (TERMINAL.has(record.state)) return decision(workflowId, record.state, "none", "WORKFLOW_TERMINAL", true);
    const expired = await expireIfDue(record, currentTime);
    if (expired) return expired;
    if (INTERRUPTED.has(record.state)) return decision(workflowId, record.state, "recover", "RECOVERY_REQUIRED", true);

    if (record.state === "detected") {
      record = nextRecord(record, currentTime, "analysis_pending", "ANALYSIS_REQUESTED");
      return persist(record, "continue", "ANALYSIS_REQUESTED");
    }

    if (record.state === "quota_wait") {
      const resumeState = record.resumeState;
      if (!PROVIDER_STAGES.has(resumeState) && resumeState !== "ready_to_execute") return invalid("INTERNAL_STATE_INVALID", workflowId);
      const blocked = await quotaGate(record, currentTime, resumeState);
      if (blocked) return blocked;
      record = nextRecord(record, currentTime, resumeState, "QUOTA_AVAILABLE", { waitReasonCode: null });
      return persist(record, "resume", "QUOTA_AVAILABLE");
    }

    if (record.state === "provider_wait") {
      const resumeState = record.resumeState;
      if (!PROVIDER_STAGES.has(resumeState)) return invalid("INTERNAL_STATE_INVALID", workflowId);
      const quotaBlocked = await quotaGate(record, currentTime, resumeState);
      if (quotaBlocked) return quotaBlocked;
      const providerBlocked = await providerGate(record, currentTime, resumeState);
      if (providerBlocked) return providerBlocked;
      record = nextRecord(record, currentTime, resumeState, "PROVIDER_AVAILABLE", { providerState: "available", waitReasonCode: null });
      return persist(record, "resume", "PROVIDER_AVAILABLE");
    }

    if (PROVIDER_STAGES.has(record.state)) {
      const quotaBlocked = await quotaGate(record, currentTime, record.state);
      if (quotaBlocked) return quotaBlocked;
      const providerBlocked = await providerGate(record, currentTime, record.state);
      if (providerBlocked) return providerBlocked;

      if (record.state === "analysis_pending") {
        record = nextRecord(record, currentTime, "analysis_running", "ANALYSIS_STARTED");
        if (!await save(record)) return invalid("INTERNAL_STATE_UNAVAILABLE", workflowId);
        const output = await guarded(() => trusted.provider.analyze(Object.freeze({
          workflowId,
          triggerRef: record.triggerRef,
          productionWritePermission: false
        })));
        if (!output.ok || !exactKeys(output.value, ["analysisRef"]) || !reference(output.value.analysisRef)) {
          const failed = nextRecord(record, currentTime, "failed", "MALFORMED_PROVIDER_RESULT");
          return persist(failed, "stop", "MALFORMED_PROVIDER_RESULT", true);
        }
        const next = nextRecord(record, currentTime, "proposal_pending", "ANALYSIS_RECORDED", { analysisRef: output.value.analysisRef });
        return persist(next, "continue", "ANALYSIS_RECORDED");
      }

      record = nextRecord(record, currentTime, "proposal_running", "PROPOSAL_STARTED");
      if (!await save(record)) return invalid("INTERNAL_STATE_UNAVAILABLE", workflowId);
      const output = await guarded(() => trusted.provider.propose(Object.freeze({
        workflowId,
        analysisRef: record.analysisRef,
        productionWritePermission: false
      })));
      if (!output.ok || !exactKeys(output.value, ["proposalRef"]) || !reference(output.value.proposalRef)) {
        const failed = nextRecord(record, currentTime, "failed", "MALFORMED_PROVIDER_RESULT");
        return persist(failed, "stop", "MALFORMED_PROVIDER_RESULT", true);
      }
      const next = nextRecord(record, currentTime, "policy_pending", "PROPOSAL_RECORDED", { proposalRef: output.value.proposalRef });
      return persist(next, "policy_check", "PROPOSAL_RECORDED");
    }

    if (record.state === "policy_pending") {
      const output = await guarded(() => trusted.policy.evaluate(Object.freeze({
        workflowId,
        proposalRef: record.proposalRef,
        productionWritePermission: false
      })));
      if (!output.ok || !exactKeys(output.value, ["decision", "reasonCode", "approvalRequired"])
        || !["allow", "deny"].includes(output.value.decision) || !REASON.test(output.value.reasonCode)
        || typeof output.value.approvalRequired !== "boolean") {
        const failed = nextRecord(record, currentTime, "failed", "MALFORMED_POLICY_DECISION");
        return persist(failed, "stop", "MALFORMED_POLICY_DECISION", true);
      }
      if (output.value.decision === "deny") {
        const rejected = nextRecord(record, currentTime, "rejected", output.value.reasonCode,
          { policyDecision: "deny", approvalRequired: output.value.approvalRequired });
        return persist(rejected, "stop", output.value.reasonCode, true);
      }
      const state = output.value.approvalRequired ? "awaiting_approval" : "ready_to_execute";
      const next = nextRecord(record, currentTime, state, output.value.reasonCode,
        { policyDecision: "allow", approvalRequired: output.value.approvalRequired });
      return persist(next, output.value.approvalRequired ? "await_approval" : "continue", output.value.reasonCode);
    }

    if (record.state === "awaiting_approval") {
      const output = await guarded(() => trusted.approval.read(Object.freeze({ workflowId, proposalRef: record.proposalRef })));
      if (!output.ok || !exactKeys(output.value, ["decision", "reasonCode"])
        || !["pending", "approved", "denied", "expired"].includes(output.value.decision)
        || !REASON.test(output.value.reasonCode)) {
        const failed = nextRecord(record, currentTime, "failed", "MALFORMED_APPROVAL_DECISION");
        return persist(failed, "stop", "MALFORMED_APPROVAL_DECISION", true);
      }
      if (output.value.decision === "pending") return decision(workflowId, record.state, "pause", output.value.reasonCode, true);
      if (output.value.decision === "approved") {
        const next = nextRecord(record, currentTime, "ready_to_execute", output.value.reasonCode, { approvalDecision: "approved" });
        return persist(next, "continue", output.value.reasonCode);
      }
      const state = output.value.decision === "expired" ? "expired" : "rejected";
      const next = nextRecord(record, currentTime, state, output.value.reasonCode, { approvalDecision: output.value.decision });
      return persist(next, "stop", output.value.reasonCode, true);
    }

    if (record.state === "ready_to_execute") {
      const quotaBlocked = await quotaGate(record, currentTime, record.state);
      if (quotaBlocked) return quotaBlocked;
      record = nextRecord(record, currentTime, "executing", "SHADOW_EXECUTION_STARTED");
      if (!await save(record)) return invalid("INTERNAL_STATE_UNAVAILABLE", workflowId);
      const output = await guarded(() => trusted.executor.execute(Object.freeze({
        workflowId,
        idempotencyKey: workflowId,
        proposalRef: record.proposalRef,
        mode: "shadow",
        productionWritePermission: false
      })));
      if (!output.ok || !exactKeys(output.value, ["status", "reasonCode", "executionRef"])
        || !["succeeded", "failed", "timed_out"].includes(output.value.status)
        || !REASON.test(output.value.reasonCode)
        || (output.value.status === "succeeded" && !reference(output.value.executionRef))
        || (output.value.status !== "succeeded" && output.value.executionRef !== null)) {
        const failed = nextRecord(record, currentTime, "failed", "MALFORMED_EXECUTOR_RESULT");
        return persist(failed, "stop", "MALFORMED_EXECUTOR_RESULT", true);
      }
      if (output.value.status !== "succeeded") {
        const state = output.value.status === "timed_out" ? "expired" : "failed";
        const next = nextRecord(record, currentTime, state, output.value.reasonCode);
        return persist(next, "stop", output.value.reasonCode, true);
      }
      const next = nextRecord(record, currentTime, "verification_pending", output.value.reasonCode, { executionRef: output.value.executionRef });
      return persist(next, "verify", output.value.reasonCode);
    }

    if (record.state === "verification_pending") {
      record = nextRecord(record, currentTime, "verification_running", "VERIFICATION_STARTED");
      if (!await save(record)) return invalid("INTERNAL_STATE_UNAVAILABLE", workflowId);
      const output = await guarded(() => trusted.verification.verify(Object.freeze({
        workflowId,
        executionRef: record.executionRef,
        independentRequired: true,
        productionWritePermission: false
      })));
      if (!output.ok || !exactKeys(output.value, ["status", "reasonCode", "verificationRef"])
        || !["passed", "failed", "inconclusive"].includes(output.value.status)
        || !REASON.test(output.value.reasonCode)
        || (output.value.status === "passed" && !reference(output.value.verificationRef))
        || (output.value.status !== "passed" && output.value.verificationRef !== null)) {
        const failed = nextRecord(record, currentTime, "failed", "MALFORMED_VERIFICATION_RESULT");
        return persist(failed, "stop", "MALFORMED_VERIFICATION_RESULT", true);
      }
      if (output.value.status !== "passed") {
        const state = output.value.status === "inconclusive" ? "inconclusive" : "failed";
        const next = nextRecord(record, currentTime, state, output.value.reasonCode);
        return persist(next, "stop", output.value.reasonCode, true);
      }
      const next = nextRecord(record, currentTime, "outcome_pending", output.value.reasonCode, { verificationRef: output.value.verificationRef });
      return persist(next, "monitor", output.value.reasonCode);
    }

    if (record.state === "outcome_pending") {
      record = nextRecord(record, currentTime, "outcome_monitoring", "OUTCOME_MONITORING_STARTED");
      if (!await save(record)) return invalid("INTERNAL_STATE_UNAVAILABLE", workflowId);
      const output = await guarded(() => trusted.verification.observeOutcome(Object.freeze({
        workflowId,
        verificationRef: record.verificationRef,
        productionWritePermission: false
      })));
      if (!output.ok || !exactKeys(output.value, ["status", "reasonCode", "outcomeRef"])
        || !["completed", "failed", "inconclusive"].includes(output.value.status)
        || !REASON.test(output.value.reasonCode)
        || (output.value.status === "completed" && !reference(output.value.outcomeRef))
        || (output.value.status !== "completed" && output.value.outcomeRef !== null)) {
        const failed = nextRecord(record, currentTime, "failed", "MALFORMED_OUTCOME_RESULT");
        return persist(failed, "stop", "MALFORMED_OUTCOME_RESULT", true);
      }
      const next = nextRecord(record, currentTime, output.value.status, output.value.reasonCode,
        output.value.status === "completed" ? { outcomeRef: output.value.outcomeRef } : {});
      return persist(next, "stop", output.value.reasonCode, output.value.status !== "completed");
    }

    return invalid("INTERNAL_STATE_INVALID", workflowId);
  }

  async function cancel(workflowId, reasonCode) {
    const context = await checkedContext(workflowId);
    if (context.error) return context.error;
    if (typeof reasonCode !== "string" || !REASON.test(reasonCode)) return invalid("MALFORMED_CANCELLATION", workflowId);
    if (TERMINAL.has(context.record.state)) return decision(workflowId, context.record.state, "none", "WORKFLOW_TERMINAL", true);
    const record = nextRecord(context.record, context.now, "cancelled", reasonCode);
    return persist(record, "stop", reasonCode, true);
  }

  async function recover(workflowId) {
    const context = await checkedContext(workflowId);
    if (context.error) return context.error;
    const expired = await expireIfDue(context.record, context.now);
    if (expired) return expired;
    const resumeState = INTERRUPTED.get(context.record.state);
    if (!resumeState) return decision(workflowId, context.record.state, "none", "RECOVERY_NOT_REQUIRED", true);
    if (context.record.recoveryCount >= context.record.maxRecoveries) {
      const failed = nextRecord(context.record, context.now, "failed", "RECOVERY_LIMIT_EXCEEDED");
      return persist(failed, "stop", "RECOVERY_LIMIT_EXCEEDED", true);
    }
    const recovered = nextRecord(context.record, context.now, resumeState, "WORKFLOW_RECOVERED", {
      recoveryCount: context.record.recoveryCount + 1
    });
    return persist(recovered, "resume", "WORKFLOW_RECOVERED", true);
  }

  return Object.freeze({ start, advance, cancel, recover });
}
