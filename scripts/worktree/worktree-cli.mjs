#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");
const states = ["backlog", "ready", "active", "blocked", "review", "revision-required", "verified", "done", "cancelled", "archived"];

function fail(message) { throw new Error(message); }
function now() { return new Date().toISOString(); }
function slash(value) { return value.replaceAll(path.sep, "/"); }
function git(args, cwd = repositoryRoot, allowFailure = false) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.error) fail(`Could not start Git: ${result.error.message}`);
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`.trim();
  if (result.status !== 0 && !allowFailure) fail(`git ${args.join(" ")} failed: ${output || `exit ${result.status}`}`);
  return { status: result.status ?? 1, output };
}
function parseArgs(values) {
  const options = {}; const valued = new Set(["task", "actor"]); const flags = new Set(["apply", "help", "self-test"]);
  for (let index = 0; index < values.length; index += 1) { const item = values[index]; if (!item.startsWith("--")) fail(`Unexpected argument: ${item}`); const key = item.slice(2); if (valued.has(key)) { const value = values[++index]; if (!value || value.startsWith("--")) fail(`Missing --${key}`); options[key] = value; } else if (flags.has(key)) options[key] = true; else fail(`Unknown option: --${key}`); }
  return options;
}
function usage() { return `Usage: node scripts/worktree/<command> [options]

Commands:
  create --task <TASK-ID> [--actor <agent-id>]
  list
  status --task <TASK-ID>
  remove --task <TASK-ID>
  prune [--apply]
  doctor

Creation accepts only a canonical JSON packet in ready state. Removal is fail-closed for dirty, conflicted, unpushed, or unmerged worktrees. prune is dry-run unless --apply is supplied.`; }
function rootFor(cwd = repositoryRoot) { return git(["rev-parse", "--show-toplevel"], cwd).output; }
function localBranches(root) { return git(["for-each-ref", "--format=%(refname:short)", "refs/heads"], root).output.split(/\r?\n/).filter(Boolean); }
function remoteNames(root) { return git(["remote"], root).output.split(/\r?\n/).filter(Boolean); }
function primaryBranch(root) {
  for (const remote of remoteNames(root)) { const symbolic = git(["symbolic-ref", "--quiet", `refs/remotes/${remote}/HEAD`], root, true); if (symbolic.status === 0) return { branch: symbolic.output.replace(`refs/remotes/${remote}/`, ""), source: `${remote}/HEAD` }; }
  const branches = localBranches(root);
  for (const candidate of ["main", "master"]) if (branches.includes(candidate)) return { branch: candidate, source: `local ${candidate} fallback` };
  const current = git(["branch", "--show-current"], root).output;
  if (current) return { branch: current, source: "current branch fallback" };
  fail("Cannot determine a primary branch; configure a remote HEAD or create main/master.");
}
function parseWorktrees(root) {
  const lines = git(["worktree", "list", "--porcelain"], root).output.split(/\r?\n/); const result = []; let record;
  for (const line of lines) { if (!line) { if (record) result.push(record); record = undefined; } else if (line.startsWith("worktree ")) record = { path: line.slice(9) }; else if (record && line.startsWith("HEAD ")) record.head = line.slice(5); else if (record && line.startsWith("branch ")) record.branch = line.slice(7).replace("refs/heads/", ""); else if (record && line === "bare") record.bare = true; }
  if (record) result.push(record); return result;
}
function taskRecord(taskId, root = repositoryRoot) {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(taskId)) fail("Task ID is invalid.");
  const found = states.map((state) => ({ state, file: path.join(root, "tasks", state, taskId, "task.json") })).filter(({ file }) => fs.existsSync(file));
  if (found.length !== 1) fail(found.length ? `Ambiguous canonical task packet: ${taskId}` : `Canonical task packet not found: ${taskId}`);
  try { return { ...found[0], packet: JSON.parse(fs.readFileSync(found[0].file, "utf8")) }; } catch (error) { fail(`Cannot parse task packet: ${error.message}`); }
}
function slug(value) { const result = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48); return result || "task"; }
function siblingPath(root, taskId) { const parent = path.dirname(root); return path.join(parent, `${path.basename(root)}-worktrees`, taskId); }
function ensureOutsideRoot(root, candidate) { const relative = path.relative(root, candidate); if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative))) fail("Worktree target must be outside the main repository working tree."); }
function writePacket(record, root) { fs.writeFileSync(record.file, `${JSON.stringify(record.packet, null, 2)}\n`, "utf8"); }
function branchExists(branch, root) { return git(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`], root, true).status === 0 || remoteNames(root).some((remote) => git(["show-ref", "--verify", "--quiet", `refs/remotes/${remote}/${branch}`], root, true).status === 0); }
function create(taskId, actor = "codex-engineering-executor", root = repositoryRoot) {
  const record = taskRecord(taskId, root); if (record.state !== "ready" || record.packet.status !== "ready") fail("Worktree creation requires a task packet in ready state.");
  if (record.packet.worktree) fail("Task packet already records a worktree; inspect it before creating another.");
  const primary = primaryBranch(root); const branch = `task/${taskId}-${slug(record.packet.title)}`; const target = siblingPath(root, taskId);
  ensureOutsideRoot(root, target); if (fs.existsSync(target)) fail(`Worktree path already exists: ${target}`); if (branchExists(branch, root)) fail(`Task branch already exists unexpectedly: ${branch}`);
  fs.mkdirSync(path.dirname(target), { recursive: true }); git(["worktree", "add", "-b", branch, target, primary.branch], root);
  record.packet.worktree = { path: slash(target), branch, primaryBranch: primary.branch, createdAt: now(), createdBy: actor }; record.packet.updatedDate = now(); writePacket(record, root);
  return { taskId, branch, path: slash(target), primaryBranch: primary.branch, primaryBranchSource: primary.source };
}
function resolveTaskWorktree(taskId, root = repositoryRoot) {
  const record = taskRecord(taskId, root); const expected = record.packet.worktree?.path ?? slash(siblingPath(root, taskId)); const expectedBranch = record.packet.worktree?.branch;
  const samePath = (left, right) => { const a = slash(path.resolve(left)); const b = slash(path.resolve(right)); return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b; };
  const match = parseWorktrees(root).find((item) => samePath(item.path, expected) || (expectedBranch && item.branch === expectedBranch));
  if (!match) fail(`No registered Git worktree found for task ${taskId}.`); return { record, worktree: match, expected };
}
function safety(taskId, root = repositoryRoot) {
  const { record, worktree } = resolveTaskWorktree(taskId, root); const branch = worktree.branch;
  if (!branch?.startsWith(`task/${taskId}-`)) fail("Worktree branch does not match the requested task.");
  const dirty = git(["status", "--porcelain"], worktree.path).output; const conflicts = git(["diff", "--name-only", "--diff-filter=U"], worktree.path).output;
  const primary = record.packet.worktree?.primaryBranch ?? primaryBranch(root).branch;
  const merge = git(["merge-base", "--is-ancestor", branch, primary], root, true); const upstream = git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], worktree.path, true);
  let ahead = 0; if (upstream.status === 0) { const counts = git(["rev-list", "--left-right", "--count", `@{upstream}...HEAD`], worktree.path).output.split(/\s+/).map(Number); ahead = counts[1] ?? 0; } else ahead = Number(git(["rev-list", "--count", `${primary}..${branch}`], root).output);
  return { taskId, path: slash(worktree.path), branch, primaryBranch: primary, dirty: Boolean(dirty), conflicts: Boolean(conflicts), unmerged: merge.status !== 0, unpushedCommits: ahead, removable: !dirty && !conflicts && merge.status === 0 && ahead === 0, packetState: record.state };
}
function status(taskId, root = repositoryRoot) {
  const record = taskRecord(taskId, root); const expected = record.packet.worktree?.path ?? slash(siblingPath(root, taskId));
  const found = parseWorktrees(root).some((item) => slash(path.resolve(item.path)) === slash(path.resolve(expected)) || (record.packet.worktree?.branch && item.branch === record.packet.worktree.branch));
  if (!found) return { taskId, packetState: record.state, registered: false, expectedPath: expected, message: "No Git worktree is registered for this task." };
  return { registered: true, ...safety(taskId, root) };
}
function remove(taskId, root = repositoryRoot) {
  const report = safety(taskId, root); if (!report.removable) fail(`Refusing removal: ${JSON.stringify(report)}`);
  git(["worktree", "remove", report.path], root); git(["branch", "-d", report.branch], root); return { removed: true, ...report };
}
function doctor(root = repositoryRoot) { const primary = primaryBranch(root); return { os: `${process.platform}/${process.arch}`, node: process.version, repositoryRoot: slash(root), primaryBranch: primary.branch, primaryBranchSource: primary.source, remotes: remoteNames(root), worktrees: parseWorktrees(root).map((item) => ({ ...item, path: slash(item.path) })), dependencyPolicy: "Install dependencies inside each worktree only when its package manager requires them; reuse immutable package caches, never node_modules or mutable build output." }; }
function selfTest() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-worktree-selftest-"));
  try {
    git(["init", "-b", "main"], root); git(["config", "user.email", "selftest@example.invalid"], root); git(["config", "user.name", "Self Test"], root); fs.writeFileSync(path.join(root, "README.md"), "fixture\n"); git(["add", "README.md"], root); git(["commit", "-m", "fixture"], root);
    const taskId = "SUT-WT-001"; const taskDir = path.join(root, "tasks", "ready", taskId); fs.mkdirSync(taskDir, { recursive: true }); fs.writeFileSync(path.join(taskDir, "task.json"), JSON.stringify({ taskId, title: "Fixture worktree", status: "ready", updatedDate: now() }));
    const created = create(taskId, "self-test", root); const report = safety(taskId, root); if (!report.removable || !fs.existsSync(created.path)) fail("fixture worktree is not safely removable"); const removed = remove(taskId, root); if (!removed.removed || fs.existsSync(created.path)) fail("fixture worktree removal failed"); process.stdout.write(`${JSON.stringify({ status: "passed", checks: 5, branch: created.branch })}\n`);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
}
function main() {
  const command = path.basename(process.argv[1]); const options = parseArgs(process.argv.slice(2)); if (options.help) { process.stdout.write(`${usage()}\n`); return; } if (options["self-test"]) return selfTest();
  if (command === "create") { process.stdout.write(`${JSON.stringify(create(options.task, options.actor), null, 2)}\n`); return; }
  if (command === "list") { process.stdout.write(`${JSON.stringify(doctor().worktrees, null, 2)}\n`); return; }
  if (command === "status") { process.stdout.write(`${JSON.stringify(status(options.task), null, 2)}\n`); return; }
  if (command === "remove") { process.stdout.write(`${JSON.stringify(remove(options.task), null, 2)}\n`); return; }
  if (command === "prune") { const args = ["worktree", "prune", "--verbose"]; if (!options.apply) args.push("--dry-run"); const result = git(args); process.stdout.write(`${JSON.stringify({ applied: Boolean(options.apply), output: result.output || "no stale entries" })}\n`); return; }
  if (command === "doctor") { process.stdout.write(`${JSON.stringify(doctor(), null, 2)}\n`); return; }
  fail(`Unknown worktree command: ${command}`);
}
main();
