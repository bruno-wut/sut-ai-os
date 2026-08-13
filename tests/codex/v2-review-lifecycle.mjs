import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { assertProfileAuthorization, buildLauncherBoundReviewResult, comparisonBaseSha, gitSha, persistCodexAppReviewResult, persistReviewResult, prepareCodexAppReviewResult, reviewWorktreeIsClean, validateCodexAppFinalBinding } from "../../scripts/codex/launch.mjs";
import { computeReviewScopeHash, createPacket, findPacket, readPacketAt, transition, validateEvidenceCommitChain, validateLifecyclePacketDelta, validatePacket, validateRequiredReviewArtifacts, verificationWorktreeIsClean, writePacket } from "../../scripts/task/task-cli.mjs";
import { computeReviewOutputHash, validateReviewResult } from "../../scripts/review/validate-review-result.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-v2-review-lifecycle-"));
const externalRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-v2-review-external-"));
const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const id = "SUT-TEST-V2-REVIEW";
let baseSha;
let headSha;
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
  const git = (args) => assert.equal(spawnSync("git", args, { cwd: root, encoding: "utf8", windowsHide: true }).status, 0);
  git(["init", "-q"]);
  git(["config", "user.email", "test@example.invalid"]);
  git(["config", "user.name", "V2 lifecycle test"]);
  git(["commit", "--allow-empty", "-qm", "fixture base"]);
  git(["update-ref", "refs/remotes/origin/main", "HEAD"]);
  headSha = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true }).stdout.trim();
  baseSha = headSha;
  const workflowDocumentation = fs.readFileSync(path.join(repositoryRoot, "docs", "project", "TASK_WORKFLOW.md"), "utf8");
  assert.match(workflowDocumentation, /Source head:[\s\S]*Evidence head:[\s\S]*Lifecycle head:/, "Workflow V2 documentation preserves the ordered three-head sequence");
  assert.match(workflowDocumentation, /--evidence evidence\/reviews\/SUT-AIOS-AREA-001\/<final-review-stage>-<source-head>\.json/, "documented V2 verification uses the final exact-head review artifact");
  assert.match(workflowDocumentation, /--review-head <source-head>/, "documented V2 verification binds the immutable source head");
  assert.match(workflowDocumentation, /--review-base <origin-main-sha>/, "documented V2 verification binds canonical origin main");
  assert.match(workflowDocumentation, /distinct `headSha` and `evidenceHeadSha`/, "documentation explains the schema-valid distinct review heads");
  assert.doesNotMatch(workflowDocumentation, /--verified --evidence evidence\/tasks\/SUT-AIOS-AREA-001\/verification\.md/, "documentation no longer instructs the rejected legacy evidence command for a new V2 packet");
  createPacket({ task: id, title: "V2 review lifecycle fixture" }, root);
  let record = findPacket(id, root);
  Object.assign(record.packet, {
    phase: "test", workstream: "governance", workflowId: "v2-review-lifecycle",
    businessObjective: "test", technicalObjective: "test", acceptanceCriteria: ["test"],
    allowedPaths: ["tests/**", "evidence/reviews/**"], forbiddenPaths: ["protected/**"],
    allowedCommands: ["node --version"], requiredChecks: ["fixture"], requiredTests: ["fixture"],
    rollbackExpectations: "remove fixture", evidence: ["evidence/complete.md"]
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
  const reviewedTaskScopeHash = computeReviewScopeHash(record.packet);
  const governedContextPath = "evidence/governed-context.txt";
  const governedContextFile = path.join(root, governedContextPath);
  fs.mkdirSync(path.dirname(governedContextFile), { recursive: true });
  fs.writeFileSync(governedContextFile, "governed fixture context\n");
  const contextManifest = [
    { path: `tasks/review/${id}/task.json`, sha256: sha256(reviewedTaskPacketText) },
    { path: governedContextPath, sha256: sha256(fs.readFileSync(governedContextFile)) },
  ];
  const contextManifestHash = sha256(contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));

  const profiles = [
    ["plan-review", "engineering-planner", "gpt-5.6-sol", "sol", "plan review passed"],
    ["semantic-qa", "qa-verification", "gpt-5.6-luna", "luna", "semantic review passed"],
    ["merge-risk-review", "qa-verification", "gpt-5.6-sol", "sol", "merge-risk review passed"]
  ];
  fs.mkdirSync(path.join(root, "evidence"), { recursive: true });
  fs.writeFileSync(path.join(root, "evidence", "missing.json"), "{}\n");
  fs.writeFileSync(path.join(root, "evidence", "complete.md"), "completion fixture\n");
  const paths = [];
  for (const [profile, agent, model, route, nextAction] of profiles) {
    const stage = { "plan-review": "planReview", "semantic-qa": "semanticReview", "merge-risk-review": "mergeRiskReview" }[profile];
    assert.doesNotThrow(() => assertProfileAuthorization(profile, { format: "json", state: "review", data: record.packet }, access, agent), `${profile} is authorized by its stage agent`);
    const review = buildLauncherBoundReviewResult(assessment(nextAction), {
      taskId: id, baseSha, headSha, reviewerAgent: agent, model, reasoningEffort: "high",
      contextManifestHash, reviewedAt: "2026-08-08T12:00:00.000Z", stage,
      runId: `fixture-${route}-${agent}`, tracePath: `evidence/reviews/${id}/traces/fixture-${route}-${agent}-${agent}-${route}.jsonl`
    });
    assert.equal(validateReviewResult(review).valid, true, `${profile} result is SHA-bound and valid`);
    if (profile === "plan-review") {
      assert.throws(() => persistReviewResult({ ...review, stage: "semanticReview" }, { taskId: id, profile, headSha, root }), /does not match requested/, "persist rejects a profile/stage mismatch");
      assert.throws(() => transition(id, "verified", "Incomplete reviews must fail.", "qa-verification", root, { evidence: "evidence/missing.json", reviewHeadSha: headSha, reviewBaseSha: baseSha, reviewStatusText: "" }), /missing required/, "verified rejects incomplete V2 review evidence");
    }
    const traceFile = path.join(root, review.tracePath);
    fs.mkdirSync(path.dirname(traceFile), { recursive: true });
    const traceSerialized = [
      JSON.stringify({ event: "start", taskId: id, agentId: agent, route, model, profile }),
      JSON.stringify({ event: "review-progress", runId: review.runId, taskId: id, profile, status: "child-started" }),
      JSON.stringify({ event: "review-bound", runId: review.runId, taskId: id, baseSha, headSha, stage, reviewerAgent: agent, model, reasoningEffort: "high", contextManifestHash, outputHash: review.outputHash, contextManifest, reviewedTaskScopeHash }),
      JSON.stringify({ event: "finish", status: "success", exitCode: 0 })
    ].join("\n") + "\n";
    fs.writeFileSync(traceFile, traceSerialized);
    if (profile === "plan-review") {
      fs.unlinkSync(traceFile);
      assert.throws(() => persistReviewResult(review, { taskId: id, profile, headSha, root }), /valid bound launcher trace/, "direct persistence without terminal trace fails closed");
      fs.writeFileSync(traceFile, traceSerialized);
    }
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
  const planReview = JSON.parse(fs.readFileSync(path.join(root, paths[0]), "utf8"));
  const planTraceFile = path.join(root, planReview.tracePath);
  const originalPlanTrace = fs.readFileSync(planTraceFile, "utf8");
  fs.writeFileSync(planTraceFile, originalPlanTrace.replace('"status":"success"', '"status":"failed"'));
  assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), /exactly one successful finish/, "failed prerequisite launcher trace cannot satisfy a merge gate");
  fs.writeFileSync(planTraceFile, originalPlanTrace);
  const originalPlanEvents = originalPlanTrace.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  const writePlanEvents = (events) => fs.writeFileSync(planTraceFile, `${events.map((event) => JSON.stringify(event)).join("\n")}\n`);
  writePlanEvents(originalPlanEvents.slice(1));
  assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), /begin with exactly one start/, "prefix-truncated launcher trace cannot satisfy a merge gate");
  writePlanEvents([originalPlanEvents[0], originalPlanEvents[0], ...originalPlanEvents.slice(1)]);
  assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), /begin with exactly one start/, "duplicate launcher start is rejected");
  writePlanEvents([originalPlanEvents[1], originalPlanEvents[0], ...originalPlanEvents.slice(2)]);
  assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), /begin with exactly one start/, "reordered launcher start is rejected");
  for (const [field, value] of [["taskId", "SUT-WRONG"], ["agentId", "wrong-agent"], ["route", "luna"], ["model", "gpt-wrong"], ["profile", "semantic-qa"]]) {
    writePlanEvents([{ ...originalPlanEvents[0], [field]: value }, ...originalPlanEvents.slice(1)]);
    assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), new RegExp(`start does not bind ${field}`), `launcher start rejects mismatched ${field}`);
  }
  writePlanEvents([originalPlanEvents[0], ...originalPlanEvents.slice(2)]);
  assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), /exactly one child-started/, "missing child-started progress is rejected");
  writePlanEvents([originalPlanEvents[0], { event: "review-progress", runId: "wrong-run", taskId: id, profile: "plan-review", status: "child-started" }, ...originalPlanEvents.slice(2)]);
  assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), /child-started does not bind runId/, "mismatched child-started progress is rejected");
  writePlanEvents([...originalPlanEvents, { event: "finish", status: "failed", exitCode: 1 }]);
  assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), /exactly one successful finish/, "mixed success and failure terminals fail closed");
  writePlanEvents([originalPlanEvents.at(-1), ...originalPlanEvents.slice(0, -1)]);
  assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), /after review-bound/, "success before review binding fails closed");
  writePlanEvents(originalPlanEvents.map((event) => event.event === "finish" ? { ...event, exitCode: 1 } : event));
  assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), /exitCode 0/, "nonzero successful terminal fails closed");
  fs.writeFileSync(planTraceFile, originalPlanTrace);
  const originalPlanReview = fs.readFileSync(path.join(root, paths[0]), "utf8");
  const forgedPlanReview = JSON.parse(originalPlanReview);
  const forgedPlanTraceEvents = originalPlanTrace.trim().split(/\r?\n/).map((line) => JSON.parse(line));
  const forgedBound = forgedPlanTraceEvents.find((event) => event.event === "review-bound");
  forgedBound.contextManifest = forgedBound.contextManifest.map((entry) => entry.path === governedContextPath ? { ...entry, sha256: "f".repeat(64) } : entry);
  forgedPlanReview.contextManifestHash = sha256(forgedBound.contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));
  forgedPlanReview.outputHash = computeReviewOutputHash(forgedPlanReview);
  forgedBound.contextManifestHash = forgedPlanReview.contextManifestHash;
  forgedBound.outputHash = forgedPlanReview.outputHash;
  fs.writeFileSync(path.join(root, paths[0]), `${JSON.stringify(forgedPlanReview, null, 2)}\n`);
  fs.writeFileSync(planTraceFile, `${forgedPlanTraceEvents.map((event) => JSON.stringify(event)).join("\n")}\n`);
  assert.match(validateRequiredReviewArtifacts(record.packet, root, headSha, baseSha, ["planReview"]).join("; "), /governed context file does not match/, "internally consistent forged launcher context hashes fail closed against governed files");
  fs.writeFileSync(path.join(root, paths[0]), originalPlanReview);
  fs.writeFileSync(planTraceFile, originalPlanTrace);
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
  assert.equal(reviewWorktreeIsClean(`?? evidence/verification/${id}/verification-${headSha}.json`, id, headSha), true, "review permits only the exact same-task head-bound verification artifact");
  assert.equal(reviewWorktreeIsClean(`?? evidence/reviews/${id}/traces/fixture.jsonl`, id, headSha), true, "review permits a same-task durable launcher trace");
  assert.equal(verificationWorktreeIsClean(`?? evidence/reviews/${id}/traces/fixture.jsonl`, record.packet, headSha), true, "verification permits a same-task durable launcher trace");
  const nonCanonicalEvidence = `${path.posix.dirname(paths.at(-1))}/../${id}/${path.posix.basename(paths.at(-1))}`;
  const evidenceHeadSha = "c".repeat(40);
  const lifecycleHeadSha = "d".repeat(40);
  const exactVerificationPath = `evidence/verification/${id}/verification-${headSha}.json`;
  const expectedEvidencePaths = [exactVerificationPath, ...paths, ...paths.map((reviewPath) => JSON.parse(fs.readFileSync(path.join(root, reviewPath), "utf8")).tracePath)];
  const evidenceChainOptions = {
    currentHead: evidenceHeadSha,
    isAncestor: () => true,
    changedPaths: (older, newer) => older === headSha && newer === evidenceHeadSha ? expectedEvidencePaths : [],
    commitContains: (commit) => commit !== headSha,
  };
  assert.deepEqual(validateEvidenceCommitChain(record.packet, root, { ...evidenceChainOptions, sourceHead: headSha, evidenceHead: evidenceHeadSha }), [], "source head, evidence commit, and lifecycle commit form a valid clean-clone chain");
  assert.match(validateEvidenceCommitChain(record.packet, root, { ...evidenceChainOptions, sourceHead: headSha, evidenceHead: evidenceHeadSha, changedPaths: () => expectedEvidencePaths.filter((item) => item !== exactVerificationPath) }).join("; "), /does not add required exact-head evidence/, "evidence commit must add the exact-head verification record");
  assert.match(validateEvidenceCommitChain(record.packet, root, { ...evidenceChainOptions, sourceHead: headSha, evidenceHead: evidenceHeadSha, changedPaths: () => [...expectedEvidencePaths, `evidence/reviews/${id}/historical.json`] }).join("; "), /unauthorized historical/, "evidence commit cannot rewrite, replace, or delete historical evidence");
  assert.match(validateEvidenceCommitChain(record.packet, root, { ...evidenceChainOptions, sourceHead: headSha, evidenceHead: evidenceHeadSha, changedPaths: () => ["scripts/codex/launch.mjs"] }).join("; "), /non-evidence path/, "post-review implementation changes fail closed");
  assert.match(validateEvidenceCommitChain(record.packet, root, { ...evidenceChainOptions, sourceHead: headSha, evidenceHead: evidenceHeadSha, isAncestor: () => false }).join("; "), /not an ordered ancestor chain/, "disconnected evidence commits fail closed");
  assert.match(validateEvidenceCommitChain(record.packet, root, { ...evidenceChainOptions, sourceHead: headSha, evidenceHead: evidenceHeadSha, commitContains: () => false }).join("; "), /does not contain required review evidence/, "evidence commit must contain every bound review artifact and trace");
  const evidencePacketFixture = structuredClone(record.packet);
  const verifiedPacketFixture = structuredClone(record.packet);
  verifiedPacketFixture.status = "verified";
  verifiedPacketFixture.updatedDate = "2026-08-09T12:00:00.000Z";
  verifiedPacketFixture.stateTransitions.push({ from: "review", to: "verified", at: verifiedPacketFixture.updatedDate, actor: "qa-verification", reason: "verified" });
  verifiedPacketFixture.completionEvidence.push(paths.at(-1));
  verifiedPacketFixture.reviewVerification = { baseSha, headSha, evidenceHeadSha };
  assert.deepEqual(validateLifecyclePacketDelta(evidencePacketFixture, verifiedPacketFixture), [], "exact review-to-verified lifecycle delta is accepted");
  const rewrittenTransitions = structuredClone(verifiedPacketFixture);
  rewrittenTransitions.stateTransitions[0].reason = "rewritten history";
  assert.match(validateLifecyclePacketDelta(evidencePacketFixture, rewrittenTransitions).join("; "), /prior stateTransitions/, "prior transition history cannot be rewritten");
  const removedEvidence = structuredClone(verifiedPacketFixture);
  removedEvidence.completionEvidence = [];
  assert.match(validateLifecyclePacketDelta(evidencePacketFixture, removedEvidence).join("; "), /exactly one durable evidence reference/, "verification cannot omit its appended evidence reference");
  const extraEvidence = structuredClone(verifiedPacketFixture);
  extraEvidence.completionEvidence.push("evidence/unrelated.json");
  assert.match(validateLifecyclePacketDelta(evidencePacketFixture, extraEvidence).join("; "), /exactly one durable evidence reference/, "verification cannot append extra completion evidence");
  const unrelatedEvidence = structuredClone(verifiedPacketFixture);
  unrelatedEvidence.completionEvidence = [paths[0]];
  assert.match(validateLifecyclePacketDelta(evidencePacketFixture, unrelatedEvidence).join("; "), /exact final review artifact/, "verification evidence must be the transition-related final review artifact");
  assert.match(validateLifecyclePacketDelta(evidencePacketFixture, verifiedPacketFixture, { currentHead: lifecycleHeadSha, commitContains: () => false }).join("; "), /does not exist at current head/, "nonexistent lifecycle evidence fails closed");
  const reorderedEvidence = structuredClone(verifiedPacketFixture);
  evidencePacketFixture.completionEvidence = ["evidence/prior-a.json", "evidence/prior-b.json"];
  reorderedEvidence.completionEvidence = ["evidence/prior-b.json", "evidence/prior-a.json", paths.at(-1)];
  assert.match(validateLifecyclePacketDelta(evidencePacketFixture, reorderedEvidence).join("; "), /prior completionEvidence/, "prior evidence references cannot be reordered");
  evidencePacketFixture.completionEvidence = [];
  transition(id, "verified", "All stage-specific review artifacts passed.", "qa-verification", root, { evidence: nonCanonicalEvidence, reviewHeadSha: headSha, reviewBaseSha: baseSha, evidenceHeadSha, evidenceChainOptions, reviewStatusText: "" });
  const final = findPacket(id, root);
  Object.assign(evidenceChainOptions, { currentHead: lifecycleHeadSha, evidencePacket: evidencePacketFixture, currentPacket: final.packet });
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
  assert.throws(() => transition(id, "done", "Tampered review must fail.", "qa-verification", root, { evidence: "evidence/complete.md", evidenceChainOptions }), /Cannot complete invalid task packet/, "done transition revalidates bound review artifacts");
  assert.equal(JSON.stringify(findPacket(id, root).packet), beforeTamperedDone, "tampered review rejection leaves the verified packet unchanged");
  fs.writeFileSync(firstReviewFile, originalFirstReview);
  const verifiedPacketFile = findPacket(id, root).file;
  const originalVerifiedPacket = fs.readFileSync(verifiedPacketFile, "utf8");
  for (const schemaVersion of ["1.0.0", "9.9.9", null]) {
    const tamperedPacket = JSON.parse(originalVerifiedPacket);
    if (schemaVersion === null) delete tamperedPacket.schemaVersion; else tamperedPacket.schemaVersion = schemaVersion;
    fs.writeFileSync(verifiedPacketFile, `${JSON.stringify(tamperedPacket, null, 2)}\n`);
    const tamperedPacketBytes = fs.readFileSync(verifiedPacketFile, "utf8");
    assert.throws(() => transition(id, "done", "Invalid discriminator must fail.", "qa-verification", root, { evidence: "evidence/complete.md", evidenceChainOptions }), /Cannot complete invalid task packet/, `done rejects schemaVersion ${schemaVersion ?? "missing"}`);
    assert.equal(fs.readFileSync(verifiedPacketFile, "utf8"), tamperedPacketBytes, "invalid discriminator rejection preserves the verified packet bytes");
  }
  fs.writeFileSync(verifiedPacketFile, originalVerifiedPacket);

  const appRoot = path.join(root, "codex-app-fixture");
  fs.mkdirSync(appRoot, { recursive: true });
  const appTaskId = "SUT-AIOS-GOV-056-FND";
  const appHead = gitSha("HEAD");
  const appBase = comparisonBaseSha();
  const appProfiles = [["plan-review", "planReview"], ["semantic-qa", "semanticReview"], ["merge-risk-review", "mergeRiskReview"]];
  const appStatus = [];
  const exactVerificationRelative = `evidence/verification/${appTaskId}/verification-${appHead}.json`;
  const exactVerificationFile = path.join(appRoot, exactVerificationRelative);
  const bindAppContextFile = (prepared, relativePath) => {
    if (!prepared.contextManifest.some((entry) => entry.path === relativePath)) {
      prepared.contextManifest.push({ path: relativePath, sha256: sha256(fs.readFileSync(path.join(appRoot, relativePath))) });
    }
    prepared.reviewResult.contextManifestHash = sha256(prepared.contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));
    prepared.reviewResult.outputHash = computeReviewOutputHash(prepared.reviewResult);
  };
  for (const [profile, stage] of appProfiles) {
    const runId = `fixture-app-${stage}`;
    const prepared = prepareCodexAppReviewResult(assessment(`${stage} app review passed`), { taskId: appTaskId, profile, runId, reviewedAt: "2026-08-08T12:00:00.000Z" });
    assert.equal(prepared.contextManifest.some((entry) => entry.path === "generated/merge-risk-context"), stage === "mergeRiskReview", `${stage} binds generated merge-risk context only when required`);
    for (const entry of prepared.contextManifest) {
      if (entry.path === "generated/merge-risk-context") continue;
      const destination = path.join(appRoot, entry.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(path.join(repositoryRoot, entry.path), destination);
    }
    if (stage === "planReview") {
      assert.throws(() => persistCodexAppReviewResult(prepared, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), /Exact-head verification evidence is missing/, "Codex app persistence rejects a review without exact-head verification");
      fs.mkdirSync(path.dirname(exactVerificationFile), { recursive: true });
      fs.writeFileSync(exactVerificationFile, `${JSON.stringify({ schemaVersion: "1.0.0", taskId: appTaskId, headSha: appHead, status: "pass", reviewer: "qa-verification", productionEligible: false, reviewedAt: "2026-08-08T12:00:00.000Z", checks: ["fixture checks passed"] }, null, 2)}\n`);
      appStatus.push(`?? ${exactVerificationRelative}`);
    }
    bindAppContextFile(prepared, exactVerificationRelative);
    if (stage === "planReview") {
      const driftEntry = prepared.contextManifest.find((entry) => ![exactVerificationRelative, `tasks/review/${appTaskId}/task.json`, "generated/merge-risk-context"].includes(entry.path));
      const driftFile = path.join(appRoot, driftEntry.path);
      const originalDriftFile = fs.readFileSync(driftFile);
      fs.writeFileSync(driftFile, Buffer.concat([originalDriftFile, Buffer.from("drift")]));
      assert.throws(() => persistCodexAppReviewResult(prepared, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), /context file changed before persistence/, "Codex app persistence rejects governed context drift");
      fs.writeFileSync(driftFile, originalDriftFile);

      const forgedContext = structuredClone(prepared);
      forgedContext.contextManifest.find((entry) => entry.path === driftEntry.path).sha256 = "e".repeat(64);
      forgedContext.reviewResult.contextManifestHash = sha256(forgedContext.contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));
      forgedContext.reviewResult.outputHash = computeReviewOutputHash(forgedContext.reviewResult);
      assert.throws(() => persistCodexAppReviewResult(forgedContext, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), /context file changed before persistence/, "Codex app persistence rejects a forged ordinary context hash");

      const escapingContext = structuredClone(prepared);
      escapingContext.contextManifest.push({ path: "../escape.txt", sha256: "f".repeat(64) });
      escapingContext.reviewResult.contextManifestHash = sha256(escapingContext.contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));
      escapingContext.reviewResult.outputHash = computeReviewOutputHash(escapingContext.reviewResult);
      assert.throws(() => persistCodexAppReviewResult(escapingContext, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), /path escapes repository/, "Codex app persistence rejects an escaping context path");
    }
    if (stage === "mergeRiskReview") {
      for (const prerequisiteStage of ["planReview", "semanticReview"]) {
        const prerequisiteRelative = `evidence/reviews/${appTaskId}/${prerequisiteStage}-${appHead}.json`;
        const prerequisite = JSON.parse(fs.readFileSync(path.join(appRoot, prerequisiteRelative), "utf8"));
        bindAppContextFile(prepared, prerequisiteRelative);
        bindAppContextFile(prepared, prerequisite.tracePath);
      }

      const semanticRelative = `evidence/reviews/${appTaskId}/semanticReview-${appHead}.json`;
      const semanticFile = path.join(appRoot, semanticRelative);
      const originalSemantic = fs.readFileSync(semanticFile, "utf8");
      const semantic = JSON.parse(originalSemantic);
      const semanticTraceFile = path.join(appRoot, semantic.tracePath);
      const originalSemanticTrace = fs.readFileSync(semanticTraceFile, "utf8");
      fs.rmSync(semanticFile);
      assert.throws(() => persistCodexAppReviewResult(prepared, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), /missing required semanticReview artifact/, "Codex app merge gate rejects a missing same-head prerequisite");
      fs.writeFileSync(semanticFile, originalSemantic);
      fs.rmSync(semanticTraceFile);
      assert.throws(() => persistCodexAppReviewResult(prepared, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), /trace is missing or invalid/, "Codex app merge gate rejects a missing prerequisite trace");
      fs.writeFileSync(semanticTraceFile, originalSemanticTrace);
      for (const [field, value, pattern] of [["reviewerAgent", "engineering-planner", /reviewerAgent/], ["model", "gpt-5.6-sol", /model/], ["reasoningEffort", "medium", /reasoningEffort/]]) {
        const forged = { ...semantic, [field]: value };
        forged.outputHash = computeReviewOutputHash(forged);
        fs.writeFileSync(semanticFile, `${JSON.stringify(forged, null, 2)}\n`);
        assert.throws(() => persistCodexAppReviewResult(prepared, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), pattern, `Codex app merge gate rejects a prerequisite with wrong ${field}`);
      }
      fs.writeFileSync(semanticFile, originalSemantic);
    }
    if (stage === "planReview") {
      const resultPath = path.join(appRoot, "evidence", "reviews", appTaskId, `${stage}-${appHead}.json`);
      const runPath = path.join(appRoot, prepared.reviewResult.tracePath);
      const currentAppTaskRecord = { data: readPacketAt(path.join(appRoot, "tasks", "review", appTaskId, "task.json")) };
      assert.throws(() => validateCodexAppFinalBinding(prepared, { taskId: appTaskId, profile, headSha: appHead, taskRecord: currentAppTaskRecord, currentHeadSha: "0".repeat(40), currentBaseSha: appBase, expectedContextManifest: prepared.contextManifest }), /headSha/, "Codex-app final binding rejects a HEAD change after preparation");
      assert.equal(fs.existsSync(resultPath), false, "stale-HEAD rejection publishes no review result");
      assert.equal(fs.existsSync(runPath), false, "stale-HEAD rejection publishes no run envelope");
      const omittedContext = structuredClone(prepared);
      const omittedIndex = omittedContext.contextManifest.findIndex((entry) => ![exactVerificationRelative, `tasks/review/${appTaskId}/task.json`, "generated/merge-risk-context"].includes(entry.path));
      omittedContext.contextManifest.splice(omittedIndex, 1);
      omittedContext.reviewResult.contextManifestHash = sha256(omittedContext.contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));
      omittedContext.reviewResult.outputHash = computeReviewOutputHash(omittedContext.reviewResult);
      assert.throws(() => persistCodexAppReviewResult(omittedContext, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), /complete current review profile/, "Codex-app final persistence rejects an omitted governed context entry");
      assert.equal(fs.existsSync(resultPath), false, "omitted-context rejection publishes no review result");
      assert.equal(fs.existsSync(runPath), false, "omitted-context rejection publishes no run envelope");
      const contradictoryPass = structuredClone(prepared);
      contradictoryPass.reviewResult.blockingFindings = ["must block publication"];
      contradictoryPass.reviewResult.outputHash = computeReviewOutputHash(contradictoryPass.reviewResult);
      assert.throws(() => persistCodexAppReviewResult(contradictoryPass, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), /blockingFindings/, "Codex-app persistence rejects pass with blocking findings");
      assert.equal(fs.existsSync(resultPath), false, "contradictory pass publishes no review result");
      assert.equal(fs.existsSync(runPath), false, "contradictory pass publishes no run envelope");
      for (const [field, value, pattern] of [["reviewerAgent", "qa-verification", /reviewerAgent/], ["model", "gpt-5.6-luna", /model/], ["reasoningEffort", "medium", /reasoningEffort/], ["baseSha", "f".repeat(40), /baseSha/]]) {
        const forgedIdentity = structuredClone(prepared);
        forgedIdentity.reviewResult[field] = value;
        forgedIdentity.reviewResult.outputHash = computeReviewOutputHash(forgedIdentity.reviewResult);
        assert.throws(() => persistCodexAppReviewResult(forgedIdentity, { taskId: appTaskId, profile, headSha: appHead, root: appRoot }), pattern, `Codex-app final persistence rejects forged ${field} after preparation`);
        assert.equal(fs.existsSync(resultPath), false, `forged ${field} publishes no review result`);
        assert.equal(fs.existsSync(runPath), false, `forged ${field} publishes no run envelope`);
      }
      const partialResult = path.join(appRoot, "evidence", "reviews", appTaskId, `${stage}-${appHead}.json`);
      fs.mkdirSync(path.dirname(partialResult), { recursive: true });
      fs.writeFileSync(partialResult, `${JSON.stringify(prepared.reviewResult, null, 2)}\n`);
      assert.equal(fs.existsSync(path.join(appRoot, prepared.reviewResult.tracePath)), false, "interruption after atomic result publication leaves an exact recoverable partial publication");
    }
    const artifact = persistCodexAppReviewResult(prepared, { taskId: appTaskId, profile, headSha: appHead, root: appRoot });
    if (stage === "planReview") assert.equal(fs.existsSync(path.join(appRoot, prepared.reviewResult.tracePath)), true, "rerunning the same Codex-app run recovers exact partial publication");
    appStatus.push(`?? ${artifact}`, `?? ${prepared.reviewResult.tracePath}`);
    const persistedTrace = JSON.parse(fs.readFileSync(path.join(appRoot, prepared.reviewResult.tracePath), "utf8"));
    assert.equal("reviewedTaskPacketText" in persistedTrace, false, "Codex app trace excludes full task-packet contents");
    assert.match(persistedTrace.reviewedTaskScopeHash, /^[0-9a-f]{64}$/i, "Codex app trace binds a canonical task scope hash");
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
      const failedTrace = JSON.parse(originalTrace);
      failedTrace.status = "failed";
      fs.writeFileSync(traceFile, `${JSON.stringify(failedTrace, null, 2)}\n`);
      assert.match(validateRequiredReviewArtifacts(readPacketAt(path.join(appRoot, "tasks", "review", appTaskId, "task.json")), appRoot, appHead, appBase, ["planReview"]).join("; "), /does not record successful completion/, "failed Codex app prerequisite trace cannot satisfy a merge gate");
      fs.writeFileSync(traceFile, originalTrace);
      const incompleteTrace = JSON.parse(originalTrace);
      delete incompleteTrace.reviewedTaskScopeHash;
      incompleteTrace.contextManifest = incompleteTrace.contextManifest.filter((entry) => entry.path !== `tasks/review/${appTaskId}/task.json`);
      fs.writeFileSync(traceFile, `${JSON.stringify(incompleteTrace, null, 2)}\n`);
      assert.match(validateRequiredReviewArtifacts(readPacketAt(path.join(appRoot, "tasks", "review", appTaskId, "task.json")), appRoot, appHead, appBase).join("; "), /exactly one reviewed task scope hash/, "app envelope without the governed task scope hash fails closed");
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
  const appEvidenceHead = "e".repeat(40);
  const appLifecycleHead = "f".repeat(40);
  const appEvidenceChainOptions = { currentHead: appEvidenceHead, isAncestor: () => true, changedPaths: (older, newer) => older === appHead && newer === appEvidenceHead ? appStatus.map((line) => line.slice(3)) : [], commitContains: (commit) => commit !== appHead };
  transition(appTaskId, "verified", "Codex app review fixture passed.", "qa-verification", appRoot, { evidence: `evidence/reviews/${appTaskId}/mergeRiskReview-${appHead}.json`, reviewHeadSha: appHead, reviewBaseSha: appBase, evidenceHeadSha: appEvidenceHead, evidenceChainOptions: appEvidenceChainOptions, reviewStatusText: "" });
  const appFinal = findPacket(appTaskId, appRoot);
  Object.assign(appEvidenceChainOptions, { currentHead: appLifecycleHead, evidencePacket: appPacket, currentPacket: appFinal.packet });
  const appValidation = validatePacket(appFinal.packet, { strict: true, directoryState: "verified", root: appRoot, evidenceChainOptions: appEvidenceChainOptions });
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
  process.stdout.write(JSON.stringify({ status: "passed", checks: 100 }) + "\n");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(externalRoot, { recursive: true, force: true });
}
