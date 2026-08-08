import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertProfileAuthorization, buildLauncherBoundReviewResult, comparisonBaseSha, gitSha, persistCodexAppReviewResult, persistReviewResult, prepareCodexAppReviewResult, reviewWorktreeIsClean } from "../../scripts/codex/launch.mjs";
import { createPacket, findPacket, readPacketAt, transition, validatePacket, validateRequiredReviewArtifacts, verificationWorktreeIsClean, writePacket } from "../../scripts/task/task-cli.mjs";
import { computeReviewOutputHash, validateReviewResult } from "../../scripts/review/validate-review-result.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-v2-review-lifecycle-"));
const id = "SUT-TEST-V2-REVIEW";
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const contextManifestHash = "c".repeat(64);

function assessment(nextAction) {
  return {
    decision: "pass",
    blockingFindings: [],
    nonBlockingRisks: [],
    missingNegativeTests: [],
    architectureAssessment: {
      deepModules: "within the Foundation scope",
      hexagonalArchitecture: "no production adapter introduced",
      eventedBoundaries: "not in scope"
    },
    exactNextAction: nextAction
  };
}

try {
  createPacket({ task: id, title: "V2 review lifecycle fixture" }, root);
  let record = findPacket(id, root);
  Object.assign(record.packet, {
    phase: "test", workstream: "governance", workflowId: "v2-review-lifecycle",
    businessObjective: "test", technicalObjective: "test", acceptanceCriteria: ["test"],
    allowedPaths: ["tests/**", "evidence/reviews/**"], forbiddenPaths: ["protected/**"],
    allowedCommands: ["node --version"], requiredChecks: ["fixture"], requiredTests: ["fixture"],
    rollbackExpectations: "remove fixture"
  });
  writePacket(record.file, record.packet);
  transition(id, "ready", "Fixture is ready.", "test", root);
  transition(id, "active", "Fixture implementation starts.", "test", root);
  record = findPacket(id, root);
  const access = { version: "2.0.0" };
  assert.doesNotThrow(() => assertProfileAuthorization("implementation", { format: "json", state: "active", data: record.packet }, access, "codex-engineering-executor"));
  transition(id, "review", "Fixture is ready for independent review.", "codex-engineering-executor", root);
  record = findPacket(id, root);

  const profiles = [
    ["plan-review", "engineering-planner", "gpt-5.6-sol", "sol", "plan review passed"],
    ["semantic-qa", "qa-verification", "gpt-5.6-luna", "luna", "semantic review passed"],
    ["merge-risk-review", "qa-verification", "gpt-5.6-sol", "sol", "merge-risk review passed"]
  ];
  const paths = [];
  for (const [profile, agent, model, route, nextAction] of profiles) {
    const stage = { "plan-review": "planReview", "semantic-qa": "semanticReview", "merge-risk-review": "mergeRiskReview" }[profile];
    assert.doesNotThrow(() => assertProfileAuthorization(profile, { format: "json", state: "review", data: record.packet }, access, agent), `${profile} is authorized by its stage agent`);
    const review = buildLauncherBoundReviewResult(assessment(nextAction), {
      taskId: id, baseSha, headSha, reviewerAgent: agent, model, reasoningEffort: "high",
      contextManifestHash, reviewedAt: "2026-08-08T12:00:00.000Z", stage,
      runId: `fixture-${route}-${agent}`, tracePath: `artifacts/traces/codex-routing/fixture-${route}-${agent}.jsonl`
    });
    assert.equal(validateReviewResult(review).valid, true, `${profile} result is SHA-bound and valid`);
    if (profile === "plan-review") {
      assert.throws(() => persistReviewResult({ ...review, stage: "semanticReview" }, { taskId: id, profile, headSha, root }), /does not match requested/, "persist rejects a profile/stage mismatch");
      assert.throws(() => transition(id, "verified", "Incomplete reviews must fail.", "qa-verification", root, { evidence: "evidence/missing.json", reviewHeadSha: headSha, reviewBaseSha: baseSha, reviewStatusText: "" }), /missing required/, "verified rejects incomplete V2 review evidence");
    }
    const reviewPath = persistReviewResult(review, { taskId: id, profile, headSha, root });
    assert.equal(fs.existsSync(path.join(root, reviewPath)), true, `${profile} result is persisted`);
    paths.push(reviewPath);
  }

  assert.deepEqual(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha), [], "all required review artifacts bind the exact review head and base");
  assert.equal(verificationWorktreeIsClean(" M scripts/codex/launch.mjs", record.packet, headSha), false, "verification rejects unreviewed implementation changes");
  assert.equal(reviewWorktreeIsClean(` M tasks/review/${id}/task.json`, id, headSha), false, "Codex app review rejects a dirty task packet");
  transition(id, "verified", "All stage-specific review artifacts passed.", "qa-verification", root, { evidence: paths.at(-1), reviewHeadSha: headSha, reviewBaseSha: baseSha, reviewStatusText: "" });
  const final = findPacket(id, root);
  assert.equal(final.state, "verified", "fixture reaches verified after persisted independent review");
  assert.equal(final.packet.completionEvidence.includes(paths.at(-1)), true, "verification records durable review evidence");

  const repositoryRoot = path.resolve(import.meta.dirname, "../..");
  const appRoot = path.join(root, "codex-app-fixture");
  fs.mkdirSync(appRoot, { recursive: true });
  const appTaskId = "SUT-AIOS-GOV-056-FND";
  const appHead = gitSha("HEAD");
  const appBase = comparisonBaseSha();
  const appProfiles = [["plan-review", "planReview"], ["semantic-qa", "semanticReview"], ["merge-risk-review", "mergeRiskReview"]];
  const appStatus = [];
  for (const [profile, stage] of appProfiles) {
    const runId = `fixture-app-${stage}`;
    const prepared = prepareCodexAppReviewResult(assessment(`${stage} app review passed`), { taskId: appTaskId, profile, runId, reviewedAt: "2026-08-08T12:00:00.000Z" });
    for (const entry of prepared.contextManifest) {
      const destination = path.join(appRoot, entry.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(repositoryRoot, entry.path), destination);
    }
    const artifact = persistCodexAppReviewResult(prepared, { taskId: appTaskId, profile, headSha: appHead, root: appRoot });
    appStatus.push(`?? ${artifact}`, `?? ${prepared.reviewResult.tracePath}`);
    if (stage === "planReview") {
      const overwritten = structuredClone(prepared);
      overwritten.reviewResult.exactNextAction = "different output using the same run";
      overwritten.reviewResult.outputHash = computeReviewOutputHash(overwritten.reviewResult);
      assert.throws(() => persistCodexAppReviewResult(overwritten, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), /already exists/, "Codex app run envelopes are immutable");
      const traversal = structuredClone(prepared);
      traversal.reviewResult.runId = "../escape";
      assert.throws(() => persistCodexAppReviewResult(traversal, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), /run ID is invalid/, "invalid app run IDs are rejected before persistence");
    }
  }
  const appPacket = readPacketAt(path.join(appRoot, "tasks", "review", appTaskId, "task.json"));
  assert.deepEqual(validateRequiredReviewArtifacts(appPacket, appRoot, appHead, appBase), [], "Codex app artifacts and durable run envelopes validate");
  const forgedVerifiedPacket = { ...appPacket, status: "verified" };
  const forgedValidation = validatePacket(forgedVerifiedPacket, { strict: true, directoryState: "verified", root: appRoot });
  assert.equal(forgedValidation.valid, false, "directly edited verified V2 packet cannot bypass review verification binding");
  assert.match(forgedValidation.errors.join("; "), /reviewVerification/, "direct verification bypass reports the missing binding");
  const malformedPacket = structuredClone(appPacket);
  delete malformedPacket.routingPolicy.semanticReview;
  assert.equal(validatePacket(malformedPacket, { strict: true, directoryState: "review", root: appRoot }).valid, false, "malformed V2 routing cannot enter verification");
  transition(appTaskId, "verified", "Codex app review fixture passed.", "qa-verification", appRoot, { evidence: `evidence/reviews/${appTaskId}/mergeRiskReview-${appHead}.json`, reviewHeadSha: appHead, reviewBaseSha: appBase, reviewStatusText: appStatus.join("\n") });
  const appFinal = findPacket(appTaskId, appRoot);
  const appValidation = validatePacket(appFinal.packet, { strict: true, directoryState: "verified", root: appRoot });
  assert.equal(appValidation.valid, true, `repository validation rechecks verified Codex app evidence: ${appValidation.errors.join("; ")}`);
  process.stdout.write(JSON.stringify({ status: "passed", checks: 27 }) + "\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
