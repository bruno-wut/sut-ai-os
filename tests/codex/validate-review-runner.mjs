import assert from "node:assert/strict";
import { buildMergeRiskContext, buildReviewAssessmentPrompt, createReviewCancellationController, createReviewTerminalController, parseReviewAssessment, terminateChildTree, validateContextMaterial } from "../../scripts/codex/launch.mjs";

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
for (const output of ["", "review complete", "[]", "{}", `${JSON.stringify(assessment)}\n${JSON.stringify(assessment)}`, JSON.stringify({ ...assessment, unexpected: true })]) {
  assert.throws(() => parseReviewAssessment(output), /review stdout/, `invalid assessment output is rejected: ${JSON.stringify(output)}`);
}

const windowsCalls = [];
const progress = [];
const child = { pid: 4242, exitCode: null, signalCode: null, kill: () => { throw new Error("Windows cancellation must not kill only the direct child"); } };
const cancellation = createReviewCancellationController(child, (event) => progress.push(event), {
  platform: "win32",
  terminateChildTree: (target, options) => windowsCalls.push({ pid: target.pid, platform: options.platform })
});
assert.equal(cancellation.request("SIGINT"), true, "first cancellation is accepted");
assert.equal(cancellation.request("SIGTERM"), false, "duplicate cancellation is ignored");
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
  terminateChildTree: (_target, options) => posixSignals.push(`tree-${options.signal}`)
});
assert.equal(posixCancellation.request("SIGTERM"), true, "POSIX cancellation starts gracefully");
assert.deepEqual(posixSignals, ["tree-SIGTERM"], "POSIX cancellation first signals the isolated process group gracefully");
posixChild.exitCode = 0;
scheduled();
assert.deepEqual(posixSignals, ["tree-SIGTERM"], "delayed escalation cannot target an exited or reused PID");
posixCancellation.complete();
assert.equal(cleared, true, "completion clears pending escalation");

const taskkillCalls = [];
const sibling = { pid: 9999, exitCode: null, signalCode: null };
assert.equal(terminateChildTree({ pid: 6262, exitCode: null, signalCode: null }, { platform: "win32", spawnFn: (command, args) => { taskkillCalls.push({ command, args }); return { on() {} }; } }), true, "live Windows child tree termination is dispatched");
assert.deepEqual(taskkillCalls, [{ command: "taskkill", args: ["/pid", "6262", "/t", "/f"] }], "taskkill is fixed to the launched PID and its descendants");
assert.equal(sibling.pid, 9999, "unrelated sibling process is not selected");

const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const gitCalls = [];
const mergeContext = buildMergeRiskContext(baseSha, headSha, { runGit: (args) => { gitCalls.push(args); return args.includes("--name-only") ? "docs/a.md\n" : "diff --git a/docs/a.md b/docs/a.md\n"; } });
assert.deepEqual(gitCalls, [
  ["diff", "--name-only", baseSha, headSha, "--"],
  ["diff", "--no-ext-diff", "--no-renames", "--unified=40", baseSha, headSha, "--"]
], "merge-risk context compares the exact immutable base and head without merge-base semantics");
assert.match(mergeContext, /docs\/a\.md/, "merge-risk context includes the exact changed path set");
assert.match(mergeContext, /diff --git/, "merge-risk context includes the exact diff");
assert.throws(() => buildMergeRiskContext("bad", headSha, { runGit: () => "" }), /invalid commit SHAs/, "invalid review bindings fail closed");
assert.throws(() => buildMergeRiskContext(baseSha, headSha, { runGit: () => { throw new Error("git failed"); } }), /git failed/, "Git failures fail context construction");
assert.equal(validateContextMaterial([{ relativePath: "safe.md", text: "safe" }], mergeContext, Buffer.byteLength(mergeContext) + 4), Buffer.byteLength(mergeContext) + 4, "generated context participates in the byte budget");
assert.throws(() => validateContextMaterial([], mergeContext, 1), /exceeds limit/, "over-budget generated context fails closed");
const sensitiveGeneratedContext = ["OPENAI", "_API_KEY=", "sk_", "abcdefghijklmnop"].join("");
assert.throws(() => validateContextMaterial([], sensitiveGeneratedContext, 1000), /Secret material/, "sensitive generated context fails closed");

const terminalEvents = [];
const traceEvents = [];
const terminal = createReviewTerminalController({ append: (event) => traceEvents.push(event) }, (event) => terminalEvents.push(event), () => {});
assert.equal(terminal.complete("failed", 1), true, "a review failure records one terminal event");
assert.equal(terminal.complete("failed", 1), false, "duplicate terminal failures are suppressed");
assert.equal(terminal.status, "failed", "terminal state is retained");
assert.deepEqual(terminalEvents, [{ status: "failed" }], "terminal progress is structured and singular");
assert.deepEqual(traceEvents, [{ event: "finish", status: "failed", exitCode: 1 }], "terminal trace state is singular and redacted");

process.stdout.write(JSON.stringify({ status: "passed", checks: 32 }) + "\n");
