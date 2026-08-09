import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertProfileAuthorization, buildLauncherBoundReviewResult, comparisonBaseSha, gitSha, persistCodexAppReviewResult, persistReviewResult, prepareCodexAppReviewResult, reviewWorktreeIsClean } from "../../scripts/codex/launch.mjs";
import { createPacket, findPacket, readPacketAt, transition, validatePacket, validateRequiredReviewArtifacts, verificationWorktreeIsClean, writePacket } from "../../scripts/task/task-cli.mjs";
import { computeReviewOutputHash, validateReviewResult } from "../../scripts/review/validate-review-result.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-v2-review-lifecycle-"));
const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-v2-review-external-"));
const id = "SUT-TEST-V2-REVIEW";
const baseSha = "a".repeat(40);
const headSha = "b".repeat(40);
const sha256 = (value) => createHash("sha256").update(value).digest("hex");

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
  const reviewedTaskPacketText = fs.readFileSync(record.file, "utf8");
  const contextManifest = [{ path: `tasks/review/${id}/task.json`, sha256: sha256(reviewedTaskPacketText) }];
  const contextManifestHash = sha256(contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));

  const profiles = [
    ["plan-review", "engineering-planner", "gpt-5.6-sol", "sol", "plan review passed"],
    ["semantic-qa", "qa-verification", "gpt-5.6-luna", "luna", "semantic review passed"],
    ["merge-risk-review", "qa-verification", "gpt-5.6-sol", "sol", "merge-risk review passed"]
  ];
  fs.mkdirSync(path.join(root, "evidence"), { recursive: true });
  fs.writeFileSync(path.join(root, "evidence", "missing.json"), "{}\n");
  const paths = [];
  for (const [profile, agent, model, route, nextAction] of profiles) {
    const stage = { "plan-review": "planReview", "semantic-qa": "semanticReview", "merge-risk-review": "mergeRiskReview" }[profile];
    assert.doesNotThrow(() => assertProfileAuthorization(profile, { format: "json", state: "review", data: record.packet }, access, agent), `${profile} is authorized by its stage agent`);
    const review = buildLauncherBoundReviewResult(assessment(nextAction), {
      taskId: id, baseSha, headSha, reviewerAgent: agent, model, reasoningEffort: "high",
      contextManifestHash, reviewedAt: "2026-08-08T12:00:00.000Z", stage,
      runId: `fixture-${route}-${agent}`, tracePath: `artifacts/traces/codex-routing/${id}/fixture-${route}-${agent}-${agent}-${route}.jsonl`
    });
    assert.equal(validateReviewResult(review).valid, true, `${profile} result is SHA-bound and valid`);
    if (profile === "plan-review") {
      assert.throws(() => persistReviewResult({ ...review, stage: "semanticReview" }, { taskId: id, profile, headSha, root }), /does not match requested/, "persist rejects a profile/stage mismatch");
      assert.throws(() => transition(id, "verified", "Incomplete reviews must fail.", "qa-verification", root, { evidence: "evidence/missing.json", reviewHeadSha: headSha, reviewBaseSha: baseSha, reviewStatusText: "" }), /missing required/, "verified rejects incomplete V2 review evidence");
    }
    const traceFile = path.join(root, review.tracePath);
    fs.mkdirSync(path.dirname(traceFile), { recursive: true });
    const traceSerialized = [
      JSON.stringify({ event: "start", taskId: id, agentId: agent, route, model }),
      JSON.stringify({ event: "review-bound", runId: review.runId, taskId: id, baseSha, headSha, stage, reviewerAgent: agent, model, reasoningEffort: "high", contextManifestHash, outputHash: review.outputHash, contextManifest, reviewedTaskPacketText }),
      JSON.stringify({ event: "finish", status: "success", exitCode: 0 })
    ].join("\n") + "\n";
    fs.writeFileSync(traceFile, traceSerialized);
    const reviewPath = persistReviewResult(review, { taskId: id, profile, headSha, root });
    if (profile === "plan-review") {
      fs.unlinkSync(traceFile);
      assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha).join("; "), /launcher trace is missing/, "missing launcher trace fails closed");
      fs.writeFileSync(traceFile, traceSerialized);
    }
    assert.equal(fs.existsSync(path.join(root, reviewPath)), true, `${profile} result is persisted`);
    paths.push(reviewPath);
  }

  assert.deepEqual(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha), [], "all required review artifacts bind the exact review head and base");
  assert.throws(() => transition(id, "verified", "Missing evidence must fail.", "qa-verification", root, { evidence: "evidence/tasks/SUT-TEST-V2-REVIEW/missing.md", reviewHeadSha: headSha, reviewBaseSha: baseSha, reviewStatusText: "" }), /does not exist/, "verified transition rejects a missing evidence reference");
  assert.equal(findPacket(id, root).state, "review", "missing evidence rejection leaves the task in review");
  const externalEvidence = path.join(externalRoot, "outside.md");
  fs.writeFileSync(externalEvidence, "outside repository\n");
  const linkedEvidenceDirectory = path.join(root, "evidence", "linked-external");
  fs.symlinkSync(externalRoot, linkedEvidenceDirectory, process.platform === "win32" ? "junction" : "dir");
  const beforeEscapeAttempts = JSON.stringify(findPacket(id, root).packet);
  for (const evidence of [path.join("evidence", "linked-external", "outside.md"), externalEvidence, path.relative(root, externalEvidence), "evidence", `${paths.at(-1)}:hidden`]) {
    assert.throws(() => transition(id, "verified", "Escaping evidence must fail.", "qa-verification", root, { evidence, reviewHeadSha: headSha, reviewBaseSha: baseSha, reviewStatusText: "" }), /repository file/, `unsafe evidence reference is rejected: ${evidence}`);
    assert.equal(JSON.stringify(findPacket(id, root).packet), beforeEscapeAttempts, "unsafe evidence rejection leaves the packet unchanged");
  }
  assert.equal(verificationWorktreeIsClean(" M scripts/codex/launch.mjs", record.packet, headSha), false, "verification rejects unreviewed implementation changes");
  assert.equal(verificationWorktreeIsClean("M  scripts/codex/launch.mjs", record.packet, headSha, "scripts/codex/launch.mjs"), false, "caller-supplied evidence cannot exempt staged implementation changes");
  assert.equal(verificationWorktreeIsClean("?? evidence/tasks/OTHER/verification.md", record.packet, headSha, "evidence/tasks/OTHER/verification.md"), false, "other-task evidence cannot bypass review cleanliness");
  assert.equal(reviewWorktreeIsClean(` M tasks/review/${id}/task.json`, id, headSha), false, "Codex app review rejects a dirty task packet");
  const nonCanonicalEvidence = `${path.posix.dirname(paths.at(-1))}/../${id}/${path.posix.basename(paths.at(-1))}`;
  transition(id, "verified", "All stage-specific review artifacts passed.", "qa-verification", root, { evidence: nonCanonicalEvidence, reviewHeadSha: headSha, reviewBaseSha: baseSha, reviewStatusText: "" });
  const final = findPacket(id, root);
  assert.equal(final.state, "verified", "fixture reaches verified after persisted independent review");
  assert.equal(final.packet.completionEvidence.includes(paths.at(-1)), true, "verification records normalized durable review evidence");
  const beforeDoneAds = JSON.stringify(final.packet);
  assert.throws(() => transition(id, "done", "ADS evidence must fail.", "qa-verification", root, { evidence: `${paths.at(-1)}:hidden` }), /repository file/, "done transition rejects NTFS alternate-data-stream evidence");
  assert.equal(JSON.stringify(findPacket(id, root).packet), beforeDoneAds, "ADS evidence rejection leaves the verified packet unchanged");
  const firstReviewFile = path.join(root, paths[0]);
  const originalFirstReview = fs.readFileSync(firstReviewFile, "utf8");
  const tamperedReview = JSON.parse(originalFirstReview);
  tamperedReview.outputHash = "0".repeat(64);
  fs.writeFileSync(firstReviewFile, `${JSON.stringify(tamperedReview, null, 2)}\n`);
  const beforeTamperedDone = JSON.stringify(findPacket(id, root).packet);
  assert.throws(() => transition(id, "done", "Tampered review must fail.", "qa-verification", root, { evidence: paths.at(-1) }), /Cannot complete invalid task packet/, "done transition revalidates bound review artifacts");
  assert.equal(JSON.stringify(findPacket(id, root).packet), beforeTamperedDone, "tampered review rejection leaves the verified packet unchanged");
  fs.writeFileSync(firstReviewFile, originalFirstReview);
  const verifiedPacketFile = findPacket(id, root).file;
  const originalVerifiedPacket = fs.readFileSync(verifiedPacketFile, "utf8");
  for (const schemaVersion of ["1.0.0", "9.9.9", null]) {
    const tamperedPacket = JSON.parse(originalVerifiedPacket);
    if (schemaVersion === null) delete tamperedPacket.schemaVersion; else tamperedPacket.schemaVersion = schemaVersion;
    fs.writeFileSync(verifiedPacketFile, `${JSON.stringify(tamperedPacket, null, 2)}\n`);
    const tamperedPacketBytes = fs.readFileSync(verifiedPacketFile, "utf8");
    assert.throws(() => transition(id, "done", "Invalid discriminator must fail.", "qa-verification", root, { evidence: paths.at(-1) }), /Cannot complete invalid task packet/, `done rejects schemaVersion ${schemaVersion ?? "missing"}`);
    assert.equal(fs.readFileSync(verifiedPacketFile, "utf8"), tamperedPacketBytes, "invalid discriminator rejection preserves the verified packet bytes");
  }
  fs.writeFileSync(verifiedPacketFile, originalVerifiedPacket);

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
      const traceFile = path.join(appRoot, prepared.reviewResult.tracePath);
      const originalTrace = fs.readFileSync(traceFile, "utf8");
      const incompleteTrace = JSON.parse(originalTrace);
      delete incompleteTrace.reviewedTaskPacketText;
      incompleteTrace.contextManifest = incompleteTrace.contextManifest.filter((entry) => entry.path !== `tasks/review/${appTaskId}/task.json`);
      fs.writeFileSync(traceFile, `${JSON.stringify(incompleteTrace, null, 2)}\n`);
      assert.match(validateRequiredReviewArtifacts(readPacketAt(path.join(appRoot, "tasks", "review", appTaskId, "task.json")), appRoot, appHead, appBase).join("; "), /exactly one reviewed task packet/, "app envelope without the governed task snapshot fails closed");
      fs.writeFileSync(traceFile, originalTrace);
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
  const v1TaskId = "SUT-AIOS-GOV-009";
  const v1Source = path.join(repositoryRoot, "tasks", "verified", v1TaskId, "task.json");
  const v1Destination = path.join(root, "tasks", "verified", v1TaskId, "task.json");
  fs.mkdirSync(path.dirname(v1Destination), { recursive: true });
  fs.copyFileSync(v1Source, v1Destination);
  const v1Evidence = `evidence/tasks/${v1TaskId}/verification.md`;
  fs.mkdirSync(path.dirname(path.join(root, v1Evidence)), { recursive: true });
  fs.writeFileSync(path.join(root, v1Evidence), "V1 fixture evidence\n");
  transition(v1TaskId, "done", "Valid V1 completion remains supported.", "qa-verification", root, { evidence: v1Evidence });
  assert.equal(findPacket(v1TaskId, root).state, "done", "valid V1 verified-to-done transition remains supported");
  process.stdout.write(JSON.stringify({ status: "passed", checks: 54 }) + "\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(externalRoot, { recursive: true, force: true });
}
