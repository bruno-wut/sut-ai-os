#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..", "..");
const states = ["backlog", "ready", "active", "blocked", "review", "revision-required", "verified", "done", "cancelled", "archived"];
const unavailable = Object.freeze({ content: "No active content-schema validator exists in this governance repository.", storefront: "Astro checks exist only in the immutable compatibility baseline; run them from an approved implementation worktree.", ibe: "Next.js, Vitest, Playwright, migration, webhook, and preview checks exist only in the immutable compatibility baseline; run them from an approved implementation worktree.", "staff-os": "No independent Staff OS package or verified command exists in this repository.", });
function fail(message) { throw new Error(message); }
function now() { return new Date().toISOString(); }
function slash(value) { return value.replaceAll(path.sep, "/"); }
function run(command, args, cwd = root) { const result = spawnSync(command, args, { cwd, encoding: "utf8", windowsHide: true, timeout: 300000, shell: false }); return { command: [command, ...args].join(" "), passed: result.status === 0 && !result.error, exitCode: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "", output: `${result.stdout ?? ""}${result.stderr ?? ""}`.slice(-4000) }; }
function git(args) { const result = run("git", args); if (!result.passed) fail(`${result.command} failed: ${result.output}`); return result.stdout.trim(); }
function parseArgs(values) { const options = {}; const valued = new Set(["task", "verifier-agent", "verifier-model", "base"]); const flags = new Set(["acceptance-confirmed", "self-test", "help"]); for (let i = 0; i < values.length; i += 1) { const item = values[i]; if (!item.startsWith("--")) fail(`Unexpected argument: ${item}`); const key = item.slice(2); if (valued.has(key)) { const value = values[++i]; if (!value || value.startsWith("--")) fail(`Missing --${key}`); options[key] = value; } else if (flags.has(key)) options[key] = true; else fail(`Unknown option: --${key}`); } return options; }
function taskRecord(id) { const found = states.map((state) => ({ state, file: path.join(root, "tasks", state, id, "task.json") })).filter(({ file }) => fs.existsSync(file)); if (found.length !== 1) fail(`Expected exactly one canonical task packet for ${id}.`); return { ...found[0], packet: JSON.parse(fs.readFileSync(found[0].file, "utf8")) }; }
function changedPaths(base = "HEAD") { const output = git(["diff", "--name-only", `${base}...HEAD`]); const working = git(["diff", "--name-only"]); const staged = git(["diff", "--cached", "--name-only"]); const untracked = git(["ls-files", "--others", "--exclude-standard"]); return [...new Set(`${output}\n${working}\n${staged}\n${untracked}`.split(/\r?\n/).filter(Boolean).map(slash))].sort(); }
function glob(pattern) { const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replaceAll("**", "::STARSTAR::").replaceAll("*", "[^/]*").replaceAll("::STARSTAR::", ".*"); return new RegExp(`^${escaped}$`); }
function matches(file, patterns) { return patterns.some((pattern) => glob(pattern).test(file)); }
function security(base = "HEAD") { const paths = changedPaths(base); const secretPattern = /-----BEGIN [A-Z ]*PRIVATE KEY-----|\b(?:sk|ghp|github_pat|xox[baprs]|sb_secret)_[A-Za-z0-9_-]{12,}\b|(?:OPENAI|STRIPE|SUPABASE|CLOUDFLARE|GITHUB)[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\s*[:=]/i; const hits = []; for (const item of paths) { const absolute = path.join(root, item); if (!fs.existsSync(absolute) || fs.statSync(absolute).size > 1048576) continue; if (secretPattern.test(fs.readFileSync(absolute, "utf8"))) hits.push(item); } return { name: "security-boundaries", passed: hits.length === 0, details: hits.length ? `Potential secret material detected in ${hits.length} changed file(s); values suppressed.` : "No configured secret patterns detected in changed readable files.", paths: hits }; }
function fast() { return [run("node", ["scripts/task/validate", "--all"]), run("node", ["scripts/codex/validate-routing.mjs"]), run("node", ["scripts/worktree/worktree-cli.mjs", "--self-test"]), run("node", ["scripts/task/validate", "--self-test"])].map((item) => ({ name: item.command, passed: item.passed, exitCode: item.exitCode })); }
function changed(base = "HEAD", packet) { const paths = changedPaths(base); const forbidden = packet ? paths.filter((item) => matches(item, packet.forbiddenPaths ?? [])) : []; const outside = packet ? paths.filter((item) => !matches(item, packet.allowedPaths ?? [])) : []; return { name: "changed-path-inspection", passed: forbidden.length === 0 && outside.length === 0, paths, forbidden, outside }; }
function bundledNpmCli(execPath = process.execPath) { return path.join(path.dirname(execPath), "node_modules", "npm", "bin", "npm-cli.js"); }
function npmAuditCommand(platform = process.platform, execPath = process.execPath, exists = fs.existsSync) { if (platform !== "win32") return { command: "npm", args: ["audit", "--omit=dev"] }; const cli = bundledNpmCli(execPath); if (!exists(cli)) fail(`Bundled npm CLI is unavailable for shell-free task verification: ${cli}`); return { command: execPath, args: [cli, "audit", "--omit=dev"] }; }
function safeRequiredCommand(text, platform = process.platform, execPath = process.execPath, exists = fs.existsSync) { if (/^node\s+scripts\/[A-Za-z0-9_./-]+(?:\s+--[A-Za-z0-9_.=-]+)*$/.test(text)) return { command: "node", args: text.split(/\s+/).slice(1) }; if (text === "node tests/compatibility/validate-finalized-platform-contracts.mjs") return { command: "node", args: ["tests/compatibility/validate-finalized-platform-contracts.mjs"] }; if (text === "node tests/event-contracts/validate-normalized-system-event-contract.mjs") return { command: "node", args: ["tests/event-contracts/validate-normalized-system-event-contract.mjs"] }; if (text === "node tests/control-plane-schema/validate-control-plane-schema.mjs") return { command: "node", args: ["tests/control-plane-schema/validate-control-plane-schema.mjs"] }; if (text === "node tests/audit/validate-append-only-audit-contract.mjs") return { command: "node", args: ["tests/audit/validate-append-only-audit-contract.mjs"] }; if (text === "npm run verify:fast") return { command: "node", args: ["scripts/verify/fast"] }; if (text === "npm audit --omit=dev") return npmAuditCommand(platform, execPath, exists); if (text === "git diff --check") return { command: "git", args: ["diff", "--check"] }; fail(`Required command is not safely executable by verify:task: ${text}`); }
function taskVerify(options) {
  const record = taskRecord(options.task); const packet = record.packet; const verifier = options["verifier-agent"]; const model = options["verifier-model"]; if (!verifier || !model) fail("verify:task requires --verifier-agent and --verifier-model.");
  const checks = []; const risks = []; let status = "pass"; if (verifier === packet.owner) { status = "blocked"; risks.push("Implementation agent cannot serve as independent verifier."); }
  const base = options.base ?? packet.worktree?.primaryBranch ?? "HEAD"; const diff = changed(base, packet); checks.push(diff); if (!diff.passed) status = "fail";
  const secret = security(base); checks.push(secret); if (!secret.passed) status = "fail";
  const commands = []; for (const command of packet.requiredTests ?? []) { try { const parsed = safeRequiredCommand(command); const result = run(parsed.command, parsed.args); commands.push({ name: command, passed: result.passed, exitCode: result.exitCode }); if (!result.passed) status = "fail"; } catch (error) { commands.push({ name: command, passed: false, error: error.message }); status = "blocked"; } }
  const acceptanceCriteria = (packet.acceptanceCriteria ?? []).map((criterion) => `${options["acceptance-confirmed"] ? "confirmed" : "pending"}: ${criterion}`); if (!options["acceptance-confirmed"] && status === "pass") status = "revision_required";
  const productionEligible = status === "pass" && packet.productionWritePermission === true && commands.every((item) => item.passed) && diff.passed && secret.passed;
  const result = { schemaVersion: "1.0.0", taskId: packet.taskId, status, reviewer: verifier, verifierModel: model, implementerAgent: packet.owner, reviewedAt: now(), checks: checks.map((item) => `${item.name}: ${item.passed ? "pass" : "fail"}`), tests: commands.map((item) => `${item.name}: ${item.passed ? "pass" : "fail"}`), acceptanceCriteria, changedPaths: diff.paths, forbiddenPathsUntouched: diff.forbidden.length === 0, productionEligible, evidenceReferences: [], risks, recommendation: status === "pass" ? "verified" : status === "blocked" ? "blocked" : "revision_required" };
  const directory = path.join(root, "evidence", "verification", packet.taskId); fs.mkdirSync(directory, { recursive: true }); const file = path.join(directory, `verification-${result.reviewedAt.replace(/[-:.TZ]/g, "")}.json`); result.evidenceReferences.push(slash(path.relative(root, file))); fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`); process.stdout.write(`${JSON.stringify({ ...result, evidenceFile: slash(path.relative(root, file)) }, null, 2)}\n`); process.exitCode = status === "pass" ? 0 : 1;
}
function blocked(kind) { process.stdout.write(`${JSON.stringify({ status: "blocked", command: `verify:${kind}`, reason: unavailable[kind], productionEligible: false }, null, 2)}\n`); process.exitCode = 2; }
function selfTest() {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "sut-aios-verify-selftest-"));
  try {
    let checks = 0;
    const packet = { allowedPaths: ["scripts/verify/**"], forbiddenPaths: ["reference/**"] };
    const pass = matches("scripts/verify/x.mjs", packet.allowedPaths) && !matches("scripts/verify/x.mjs", packet.forbiddenPaths);
    const failPath = matches("reference/a", packet.forbiddenPaths);
    if (!pass || !failPath) fail("path matcher self-test failed");
    checks += 2;

    const fixtureExec = path.join(fixture, "runtime", "node.exe");
    const fixtureCli = bundledNpmCli(fixtureExec);
    fs.mkdirSync(path.dirname(fixtureCli), { recursive: true });
    fs.writeFileSync(fixtureCli, 'if (process.argv.length !== 4 || process.argv[2] !== "audit" || process.argv[3] !== "--omit=dev") process.exit(9);\n');
    const windowsAudit = safeRequiredCommand("npm audit --omit=dev", "win32", fixtureExec);
    if (windowsAudit.command !== fixtureExec || windowsAudit.args.length !== 3 || windowsAudit.args[0] !== fixtureCli || windowsAudit.args[1] !== "audit" || windowsAudit.args[2] !== "--omit=dev") fail("npm audit command mapping self-test failed for win32");
    checks += 1;
    const nonWindowsAudit = safeRequiredCommand("npm audit --omit=dev", "linux", fixtureExec);
    if (nonWindowsAudit.command !== "npm" || nonWindowsAudit.args.length !== 2 || nonWindowsAudit.args[0] !== "audit" || nonWindowsAudit.args[1] !== "--omit=dev") fail("npm audit command mapping self-test failed for non-Windows");
    checks += 1;
    const currentAudit = safeRequiredCommand("npm audit --omit=dev");
    if (process.platform === "win32" ? currentAudit.command !== process.execPath || currentAudit.args[0] !== bundledNpmCli() : currentAudit.command !== "npm") fail("npm audit current-platform mapping self-test failed");
    checks += 1;
    let missingCliBlocked = false;
    try { safeRequiredCommand("npm audit --omit=dev", "win32", path.join(fixture, "missing", "node.exe")); } catch { missingCliBlocked = true; }
    if (!missingCliBlocked) fail("missing bundled npm CLI did not block");
    checks += 1;

    const rejected = ["npm audit", "npm audit fix", "npm audit --omit=dev --json", "npm audit --omit=dev && npm install", "npm install", "npm audit --omit=dev "];
    for (const command of rejected) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe npm command admitted by self-test: ${command}`); checks += 1; }

    const contractValidator = "node tests/compatibility/validate-finalized-platform-contracts.mjs";
    const contractMapping = safeRequiredCommand(contractValidator);
    if (contractMapping.command !== "node" || contractMapping.args.length !== 1 || contractMapping.args[0] !== "tests/compatibility/validate-finalized-platform-contracts.mjs") fail("P0-003 contract validator mapping self-test failed");
    checks += 1;
    const rejectedContractCommands = ["node tests/compatibility/validate-finalized-platform-contracts.mjs ", "node tests/compatibility/validate-finalized-platform-contracts.mjs --json", "node tests/compatibility/validate-finalized-platform-contracts.mjs && npm install", "node tests/compatibility/other.mjs", "node ./tests/compatibility/validate-finalized-platform-contracts.mjs", "node tests/compatibility/validate-finalized-platform-contracts.mjs; node -e 0"];
    for (const command of rejectedContractCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe node tests command admitted by self-test: ${command}`); checks += 1; }

    const eventContractValidator = "node tests/event-contracts/validate-normalized-system-event-contract.mjs";
    const eventContractMapping = safeRequiredCommand(eventContractValidator);
    if (eventContractMapping.command !== "node" || eventContractMapping.args.length !== 1 || eventContractMapping.args[0] !== "tests/event-contracts/validate-normalized-system-event-contract.mjs") fail("P1-001 event-contract validator mapping self-test failed");
    checks += 1;
    const rejectedEventContractCommands = ["node tests/event-contracts/validate-normalized-system-event-contract.mjs ", "node tests/event-contracts/validate-normalized-system-event-contract.mjs --json", "node tests/event-contracts/validate-normalized-system-event-contract.mjs && npm install", "node tests/event-contracts/other.mjs", "node ./tests/event-contracts/validate-normalized-system-event-contract.mjs", "node tests/event-contracts/validate-normalized-system-event-contract.mjs; node -e 0"];
    for (const command of rejectedEventContractCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe event-contract test command admitted by self-test: ${command}`); checks += 1; }

    const controlPlaneSchemaValidator = "node tests/control-plane-schema/validate-control-plane-schema.mjs";
    const controlPlaneSchemaMapping = safeRequiredCommand(controlPlaneSchemaValidator);
    if (controlPlaneSchemaMapping.command !== "node" || controlPlaneSchemaMapping.args.length !== 1 || controlPlaneSchemaMapping.args[0] !== "tests/control-plane-schema/validate-control-plane-schema.mjs") fail("P1-002 control-plane-schema validator mapping self-test failed");
    checks += 1;
    const rejectedControlPlaneSchemaCommands = ["node tests/control-plane-schema/validate-control-plane-schema.mjs ", "node tests/control-plane-schema/validate-control-plane-schema.mjs --json", "node tests/control-plane-schema/validate-control-plane-schema.mjs && npm install", "node tests/control-plane-schema/other.mjs", "node ./tests/control-plane-schema/validate-control-plane-schema.mjs", "node tests/control-plane-schema/validate-control-plane-schema.mjs; node -e 0"];
    for (const command of rejectedControlPlaneSchemaCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe control-plane-schema test command admitted by self-test: ${command}`); checks += 1; }

    const auditValidator = "node tests/audit/validate-append-only-audit-contract.mjs";
    const auditMapping = safeRequiredCommand(auditValidator);
    if (auditMapping.command !== "node" || auditMapping.args.length !== 1 || auditMapping.args[0] !== "tests/audit/validate-append-only-audit-contract.mjs") fail("P1-003 audit validator mapping self-test failed");
    checks += 1;
    const rejectedAuditCommands = ["node tests/audit/validate-append-only-audit-contract.mjs ", "node tests/audit/validate-append-only-audit-contract.mjs --json", "node tests/audit/validate-append-only-audit-contract.mjs && npm install", "node tests/audit/other.mjs", "node ./tests/audit/validate-append-only-audit-contract.mjs", "node tests/audit/validate-append-only-audit-contract.mjs; node -e 0"];
    for (const command of rejectedAuditCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe audit test command admitted by self-test: ${command}`); checks += 1; }

    const childPass = run(process.execPath, [fixtureCli, "audit", "--omit=dev"], fixture);
    if (!childPass.passed || childPass.exitCode !== 0) fail("child-process success self-test failed");
    checks += 1;
    const childFail = run(process.execPath, ["-e", "process.exit(7)"], fixture);
    if (childFail.passed || childFail.exitCode !== 7) fail("child-process nonzero self-test failed");
    checks += 1;
    const childError = run(path.join(fixture, "missing-executable"), [], fixture);
    if (childError.passed || childError.exitCode !== null) fail("child-process execution-error self-test failed");
    checks += 1;

    const output = { status: "passed", checks, fixture: path.basename(fixture) };
    process.stdout.write(`${JSON.stringify(output)}\n`);
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
}
function main() { const command = path.basename(process.argv[1]); const options = parseArgs(process.argv.slice(2)); if (options.help) { process.stdout.write("Usage: npm run verify:<fast|changed|task|full|content|storefront|ibe|staff-os|security-boundaries> -- [options]\n"); return; } if (options["self-test"]) return selfTest(); if (command === "fast") { const results = fast(); process.stdout.write(`${JSON.stringify({ status: results.every((x) => x.passed) ? "pass" : "fail", results }, null, 2)}\n`); if (!results.every((x) => x.passed)) process.exitCode = 1; return; } if (command === "changed") { const result = changed(options.base); process.stdout.write(`${JSON.stringify({ status: result.passed ? "pass" : "fail", ...result }, null, 2)}\n`); if (!result.passed) process.exitCode = 1; return; } if (command === "security-boundaries") { const result = security(options.base); process.stdout.write(`${JSON.stringify({ status: result.passed ? "pass" : "fail", ...result }, null, 2)}\n`); if (!result.passed) process.exitCode = 1; return; } if (command === "task") return taskVerify(options); if (command === "full") { const results = [...fast(), { name: "changed-path-inspection", passed: changed(options.base).passed }, security(options.base)]; process.stdout.write(`${JSON.stringify({ status: results.every((x) => x.passed) ? "pass" : "fail", results, blockedCapabilities: Object.keys(unavailable) }, null, 2)}\n`); if (!results.every((x) => x.passed)) process.exitCode = 1; return; } if (Object.hasOwn(unavailable, command)) return blocked(command); fail(`Unknown verification command: ${command}`); }
main();
