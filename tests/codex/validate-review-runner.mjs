import nodeAssert from "node:assert/strict";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendBoundedReviewOutput, assertReviewRevisionUnchanged, buildLauncherBoundReviewResult, buildMergeRiskContext, buildReviewAssessmentPrompt, completeCancelledReview, completeReviewPreflightFailure, createReviewCancellationController, createReviewTerminalController, parseReviewAssessment, prepareReviewResultPersistence, requireReviewEvidenceSequence, revalidateCurrentReviewBinding, terminateChildTree, validateContextMaterial, validateCurrentContextManifest, validateExactHeadVerification } from "../../scripts/codex/launch.mjs";

let checks = 0;
const assert = new Proxy(nodeAssert, {
  get(target, property) {
    const assertion = target[property];
    if (typeof assertion !== "function") return assertion;
    return (...args) => { checks += 1; return assertion(...args); };
  }
});

const assessment = {
  decision: "pass",
  blockingFindings: [],
  nonBlockingRisks: [],
  missingNegativeTests: [],
  architectureAssessment: {
    deepModules: "bounded review surface",
    hexagonalArchitecture: "no production adapter",
    eventedBoundaries: "not in scope"
  },
  exactNextAction: "Continue to the next required review stage."
};

for (const [profile, stage] of [["plan-review", "planReview"], ["semantic-qa", "semanticReview"], ["merge-risk-review", "mergeRiskReview"]]) {
  const prompt = buildReviewAssessmentPrompt(profile);
  assert.match(prompt, new RegExp(`Requested stage: ${stage}`), `${profile} has an explicit stage prompt`);
  assert.match(prompt, /exactly one JSON object/, `${profile} requires JSON-only output`);
  assert.match(prompt, /schemas\/review-result-v1\.schema\.json/, `${profile} names the required review-result schema`);
}
assert.equal(buildReviewAssessmentPrompt("implementation"), "", "implementation has no review assessment prompt");
assert.deepEqual(parseReviewAssessment(`${JSON.stringify(assessment)}\n`), assessment, "one valid assessment object is accepted");
assert.throws(() => parseReviewAssessment(JSON.stringify({ ...assessment, blockingFindings: ["contradiction"] })), /cannot combine decision pass/, "pass with blocking findings is rejected before launcher binding or persistence");
const validAssessmentJson = JSON.stringify(assessment);
assert.throws(() => parseReviewAssessment(validAssessmentJson.replace('"decision":"pass"', '"decision":"pass","decision":"blocked"')), /duplicate JSON member/, "duplicate top-level assessment fields are rejected");
assert.throws(() => parseReviewAssessment(validAssessmentJson.replace('"deepModules":"bounded review surface"', '"deepModules":"bounded review surface","deepModules":"ambiguous"')), /duplicate JSON member/, "duplicate nested architecture fields are rejected");
for (const output of ["", "review complete", "[]", "{}", `${JSON.stringify(assessment)}\n${JSON.stringify(assessment)}`, JSON.stringify({ ...assessment, unexpected: true })]) {
  assert.throws(() => parseReviewAssessment(output), /review stdout/, `invalid assessment output is rejected: ${JSON.stringify(output)}`);
}

const windowsCalls = [];
const progress = [];
const child = { pid: 4242, exitCode: null, signalCode: null, kill: () => { throw new Error("Windows cancellation must not kill only the direct child"); } };
const cancellation = createReviewCancellationController(child, (event) => progress.push(event), {
  platform: "win32",
  terminateChildTree: (target, options) => { windowsCalls.push({ pid: target.pid, platform: options.platform }); return Promise.resolve({ status: "terminated" }); }
});
assert.equal(cancellation.request("SIGINT"), true, "first cancellation is accepted");
assert.equal(cancellation.request("SIGTERM"), false, "duplicate cancellation is ignored");
assert.deepEqual(await cancellation.termination, { status: "terminated" }, "Windows cancellation exposes its confirmed termination result");
assert.deepEqual(windowsCalls, [{ pid: 4242, platform: "win32" }], "Windows cancellation targets the original live child tree exactly once");
assert.deepEqual(progress.map((event) => event.status), ["cancellation-requested", "cancellation-escalated"], "cancellation exposes structured progress without model output");

const exitedChild = { pid: 4242, exitCode: 0, signalCode: null, kill: () => { throw new Error("exited child must not be signalled"); } };
const exitedProgress = [];
assert.equal(createReviewCancellationController(exitedChild, (event) => exitedProgress.push(event), { platform: "win32", terminateChildTree: () => { throw new Error("exited PID must not be reused"); } }).request("SIGINT"), false, "cancellation after child exit is ignored");
assert.deepEqual(exitedProgress, [], "cancellation after exit emits no misleading state");

let scheduled;
let cleared = false;
const posixSignals = [];
const posixChild = { pid: 5252, exitCode: null, signalCode: null, kill: (signal) => posixSignals.push(signal) };
const posixCancellation = createReviewCancellationController(posixChild, () => {}, {
  platform: "linux",
  graceMs: 1,
  setTimeoutFn: (callback) => { scheduled = callback; return { unref() {} }; },
  clearTimeoutFn: () => { cleared = true; },
  terminateChildTree: (_target, options) => { posixSignals.push(`tree-${options.signal}`); return Promise.resolve({ status: options.signal === "SIGKILL" ? "terminated" : "signalled" }); }
});
assert.equal(posixCancellation.request("SIGTERM"), true, "POSIX cancellation starts gracefully");
assert.deepEqual(posixSignals, ["tree-SIGTERM"], "POSIX cancellation first signals the isolated process group gracefully");
posixChild.exitCode = 0;
scheduled();
assert.deepEqual(posixSignals, ["tree-SIGTERM"], "POSIX escalation never signals the process group after the original child exits");
const posixTerminal = createReviewTerminalController({ append: () => {} }, () => {}, () => {});
assert.equal(await completeCancelledReview(posixCancellation, posixTerminal), "cancelled", "POSIX root-child close after graceful cancellation completes without unsafe escalation");
assert.equal(cleared, true, "completion clears pending escalation");

const taskkillCalls = [];
const sibling = { pid: 9999, exitCode: null, signalCode: null };
let taskkillProcess;
const successfulTermination = terminateChildTree({ pid: 6262, exitCode: null, signalCode: null }, { platform: "win32", spawnFn: (command, args) => { taskkillCalls.push({ command, args }); taskkillProcess = new EventEmitter(); taskkillProcess.kill = () => {}; return taskkillProcess; } });
taskkillProcess.emit("close", 0);
assert.deepEqual(await successfulTermination, { status: "terminated" }, "live Windows child tree termination confirms taskkill success");
assert.deepEqual(taskkillCalls, [{ command: "taskkill", args: ["/pid", "6262", "/t", "/f"] }], "taskkill is fixed to the launched PID and its descendants");
assert.equal(sibling.pid, 9999, "unrelated sibling process is not selected");

for (const [label, event, expectedReason] of [["missing command", "error", "spawn-error"], ["access denied", "error", "spawn-error"], ["nonzero exit", "close", "nonzero-exit"]]) {
  let failedProcess;
  const resultPromise = terminateChildTree({ pid: 6363, exitCode: null, signalCode: null }, { platform: "win32", spawnFn: () => { failedProcess = new EventEmitter(); failedProcess.kill = () => {}; return failedProcess; } });
  failedProcess.emit(event, event === "error" ? new Error(label) : 5);
  assert.equal((await resultPromise).reason, expectedReason, `${label} is an observable tree-termination failure`);
}
let timeoutCallback;
let timeoutKilled = false;
const timeoutResult = terminateChildTree({ pid: 6464, exitCode: null, signalCode: null }, {
  platform: "win32",
  spawnFn: () => { const process = new EventEmitter(); process.kill = () => { timeoutKilled = true; }; return process; },
  setTimeoutFn: (callback) => { timeoutCallback = callback; return { unref() {} }; },
  clearTimeoutFn: () => {}
});
timeoutCallback();
assert.deepEqual(await timeoutResult, { status: "failed", reason: "timeout" }, "hung taskkill fails within the bounded timeout");
assert.equal(timeoutKilled, true, "hung taskkill helper is stopped at the timeout");
assert.deepEqual(await terminateChildTree({ pid: 6565, exitCode: 0, signalCode: null }, { platform: "win32", spawnFn: () => { throw new Error("must not spawn"); } }), { status: "already-exited" }, "already-exited child never reuses its PID");

const failedCancellationProgress = [];
const failedCancellationResults = [];
const failedCancellationChild = { pid: 6666, exitCode: null, signalCode: null };
const failedCancellation = createReviewCancellationController(failedCancellationChild, (event) => failedCancellationProgress.push(event), {
  platform: "win32",
  terminateChildTree: () => Promise.resolve({ status: "failed", reason: "access-denied" }),
  onTerminationFailure: (result) => failedCancellationResults.push(result)
});
assert.equal(failedCancellation.request("SIGTERM"), true, "failed Windows cancellation is accepted once");
await failedCancellation.termination;
assert.deepEqual(failedCancellationProgress.map((event) => event.status), ["cancellation-requested", "cancellation-escalated", "cancellation-failed"], "tree-termination failure reaches one explicit fail-closed state");
assert.deepEqual(failedCancellationResults, [{ status: "failed", reason: "access-denied" }], "tree-termination failure invokes bounded terminal handling");

let childSettleCallback;
const unclosedProgress = [];
const unclosedFailures = [];
const unclosedChild = { pid: 6767, exitCode: null, signalCode: null };
const unclosedCancellation = createReviewCancellationController(unclosedChild, (event) => unclosedProgress.push(event), {
  platform: "win32",
  settleMs: 1,
  setTimeoutFn: (callback) => { childSettleCallback = callback; return { unref() {} }; },
  clearTimeoutFn: () => {},
  terminateChildTree: () => Promise.resolve({ status: "terminated" }),
  onTerminationFailure: (result) => unclosedFailures.push(result)
});
assert.equal(unclosedCancellation.request("SIGINT"), true, "confirmed taskkill starts a bounded child-exit wait");
await unclosedCancellation.termination;
childSettleCallback();
assert.deepEqual(unclosedProgress.map((event) => event.status), ["cancellation-requested", "cancellation-escalated", "cancellation-failed"], "missing child close cannot remain indefinitely cancellation-requested");
assert.deepEqual(unclosedFailures, [{ status: "failed", reason: "child-still-running" }], "missing child close reaches fail-closed terminal handling");

let resolveLateTaskkill;
const lateFailureProgress = [];
const lateFailureResults = [];
const lateFailureChild = { pid: 6868, exitCode: null, signalCode: null };
const lateFailureCancellation = createReviewCancellationController(lateFailureChild, (event) => lateFailureProgress.push(event), {
  platform: "win32",
  terminateChildTree: () => new Promise((resolve) => { resolveLateTaskkill = resolve; }),
  onTerminationFailure: (result) => lateFailureResults.push(result)
});
assert.equal(lateFailureCancellation.request("SIGINT"), true, "Windows cancellation starts before root-child close");
lateFailureChild.exitCode = 1;
const lateTerminalEvents = [];
const lateTerminal = createReviewTerminalController({ append: () => {} }, (event) => lateTerminalEvents.push(event), () => {});
const lateCompletion = completeCancelledReview(lateFailureCancellation, lateTerminal);
resolveLateTaskkill({ status: "failed", reason: "nonzero-exit", exitCode: 5 });
assert.equal(await lateCompletion, "failed", "late taskkill failure overrides an earlier root-child close");
assert.deepEqual(lateFailureProgress.map((event) => event.status), ["cancellation-requested", "cancellation-escalated", "cancellation-failed"], "late taskkill failure remains explicit after root-child close");
assert.deepEqual(lateFailureResults, [{ status: "failed", reason: "nonzero-exit", exitCode: 5 }], "late taskkill failure reaches fail-closed handling");
assert.deepEqual(lateTerminalEvents, [{ status: "failed" }], "late taskkill failure cannot emit a cancelled terminal state");

let resolveConfirmedTaskkill;
const confirmedChild = { pid: 6969, exitCode: null, signalCode: null };
const confirmedCancellation = createReviewCancellationController(confirmedChild, () => {}, {
  platform: "win32",
  terminateChildTree: () => new Promise((resolve) => { resolveConfirmedTaskkill = resolve; })
});
assert.equal(confirmedCancellation.request("SIGTERM"), true, "successful cancellation begins without a terminal outcome");
resolveConfirmedTaskkill({ status: "terminated" });
await confirmedCancellation.termination;
assert.equal(confirmedCancellation.childClosed, false, "taskkill success alone does not confirm root-child close");
const confirmedTerminalEvents = [];
const confirmedTerminal = createReviewTerminalController({ append: () => {} }, (event) => confirmedTerminalEvents.push(event), () => {});
assert.deepEqual(confirmedTerminalEvents, [], "no terminal cancellation is emitted before child close");
confirmedChild.exitCode = 0;
assert.equal(await completeCancelledReview(confirmedCancellation, confirmedTerminal), "cancelled", "cancelled requires taskkill success and explicit child-close confirmation");
assert.equal(confirmedCancellation.childClosed, true, "root-child close confirmation is retained by the controller");
assert.deepEqual(confirmedTerminalEvents, [{ status: "cancelled" }], "both confirmations emit exactly one cancelled terminal outcome");

const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const gitCalls = [];
const mergeContext = buildMergeRiskContext(baseSha, headSha, { runGit: (args) => { gitCalls.push(args); return args.includes("--name-only") ? "forbidden/old.mjs\0allowed/new.mjs\0" : `diff --git a/${args.at(-1)} b/${args.at(-1)}\n`; } });
assert.deepEqual(gitCalls, [
  ["diff", "--no-renames", "--name-only", "-z", baseSha, headSha, "--"],
  ["diff", "--no-ext-diff", "--no-renames", "--unified=8", baseSha, headSha, "--", "forbidden/old.mjs"],
  ["diff", "--no-ext-diff", "--no-renames", "--unified=8", baseSha, headSha, "--", "allowed/new.mjs"]
], "merge-risk context compares exact immutable revisions and maps every changed path to its patch");
assert.match(mergeContext, /forbidden\/old\.mjs/, "no-rename inventory preserves a renamed source under a forbidden boundary");
assert.match(mergeContext, /allowed\/new\.mjs/, "no-rename inventory preserves the renamed destination patch");
assert.match(mergeContext, /diff --git/, "merge-risk context includes the exact diff");
const historicalEvidencePayload = "historical-review-body".repeat(1000);
const boundedEvidenceContext = buildMergeRiskContext(baseSha, headSha, { runGit: (args) => args.includes("--name-only") ? "evidence/reviews/SUT-TEST/semanticReview-old.json\0" : historicalEvidencePayload });
assert.match(boundedEvidenceContext, new RegExp(createHash("sha256").update(historicalEvidencePayload).digest("hex")), "historical review evidence remains bound by its exact patch digest");
assert.doesNotMatch(boundedEvidenceContext, /historical-review-body/, "historical review evidence payload does not recursively consume merge context");
assert.match(boundedEvidenceContext, /Patch bytes:/, "historical evidence digest records deterministic byte length");
assert.throws(() => buildMergeRiskContext("bad", headSha, { runGit: () => "" }), /invalid commit SHAs/, "invalid review bindings fail closed");
assert.throws(() => buildMergeRiskContext(baseSha, headSha, { runGit: () => { throw new Error("git failed"); } }), /git failed/, "Git failures fail context construction");
assert.throws(() => buildMergeRiskContext(baseSha, headSha, { runGit: (args) => args.includes("--name-only") ? "missing.md\0" : "" }), /missing changed path/, "changed-path inventory without a corresponding patch fails closed");
assert.equal(validateContextMaterial([{ relativePath: "safe.md", text: "safe" }], mergeContext, Buffer.byteLength(mergeContext) + 4), Buffer.byteLength(mergeContext) + 4, "generated context participates in the byte budget");
assert.throws(() => validateContextMaterial([], mergeContext, 1), /exceeds limit/, "over-budget generated context fails closed");
const sensitiveGeneratedContext = ["OPENAI", "_API_KEY=", "sk_", "abcdefghijklmnop"].join("");
assert.throws(() => validateContextMaterial([], sensitiveGeneratedContext, 1000), /Secret material/, "sensitive generated context fails closed");

const exactVerification = { schemaVersion: "1.0.0", taskId: "SUT-AIOS-GOV-057", headSha, status: "pass", reviewer: "qa-verification", productionEligible: false, checks: ["all checks passed"] };
assert.equal(validateExactHeadVerification(exactVerification, exactVerification.taskId, headSha), true, "exact-head verification binds task, head, status, reviewer, and checks");
assert.equal(validateExactHeadVerification({ ...exactVerification, headSha: baseSha }, exactVerification.taskId, headSha), false, "stale verification head is rejected");
assert.equal(validateExactHeadVerification({ ...exactVerification, headSha: undefined }, exactVerification.taskId, headSha), false, "SHA-less verification is rejected");
assert.doesNotThrow(() => assertReviewRevisionUnchanged({ headSha, baseSha }, headSha, baseSha), "unchanged app review revision satisfies the persistence boundary");
assert.throws(() => assertReviewRevisionUnchanged({ headSha, baseSha }, baseSha, baseSha), /revision changed/, "app persistence rejects a changed review head");
assert.throws(() => assertReviewRevisionUnchanged({ headSha, baseSha }, headSha, headSha), /revision changed/, "app persistence rejects a changed canonical base");
const revisionFailureProgress = [];
const revisionFailureTrace = [];
const revisionFailureTerminal = createReviewTerminalController({ append: (event) => revisionFailureTrace.push(event) }, (event) => revisionFailureProgress.push(event), () => {});
assert.equal(revalidateCurrentReviewBinding({ headSha, baseSha }, { getHead: () => headSha, getBase: () => { throw new Error("canonical base unavailable"); }, onFailure: () => revisionFailureTerminal.complete("failed", 1) }), false, "canonical-base resolution failure is caught at the successful-close boundary");
assert.deepEqual(revisionFailureTrace, [{ event: "finish", status: "failed", exitCode: 1 }], "canonical-base failure records exactly one failed terminal event");
assert.deepEqual(revisionFailureProgress, [{ status: "failed" }], "canonical-base failure emits structured failed progress");

const evidenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-review-evidence-"));
const evidenceRelative = `evidence/verification/${exactVerification.taskId}/verification-${headSha}.json`;
const evidenceFile = path.join(evidenceRoot, evidenceRelative);
fs.mkdirSync(path.dirname(evidenceFile), { recursive: true });
fs.writeFileSync(evidenceFile, `${JSON.stringify(exactVerification)}\n`);
const evidenceManifest = [{ path: evidenceRelative, sha256: createHash("sha256").update(fs.readFileSync(evidenceFile)).digest("hex") }];
assert.doesNotThrow(() => requireReviewEvidenceSequence({ taskRecord: { data: { taskId: exactVerification.taskId } }, profile: "plan-review", baseSha, headSha, contextManifest: evidenceManifest, root: evidenceRoot }), "unchanged exact-head evidence satisfies the shared preflight gate");
assert.doesNotThrow(() => validateCurrentContextManifest(evidenceManifest, { root: evidenceRoot, profile: "plan-review" }), "unchanged CLI context satisfies final persistence validation");
fs.writeFileSync(evidenceFile, `${JSON.stringify({ ...exactVerification, checks: ["changed during review"] })}\n`);
assert.throws(() => requireReviewEvidenceSequence({ taskRecord: { data: { taskId: exactVerification.taskId } }, profile: "plan-review", baseSha, headSha, contextManifest: evidenceManifest, root: evidenceRoot }), /does not bind required evidence/, "evidence drift is rejected by final shared-gate revalidation");
assert.throws(() => validateCurrentContextManifest(evidenceManifest, { root: evidenceRoot, profile: "plan-review" }), /context file changed before persistence/, "CLI final persistence validation rejects ordinary context drift");
fs.rmSync(evidenceRoot, { recursive: true, force: true });

const terminalEvents = [];
const traceEvents = [];
const terminal = createReviewTerminalController({ append: (event) => traceEvents.push(event) }, (event) => terminalEvents.push(event), () => {});
assert.equal(terminal.complete("failed", 1), true, "a review failure records one terminal event");
assert.equal(terminal.complete("failed", 1), false, "duplicate terminal failures are suppressed");
assert.equal(terminal.status, "failed", "terminal state is retained");
assert.deepEqual(terminalEvents, [{ status: "failed" }], "terminal progress is structured and singular");
assert.deepEqual(traceEvents, [{ event: "finish", status: "failed", exitCode: 1 }], "terminal trace state is singular and redacted");

const preflightProgress = [];
const preflightTrace = [];
const preflightErrors = [];
const preflightTerminal = createReviewTerminalController({ append: (event) => preflightTrace.push(event) }, (event) => preflightProgress.push(event), () => {});
completeReviewPreflightFailure(new Error("context unavailable"), { progress: (event) => preflightProgress.push(event), terminal: preflightTerminal, writeError: (message) => preflightErrors.push(message) });
assert.deepEqual(preflightProgress.map((event) => event.status), ["preflight-failed", "failed"], "preflight failure emits structured progress and one terminal state");
assert.deepEqual(preflightTrace, [{ event: "finish", status: "failed", exitCode: 1 }], "preflight failure records exactly one JSONL terminal event");
assert.match(preflightErrors[0], /context unavailable/, "preflight failure retains a concise diagnostic without governed context contents");

const boundedOutput = { bytes: 0, text: "", capture: true };
assert.equal(appendBoundedReviewOutput(boundedOutput, Buffer.from("1234"), 5), true, "bounded review output accepts content below its byte ceiling");
assert.equal(appendBoundedReviewOutput(boundedOutput, Buffer.from("56"), 5), false, "bounded review output rejects content above its byte ceiling");
assert.equal(boundedOutput.text, "1234", "overflow content is not retained in memory");
const redactedOutput = { bytes: 0, text: "", capture: false };
assert.equal(appendBoundedReviewOutput(redactedOutput, Buffer.from("secret stderr"), 1024), true, "redacted review output is byte-counted");
assert.equal(redactedOutput.text, "", "redacted review stderr is never accumulated");

const persistenceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-review-persistence-"));
const preparedReview = buildLauncherBoundReviewResult(assessment, {
  taskId: "SUT-AIOS-GOV-057", baseSha, headSha, reviewerAgent: "qa-verification", model: "gpt-5.6-luna", reasoningEffort: "high",
  contextManifestHash: "3".repeat(64), reviewedAt: "2026-08-09T12:00:00.000Z", stage: "semanticReview",
  runId: "crash-recovery-run", tracePath: "evidence/reviews/SUT-AIOS-GOV-057/traces/crash-recovery-run-qa-verification-luna.jsonl",
});
const pendingPersistence = prepareReviewResultPersistence(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha, root: persistenceRoot });
const preparedDestination = path.join(persistenceRoot, "evidence", "reviews", preparedReview.taskId, `semanticReview-${headSha}.json`);
assert.equal(fs.existsSync(preparedDestination), false, "a crash before successful terminal provenance exposes no immutable review artifact");
pendingPersistence.abort();
assert.equal(fs.existsSync(preparedDestination), false, "aborting prepared persistence leaves no review artifact");
const finalPersistence = prepareReviewResultPersistence(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha, root: persistenceRoot });
assert.equal(finalPersistence.finalize(), `evidence/reviews/${preparedReview.taskId}/semanticReview-${headSha}.json`, "prepared persistence finalizes atomically after terminal provenance");
assert.equal(fs.existsSync(preparedDestination), true, "finalized review persistence is durable");
fs.rmSync(persistenceRoot, { recursive: true, force: true });

process.stdout.write(JSON.stringify({ status: "passed", checks }) + "\n");
