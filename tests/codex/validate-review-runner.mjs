import nodeAssert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendBoundedReviewOutput, assertReviewRevisionUnchanged, attachChildProcessStreams, buildLauncherBoundReviewResult, buildMergeRiskContext, buildReviewAssessmentPrompt, collectBoundedReviewOutput, completeCancelledReview, completeFailedReviewCancellation, completeReviewPreflightFailure, createReviewCancellationController, createReviewTerminalController, finalizePreparedReviewPublication, parseReviewAssessment, persistReviewResult, prepareReviewResultPersistence, requireReviewEvidenceSequence, revalidateCurrentReviewBinding, terminateChildTree, validateContextMaterial, validateCurrentContextManifest, validateExactHeadVerification, waitForProcessGroupExit } from "../../scripts/codex/launch.mjs";
import { computeReviewOutputHash } from "../../scripts/review/validate-review-result.mjs";
import { computeReviewScopeHash } from "../../scripts/task/task-cli.mjs";

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

const tinyChunkState = { bytes: 0, text: "", capture: true };
const tinyChunkProgress = [];
let tinyChunkAccepted = true;
for (let index = 0; index < 4097; index += 1) {
  tinyChunkAccepted = collectBoundedReviewOutput("stdout", tinyChunkState, Buffer.from("x"), (event) => tinyChunkProgress.push(event), { limit: 4096, interval: 1024 });
}
assert.equal(tinyChunkAccepted, false, "tiny-chunk output fails closed at the explicit byte ceiling");
assert.equal(tinyChunkProgress.length, 4, "thousands of tiny chunks coalesce into deterministic progress milestones");
assert.deepEqual(tinyChunkProgress.map((event) => event.bytes), [1, 1025, 2049, 3073], "coalesced progress records cumulative bounded byte milestones");
assert.equal(tinyChunkProgress.every((event) => event.status === "child-output" && event.stream === "stdout"), true, "coalesced output retains structured stream progress");
const amplificationRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-review-amplification-"));
const amplificationTrace = [];
const amplificationTerminal = createReviewTerminalController({ append: (event) => amplificationTrace.push(event) }, () => {}, () => {});
if (!tinyChunkAccepted) amplificationTerminal.complete("failed", 1);
assert.deepEqual(amplificationTrace, [{ event: "finish", status: "failed", exitCode: 1 }], "tiny-chunk overflow reaches one failed terminal");
assert.equal(fs.existsSync(path.join(amplificationRoot, "evidence", "reviews", "SUT-AIOS-GOV-057")), false, "tiny-chunk overflow publishes no review artifact");
fs.rmSync(amplificationRoot, { recursive: true, force: true });

const makePipeChild = (writeError = null) => {
  const child = { stdin: new EventEmitter(), stdout: new EventEmitter(), stderr: new EventEmitter() };
  child.stdin.write = () => { if (writeError) throw writeError; return true; };
  child.stdin.end = () => {};
  return child;
};
const emittedPipeChild = makePipeChild();
const emittedPipeTrace = [];
const emittedPipeFailures = [];
const emittedPipeTerminal = createReviewTerminalController({ append: (event) => emittedPipeTrace.push(event) }, () => {}, () => {});
const emittedPipeAttachment = attachChildProcessStreams(emittedPipeChild, { prompt: "review", onStdout: () => {}, onStderr: () => {}, onFailure: (stream, error) => { emittedPipeFailures.push({ stream, message: error.message }); emittedPipeTerminal.complete("failed", 1); } });
emittedPipeChild.stdout.emit("error", new Error("stdout broke"));
emittedPipeChild.stderr.emit("error", new Error("stderr also broke"));
assert.deepEqual(emittedPipeFailures, [{ stream: "stdout", message: "stdout broke" }], "multiple emitted pipe failures converge on one process failure");
assert.deepEqual(emittedPipeTrace, [{ event: "finish", status: "failed", exitCode: 1 }], "emitted pipe failure records exactly one failed terminal");
assert.equal(emittedPipeAttachment.failure.stream, "stdout", "the first emitted stream failure remains authoritative");
const synchronousPipeChild = makePipeChild(new Error("stdin write broke"));
const synchronousPipeTrace = [];
const synchronousPipeTerminal = createReviewTerminalController({ append: (event) => synchronousPipeTrace.push(event) }, () => {}, () => {});
const synchronousPipeAttachment = attachChildProcessStreams(synchronousPipeChild, { prompt: "review", onStdout: () => {}, onStderr: () => {}, onFailure: () => synchronousPipeTerminal.complete("failed", 1) });
assert.equal(synchronousPipeAttachment.failure.stream, "stdin", "synchronous stdin failure is captured before it can escape the launcher");
assert.deepEqual(synchronousPipeTrace, [{ event: "finish", status: "failed", exitCode: 1 }], "synchronous stdin failure records exactly one failed terminal");
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

let descendantPoll;
let descendantChecks = 0;
const descendantProgress = [];
const descendantChild = { pid: 5303, exitCode: null, signalCode: null };
const descendantCancellation = createReviewCancellationController(descendantChild, (event) => descendantProgress.push(event), {
  platform: "linux",
  setTimeoutFn: () => ({ unref() {} }),
  clearTimeoutFn: () => {},
  terminateChildTree: () => Promise.resolve({ status: "signalled" }),
  waitForProcessGroupExit: () => new Promise((resolve) => { descendantPoll = () => resolve(++descendantChecks > 0 ? { status: "terminated" } : { status: "failed" }); }),
});
assert.equal(descendantCancellation.request("SIGTERM"), true, "POSIX descendant fixture requests graceful group cancellation");
descendantChild.exitCode = 0;
const descendantTerminalEvents = [];
const descendantTerminal = createReviewTerminalController({ append: () => {} }, (event) => descendantTerminalEvents.push(event), () => {});
const descendantCompletion = completeCancelledReview(descendantCancellation, descendantTerminal);
for (let index = 0; index < 4 && !descendantPoll; index += 1) await Promise.resolve();
assert.deepEqual(descendantTerminalEvents, [], "root-child close cannot emit cancelled while descendant-group confirmation is pending");
descendantPoll();
assert.equal(await descendantCompletion, "cancelled", "POSIX cancellation completes only after descendant group exit is confirmed");
assert.deepEqual(descendantTerminalEvents, [{ status: "cancelled" }], "confirmed descendant-group exit emits one cancelled terminal state");

const persistentDescendantChild = { pid: 5313, exitCode: null, signalCode: null };
const persistentDescendantFailures = [];
const persistentDescendantCancellation = createReviewCancellationController(persistentDescendantChild, () => {}, {
  platform: "linux",
  setTimeoutFn: () => ({ unref() {} }),
  clearTimeoutFn: () => {},
  terminateChildTree: () => Promise.resolve({ status: "signalled" }),
  waitForProcessGroupExit: () => Promise.resolve({ status: "failed", reason: "process-group-still-running" }),
  onTerminationFailure: (result) => persistentDescendantFailures.push(result),
});
persistentDescendantCancellation.request("SIGTERM");
persistentDescendantChild.exitCode = 0;
const persistentDescendantTerminals = [];
assert.equal(await completeCancelledReview(persistentDescendantCancellation, createReviewTerminalController({ append: () => {} }, (event) => persistentDescendantTerminals.push(event), () => {})), "failed", "live descendant after bounded confirmation fails closed");
assert.deepEqual(persistentDescendantFailures, [{ status: "failed", reason: "process-group-still-running" }], "persistent descendant failure remains explicit");
assert.deepEqual(persistentDescendantTerminals, [{ status: "failed" }], "persistent descendant cannot emit cancelled");

let failedCleanupConfirmed = false;
const failedCleanupCancellation = { confirmChildClosed() {}, ensureTerminated: () => Promise.resolve({ status: "signalled" }), confirmProcessGroupTerminated: () => new Promise((resolve) => { failedCleanupConfirmed = true; resolve({ status: "terminated" }); }), complete() {} };
const failedCleanupTerminals = [];
assert.equal(await completeFailedReviewCancellation(failedCleanupCancellation, createReviewTerminalController({ append: () => {} }, (event) => failedCleanupTerminals.push(event), () => {})), "failed", "failed review cleanup completes fail closed");
assert.equal(failedCleanupConfirmed, true, "failed review cleanup awaits descendant-group confirmation");
assert.deepEqual(failedCleanupTerminals, [{ status: "failed" }], "failed review cleanup emits one terminal only after confirmation");

let escalationCallback;
let confirmationCallback;
let confirmationTimerUnref = false;
let processGroupChecks = 0;
const escalatedChild = { pid: 5353, exitCode: null, signalCode: null };
const escalatedCancellation = createReviewCancellationController(escalatedChild, () => {}, {
  platform: "linux",
  graceMs: 1,
  setTimeoutFn: (callback) => { escalationCallback = callback; return { unref() {} }; },
  clearTimeoutFn: () => {},
  terminateChildTree: (_target, options) => options.signal !== "SIGKILL"
    ? Promise.resolve({ status: "signalled" })
    : waitForProcessGroupExit(escalatedChild.pid, {
      timeoutMs: 1000,
      processGroupIsRunning: () => ++processGroupChecks === 1,
      setTimeoutFn: (callback) => {
        confirmationCallback = callback;
        return { unref() { confirmationTimerUnref = true; } };
      },
    }),
});
assert.equal(escalatedCancellation.request("SIGTERM"), true, "POSIX cancellation accepts a live child before escalation");
escalationCallback();
escalatedChild.exitCode = 1;
const escalatedTrace = [];
const escalatedTerminal = createReviewTerminalController({ append: (event) => escalatedTrace.push(event) }, () => {}, () => {});
const escalatedCompletion = completeCancelledReview(escalatedCancellation, escalatedTerminal);
await Promise.resolve();
assert.deepEqual(escalatedTrace, [], "root-child close cannot publish a terminal event before process-group confirmation");
assert.equal(confirmationTimerUnref, false, "bounded POSIX process-group confirmation remains referenced");
confirmationCallback();
assert.equal(await escalatedCompletion, "cancelled", "confirmed process-group exit completes cancellation");
assert.deepEqual(escalatedTrace, [{ event: "finish", status: "cancelled", exitCode: 130 }], "POSIX escalation records exactly one terminal cancellation event");
const escalatedRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-review-posix-cancel-"));
assert.equal(fs.existsSync(path.join(escalatedRoot, "evidence", "reviews", "SUT-AIOS-GOV-057")), false, "POSIX cancellation publishes no review artifact");
fs.rmSync(escalatedRoot, { recursive: true, force: true });

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
const taskPacketPayload = "task-lifecycle-history".repeat(1000);
const boundedTaskPacketContext = buildMergeRiskContext(baseSha, headSha, { runGit: (args) => args.includes("--name-only") ? "tasks/review/SUT-TEST/task.json\0" : taskPacketPayload });
assert.match(boundedTaskPacketContext, new RegExp(createHash("sha256").update(taskPacketPayload).digest("hex")), "task packet patch remains bound by its exact digest");
assert.match(boundedTaskPacketContext, /full current task packet is included separately/, "task packet digest explains the full governed source");
assert.doesNotMatch(boundedTaskPacketContext, /task-lifecycle-history/, "duplicated task lifecycle patch does not consume merge context");
const governedDocumentPayload = "workflow-document-patch".repeat(1000);
const boundedDocumentContext = buildMergeRiskContext(baseSha, headSha, { fullContextPaths: ["docs/project/TASK_WORKFLOW.md"], runGit: (args) => args.includes("--name-only") ? "docs/project/TASK_WORKFLOW.md\0" : governedDocumentPayload });
assert.match(boundedDocumentContext, new RegExp(createHash("sha256").update(governedDocumentPayload).digest("hex")), "separately included governed documentation patch remains bound by its exact digest");
assert.match(boundedDocumentContext, /full current document is included separately/, "governed documentation digest identifies its complete current source");
assert.doesNotMatch(boundedDocumentContext, /workflow-document-patch/, "duplicated governed documentation patch does not consume merge context");
const inlineImplementationContext = buildMergeRiskContext(baseSha, headSha, { fullContextPaths: ["scripts/codex/launch.mjs"], runGit: (args) => args.includes("--name-only") ? "scripts/codex/launch.mjs\0" : "implementation-patch-body" });
assert.match(inlineImplementationContext, /implementation-patch-body/, "implementation patches remain inline even when the current file is separately governed");
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
const persistenceTaskDirectory = path.join(persistenceRoot, "tasks", "review", "SUT-AIOS-GOV-057");
fs.mkdirSync(persistenceTaskDirectory, { recursive: true });
const persistencePacket = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../..", "tasks", "active", "SUT-AIOS-GOV-057", "task.json"), "utf8"));
persistencePacket.status = "review";
persistencePacket.updatedDate = "2026-08-09T12:00:00.000Z";
persistencePacket.stateTransitions.push({ from: "active", to: "review", at: persistencePacket.updatedDate, actor: "test", reason: "direct persistence fixture" });
fs.writeFileSync(path.join(persistenceTaskDirectory, "task.json"), `${JSON.stringify(persistencePacket, null, 2)}\n`);
const git = (args) => nodeAssert.equal(spawnSync("git", args, { cwd: persistenceRoot, encoding: "utf8", windowsHide: true }).status, 0);
git(["init", "-q"]);
git(["config", "user.email", "test@example.invalid"]);
git(["config", "user.name", "GOV-057 test"]);
git(["add", "tasks"]);
git(["commit", "-qm", "fixture"]);
git(["remote", "add", "origin", persistenceRoot]);
git(["update-ref", "refs/remotes/origin/main", "HEAD"]);
const persistenceHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: persistenceRoot, encoding: "utf8", windowsHide: true }).stdout.trim();
const persistenceTaskRelative = "tasks/review/SUT-AIOS-GOV-057/task.json";
const persistenceVerificationRelative = `evidence/verification/SUT-AIOS-GOV-057/verification-${persistenceHead}.json`;
const persistenceVerificationFile = path.join(persistenceRoot, persistenceVerificationRelative);
fs.mkdirSync(path.dirname(persistenceVerificationFile), { recursive: true });
fs.writeFileSync(persistenceVerificationFile, `${JSON.stringify({ schemaVersion: "1.0.0", taskId: "SUT-AIOS-GOV-057", headSha: persistenceHead, status: "pass", reviewer: "qa-verification", productionEligible: false, reviewedAt: "2026-08-09T12:00:00.000Z", checks: ["fixture passed"] }, null, 2)}\n`);
const persistenceManifest = [persistenceTaskRelative, persistenceVerificationRelative].map((relativePath) => ({ path: relativePath, sha256: createHash("sha256").update(fs.readFileSync(path.join(persistenceRoot, relativePath))).digest("hex") }));
const persistenceManifestHash = createHash("sha256").update(persistenceManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n")).digest("hex");
const preparedReview = buildLauncherBoundReviewResult(assessment, {
  taskId: "SUT-AIOS-GOV-057", baseSha: persistenceHead, headSha: persistenceHead, reviewerAgent: "qa-verification", model: "gpt-5.6-luna", reasoningEffort: "high",
  contextManifestHash: persistenceManifestHash, reviewedAt: "2026-08-09T12:00:00.000Z", stage: "semanticReview",
  runId: "crash-recovery-run", tracePath: "evidence/reviews/SUT-AIOS-GOV-057/traces/crash-recovery-run-qa-verification-luna.jsonl",
});
const pendingPersistence = prepareReviewResultPersistence(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot });
const preparedDestination = path.join(persistenceRoot, "evidence", "reviews", preparedReview.taskId, `semanticReview-${persistenceHead}.json`);
assert.equal(fs.existsSync(preparedDestination), false, "a crash before successful terminal provenance exposes no immutable review artifact");
pendingPersistence.abort();
assert.equal(fs.existsSync(preparedDestination), false, "aborting prepared persistence leaves no review artifact");
const traversalReview = { ...preparedReview, tracePath: `evidence/reviews/${preparedReview.taskId}/traces/${preparedReview.runId}-${preparedReview.reviewerAgent}-luna/../../escaped.jsonl` };
traversalReview.outputHash = computeReviewOutputHash(traversalReview);
assert.throws(() => persistReviewResult(traversalReview, { taskId: traversalReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), /traversal components/, "direct persistence rejects a traversal-shaped trace before reading it");
const crossTaskReview = { ...preparedReview, tracePath: `evidence/reviews/SUT-OTHER/traces/${preparedReview.runId}-${preparedReview.reviewerAgent}-luna.jsonl` };
crossTaskReview.outputHash = computeReviewOutputHash(crossTaskReview);
assert.throws(() => persistReviewResult(crossTaskReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), /tracePath must match taskId/, "direct persistence rejects another task's trace directory");
assert.equal(revalidateCurrentReviewBinding({ headSha: preparedReview.headSha, baseSha: preparedReview.baseSha }, { getHead: () => preparedReview.headSha, getBase: () => preparedReview.baseSha }), true, "successful review binding accepts the exact current head and canonical base object");
const successfulTraceFile = path.join(persistenceRoot, preparedReview.tracePath);
fs.mkdirSync(path.dirname(successfulTraceFile), { recursive: true });
const successfulStartEvent = { event: "start", taskId: preparedReview.taskId, agentId: preparedReview.reviewerAgent, route: "luna", model: preparedReview.model, profile: "semantic-qa" };
const successfulChildStartEvent = { event: "review-progress", runId: preparedReview.runId, taskId: preparedReview.taskId, profile: "semantic-qa", status: "child-started" };
const successfulBoundEvent = { event: "review-bound", ...Object.fromEntries(["runId", "taskId", "baseSha", "headSha", "stage", "reviewerAgent", "model", "reasoningEffort", "contextManifestHash", "outputHash"].map((key) => [key, preparedReview[key]])), contextManifest: persistenceManifest, reviewedTaskScopeHash: computeReviewScopeHash(persistencePacket) };
const successfulFinishEvent = { event: "finish", status: "success", exitCode: 0 };
const writePersistenceTrace = (events) => fs.writeFileSync(successfulTraceFile, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
writePersistenceTrace([successfulChildStartEvent, successfulBoundEvent, successfulFinishEvent]);
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), /begin with exactly one start/, "direct persistence rejects a prefix-truncated launcher trace");
writePersistenceTrace([successfulStartEvent, successfulBoundEvent, successfulFinishEvent]);
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), /exactly one child-started/, "direct persistence rejects missing child-started progress");
writePersistenceTrace([successfulStartEvent, successfulChildStartEvent, successfulBoundEvent, successfulFinishEvent]);
writePersistenceTrace([{ ...successfulStartEvent, prompt: "must never persist" }, successfulChildStartEvent, successfulBoundEvent, successfulFinishEvent]);
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), /forbidden fields: prompt/, "direct persistence rejects prompt-bearing trace events");
assert.equal(fs.existsSync(preparedDestination), false, "forbidden trace payload publishes no review artifact");
writePersistenceTrace([successfulStartEvent, successfulChildStartEvent, { ...successfulBoundEvent, reviewedTaskScopeHash: "0".repeat(64) }, successfulFinishEvent]);
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), /reviewed task scope does not match/, "direct persistence rejects a mismatched review-scope hash");
writePersistenceTrace([successfulStartEvent, successfulChildStartEvent, { ...successfulBoundEvent, contextManifest: [{ ...persistenceManifest[0], sha256: "f".repeat(64) }] }, successfulFinishEvent]);
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), /context manifest hash|governed context/, "direct persistence rejects a mismatched context manifest");
const persistenceTaskFile = path.join(persistenceTaskDirectory, "task.json");
fs.writeFileSync(persistenceTaskFile, `${JSON.stringify({ ...persistencePacket, status: "active" }, null, 2)}\n`);
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), /valid V2 task packet in review/, "direct persistence rejects a non-review lifecycle state");
fs.writeFileSync(persistenceTaskFile, `${JSON.stringify({ ...persistencePacket, routingPolicy: null }, null, 2)}\n`);
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), /valid V2 task packet in review/, "direct persistence rejects a malformed current packet");
fs.writeFileSync(persistenceTaskFile, `${JSON.stringify(persistencePacket, null, 2)}\n`);
writePersistenceTrace([successfulStartEvent, successfulChildStartEvent, successfulBoundEvent, successfulFinishEvent]);
const originalPersistenceTask = fs.readFileSync(persistenceTaskFile, "utf8");
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot, beforeFinalValidation: () => fs.writeFileSync(persistenceTaskFile, originalPersistenceTask.replace('"status": "review"', '"status": "active"')) }), /valid V2 task packet in review/, "final direct-persistence gate rejects packet lifecycle drift");
fs.writeFileSync(persistenceTaskFile, originalPersistenceTask);
const originalVerification = fs.readFileSync(persistenceVerificationFile, "utf8");
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot, beforeFinalValidation: () => fs.appendFileSync(persistenceVerificationFile, " ") }), /governed context file does not match/, "final direct-persistence gate rejects governed-context drift");
fs.writeFileSync(persistenceVerificationFile, originalVerification);
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot, beforeFinalValidation: () => git(["commit", "--allow-empty", "-qm", "stale head"]) }), /headSha/, "final direct-persistence gate rejects HEAD drift");
const staleHead = spawnSync("git", ["rev-parse", "HEAD"], { cwd: persistenceRoot, encoding: "utf8", windowsHide: true }).stdout.trim();
git(["update-ref", "HEAD", persistenceHead]);
assert.throws(() => persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot, beforeFinalValidation: () => git(["update-ref", "refs/remotes/origin/main", staleHead]) }), /baseSha/, "final direct-persistence gate rejects canonical-base drift");
git(["update-ref", "refs/remotes/origin/main", persistenceHead]);
assert.equal(fs.existsSync(preparedDestination), false, "stale final-state races publish no review artifact");
for (const [field, value] of [["reviewerAgent", "engineering-planner"], ["model", "gpt-5.6-sol"], ["reasoningEffort", "medium"]]) {
  const forged = { ...preparedReview, [field]: value };
  forged.outputHash = computeReviewOutputHash(forged);
  assert.throws(() => persistReviewResult(forged, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), new RegExp(field), `direct persistence rejects forged ${field}`);
  assert.equal(fs.existsSync(preparedDestination), false, `forged ${field} publishes no review artifact`);
}
assert.equal(persistReviewResult(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot }), `evidence/reviews/${preparedReview.taskId}/semanticReview-${persistenceHead}.json`, "successful exact-revision review persists after binding validation");
const finalPersistence = prepareReviewResultPersistence(preparedReview, { taskId: preparedReview.taskId, profile: "semantic-qa", headSha: persistenceHead, root: persistenceRoot });
assert.equal(finalPersistence.finalize(), `evidence/reviews/${preparedReview.taskId}/semanticReview-${persistenceHead}.json`, "prepared persistence finalizes atomically after terminal provenance");
assert.equal(fs.existsSync(preparedDestination), true, "finalized review persistence is durable");
const publicationFailureTrace = [];
const publicationFailureProgress = [];
const publicationFailureTerminal = createReviewTerminalController({ append: (event) => publicationFailureTrace.push(event) }, (event) => publicationFailureProgress.push(event), () => {});
let publicationAbort = false;
assert.equal(finalizePreparedReviewPublication({ finalize() { throw new Error("simulated publication failure"); }, abort() { publicationAbort = true; } }, { terminal: publicationFailureTerminal, trace: { append: (event) => publicationFailureTrace.push(event) }, progress: (event) => publicationFailureProgress.push(event), writeError: () => {}, setExitCode: () => {} }), null, "publication failure returns no review artifact");
assert.equal(publicationAbort, true, "publication failure aborts pending review output");
assert.deepEqual(publicationFailureTrace, [{ event: "finish", status: "success", exitCode: 0 }, { event: "finish", status: "failed", exitCode: 1 }], "publication failure invalidates prior success with a failed terminal");
assert.equal(publicationFailureProgress.at(-1).status, "review-persistence-failed", "publication failure remains observable");
fs.rmSync(persistenceRoot, { recursive: true, force: true });

process.stdout.write(JSON.stringify({ status: "passed", checks }) + "\n");
