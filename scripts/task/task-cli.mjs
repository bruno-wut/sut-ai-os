#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
const requiredFields = ["taskId", "title", "status", "phase", "workstream", "workflowId", "playbookId", "playbookMode", "businessObjective", "technicalObjective", "architectureReferences", "dependencies", "evidence", "assumptions", "acceptanceCriteria", "allowedPaths", "forbiddenPaths", "allowedCommands", "requiredChecks", "requiredTests", "productionWritePermission", "pullRequestRequirement", "riskLevel", "autonomyTier", "defaultAgent", "allowedAgents", "modelRoute", "defaultModel", "fallbackModel", "workspaceWrite", "solEscalationTriggers", "rollbackExpectations", "outputSchema", "contextBudget", "owner", "reviewer", "createdDate", "updatedDate", "completionEvidence", "stateTransitions"];
const requiredForExecution = ["acceptanceCriteria", "allowedPaths", "forbiddenPaths", "allowedCommands", "requiredChecks", "requiredTests"];

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
function validatePacket(packet, { strict = false, directoryState } = {}) {
  const errors = []; const warnings = [];
  for (const field of requiredFields) if (!(field in packet)) errors.push(`missing required field: ${field}`);
  if (!isTaskId(packet.taskId ?? "")) errors.push("taskId is invalid");
  if (!states.includes(packet.status)) errors.push("status is invalid");
  if (directoryState && packet.status !== directoryState) errors.push(`status ${packet.status} does not match directory ${directoryState}`);
  for (const field of ["title", "phase", "workstream", "workflowId", "businessObjective", "technicalObjective", "rollbackExpectations", "outputSchema", "owner", "reviewer", "defaultAgent", "defaultModel", "fallbackModel"]) if (!nonEmptyString(packet[field])) errors.push(`${field} must be a non-empty string`);
  for (const field of ["architectureReferences", "dependencies", "evidence", "assumptions", "acceptanceCriteria", "allowedPaths", "forbiddenPaths", "allowedCommands", "requiredChecks", "requiredTests", "allowedAgents", "solEscalationTriggers", "completionEvidence"]) if (!Array.isArray(packet[field]) || !packet[field].every(nonEmptyString)) errors.push(`${field} must be an array of non-empty strings`);
  if (typeof packet.productionWritePermission !== "boolean") errors.push("productionWritePermission must be boolean");
  if (typeof packet.pullRequestRequirement !== "boolean") errors.push("pullRequestRequirement must be boolean");
  if (typeof packet.workspaceWrite !== "boolean") errors.push("workspaceWrite must be boolean");
  if (!["low", "medium", "high", "critical"].includes(packet.riskLevel)) errors.push("riskLevel is invalid");
  if (!["tier-0", "tier-1", "tier-2", "tier-3"].includes(packet.autonomyTier)) errors.push("autonomyTier is invalid");
  if (!["shadow", "enabled"].includes(packet.playbookMode)) errors.push("playbookMode is invalid");
  if (!["sol", "terra", "luna", "qwen-local"].includes(packet.modelRoute)) errors.push("modelRoute is invalid");
  if (!packet.contextBudget || !Number.isInteger(packet.contextBudget.maxBytes) || packet.contextBudget.maxBytes < 1024 || packet.contextBudget.maxBytes > 1048576 || !Array.isArray(packet.contextBudget.includedPaths)) errors.push("contextBudget must provide maxBytes (1024-1048576) and includedPaths");
  if (!Array.isArray(packet.stateTransitions) || packet.stateTransitions.length === 0) errors.push("stateTransitions must be a non-empty array");
  else {
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
  if (needsExecutionReadiness && missingExecution.length) errors.push(`execution-blocking fields are empty: ${missingExecution.join(", ")}`);
  else if (missingExecution.length) warnings.push(`not execution-ready: ${missingExecution.join(", ")}`);
  if (packet.playbookId && packet.playbookMode !== "shadow" && packet.autonomyTier === "tier-0") warnings.push("tier-0 playbook is expected to remain in shadow mode");
  if (strict && missingExecution.length) errors.push("strict validation requires execution readiness");
  return { valid: errors.length === 0, errors, warnings, executionReady: missingExecution.length === 0 };
}

function transition(id, to, reason, actor = "codex-engineering-executor", root = repositoryRoot, options = {}) {
  const record = findPacket(id, root); const { packet, state, file } = record;
  if (terminalStates.has(state)) fail(`Terminal packet cannot be changed: ${id} is ${state}`);
  if (!states.includes(to) || !transitions[state].includes(to)) fail(`Invalid transition: ${state} -> ${to}`);
  if (!nonEmptyString(reason)) fail("A non-empty --reason is required.");
  if (to === "active") { const candidate = { ...packet, status: to, stateTransitions: [...packet.stateTransitions, { from: state, to, at: now(), actor, reason }] }; const check = validatePacket(candidate, { strict: true, directoryState: to }); if (!check.valid) fail(`Cannot start invalid task:\n- ${check.errors.join("\n- ")}`); }
  if (to === "verified" && !options.evidence) fail("Verification requires --evidence <durable-reference>.");
  if (to === "done" && !options.evidence) fail("Completion requires --evidence <durable-reference>.");
  packet.status = to; packet.updatedDate = now();
  if (options.evidence) packet.completionEvidence = [...new Set([...(packet.completionEvidence ?? []), options.evidence])];
  packet.stateTransitions.push({ from: state, to, at: packet.updatedDate, actor, reason });
  const destination = taskPath(to, id, root); const sourceDirectory = path.dirname(file); const destinationDirectory = path.dirname(destination);
  fs.mkdirSync(path.dirname(destinationDirectory), { recursive: true });
  fs.renameSync(sourceDirectory, destinationDirectory); writePacket(destination, packet);
  return { from: state, to, file: normalize(path.relative(root, destination)) };
}

function createPacket(options, root = repositoryRoot) {
  const id = options.task; if (!isTaskId(id)) fail("A valid --task is required."); if (!nonEmptyString(options.title)) fail("A non-empty --title is required.");
  const target = taskPath("backlog", id, root); if (states.some((state) => fs.existsSync(taskPath(state, id, root)))) fail(`Task already exists: ${id}`);
  const created = now(); const agent = options.agent ?? "codex-engineering-executor"; const route = options.route ?? "terra";
  if (!["sol", "terra", "luna", "qwen-local"].includes(route)) fail("--route must be sol, terra, luna, or qwen-local.");
  const packet = { "$schema": "../../../schemas/task-packet.schema.json", schemaVersion: "1.0.0", taskId: id, title: options.title, status: "backlog", phase: "discovery", workstream: "unassigned", workflowId: "unassigned", playbookId: null, playbookMode: "shadow", businessObjective: "REPLACE_ME", technicalObjective: "REPLACE_ME", architectureReferences: [], dependencies: [], evidence: [`evidence/tasks/${id}/verification.md`], assumptions: [], acceptanceCriteria: [], allowedPaths: [], forbiddenPaths: [], allowedCommands: [], requiredChecks: [], requiredTests: [], productionWritePermission: false, pullRequestRequirement: true, riskLevel: "low", autonomyTier: "tier-0", defaultAgent: agent, allowedAgents: [agent], modelRoute: route, defaultModel: route === "sol" ? "gpt-5.6-sol" : route === "luna" ? "gpt-5.6-luna" : route === "terra" ? "gpt-5.6-terra" : "REPLACE_WITH_LOCAL_MODEL", fallbackModel: "gpt-5.6-sol", workspaceWrite: false, solEscalationTriggers: [], rollbackExpectations: "REPLACE_ME", outputSchema: "schemas/agent-result.schema.json", contextBudget: { maxBytes: 524288, includedPaths: [] }, owner: options.owner ?? agent, reviewer: "unassigned", createdDate: created, updatedDate: created, completionEvidence: [], stateTransitions: [{ from: null, to: "backlog", at: created, actor: "chief-orchestrator", reason: "Task created by task:new." }] };
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
    transition(id, "ready", "Ready for fixture.", "test", root); transition(id, "active", "Start fixture.", "test", root); transition(id, "review", "Send fixture to review.", "test", root); transition(id, "verified", "Verification passed.", "qa-verification", root, { evidence: "evidence/self-test.md" }); transition(id, "done", "Completed fixture.", "qa-verification", root, { evidence: "evidence/complete.md" });
    let terminalRejected = false; try { transition(id, "archived", "should fail", "test", root); } catch { terminalRejected = true; }
    const final = findPacket(id, root); const check = validatePacket(final.packet, { strict: true, directoryState: "done" });
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
main();
