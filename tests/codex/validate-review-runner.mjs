import assert from "node:assert/strict";
import { buildReviewAssessmentPrompt, createReviewCancellationController, parseReviewAssessment } from "../../scripts/codex/launch.mjs";

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

const signals = [];
const progress = [];
let scheduled;
const child = { kill: (signal) => signals.push(signal) };
const cancellation = createReviewCancellationController(child, (event) => progress.push(event), {
  graceMs: 1,
  setTimeoutFn: (callback) => { scheduled = callback; return { unref() {} }; },
  clearTimeoutFn: () => {},
  terminateChildTree: () => signals.push("tree-terminate")
});
assert.equal(cancellation.request("SIGINT"), true, "first cancellation is accepted");
assert.equal(cancellation.request("SIGTERM"), false, "duplicate cancellation is ignored");
assert.deepEqual(signals, ["SIGINT"], "graceful signal targets only the local child first");
scheduled();
assert.deepEqual(signals, ["SIGINT", "tree-terminate"], "escalation terminates only the child tree");
assert.deepEqual(progress.map((event) => event.status), ["cancellation-requested", "cancellation-escalated"], "cancellation exposes structured progress without model output");

process.stdout.write(JSON.stringify({ status: "passed", checks: 16 }) + "\n");
