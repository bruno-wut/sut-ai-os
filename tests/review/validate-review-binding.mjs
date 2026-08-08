import assert from "node:assert/strict";
import { computeReviewOutputHash, validateReviewResult } from "../../scripts/review/validate-review-result.mjs";

const review = {
  schemaVersion: "1.0.0",
  taskId: "SUT-AIOS-GOV-056-FND",
  baseSha: "1".repeat(40),
  headSha: "2".repeat(40),
  reviewerAgent: "qa-verification",
  model: "gpt-5.6-terra",
  reasoningEffort: "high",
  contextManifestHash: "3".repeat(64),
  reviewedAt: "2026-08-01T12:00:00.000Z",
  stage: "semanticReview",
  runId: "20260801-120000-12345678",
  tracePath: "artifacts/traces/codex-routing/20260801-120000-12345678-qa-verification-luna.jsonl",
  outputHash: "",
  decision: "pass",
  blockingFindings: [],
  nonBlockingRisks: ["follow-up review remains separate"],
  missingNegativeTests: [],
  architectureAssessment: {
    deepModules: "not in scope",
    hexagonalArchitecture: "not in scope",
    eventedBoundaries: "not in scope"
  },
  exactNextAction: "Review the exact final Foundation diff."
};
review.outputHash = computeReviewOutputHash(review);

assert.equal(validateReviewResult(review).valid, true, "valid structured review passes");
assert.equal(validateReviewResult(review, {
  taskId: review.taskId,
  baseSha: review.baseSha,
  headSha: review.headSha,
  reviewerAgent: review.reviewerAgent,
  model: review.model,
  reasoningEffort: review.reasoningEffort,
  contextManifestHash: review.contextManifestHash
}).valid, true, "matching SHA and identity binding passes");

const wrongHead = { ...review, headSha: "4".repeat(40) };
assert.equal(validateReviewResult(wrongHead, { headSha: review.headSha }).valid, false, "wrong head SHA is rejected");

const wrongOutput = { ...review, outputHash: "0".repeat(64) };
assert.equal(validateReviewResult(wrongOutput).valid, false, "wrong output hash is rejected");

const passingWithBlocker = { ...review, blockingFindings: ["must fail"] };
passingWithBlocker.outputHash = computeReviewOutputHash(passingWithBlocker);
assert.equal(validateReviewResult(passingWithBlocker).valid, false, "pass with blocking findings is rejected");

process.stdout.write(JSON.stringify({ status: "passed", checks: 5 }) + "\n");
