#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPacket, validatePacket, transition, repositoryRoot, taskPath } from "./task-cli.mjs";

function fail(msg) {
  throw new Error(`RECONCILIATION_ERROR: ${msg}`);
}

function runGit(args, cwd = repositoryRoot) {
  const res = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (res.error) throw res.error;
  if (res.status !== 0) throw new Error(`Git failed: git ${args.join(" ")} -> ${res.stderr}`);
  return res.stdout.trim();
}

export function reconcileMergedTask({
  root = repositoryRoot,
  beforeEnv = process.env.GITHUB_EVENT_BEFORE,
  afterEnv = process.env.GITHUB_EVENT_AFTER,
  prEnv = process.env.GITHUB_PR_NUMBER,
  changedFiles: overrideChangedFiles = null,
  dryRun = false,
  skipGitPush = false
} = {}) {
  let before = beforeEnv?.trim();
  let after = afterEnv?.trim();

  let changedFiles = overrideChangedFiles;
  if (!changedFiles) {
    // If environment variables are missing or null SHAs, try git HEAD~1..HEAD
    if (!before || before === "0000000000000000000000000000000000000000") {
      try {
        before = runGit(["rev-parse", "HEAD~1"], root);
      } catch {
        before = null;
      }
    }
    if (!after || after === "0000000000000000000000000000000000000000") {
      try {
        after = runGit(["rev-parse", "HEAD"], root);
      } catch {
        after = null;
      }
    }

    if (before && after) {
      try {
        const output = runGit(["diff", "--name-only", before, after], root);
        changedFiles = output.split("\n").map((f) => f.trim()).filter(Boolean);
      } catch (err) {
        fail(`Could not compute diff range ${before}..${after}: ${err.message}`);
      }
    } else {
      fail("Missing commit range for diff calculation.");
    }
  }

  // Find candidate task IDs under tasks/verified/
  const verifiedCandidates = new Set();
  for (const file of changedFiles) {
    const norm = file.replaceAll("\\", "/");
    const match = norm.match(/^tasks\/verified\/([^/]+)\//);
    if (match) {
      verifiedCandidates.add(match[1]);
    }
  }

  if (verifiedCandidates.size === 0) {
    fail("No verified tasks modified in diff range.");
  }
  if (verifiedCandidates.size > 1) {
    fail(`Ambiguous reconciliation: multiple verified tasks in diff range [${Array.from(verifiedCandidates).join(", ")}].`);
  }

  const taskId = Array.from(verifiedCandidates)[0];

  // 1. Confirm destination does not exist
  const destinationFile = taskPath("done", taskId, root);
  if (fs.existsSync(destinationFile)) {
    fail(`Destination packet already exists for ${taskId} at tasks/done/${taskId}/task.json.`);
  }

  // 2. Confirm packet is exactly verified
  let record;
  try {
    record = findPacket(taskId, root);
  } catch (err) {
    fail(`Candidate task ${taskId} could not be loaded: ${err.message}`);
  }

  if (record.state !== "verified") {
    fail(`Candidate task ${taskId} is not in verified state (current: ${record.state}).`);
  }

  // 3. Perform shared lifecycle transition: verified -> done
  const evidenceRef = prEnv ? `pr:${prEnv}` : `merge-commit:${after}`;
  const transitionResult = transition(
    taskId,
    "done",
    `Automated post-merge reconciliation for ${taskId} (${after ? after.slice(0, 7) : "merge"})`,
    "github-actions",
    root,
    { evidence: evidenceRef }
  );

  // 4. Validate post-transition task packet
  const updatedRecord = findPacket(taskId, root);
  const check = validatePacket(updatedRecord.packet, { strict: true, directoryState: "done" });
  if (!check.valid) {
    fail(`Reconciled packet for ${taskId} failed strict validation:\n- ${check.errors.join("\n- ")}`);
  }

  if (dryRun) {
    return { taskId, status: "reconciled", file: transitionResult.file };
  }

  // 5. Create one deterministic commit and push
  if (!skipGitPush) {
    try {
      runGit(["add", "tasks/verified", "tasks/done"], root);
      runGit(["commit", "-m", `chore(governance): reconcile ${taskId} to done post-merge`], root);
      runGit(["push", "origin", "HEAD"], root);
    } catch (err) {
      fail(`Git commit/push failed during reconciliation: ${err.message}`);
    }
  }

  return { taskId, status: "reconciled", file: transitionResult.file };
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  reconcileMergedTask();
}
