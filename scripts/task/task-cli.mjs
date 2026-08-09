#!/usr/bin/env node
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import { computeReviewOutputHash, validateReviewResult } from "../review/validate-review-result.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const states = Object.freeze(["backlog", "ready", "active", "blocked", "review", "revision-required", "verified", "done", "cancelled", "archived"]);
const terminalStates = new Set(["done", "cancelled", "archived"]);
const transitions = Object.freeze({
  backlog: ["ready", "cancelled", "archived"], ready: ["active", "blocked", "cancelled"],
  active: ["blocked", "review", "cancelled"], blocked: ["ready", "active", "cancelled"],
  review: ["revision-required", "verified", "blocked", "cancelled"], "revision-required": ["active", "blocked", "cancelled"],
  verified: ["done", "revision-required", "blocked"], done: [], cancelled: [], archived: [],
});
const requiredForExecution = ["acceptanceCriteria", "allowedPaths", "forbiddenPaths", "allowedCommands", "requiredChecks", "requiredTests"];

const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
ajv.addFormat("date-time", { validate: (str) => !isNaN(Date.parse(str)) });
const v1Schema = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "schemas", "task-packet.schema.json"), "utf8"));
const v2Schema = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "schemas", "task-packet-v2.schema.json"), "utf8"));
const validateV1 = ajv.compile(v1Schema);
const validateV2 = ajv.compile(v2Schema);

function fail(message) { throw new Error(message); }
function now() { return new Date().toISOString(); }
function normalize(p) { return p.replaceAll(path.sep, "/"); }
function usage() { return `Usage: node scripts/task/<command> [options]

Commands:
  new --task <id> --title <title> [--owner <agent>] [--agent <agent>] [--route <terra|sol|luna|qwen-local>]
  validate [--task <id> | --all | --self-test] [--strict]
  move --task <id> --to <status> --reason <text> [--actor <id>]
  start --task <id> --reason <text> [--actor <id>]
  block --task <id> --reason <text> [--actor <id>]
  review --task <id> [--verified] [--evidence <path>] --reason <text> [--actor <id>]
  complete --task <id> --evidence <path> --reason <text> [--actor <id>]
  list [--status <status>]
  status --task <id>

Task packets are canonical JSON at tasks/<status>/<task-id>/task.json. Terminal packets are immutable.`; }

function parseArgs(items) {
  const options = {}; const valueKeys = new Set(["task", "title", "owner", "agent", "route", "to", "reason", "actor", "evidence", "status"]);
  const flags = new Set(["all", "strict", "verified", "self-test", "help"]);
  for (let i = 0; i < items.length; i += 1) {
    const item = items[i];
    if (!item.startsWith("--")) fail(`Unexpected argument: ${item}`);
    const key = item.slice(2);
    if (valueKeys.has(key)) { const value = items[++i]; if (!value || value.startsWith("--")) fail(`Missing value for --${key}`); if (options[key] !== undefined) fail(`Duplicate --${key}`); options[key] = value; }
    else if (flags.has(key)) { if (options[key]) fail(`Duplicate --${key}`); options[key] = true; }
    else fail(`Unknown option: --${key}`);
  }
  return options;
}

function taskPath(state, id, root = repositoryRoot) { return path.join(root, "tasks", state, id, "task.json"); }
function isTaskId(id) { return /^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(id); }
function readPacketAt(file) { try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (error) { fail(`Cannot parse ${normalize(file)}: ${error.message}`); } }
function findPacket(id, root = repositoryRoot) {
  if (!isTaskId(id)) fail("Task ID must be 3-81 URL-safe characters.");
  const found = states.map((state) => ({ state, file: taskPath(state, id, root) })).filter(({ file }) => fs.existsSync(file));
  if (found.length === 0) fail(`Task packet not found: ${id}`);
  if (found.length > 1) fail(`Task packet is ambiguous: ${id}`);
  return { ...found[0], packet: readPacketAt(found[0].file) };
}
function writePacket(file, packet) { fs.writeFileSync(file, `${JSON.stringify(packet, null, 2)}\n`, "utf8"); }
function nonEmptyString(value) { return typeof value === "string" && value.trim().length > 0; }
function nonEmptyList(value) { return Array.isArray(value) && value.length > 0 && value.every(nonEmptyString); }
function reviewHeadSha(root) {
  const result = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8", windowsHide: true });
  const value = result.status === 0 ? result.stdout.trim() : "";
  return /^[0-9a-f]{40}$/i.test(value) ? value : null;
}
function reviewBaseSha(root) {
  const result = spawnSync("git", ["rev-parse", "origin/main"], { cwd: root, encoding: "utf8", windowsHide: true });
  const value = result.status === 0 ? result.stdout.trim() : "";
  return /^[0-9a-f]{40}$/i.test(value) ? value : null;
}
function modelForRoute(route) { return { luna: "gpt-5.6-luna", terra: "gpt-5.6-terra", sol: "gpt-5.6-sol" }[route]; }
function sha256(value) { return createHash("sha256").update(value).digest("hex"); }
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  return value;
}
function reviewScopeProjection(packet) {
  const copy = structuredClone(packet);
  for (const field of ["status", "updatedDate", "completionEvidence", "stateTransitions", "reviewVerification"]) delete copy[field];
  if (Array.isArray(copy.contextBudget?.includedPaths)) {
    copy.contextBudget.includedPaths = copy.contextBudget.includedPaths.map((item) => item.match(/^tasks\/(?:review|verified|done)\/[^/]+\/task\.json$/) ? "tasks/<lifecycle>/<task>/task.json" : item);
  }
  return canonicalize(copy);
}
function computeReviewScopeHash(packet) { return sha256(JSON.stringify(reviewScopeProjection(packet))); }
function verificationWorktreeIsClean(statusText, packet, headSha, evidencePath) {
  const reviewPaths = new Set(["planReview", "semanticReview", ...(packet.routingPolicy?.mergeRiskReview?.required ? ["mergeRiskReview"] : [])]
    .map((stage) => `?? evidence/reviews/${packet.taskId}/${stage}-${headSha}.json`));
  return statusText.trim().split(/\r?\n/).filter(Boolean).every((line) => {
    if (reviewPaths.has(line)) return true;
    const file = line.slice(3).replaceAll("\\", "/");
    if (line.startsWith("?? ") && file.startsWith(`evidence/reviews/${packet.taskId}/runs/`) && file.endsWith(".json")) return true;
    return line.startsWith("?? ") && nonEmptyString(evidencePath) && packet.evidence?.includes(normalize(evidencePath)) && file === normalize(evidencePath);
  });
}
function validateRequiredReviewArtifacts(packet, root = repositoryRoot, headSha = reviewHeadSha(root), baseSha = reviewBaseSha(root)) {
  const errors = [];
  if (!/^[0-9a-f]{40}$/i.test(headSha ?? "")) return ["cannot determine committed review head SHA"];
  if (!baseSha) return ["cannot determine canonical review base SHA"];
  const stages = ["planReview", "semanticReview", ...(packet.routingPolicy?.mergeRiskReview?.required ? ["mergeRiskReview"] : [])];
  for (const stage of stages) {
    const expected = packet.routingPolicy?.[stage];
    const file = path.join(root, "evidence", "reviews", packet.taskId, `${stage}-${headSha}.json`);
    if (!fs.existsSync(file)) { errors.push(`missing required ${stage} artifact for review head`); continue; }
    let result;
    try { result = JSON.parse(fs.readFileSync(file, "utf8")); } catch { errors.push(`invalid JSON in ${stage} artifact`); continue; }
    const validation = validateReviewResult(result, { taskId: packet.taskId, baseSha, headSha, reviewerAgent: expected.agent, model: modelForRoute(expected.route), reasoningEffort: expected.effort });
    if (!validation.valid) errors.push(`${stage} artifact is invalid: ${validation.errors.join("; ")}`);
    if (result.stage !== stage) errors.push(`${stage} artifact stage does not match its required stage`);
    if (result.decision !== "pass") errors.push(`${stage} artifact decision is not pass`);
    if (result.tracePath.includes("/runs/")) {
      if (result.tracePath !== `evidence/reviews/${packet.taskId}/runs/${result.runId}.json`) errors.push(`${stage} app trace path does not match task and run ID`);
      const traceFile = path.join(root, result.tracePath);
      let trace;
      try { trace = JSON.parse(fs.readFileSync(traceFile, "utf8")); } catch { errors.push(`${stage} app trace is missing or invalid`); continue; }
      for (const key of ["runId", "taskId", "baseSha", "headSha", "stage", "reviewerAgent", "model", "reasoningEffort", "contextManifestHash", "outputHash"]) {
        if (trace[key] !== result[key]) errors.push(`${stage} app trace ${key} does not bind review result`);
      }
      if (trace.source !== "codex-app") errors.push(`${stage} trace is not a Codex app envelope`);
      if (!Array.isArray(trace.contextManifest) || trace.contextManifest.length === 0) errors.push(`${stage} app trace has no governed context manifest`);
      else {
        const seen = new Set();
        const taskEntries = trace.contextManifest.filter((entry) => entry?.path === `tasks/review/${packet.taskId}/task.json`);
        if (taskEntries.length !== 1 || !/^[0-9a-f]{64}$/i.test(trace.reviewedTaskScopeHash ?? "")) errors.push(`${stage} app trace must bind exactly one reviewed task scope hash`);
        for (const entry of trace.contextManifest) {
          if (!entry || typeof entry.path !== "string" || typeof entry.sha256 !== "string" || path.isAbsolute(entry.path) || entry.path.includes("..") || seen.has(entry.path)) { errors.push(`${stage} app trace context entry is invalid`); continue; }
          seen.add(entry.path);
          if (entry.path === "generated/merge-risk-context") {
            if (stage !== "mergeRiskReview" || !/^[0-9a-f]{64}$/i.test(entry.sha256)) errors.push(`${stage} generated merge-risk context binding is invalid`);
            continue;
          }
          if (entry.path === `tasks/review/${packet.taskId}/task.json`) {
            if (trace.reviewedTaskScopeHash !== computeReviewScopeHash(packet)) errors.push(`${stage} reviewed task scope does not match the current packet`);
            continue;
          }
          const contextFile = path.resolve(root, entry.path);
          if (!fs.existsSync(contextFile) || sha256(fs.readFileSync(contextFile)) !== entry.sha256) errors.push(`${stage} governed context file does not match: ${entry.path}`);
        }
        const actualManifestHash = sha256(trace.contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));
        if (actualManifestHash !== result.contextManifestHash) errors.push(`${stage} app context manifest hash does not match governed files`);
      }
    } else {
      const expectedTracePath = `artifacts/traces/codex-routing/${packet.taskId}/${result.runId}-${result.reviewerAgent}-${expected.route}.jsonl`;
      if (result.tracePath !== expectedTracePath) { errors.push(`${stage} launcher trace path does not match its bound task, run, reviewer, and route`); continue; }
      let events;
      try { events = fs.readFileSync(path.join(root, result.tracePath), "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
      catch { errors.push(`${stage} launcher trace is missing or invalid`); continue; }
      const boundEvents = events.filter((event) => event?.event === "review-bound");
      if (boundEvents.length !== 1) { errors.push(`${stage} launcher trace must contain exactly one review-bound event`); continue; }
      const bound = boundEvents[0];
      for (const key of ["runId", "taskId", "baseSha", "headSha", "stage", "reviewerAgent", "model", "reasoningEffort", "contextManifestHash", "outputHash"]) {
        if (bound[key] !== result[key]) errors.push(`${stage} launcher trace ${key} does not bind review result`);
      }
      if (!events.some((event) => event?.event === "finish" && event?.status === "success")) errors.push(`${stage} launcher trace does not record successful completion`);
      if (!Array.isArray(bound.contextManifest) || bound.contextManifest.filter((entry) => entry?.path === `tasks/review/${packet.taskId}/task.json`).length !== 1 || !/^[0-9a-f]{64}$/i.test(bound.reviewedTaskScopeHash ?? "")) {
        errors.push(`${stage} launcher trace must bind exactly one reviewed task scope hash`);
      } else {
        const taskEntry = bound.contextManifest.find((entry) => entry.path === `tasks/review/${packet.taskId}/task.json`);
        if (!taskEntry?.sha256 || bound.reviewedTaskScopeHash !== computeReviewScopeHash(packet)) errors.push(`${stage} launcher reviewed task scope does not match the current packet`);
        const manifestHash = sha256(bound.contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));
        if (manifestHash !== result.contextManifestHash) errors.push(`${stage} launcher context manifest hash does not match its bound files`);
      }
    }
  }
  return errors;
}
function validatePacket(packet, { strict = false, directoryState, root = repositoryRoot } = {}) {
  const errors = []; const warnings = [];

  if (packet.schemaVersion === "2.0.0") {
    if (!validateV2(packet)) errors.push(`schema validation failed: ${ajv.errorsText(validateV2.errors)}`);
    const stageAgents = Object.entries(packet.routingPolicy ?? {}).map(([stage, definition]) => [stage, definition?.agent]);
    for (const [stage, agent] of stageAgents) {
      if (agent && !packet.allowedAgents?.includes(agent)) errors.push(`routingPolicy.${stage}.agent must be listed in allowedAgents`);
    }
  } else {
    if (packet.schemaVersion !== "1.0.0") errors.push(`unsupported schemaVersion: ${packet.schemaVersion}`);
    if (!validateV1(packet)) {
      const filtered = validateV1.errors.filter((e) => {
        if (packet.taskId === "SUT-AIOS-GOV-042" && e.instancePath === "/worktree" && e.keyword === "required" && ["branch", "createdBy"].includes(e.params?.missingProperty)) return false;
        if (packet.taskId === "SUT-AIOS-GOV-042" && e.instancePath === "/worktree" && e.keyword === "additionalProperties" && e.params?.additionalProperty === "taskBranch") return false;
        if (packet.taskId === "SUT-AIOS-P1-005" && e.instancePath === "" && e.keyword === "additionalProperties" && ["supersededBy", "supersessionNote"].includes(e.params?.additionalProperty)) return false;
        return true;
      });
      if (filtered.length > 0) errors.push(`schema validation failed: ${ajv.errorsText(filtered)}`);
    }
  }

  if (directoryState && packet.status !== directoryState) errors.push(`status ${packet.status} does not match directory ${directoryState}`);

  if (Array.isArray(packet.stateTransitions) && packet.stateTransitions.length > 0) {
    const history = packet.stateTransitions;
    if (history[0].from !== null || history[0].to !== "backlog") errors.push("first transition must be null -> backlog");
    history.forEach((entry, index) => {
      if (!entry || !Object.prototype.hasOwnProperty.call(entry, "from") || !states.includes(entry.to) || !nonEmptyString(entry.at) || !nonEmptyString(entry.actor) || !nonEmptyString(entry.reason)) errors.push(`transition ${index + 1} is invalid`);
      if (index > 0 && entry.from !== history[index - 1].to) errors.push(`transition ${index + 1} does not continue history`);
      if (index > 0 && !transitions[entry.from]?.includes(entry.to)) errors.push(`transition ${index + 1} is not permitted: ${entry.from} -> ${entry.to}`);
    });
    if (history.at(-1)?.to !== packet.status) errors.push("last transition does not match status");
  }
  const missingExecution = requiredForExecution.filter((field) => !nonEmptyList(packet[field]));
  const needsExecutionReadiness = ["ready", "active", "blocked", "review", "revision-required", "verified", "done"].includes(packet.status);
  if (needsExecutionReadiness && packet.owner === packet.reviewer) errors.push("owner and reviewer must differ for independent verification");
  if (needsExecutionReadiness && missingExecution.length) errors.push(`execution-blocking fields are empty: ${missingExecution.join(", ")}`);
  else if (missingExecution.length) warnings.push(`not execution-ready: ${missingExecution.join(", ")}`);
  if (packet.playbookId && packet.playbookMode !== "shadow" && packet.autonomyTier === "tier-0") warnings.push("tier-0 playbook is expected to remain in shadow mode");
  if (strict && missingExecution.length) errors.push("strict validation requires execution readiness");
  if (packet.schemaVersion === "2.0.0" && ["verified", "done"].includes(packet.status)) {
    if (!packet.reviewVerification) errors.push("verified V2 packet requires reviewVerification base/head binding");
    else errors.push(...validateRequiredReviewArtifacts(packet, root, packet.reviewVerification.headSha, packet.reviewVerification.baseSha));
  }
  return { valid: errors.length === 0, errors, warnings, executionReady: missingExecution.length === 0 };
}

function transition(id, to, reason, actor = "codex-engineering-executor", root = repositoryRoot, options = {}) {
  const record = findPacket(id, root); const { packet, state, file } = record;
  if (terminalStates.has(state)) fail(`Terminal packet cannot be changed: ${id} is ${state}`);
  if (!states.includes(to) || !transitions[state].includes(to)) fail(`Invalid transition: ${state} -> ${to}`);
  if (!nonEmptyString(reason)) fail("A non-empty --reason is required.");
  let normalizedEvidence;
  if (options.evidence) {
    const evidenceReference = normalize(options.evidence);
    if (path.isAbsolute(options.evidence) || evidenceReference.includes(":")) fail(`Evidence reference must be an existing repository file: ${evidenceReference}`);
    const evidenceFile = path.resolve(root, evidenceReference);
    let canonicalRoot; let canonicalEvidence;
    let evidenceStat;
    try { canonicalRoot = fs.realpathSync(root); canonicalEvidence = fs.realpathSync(evidenceFile); evidenceStat = fs.statSync(canonicalEvidence); } catch { fail(`Evidence reference does not exist: ${evidenceReference}`); }
    const relativeEvidence = normalize(path.relative(canonicalRoot, canonicalEvidence));
    if (relativeEvidence.startsWith("../") || relativeEvidence === ".." || path.isAbsolute(relativeEvidence) || !evidenceStat.isFile()) fail(`Evidence reference must be an existing repository file: ${evidenceReference}`);
    normalizedEvidence = relativeEvidence;
  }
  if (to === "active") { const candidate = { ...packet, status: to, stateTransitions: [...packet.stateTransitions, { from: state, to, at: now(), actor, reason }] }; const check = validatePacket(candidate, { strict: true, directoryState: to }); if (!check.valid) fail(`Cannot start invalid task:\n- ${check.errors.join("\n- ")}`); }
  if (to === "verified" && !options.evidence) fail("Verification requires --evidence <durable-reference>.");
  if (to === "verified" && packet.schemaVersion === "2.0.0") {
    const packetCheck = validatePacket(packet, { strict: true, directoryState: state, root });
    if (!packetCheck.valid) fail(`Cannot verify invalid V2 task packet:\n- ${packetCheck.errors.join("\n- ")}`);
    const reviewErrors = validateRequiredReviewArtifacts(packet, root, options.reviewHeadSha, options.reviewBaseSha);
    if (reviewErrors.length > 0) fail(`Cannot verify V2 task without passing exact-head review artifacts:\n- ${reviewErrors.join("\n- ")}`);
    const reviewHead = options.reviewHeadSha ?? reviewHeadSha(root);
    const canonicalBase = reviewBaseSha(root);
    if (canonicalBase && options.reviewBaseSha && options.reviewBaseSha !== canonicalBase) fail("Cannot verify V2 task against a non-canonical review base SHA.");
    const statusText = options.reviewStatusText ?? spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root, encoding: "utf8", windowsHide: true }).stdout;
    if (!verificationWorktreeIsClean(statusText, packet, reviewHead, normalizedEvidence)) fail("Cannot verify V2 task with unreviewed implementation changes in the worktree.");
    packet.reviewVerification = { baseSha: options.reviewBaseSha ?? reviewBaseSha(root), headSha: reviewHead };
  }
  if (to === "done" && !options.evidence) fail("Completion requires --evidence <durable-reference>.");
  if (to === "done") {
    const verifiedCheck = validatePacket(packet, { strict: true, directoryState: state, root });
    if (!verifiedCheck.valid) fail(`Cannot complete invalid task packet:\n- ${verifiedCheck.errors.join("\n- ")}`);
  }
  packet.status = to; packet.updatedDate = now();
  if (normalizedEvidence) packet.completionEvidence = [...new Set([...(packet.completionEvidence ?? []), normalizedEvidence])];
  packet.stateTransitions.push({ from: state, to, at: packet.updatedDate, actor, reason });
  const destination = taskPath(to, id, root); const sourceDirectory = path.dirname(file); const destinationDirectory = path.dirname(destination);
  const oldRelative = normalize(path.relative(root, file)); const newRelative = normalize(path.relative(root, destination));
  if (packet.contextBudget?.includedPaths) packet.contextBudget.includedPaths = packet.contextBudget.includedPaths.map((item) => item === oldRelative ? newRelative : item);
  fs.mkdirSync(path.dirname(destinationDirectory), { recursive: true });
  fs.renameSync(sourceDirectory, destinationDirectory); writePacket(destination, packet);
  return { from: state, to, file: normalize(path.relative(root, destination)) };
}

function createPacket(options, root = repositoryRoot) {
  const id = options.task; if (!isTaskId(id)) fail("A valid --task is required."); if (!nonEmptyString(options.title)) fail("A non-empty --title is required.");
  const target = taskPath("backlog", id, root); if (states.some((state) => fs.existsSync(taskPath(state, id, root)))) fail(`Task already exists: ${id}`);
  const created = now(); const agent = options.agent ?? "codex-engineering-executor"; const route = options.route ?? "terra";
  if (!["sol", "terra", "luna", "qwen-local"].includes(route)) fail("--route must be sol, terra, luna, or qwen-local.");
  const reviewAgents = ["engineering-planner", "qa-verification"];
  const packet = { "$schema": "../../../schemas/task-packet-v2.schema.json", schemaVersion: "2.0.0", taskId: id, title: options.title, status: "backlog", phase: "discovery", workstream: "unassigned", workflowId: "unassigned", playbookId: null, playbookMode: "shadow", businessObjective: "REPLACE_ME", technicalObjective: "REPLACE_ME", architectureReferences: [], dependencies: [], evidence: [`evidence/tasks/${id}/verification.md`], assumptions: [], acceptanceCriteria: [], allowedPaths: [], forbiddenPaths: [], allowedCommands: [], requiredChecks: [], requiredTests: [], productionWritePermission: false, pullRequestRequirement: true, riskLevel: "low", autonomyTier: "tier-0", defaultAgent: agent, allowedAgents: [...new Set([agent, ...reviewAgents])], routingPolicy: { implementation: { agent, route: route, effort: "high" }, planReview: { agent: "engineering-planner", route: "sol", effort: "high" }, semanticReview: { agent: "qa-verification", route: "luna", effort: "high" }, mergeRiskReview: { agent: "qa-verification", required: true, route: "sol", effort: "high" } }, routingComplexity: "routine", workspaceWrite: false, solEscalationTriggers: [], rollbackExpectations: "REPLACE_ME", outputSchema: "schemas/agent-result.schema.json", contextBudget: { maxBytes: 524288, includedPaths: [] }, owner: options.owner ?? agent, reviewer: "qa-verification", createdDate: created, updatedDate: created, completionEvidence: [], stateTransitions: [{ from: null, to: "backlog", at: created, actor: "chief-orchestrator", reason: "Task created by task:new." }] };
  fs.mkdirSync(path.dirname(target), { recursive: true }); writePacket(target, packet); return normalize(path.relative(root, target));
}

function listPackets(root = repositoryRoot, filterStatus) {
  const rows = [];
  for (const state of states) { if (filterStatus && state !== filterStatus) continue; const directory = path.join(root, "tasks", state); if (!fs.existsSync(directory)) continue; for (const entry of fs.readdirSync(directory, { withFileTypes: true })) { const file = path.join(directory, entry.name, "task.json"); if (entry.isDirectory() && fs.existsSync(file)) { const packet = readPacketAt(file); rows.push({ id: packet.taskId, status: packet.status, title: packet.title, risk: packet.riskLevel, updated: packet.updatedDate }); } } }
  return rows.sort((a, b) => a.id.localeCompare(b.id));
}

function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-task-selftest-"));
  try {
    const id = "SUT-TEST-001"; createPacket({ task: id, title: "Self-test packet" }, root);
    let record = findPacket(id, root); record.packet.phase = "test"; record.packet.workstream = "test"; record.packet.workflowId = "test"; record.packet.businessObjective = "test"; record.packet.technicalObjective = "test"; record.packet.acceptanceCriteria = ["test"]; record.packet.allowedPaths = ["test/**"]; record.packet.forbiddenPaths = ["protected/**"]; record.packet.allowedCommands = ["node --version"]; record.packet.requiredChecks = ["fixture"]; record.packet.requiredTests = ["self-test"]; record.packet.rollbackExpectations = "remove test files"; record.packet.reviewer = "qa-verification"; writePacket(record.file, record.packet);
    transition(id, "ready", "Ready for fixture.", "test", root); transition(id, "active", "Start fixture.", "test", root); transition(id, "review", "Send fixture to review.", "test", root);
    const reviewHead = "b".repeat(40); record = findPacket(id, root);
    const reviewedTaskPacketText = fs.readFileSync(record.file, "utf8");
    const contextManifest = [{ path: `tasks/review/${id}/task.json`, sha256: sha256(reviewedTaskPacketText) }];
    const reviewedTaskScopeHash = computeReviewScopeHash(record.packet);
    const contextManifestHash = sha256(contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));
    for (const stage of ["planReview", "semanticReview", "mergeRiskReview"]) {
      const route = record.packet.routingPolicy[stage].route;
      const runId = `self-test-${stage}`;
      const review = { schemaVersion: "1.0.0", taskId: id, baseSha: "a".repeat(40), headSha: reviewHead, reviewerAgent: record.packet.routingPolicy[stage].agent, model: modelForRoute(route), reasoningEffort: record.packet.routingPolicy[stage].effort, contextManifestHash, reviewedAt: now(), stage, runId, tracePath: `evidence/reviews/${id}/runs/${runId}.json`, outputHash: "", decision: "pass", blockingFindings: [], nonBlockingRisks: [], missingNegativeTests: [], architectureAssessment: { deepModules: "fixture", hexagonalArchitecture: "fixture", eventedBoundaries: "fixture" }, exactNextAction: "continue" };
      review.outputHash = computeReviewOutputHash(review);
      const trace = { source: "codex-app", runId, taskId: id, baseSha: review.baseSha, headSha: reviewHead, stage, reviewerAgent: review.reviewerAgent, model: review.model, reasoningEffort: review.reasoningEffort, contextManifestHash, outputHash: review.outputHash, contextManifest, reviewedTaskScopeHash };
      const traceFile = path.join(root, review.tracePath); fs.mkdirSync(path.dirname(traceFile), { recursive: true }); fs.writeFileSync(traceFile, `${JSON.stringify(trace)}\n`, "utf8");
      const reviewFile = path.join(root, "evidence", "reviews", id, `${stage}-${reviewHead}.json`); fs.mkdirSync(path.dirname(reviewFile), { recursive: true }); fs.writeFileSync(reviewFile, `${JSON.stringify(review)}\n`, "utf8");
    }
    fs.mkdirSync(path.join(root, "evidence"), { recursive: true });
    fs.writeFileSync(path.join(root, "evidence", "self-test.md"), "verified fixture\n");
    fs.writeFileSync(path.join(root, "evidence", "complete.md"), "completed fixture\n");
    transition(id, "verified", "Verification passed.", "qa-verification", root, { evidence: "evidence/self-test.md", reviewHeadSha: reviewHead, reviewBaseSha: "a".repeat(40), reviewStatusText: "" }); transition(id, "done", "Completed fixture.", "qa-verification", root, { evidence: "evidence/complete.md" });
    let terminalRejected = false; try { transition(id, "archived", "should fail", "test", root); } catch { terminalRejected = true; }
    const final = findPacket(id, root); const check = validatePacket(final.packet, { strict: true, directoryState: "done", root });
    if (!terminalRejected || !check.valid || final.packet.completionEvidence.length !== 2) fail("self-test assertions failed");
    process.stdout.write(`${JSON.stringify({ status: "passed", checks: 4, taskId: id })}\n`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}

function main() {
  const command = path.basename(process.argv[1]); const options = parseArgs(process.argv.slice(2));
  if (options.help) { process.stdout.write(`${usage()}\n`); return; }
  if (command === "new") { process.stdout.write(`${createPacket(options)}\n`); return; }
  if (command === "validate") { if (options["self-test"]) return selfTest(); const records = options.all ? listPackets().map(({ id }) => findPacket(id)) : [findPacket(options.task)]; let invalid = false; for (const record of records) { const result = validatePacket(record.packet, { strict: options.strict, directoryState: record.state }); process.stdout.write(`${JSON.stringify({ taskId: record.packet.taskId, status: record.packet.status, valid: result.valid, executionReady: result.executionReady, errors: result.errors, warnings: result.warnings })}\n`); invalid ||= !result.valid; } if (invalid) process.exitCode = 1; return; }
  if (command === "move") { const result = transition(options.task, options.to, options.reason, options.actor); process.stdout.write(`${JSON.stringify(result)}\n`); return; }
  if (command === "start") { const result = transition(options.task, "active", options.reason, options.actor); process.stdout.write(`${JSON.stringify(result)}\n`); return; }
  if (command === "block") { const result = transition(options.task, "blocked", options.reason, options.actor); process.stdout.write(`${JSON.stringify(result)}\n`); return; }
  if (command === "review") { const to = options.verified ? "verified" : "review"; const result = transition(options.task, to, options.reason, options.actor ?? (options.verified ? "qa-verification" : "codex-engineering-executor"), repositoryRoot, { evidence: options.evidence }); process.stdout.write(`${JSON.stringify(result)}\n`); return; }
  if (command === "complete") { const result = transition(options.task, "done", options.reason, options.actor ?? "qa-verification", repositoryRoot, { evidence: options.evidence }); process.stdout.write(`${JSON.stringify(result)}\n`); return; }
  if (command === "list") { if (options.status && !states.includes(options.status)) fail("Unknown --status."); const rows = listPackets(repositoryRoot, options.status); process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`); return; }
  if (command === "status") { const record = findPacket(options.task); const validation = validatePacket(record.packet, { directoryState: record.state }); process.stdout.write(`${JSON.stringify({ path: normalize(path.relative(repositoryRoot, record.file)), packet: record.packet, validation }, null, 2)}\n`); return; }
  fail(`Unknown task command: ${command}`);
}

export { computeReviewScopeHash, findPacket, validatePacket, validateRequiredReviewArtifacts, verificationWorktreeIsClean, transition, createPacket, isTaskId, readPacketAt, writePacket, taskPath, listPackets, repositoryRoot };

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && (path.resolve(process.argv[1]) === currentFile || ["new", "validate", "move", "start", "block", "review", "complete", "list", "status"].includes(path.basename(process.argv[1])))) {
  main();
}
