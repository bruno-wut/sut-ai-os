import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createPacket, findPacket, readPacketAt, validatePacket, writePacket } from "../../scripts/task/task-cli.mjs";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-v2-validation-"));

try {
  const legacy = readPacketAt(path.join(repositoryRoot, "tasks", "active", "SUT-AIOS-GOV-003", "task.json"));
  assert.equal(validatePacket(legacy, { strict: true, directoryState: "active" }).valid, true, "a valid V1 packet remains valid");
  assert.equal(validatePacket({ ...legacy, unexpectedField: true }, { strict: true, directoryState: "active" }).valid, false, "malformed V1 packets remain rejected");

  createPacket({ task: "SUT-TEST-V2", title: "V2 fixture", route: "terra" }, tempRoot);
  const record = findPacket("SUT-TEST-V2", tempRoot);
  const packet = record.packet;
  Object.assign(packet, {
    phase: "test",
    workstream: "governance",
    workflowId: "v2-fixture",
    businessObjective: "test",
    technicalObjective: "test",
    acceptanceCriteria: ["test"],
    allowedPaths: ["tests/**"],
    forbiddenPaths: ["reference/finalized-platform/**"],
    allowedCommands: ["node --version"],
    requiredChecks: ["fixture"],
    requiredTests: ["fixture"],
    rollbackExpectations: "remove fixture",
    reviewer: "qa-verification"
  });
  writePacket(record.file, packet);

  assert.equal(validatePacket(packet, { strict: true, directoryState: "backlog" }).valid, true, "a valid V2 packet is accepted");
  assert.deepEqual(packet.routingPolicy, {
    implementation: { route: "terra", effort: "high" },
    planReview: { route: "sol", effort: "high" },
    semanticReview: { route: "luna", effort: "high" },
    mergeRiskReview: { required: true, route: "sol", effort: "high" }
  }, "new V2 packets receive the canonical routine stage routing");
  assert.equal(packet.routingComplexity, "routine", "new V2 packets require routine routing complexity by default");

  const missingRouting = { ...packet };
  delete missingRouting.routingPolicy;
  assert.equal(validatePacket(missingRouting, { strict: true, directoryState: "backlog" }).valid, false, "V2 without routingPolicy is rejected");

  const missingRoutingComplexity = { ...packet };
  delete missingRoutingComplexity.routingComplexity;
  assert.equal(validatePacket(missingRoutingComplexity, { strict: true, directoryState: "backlog" }).valid, false, "V2 without routingComplexity is rejected");

  const emptyAgents = { ...packet, allowedAgents: [] };
  assert.equal(validatePacket(emptyAgents, { strict: true, directoryState: "backlog" }).valid, false, "V2 without an allowed agent is rejected");

  const topLevelRoute = { ...packet, modelRoute: "terra" };
  assert.equal(validatePacket(topLevelRoute, { strict: true, directoryState: "backlog" }).valid, false, "V2 top-level route authority is rejected");

  const unsupported = { ...packet, schemaVersion: "3.0.0" };
  assert.equal(validatePacket(unsupported, { strict: true, directoryState: "backlog" }).valid, false, "unsupported packet versions are rejected");

  process.stdout.write(JSON.stringify({ status: "passed", checks: 9 }) + "\n");
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}
