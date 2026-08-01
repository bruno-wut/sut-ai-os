#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { reconcileMergedTask } from "../../scripts/task/reconcile-merged-task.mjs";
import { createPacket, transition, findPacket } from "../../scripts/task/task-cli.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function createFixtureTask(root, id, title = "Test Task") {
  createPacket({ task: id, title }, root);
  const rec = findPacket(id, root);
  rec.packet.phase = "test";
  rec.packet.workstream = "test";
  rec.packet.workflowId = "test";
  rec.packet.businessObjective = "test obj";
  rec.packet.technicalObjective = "test obj";
  rec.packet.acceptanceCriteria = ["test criteria"];
  rec.packet.allowedPaths = ["test/**"];
  rec.packet.forbiddenPaths = ["protected/**"];
  rec.packet.allowedCommands = ["node --version"];
  rec.packet.requiredChecks = ["fixture"];
  rec.packet.requiredTests = ["self-test"];
  rec.packet.rollbackExpectations = "remove test files";
  rec.packet.reviewer = "qa-verification";
  fs.writeFileSync(rec.file, JSON.stringify(rec.packet, null, 2) + "\n");

  transition(id, "ready", "Ready fixture", "test", root);
  transition(id, "active", "Start fixture", "test", root);
  transition(id, "review", "Send fixture to review", "test", root);
  transition(id, "verified", "Verification passed", "qa-verification", root, { evidence: "evidence/test.md" });
}

function runTests() {
  console.log("Running reconcile-merged-task unit test suite...");

  // 1. Zero candidates -> fails closed
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reconcile-test-zero-"));
    try {
      let threw = false;
      try {
        reconcileMergedTask({ root: tmp, changedFiles: ["docs/README.md"], dryRun: true, skipGitPush: true });
      } catch (err) {
        threw = true;
        assert(err.message.includes("No verified tasks modified"), "Error message should mention zero tasks");
      }
      assert(threw, "Zero candidates should fail closed");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // 2. Multiple candidates -> fails closed
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reconcile-test-multi-"));
    try {
      let threw = false;
      try {
        reconcileMergedTask({
          root: tmp,
          changedFiles: ["tasks/verified/TASK-A/task.json", "tasks/verified/TASK-B/task.json"],
          dryRun: true,
          skipGitPush: true
        });
      } catch (err) {
        threw = true;
        assert(err.message.includes("Ambiguous reconciliation"), "Error message should mention ambiguous tasks");
      }
      assert(threw, "Multiple candidates should fail closed");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // 3. Destination collision -> fails closed
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reconcile-test-collision-"));
    try {
      const taskId = "SUT-TEST-COLLISION";
      createFixtureTask(tmp, taskId);

      // Create dummy destination done file
      const doneFile = path.join(tmp, "tasks", "done", taskId, "task.json");
      fs.mkdirSync(path.dirname(doneFile), { recursive: true });
      fs.writeFileSync(doneFile, "{}", "utf8");

      let threw = false;
      try {
        reconcileMergedTask({
          root: tmp,
          changedFiles: [`tasks/verified/${taskId}/task.json`],
          dryRun: true,
          skipGitPush: true
        });
      } catch (err) {
        threw = true;
        assert(err.message.includes("already exists"), "Error message should mention destination exists");
      }
      assert(threw, "Destination collision should fail closed");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  // 4. Exactly 1 valid verified task -> succeeds cleanly
  {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "reconcile-test-success-"));
    try {
      const taskId = "SUT-TEST-SUCCESS";
      createFixtureTask(tmp, taskId);

      const res = reconcileMergedTask({
        root: tmp,
        changedFiles: [`tasks/verified/${taskId}/task.json`],
        prEnv: "123",
        dryRun: true,
        skipGitPush: true
      });

      assert(res.status === "reconciled", "Reconciliation status should be reconciled");
      assert(res.taskId === taskId, "Task ID should match");

      const finalRecord = findPacket(taskId, tmp);
      assert(finalRecord.state === "done", "State should be done");
      assert(finalRecord.packet.completionEvidence.includes("pr:123"), "Evidence should include PR");
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }

  console.log("reconcile-merged-task unit tests passed successfully.");
}

runTests();
