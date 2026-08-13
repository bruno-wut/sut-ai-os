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
function safeRequiredCommand(text, platform = process.platform, execPath = process.execPath, exists = fs.existsSync) { if (/^node\s+scripts\/[A-Za-z0-9_./-]+(?:\s+--[A-Za-z0-9_.=-]+)*$/.test(text)) return { command: "node", args: text.split(/\s+/).slice(1) }; if (text === "node tests/compatibility/validate-finalized-platform-contracts.mjs") return { command: "node", args: ["tests/compatibility/validate-finalized-platform-contracts.mjs"] }; if (text === "node tests/event-contracts/validate-normalized-system-event-contract.mjs") return { command: "node", args: ["tests/event-contracts/validate-normalized-system-event-contract.mjs"] }; if (text === "node tests/control-plane-schema/validate-control-plane-schema.mjs") return { command: "node", args: ["tests/control-plane-schema/validate-control-plane-schema.mjs"] }; if (text === "node tests/audit/validate-append-only-audit-contract.mjs") return { command: "node", args: ["tests/audit/validate-append-only-audit-contract.mjs"] }; if (text === "node tests/policy-definitions/validate-authorization-policies.mjs") return { command: "node", args: ["tests/policy-definitions/validate-authorization-policies.mjs"] }; if (text === "node tests/policy-definitions/validate-authorization-policies-v1.mjs") return { command: "node", args: ["tests/policy-definitions/validate-authorization-policies-v1.mjs"] }; if (text === "node tests/policy-definitions/validate-authorization-policies-v2.mjs") return { command: "node", args: ["tests/policy-definitions/validate-authorization-policies-v2.mjs"] }; if (text === "node tests/policy-engine/validate-deterministic-policy-evaluator.mjs") return { command: "node", args: ["tests/policy-engine/validate-deterministic-policy-evaluator.mjs"] }; if (text === "node tests/playbooks/validate-playbook-registry-v1.mjs") return { command: "node", args: ["tests/playbooks/validate-playbook-registry-v1.mjs"] }; if (text === "node tests/orchestrator/validate-kill-switch-controls-v1.mjs") return { command: "node", args: ["tests/orchestrator/validate-kill-switch-controls-v1.mjs"] }; if (text === "node tests/staff-os/validate-observe-only-control-views-v1.mjs") return { command: "node", args: ["tests/staff-os/validate-observe-only-control-views-v1.mjs"] }; if (text === "node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs") return { command: "node", args: ["tests/analytics/validate-deterministic-analytics-calculators-v1.mjs"] }; if (text === "node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs") return { command: "node", args: ["tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs"] }; if (text === "node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs") return { command: "node", args: ["tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs"] }; if (text === "node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs") return { command: "node", args: ["tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs"] }; if (text === "node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs") return { command: "node", args: ["tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs"] }; if (text === "node tests/resource-governance/validate-resource-budget-contract-v1.mjs") return { command: "node", args: ["tests/resource-governance/validate-resource-budget-contract-v1.mjs"] }; if (text === "npm run test:signal-ingestion") return { command: "node", args: ["tests/signal-ingestion/validate-signal-ingestion-v1.mjs"] }; if (text === "npm run test:event-delivery") return { command: "node", args: ["tests/event-delivery/validate-event-delivery-v1.mjs"] }; if (text === "npm run test:workflow") return { command: "node", args: ["tests/workflow-runtime/validate-workflow-runtime-v1.mjs"] }; if (text === "npm run test:persistence-composition") return { command: "node", args: ["tests/persistence-composition/validate-persistence-composition-v1.mjs"] }; if (text === "npm run verify:fast") return { command: "node", args: ["scripts/verify/fast"] }; if (text === "npm audit --omit=dev") return npmAuditCommand(platform, execPath, exists); if (text === "git diff --check") return { command: "git", args: ["diff", "--check"] }; fail(`Required command is not safely executable by verify:task: ${text}`); }
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

    const policyValidator = "node tests/policy-definitions/validate-authorization-policies.mjs";
    const policyMapping = safeRequiredCommand(policyValidator);
    if (policyMapping.command !== "node" || policyMapping.args.length !== 1 || policyMapping.args[0] !== "tests/policy-definitions/validate-authorization-policies.mjs") fail("P1-004 policy validator mapping self-test failed");
    checks += 1;
    const rejectedPolicyCommands = ["node tests/policy-definitions/validate-authorization-policies.mjs ", "node tests/policy-definitions/validate-authorization-policies.mjs --json", "node tests/policy-definitions/validate-authorization-policies.mjs && npm install", "node tests/policy-definitions/other.mjs", "node ./tests/policy-definitions/validate-authorization-policies.mjs", "node tests/policy-definitions/validate-authorization-policies.mjs; node -e 0"];
    for (const command of rejectedPolicyCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe policy test command admitted by self-test: ${command}`); checks += 1; }

    const policyEvaluatorValidator = "node tests/policy-engine/validate-deterministic-policy-evaluator.mjs";
    const policyEvaluatorMapping = safeRequiredCommand(policyEvaluatorValidator);
    if (policyEvaluatorMapping.command !== "node" || policyEvaluatorMapping.args.length !== 1 || policyEvaluatorMapping.args[0] !== "tests/policy-engine/validate-deterministic-policy-evaluator.mjs") fail("P1-005 policy-engine validator mapping self-test failed");
    checks += 1;
    const rejectedPolicyEvaluatorCommands = ["node tests/policy-engine/validate-deterministic-policy-evaluator.mjs ", "node tests/policy-engine/validate-deterministic-policy-evaluator.mjs --json", "node tests/policy-engine/validate-deterministic-policy-evaluator.mjs && npm install", "node tests/policy-engine/other.mjs", "node ./tests/policy-engine/validate-deterministic-policy-evaluator.mjs", "node tests/policy-engine/validate-deterministic-policy-evaluator.mjs; node -e 0"];
    for (const command of rejectedPolicyEvaluatorCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe policy-engine test command admitted by self-test: ${command}`); checks += 1; }

    const playbookRegistryValidator = "node tests/playbooks/validate-playbook-registry-v1.mjs";
    const playbookRegistryMapping = safeRequiredCommand(playbookRegistryValidator);
    if (playbookRegistryMapping.command !== "node" || playbookRegistryMapping.args.length !== 1 || playbookRegistryMapping.args[0] !== "tests/playbooks/validate-playbook-registry-v1.mjs") fail("P1-006 playbook registry validator mapping self-test failed");
    checks += 1;
    const rejectedPlaybookRegistryCommands = ["node tests/playbooks/validate-playbook-registry-v1.mjs ", "node tests/playbooks/validate-playbook-registry-v1.mjs --json", "node tests/playbooks/validate-playbook-registry-v1.mjs && npm install", "node tests/playbooks/other.mjs", "node ./tests/playbooks/validate-playbook-registry-v1.mjs", "node tests/playbooks/validate-playbook-registry-v1.mjs; node -e 0"];
    for (const command of rejectedPlaybookRegistryCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe playbook-registry test command admitted by self-test: ${command}`); checks += 1; }

    const killSwitchValidator = "node tests/orchestrator/validate-kill-switch-controls-v1.mjs";
    const killSwitchMapping = safeRequiredCommand(killSwitchValidator);
    if (killSwitchMapping.command !== "node" || killSwitchMapping.args.length !== 1 || killSwitchMapping.args[0] !== "tests/orchestrator/validate-kill-switch-controls-v1.mjs") fail("P1-007 kill-switch validator mapping self-test failed");
    checks += 1;
    const rejectedKillSwitchCommands = ["node tests/orchestrator/validate-kill-switch-controls-v1.mjs ", "node tests/orchestrator/validate-kill-switch-controls-v1.mjs --json", "node tests/orchestrator/validate-kill-switch-controls-v1.mjs && npm install", "node tests/orchestrator/other.mjs", "node ./tests/orchestrator/validate-kill-switch-controls-v1.mjs", "node tests/orchestrator/validate-kill-switch-controls-v1.mjs; node -e 0"];
    for (const command of rejectedKillSwitchCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe kill-switch test command admitted by self-test: ${command}`); checks += 1; }

    const staffOsControlViewsValidator = "node tests/staff-os/validate-observe-only-control-views-v1.mjs";
    const staffOsControlViewsMapping = safeRequiredCommand(staffOsControlViewsValidator);
    if (staffOsControlViewsMapping.command !== "node" || staffOsControlViewsMapping.args.length !== 1 || staffOsControlViewsMapping.args[0] !== "tests/staff-os/validate-observe-only-control-views-v1.mjs") fail("P1-008 Staff OS control-view validator mapping self-test failed");
    checks += 1;
    const rejectedStaffOsControlViewsCommands = [
      " node tests/staff-os/validate-observe-only-control-views-v1.mjs",
      "node  tests/staff-os/validate-observe-only-control-views-v1.mjs",
      "node tests/staff-os/validate-observe-only-control-views-v1.mjs ",
      "node tests/staff-os/validate-observe-only-control-views-v1.mjs --json",
      "node tests/staff-os/validate-observe-only-control-views-v1.mjs && npm install",
      "node tests/staff-os/validate-observe-only-control-views-v1.mjs || node -e 0",
      "node tests/staff-os/validate-observe-only-control-views-v1.mjs; node -e 0",
      "node tests/staff-os/validate-observe-only-control-views-v1.mjs > report.txt",
      "node tests/staff-os/validate-observe-only-control-views-v1.mjs $(npm install)",
      "node tests/staff-os/validate-observe-only-control-views-v1.mjs `npm install`",
      "node tests/staff-os/other.mjs",
      "node tests/orchestrator/validate-observe-only-control-views-v1.mjs",
      "node ./tests/staff-os/validate-observe-only-control-views-v1.mjs",
      "node tests/staff-os/../staff-os/validate-observe-only-control-views-v1.mjs",
      "node tests\\staff-os\\validate-observe-only-control-views-v1.mjs"
    ];
    for (const command of rejectedStaffOsControlViewsCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe Staff OS control-view test command admitted by self-test: ${command}`); checks += 1; }

    const analyticsCalculatorValidator = "node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs";
    const analyticsCalculatorMapping = safeRequiredCommand(analyticsCalculatorValidator);
    if (analyticsCalculatorMapping.command !== "node" || analyticsCalculatorMapping.args.length !== 1 || analyticsCalculatorMapping.args[0] !== "tests/analytics/validate-deterministic-analytics-calculators-v1.mjs") fail("P2-001 analytics calculator validator mapping self-test failed");
    checks += 1;
    const rejectedAnalyticsCalculatorCommands = [
      " node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs",
      "node  tests/analytics/validate-deterministic-analytics-calculators-v1.mjs",
      "node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs ",
      "node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs --json",
      "node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs && npm install",
      "node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs || node -e 0",
      "node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs; node -e 0",
      "node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs > report.txt",
      "node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs $(npm install)",
      "node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs `npm install`",
      "node tests/analytics/other.mjs",
      "node tests/staff-os/validate-deterministic-analytics-calculators-v1.mjs",
      "node ./tests/analytics/validate-deterministic-analytics-calculators-v1.mjs",
      "node tests/analytics/../analytics/validate-deterministic-analytics-calculators-v1.mjs",
      "node tests\\analytics\\validate-deterministic-analytics-calculators-v1.mjs"
    ];
    for (const command of rejectedAnalyticsCalculatorCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe analytics calculator test command admitted by self-test: ${command}`); checks += 1; }

    const intelligenceProviderContractsValidator = "node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs";
    const intelligenceProviderContractsMapping = safeRequiredCommand(intelligenceProviderContractsValidator);
    if (intelligenceProviderContractsMapping.command !== "node" || intelligenceProviderContractsMapping.args.length !== 1 || intelligenceProviderContractsMapping.args[0] !== "tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs") fail("P2-002 intelligence-provider contract validator mapping self-test failed");
    checks += 1;
    const rejectedIntelligenceProviderContractsCommands = [
      " node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs",
      "node  tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs",
      "node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs ",
      "node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs --json",
      "node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs && npm install",
      "node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs || node -e 0",
      "node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs; node -e 0",
      "node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs > report.txt",
      "node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs $(npm install)",
      "node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs `npm install`",
      "node tests/ai-analysis/other.mjs",
      "node tests/analytics/validate-intelligence-provider-contracts-v1.mjs",
      "node ./tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs",
      "node tests/ai-analysis/../ai-analysis/validate-intelligence-provider-contracts-v1.mjs",
      "node tests\\ai-analysis\\validate-intelligence-provider-contracts-v1.mjs"
    ];
    for (const command of rejectedIntelligenceProviderContractsCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe intelligence-provider contract test command admitted by self-test: ${command}`); checks += 1; }

    const interventionProposalContractValidator = "node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs";
    const interventionProposalContractMapping = safeRequiredCommand(interventionProposalContractValidator);
    if (interventionProposalContractMapping.command !== "node" || interventionProposalContractMapping.args.length !== 1 || interventionProposalContractMapping.args[0] !== "tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs") fail("P2-004 intervention-proposal contract validator mapping self-test failed");
    checks += 1;
    const rejectedInterventionProposalContractCommands = [
      " node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs",
      "node  tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs",
      "node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs ",
      "node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs --json",
      "node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs && npm install",
      "node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs || node -e 0",
      "node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs; node -e 0",
      "node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs > report.txt",
      "node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs $(npm install)",
      "node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs `npm install`",
      "node tests/intervention-proposals/other.mjs",
      "node tests/ai-analysis/validate-intervention-proposal-contract-v1.mjs",
      "node ./tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs",
      "node tests/intervention-proposals/../intervention-proposals/validate-intervention-proposal-contract-v1.mjs",
      "node /tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs",
      "node C:/repo/tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs",
      "node tests\\intervention-proposals\\validate-intervention-proposal-contract-v1.mjs"
    ];
    for (const command of rejectedInterventionProposalContractCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe intervention-proposal contract test command admitted by self-test: ${command}`); checks += 1; }

    const infrastructurePortContractValidator = "node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs";
    const infrastructurePortContractMapping = safeRequiredCommand(infrastructurePortContractValidator);
    if (infrastructurePortContractMapping.command !== "node" || infrastructurePortContractMapping.args.length !== 1 || infrastructurePortContractMapping.args[0] !== "tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs") fail("P2-005 infrastructure-port contract validator mapping self-test failed");
    checks += 1;
    const rejectedInfrastructurePortContractCommands = [
      " node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs",
      "node  tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs",
      "node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs ",
      "node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs --json",
      "node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs && npm install",
      "node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs || node -e 0",
      "node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs; node -e 0",
      "node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs > report.txt",
      "node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs $(npm install)",
      "node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs `npm install`",
      "node tests/infrastructure-contracts/other.mjs",
      "node tests/intervention-proposals/validate-infrastructure-port-contract-v1.mjs",
      "node ./tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs",
      "node tests/infrastructure-contracts/../infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs",
      "node /tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs",
      "node C:/repo/tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs",
      "node tests\\infrastructure-contracts\\validate-infrastructure-port-contract-v1.mjs"
    ];
    for (const command of rejectedInfrastructurePortContractCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe infrastructure-port contract test command admitted by self-test: ${command}`); checks += 1; }

    const dataMinimisationRetentionContractValidator = "node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs";
    const dataMinimisationRetentionContractMapping = safeRequiredCommand(dataMinimisationRetentionContractValidator);
    if (dataMinimisationRetentionContractMapping.command !== "node" || dataMinimisationRetentionContractMapping.args.length !== 1 || dataMinimisationRetentionContractMapping.args[0] !== "tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs") fail("P2-006 data-minimisation and retention contract validator mapping self-test failed");
    checks += 1;
    const rejectedDataMinimisationRetentionContractCommands = [
      " node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs",
      "node  tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs",
      "node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs ",
      "node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs --json",
      "node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs && npm install",
      "node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs || node -e 0",
      "node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs; node -e 0",
      "node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs > report.txt",
      "node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs $(npm install)",
      "node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs `npm install`",
      "node tests/data-governance/other.mjs",
      "node tests/infrastructure-contracts/validate-data-minimisation-retention-contract-v1.mjs",
      "node ./tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs",
      "node tests/data-governance/../data-governance/validate-data-minimisation-retention-contract-v1.mjs",
      "node /tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs",
      "node C:/repo/tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs",
      "node tests\\data-governance\\validate-data-minimisation-retention-contract-v1.mjs"
    ];
    for (const command of rejectedDataMinimisationRetentionContractCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe data-minimisation and retention contract test command admitted by self-test: ${command}`); checks += 1; }

    const resourceBudgetValidator = "node tests/resource-governance/validate-resource-budget-contract-v1.mjs";
    const resourceBudgetMapping = safeRequiredCommand(resourceBudgetValidator);
    if (resourceBudgetMapping.command !== "node" || resourceBudgetMapping.args.length !== 1 || resourceBudgetMapping.args[0] !== "tests/resource-governance/validate-resource-budget-contract-v1.mjs") fail("P2-007 resource-budget validator mapping self-test failed");
    checks += 1;
    const rejectedResourceBudgetCommands = [" node tests/resource-governance/validate-resource-budget-contract-v1.mjs", "node  tests/resource-governance/validate-resource-budget-contract-v1.mjs", "node tests/resource-governance/validate-resource-budget-contract-v1.mjs ", "node tests/resource-governance/validate-resource-budget-contract-v1.mjs --json", "node tests/resource-governance/validate-resource-budget-contract-v1.mjs && npm install", "node tests/resource-governance/validate-resource-budget-contract-v1.mjs || node -e 0", "node tests/resource-governance/validate-resource-budget-contract-v1.mjs; node -e 0", "node tests/resource-governance/validate-resource-budget-contract-v1.mjs $(npm install)", "node tests/resource-governance/validate-resource-budget-contract-v1.mjs `npm install`", "node tests/resource-governance/validate-resource-governance-v1.mjs", "node tests/resource-governance/other.mjs", "node ./tests/resource-governance/validate-resource-budget-contract-v1.mjs", "node tests/resource-governance/../resource-governance/validate-resource-budget-contract-v1.mjs", "node tests\\resource-governance\\validate-resource-budget-contract-v1.mjs", "node /tests/resource-governance/validate-resource-budget-contract-v1.mjs", "node C:/repo/tests/resource-governance/validate-resource-budget-contract-v1.mjs", "node tests/resource-governance/validate-resource-budget-contract-v1.mjs > out"];
    for (const command of rejectedResourceBudgetCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe resource-budget command admitted by self-test: ${command}`); checks += 1; }

    const signalIngestionCommand = "npm run test:signal-ingestion";
    const signalIngestionMapping = safeRequiredCommand(signalIngestionCommand);
    if (signalIngestionMapping.command !== "node" || signalIngestionMapping.args.length !== 1 || signalIngestionMapping.args[0] !== "tests/signal-ingestion/validate-signal-ingestion-v1.mjs") fail("P3-001 signal-ingestion validator mapping self-test failed");
    checks += 1;
    const rejectedSignalIngestionCommands = [
      " npm run test:signal-ingestion",
      "npm  run test:signal-ingestion",
      "npm run  test:signal-ingestion",
      "npm run test:signal-ingestion ",
      "npm run test:signal-ingestion -- --json",
      "npm run test:signal-ingestion --silent",
      "npm run test:signal-ingestion && npm install",
      "npm run test:signal-ingestion || npm run verify:fast",
      "npm run test:signal-ingestion; npm install",
      "npm run test:signal-ingestion > out",
      "npm run test:signal_ingestion",
      "npm run test-signal-ingestion",
      "npm test -- signal-ingestion",
      "npm exec node tests/signal-ingestion/validate-signal-ingestion-v1.mjs",
      "node tests/signal-ingestion/validate-signal-ingestion-v1.mjs",
      "npm run tests/signal-ingestion/validate-signal-ingestion-v1.mjs",
      "npm run test\\signal-ingestion"
    ];
    for (const command of rejectedSignalIngestionCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe signal-ingestion command admitted by self-test: ${command}`); checks += 1; }

    const eventDeliveryCommand = "npm run test:event-delivery";
    const eventDeliveryMapping = safeRequiredCommand(eventDeliveryCommand);
    if (eventDeliveryMapping.command !== "node" || eventDeliveryMapping.args.length !== 1 || eventDeliveryMapping.args[0] !== "tests/event-delivery/validate-event-delivery-v1.mjs") fail("P3-002 event-delivery validator mapping self-test failed");
    checks += 1;
    const rejectedEventDeliveryCommands = [
      " npm run test:event-delivery",
      "npm  run test:event-delivery",
      "npm run  test:event-delivery",
      "npm run test:event-delivery ",
      "npm run test:event-delivery -- --json",
      "npm run test:event-delivery --silent",
      "npm run test:event-delivery && npm install",
      "npm run test:event-delivery || npm run verify:fast",
      "npm run test:event-delivery; npm install",
      "npm run test:event-delivery > out",
      "npm run test:event_delivery",
      "npm run test-event-delivery",
      "npm test -- event-delivery",
      "npm exec node tests/event-delivery/validate-event-delivery-v1.mjs",
      "node tests/event-delivery/validate-event-delivery-v1.mjs",
      "npm run tests/event-delivery/validate-event-delivery-v1.mjs",
      "npm run test\\event-delivery"
    ];
    for (const command of rejectedEventDeliveryCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe event-delivery command admitted by self-test: ${command}`); checks += 1; }

    const workflowCommand = "npm run test:workflow";
    const workflowMapping = safeRequiredCommand(workflowCommand);
    if (workflowMapping.command !== "node" || workflowMapping.args.length !== 1 || workflowMapping.args[0] !== "tests/workflow-runtime/validate-workflow-runtime-v1.mjs") fail("P3-003 workflow validator mapping self-test failed");
    checks += 1;
    const rejectedWorkflowCommands = [
      " npm run test:workflow",
      "npm  run test:workflow",
      "npm run  test:workflow",
      "npm run test:workflow ",
      "npm run test:workflow -- --json",
      "npm run test:workflow --silent",
      "npm run test:workflow && npm install",
      "npm run test:workflow || npm run verify:fast",
      "npm run test:workflow; npm install",
      "npm run test:workflow > out",
      "npm run test_workflow",
      "npm run test-workflow",
      "npm test -- workflow",
      "npm exec node tests/workflow-runtime/validate-workflow-runtime-v1.mjs",
      "node tests/workflow-runtime/validate-workflow-runtime-v1.mjs",
      "npm run tests/workflow-runtime/validate-workflow-runtime-v1.mjs",
      "npm run test\\workflow"
    ];
    for (const command of rejectedWorkflowCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe workflow command admitted by self-test: ${command}`); checks += 1; }

    const persistenceCompositionCommand = "npm run test:persistence-composition";
    const persistenceCompositionMapping = safeRequiredCommand(persistenceCompositionCommand);
    if (persistenceCompositionMapping.command !== "node" || persistenceCompositionMapping.args.length !== 1 || persistenceCompositionMapping.args[0] !== "tests/persistence-composition/validate-persistence-composition-v1.mjs") fail("P3-004 persistence-composition validator mapping self-test failed");
    checks += 1;
    const rejectedPersistenceCompositionCommands = [
      " npm run test:persistence-composition",
      "npm  run test:persistence-composition",
      "npm run  test:persistence-composition",
      "npm run test:persistence-composition ",
      "npm run test:persistence-composition -- --json",
      "npm run test:persistence-composition --silent",
      "npm run-script test:persistence-composition",
      "npm test -- persistence-composition",
      "npm exec node tests/persistence-composition/validate-persistence-composition-v1.mjs",
      "npm run test:persistence-composition && npm install",
      "npm run test:persistence-composition || npm run verify:fast",
      "npm run test:persistence-composition; npm install",
      "npm run test:persistence-composition > out",
      "npm run test:persistence-composition | npm install",
      "npm run test:persistence_composition",
      "npm run test-persistence-composition",
      "node tests/persistence-composition/validate-persistence-composition-v1.mjs",
      "npm run tests/persistence-composition/validate-persistence-composition-v1.mjs",
      "npm run test\\persistence-composition",
      "npm run ./test:persistence-composition",
      "npm run ../test:persistence-composition"
    ];
    for (const command of rejectedPersistenceCompositionCommands) { let blocked = false; try { safeRequiredCommand(command); } catch { blocked = true; } if (!blocked) fail(`unsafe persistence-composition command admitted by self-test: ${command}`); checks += 1; }

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
