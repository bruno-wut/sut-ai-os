import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReviewResult } from "../review/validate-review-result.mjs";
import { validatePacket } from "../task/task-cli.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");

const modelIds = Object.freeze({
  sol: "gpt-5.6-sol",
  terra: "gpt-5.6-terra",
  luna: "gpt-5.6-luna",
});

const allowedEfforts = Object.freeze({
  luna: new Set(["low", "medium", "high", "xhigh", "max"]),
  terra: new Set(["low", "medium", "high", "xhigh"]),
  sol: new Set(["medium", "high", "xhigh"]),
  "qwen-local": new Set(["low", "medium", "high", "xhigh", "max"]),
});

const routeRank = Object.freeze({ luna: 1, terra: 2, sol: 3 });
const taskStates = Object.freeze(["backlog", "ready", "active", "blocked", "review", "revision-required", "verified", "done", "cancelled", "archived"]);
const terminalStates = new Set(["done", "cancelled", "archived"]);
const executableTaskStates = new Set(["active", "review"]);
const agentCategories = Object.freeze([
  "command",
  "intelligence",
  "execution",
  "assurance",
  "learning",
  "optional",
]);
const contextLimitBytes = 512 * 1024;

function usage() {
  return `Usage:
  node scripts/codex/launch.mjs --route <auto|sol|terra|luna|qwen-local> --agent <agent-id> --task <task-id> [--effort <low|medium|high|xhigh|max>] [--profile <plan-review|implementation|semantic-qa|merge-risk-review>] [--workspace-write] [--dry-run]`;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function gitSha(base = "HEAD") {
  try {
    const r = spawnSync("git", ["rev-parse", base], { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
    if (r.error || r.status !== 0) return null;
    const value = r.stdout?.trim();
    if (!/^[0-9a-f]{40}$/i.test(value ?? "")) return null;
    const object = spawnSync("git", ["cat-file", "-e", `${value}^{commit}`], { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
    if (object.error || object.status !== 0) return null;
    return value;
  } catch {
    return null;
  }
}

function comparisonBaseSha() {
  const configured = process.env.GOVERNED_BASE_SHA;
  const configuredRef = process.env.GOVERNED_BASE_REF;
  if (configuredRef && configuredRef !== "origin/main") throw new Error("GOVERNED_BASE_REF must be the canonical origin/main ref");
  const canonical = gitSha("origin/main");
  if (!/^[0-9a-f]{40}$/i.test(canonical ?? "")) throw new Error("Cannot determine the canonical review comparison base SHA");
  if (configured && configured !== canonical) throw new Error("GOVERNED_BASE_SHA does not match fetched origin/main");
  return canonical;
}

function isTaskId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(value);
}

function assertTaskId(value) {
  if (!isTaskId(value)) throw new Error("Task ID must be 3-81 URL-safe characters");
}

function parseArguments(values) {
  const parsed = {};
  const valueOptions = new Set(["route", "agent", "task", "effort", "profile", "local-provider", "local-model"]);
  const booleanOptions = new Set(["workspace-write", "dry-run", "help", "self-test"]);

  for (let index = 0; index < values.length; index += 1) {
    const item = values[index];
    if (!item.startsWith("--")) throw new Error(`Unexpected positional argument: ${item}`);
    const key = item.slice(2);
    if (valueOptions.has(key)) {
      const value = values[index + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
      if (parsed[key] !== undefined) throw new Error(`Duplicate option: --${key}`);
      parsed[key] = value;
      index += 1;
    } else if (booleanOptions.has(key)) {
      if (parsed[key]) throw new Error(`Duplicate option: --${key}`);
      parsed[key] = true;
    } else {
      throw new Error(`Unknown option: --${key}`);
    }
  }
  return parsed;
}

function readText(relativePath) {
  const absolutePath = path.resolve(repositoryRoot, relativePath);
  const relative = path.relative(repositoryRoot, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Context path escapes repository: ${relativePath}`);
  }
  const realPath = fs.realpathSync(absolutePath);
  const realRelative = path.relative(fs.realpathSync(repositoryRoot), realPath);
  if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) {
    throw new Error(`Context symlink escapes repository: ${relativePath}`);
  }
  return { absolutePath, relativePath: relative.replaceAll(path.sep, "/"), text: fs.readFileSync(realPath, "utf8") };
}

function frontmatterValue(text, key) {
  const match = text.match(new RegExp(`^${key}:\\s*([^\\r\\n]+)$`, "m"));
  return match?.[1]?.trim()?.replace(/^['"]|['"]$/g, "");
}

function frontmatterList(value) {
  if (!value) return null;
  const normalized = value.trim().replace(/^\[|\]$/g, "");
  return normalized.split(",").map((item) => item.trim().replace(/^['\"]|['\"]$/g, "").toLowerCase()).filter(Boolean);
}

function packetField(text, field) {
  const match = text.match(new RegExp(`^- \\*\\*${field}:\\*\\*\\s*(.+)$`, "mi"));
  return match?.[1]?.trim();
}

function packetIdentifiers(text, field) {
  const value = packetField(text, field);
  if (!value) return [];
  const quoted = [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1]);
  return quoted.length > 0 ? quoted : value.split(",").map((item) => item.trim()).filter(Boolean);
}

function normalizePacketRoute(value) {
  return value?.replaceAll("`", "").trim().toLowerCase();
}

function discoverAgents() {
  const agents = new Map();
  for (const category of agentCategories) {
    const directory = path.join(repositoryRoot, "agents", category);
    if (!fs.existsSync(directory)) continue;
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (!entry.isFile() || !entry.name.endsWith(".md")) continue;
      const relativePath = path.join("agents", category, entry.name);
      const record = readText(relativePath);
      const id = frontmatterValue(record.text, "id");
      if (!id) continue;
      if (agents.has(id)) throw new Error(`Duplicate agent ID: ${id}`);

      const routesStr = frontmatterValue(record.text, "allowed_model_routes");
      const effortsStr = frontmatterValue(record.text, "allowed_reasoning_efforts");
      const allowedRoutes = frontmatterList(routesStr);
      const allowedEffortsList = frontmatterList(effortsStr);

      agents.set(id, {
        id,
        category,
        status: frontmatterValue(record.text, "status") ?? null,
        defaultRoute: frontmatterValue(record.text, "default_model") ?? "terra",
        allowedRoutes,
        allowedEfforts: allowedEffortsList,
        relativePath: record.relativePath,
        text: record.text,
      });
    }
  }
  return agents;
}

function findTaskPacket(taskId) {
  const matches = [];
  for (const state of taskStates) {
    const jsonPath = path.join("tasks", state, taskId, "task.json");
    const markdownPath = path.join("tasks", state, taskId, "TASK.md");
    if (fs.existsSync(path.join(repositoryRoot, jsonPath))) {
      const record = readText(jsonPath);
      let data;
      try { data = JSON.parse(record.text); } catch { throw new Error(`Cannot parse canonical JSON task packet: ${record.relativePath}`); }
      matches.push({ ...record, state, format: "json", data });
    } else if (fs.existsSync(path.join(repositoryRoot, markdownPath))) {
      matches.push({ ...readText(markdownPath), state, format: "markdown" });
    }
  }
  if (matches.length === 0) throw new Error(`Missing eligible task packet for ${taskId}`);
  if (matches.length > 1) throw new Error(`Ambiguous task packet for ${taskId}`);
  return matches[0];
}

function packetAccess(packet) {
  if (packet.format === "json") {
    const isV2 = packet.data.schemaVersion === "2.0.0" && packet.data.routingPolicy;
    const implRoute = isV2 ? packet.data.routingPolicy.implementation?.route : packet.data.modelRoute;
    const implEffort = isV2 ? packet.data.routingPolicy.implementation?.effort : packet.data.reasoningEffort;
    return {
      version: packet.data.schemaVersion ?? "1.0.0",
      allowedAgents: Array.isArray(packet.data.allowedAgents) ? packet.data.allowedAgents : [],
      route: implRoute,
      effort: implEffort ?? "high",
      routingPolicy: packet.data.routingPolicy,
      workspaceWrite: packet.data.workspaceWrite === true,
      contextBudget: packet.data.contextBudget,
      state: packet.state,
    };
  }
  return {
    version: "1.0.0",
    allowedAgents: packetIdentifiers(packet.text, "Allowed agents"),
    route: normalizePacketRoute(packetField(packet.text, "Model route")) ?? "terra",
    effort: "high",
    workspaceWrite: normalizePacketRoute(packetField(packet.text, "Workspace write")) === "true",
    state: packet.state,
  };
}

function selectRoute(requestedRoute, cliEffort, packetAccess, agentRoute, profile = "implementation") {
  const isV2 = Boolean(packetAccess.routingPolicy);

  // Reject CLI route or effort override if V2 packet
  if (isV2) {
    if (requestedRoute !== "auto") {
      throw new Error("CLI --route override is prohibited for Task Packet V2; route must be governed by routingPolicy.<stage>");
    }
    if (cliEffort !== undefined) {
      throw new Error("CLI --effort override is prohibited for Task Packet V2; effort must be governed by routingPolicy.<stage>");
    }
  }

  let packetRoute = packetAccess.route ?? "terra";
  let packetEffort = packetAccess.effort ?? "high";

  if (packetAccess.routingPolicy) {
    const stageByProfile = { implementation: "implementation", "plan-review": "planReview", "semantic-qa": "semanticReview", "merge-risk-review": "mergeRiskReview" };
    const stageName = stageByProfile[profile];
    if (!stageName || !packetAccess.routingPolicy[stageName]) {
      throw new Error(`Task Packet V2 is missing routingPolicy.${stageName ?? profile}`);
    }
    packetRoute = packetAccess.routingPolicy[stageName].route;
    packetEffort = packetAccess.routingPolicy[stageName].effort;
  }

  const selectedRoute = requestedRoute === "auto" ? packetRoute : requestedRoute;
  const selectedEffort = isV2 ? packetEffort : (cliEffort ?? packetEffort);

  if (packetRoute === "qwen-local" || selectedRoute === "qwen-local") {
    if (packetRoute !== "qwen-local" || selectedRoute !== "qwen-local") {
      throw new Error("Qwen local is an isolated route and cannot be substituted for or by a hosted model");
    }
    return { route: selectedRoute, effort: selectedEffort };
  }

  // If V1 packet (no routingPolicy), enforce minimum route rank
  if (!packetAccess.routingPolicy) {
    const required = routeRank[packetRoute] >= routeRank[agentRoute] ? packetRoute : agentRoute;
    if (routeRank[selectedRoute] < routeRank[required]) {
      throw new Error(`Unsafe model downgrade: ${selectedRoute} is below required route ${required}`);
    }
  }

  // Enforce repository policy limits per model
  if (!allowedEfforts[selectedRoute]?.has(selectedEffort)) {
    throw new Error(`Policy violation: Effort '${selectedEffort}' is prohibited for route '${selectedRoute}'.`);
  }

  return { route: selectedRoute, effort: selectedEffort };
}

function assertAgentRouteEffort(agent, route, effort, requireDeclarations = false) {
  if (requireDeclarations && (!agent.allowedRoutes || !agent.allowedEfforts)) {
    throw new Error(`Agent ${agent.id} must declare allowed_model_routes and allowed_reasoning_efforts for V2`);
  }
  if (agent.allowedRoutes && !agent.allowedRoutes.includes(route)) {
    throw new Error(`Agent ${agent.id} does not permit route '${route}' (allowed: ${agent.allowedRoutes.join(", ")})`);
  }
  if (agent.allowedEfforts && !agent.allowedEfforts.includes(effort)) {
    throw new Error(`Agent ${agent.id} does not permit effort '${effort}' (allowed: ${agent.allowedEfforts.join(", ")})`);
  }
}

function assertActiveAgent(agent) {
  if (!agent || agent.status !== "active") throw new Error(`Agent ${agent?.id ?? "unknown"} is not active`);
}

function assertNonTerminalTask(taskId, state) {
  if (terminalStates.has(state)) throw new Error(`Cannot launch execution on terminal task: ${taskId} is in '${state}' state`);
}

function assertExecutableTaskState(taskId, state) {
  assertNonTerminalTask(taskId, state);
  if (!executableTaskStates.has(state)) throw new Error(`Task ${taskId} is not executable from '${state}' state`);
}

function assertProfileAuthorization(profile, taskRecord, access, agentId) {
  const reviewProfile = ["plan-review", "semantic-qa", "merge-risk-review"].includes(profile);
  if (profile === "implementation" && taskRecord.state !== "active") throw new Error("Implementation launches require an active task");
  if (reviewProfile && taskRecord.state !== "review") throw new Error(`${profile} launches require a task in review state`);
  if (access.version === "2.0.0" && taskRecord.format === "json") {
    if (profile === "implementation" && ![taskRecord.data.owner, taskRecord.data.defaultAgent].includes(agentId)) {
      throw new Error(`Implementation agent ${agentId} is not the V2 task owner/default agent`);
    }
    if (reviewProfile && (taskRecord.data.reviewer !== agentId || taskRecord.data.owner === agentId)) {
      throw new Error(`Review agent ${agentId} is not the independent V2 task reviewer`);
    }
  }
}

function assertWorkspaceWriteAuthority(selectedRoute, workspaceWrite, access, taskId, agent) {
  if (selectedRoute === "qwen-local" && workspaceWrite) {
    throw new Error("qwen-local is read-only and cannot request workspace-write");
  }
  if (workspaceWrite && !access.workspaceWrite) {
    throw new Error(`Task packet ${taskId} does not grant workspaceWrite authority`);
  }
  if (workspaceWrite && agent.category !== "execution") {
    throw new Error(`Workspace write authority is limited to execution category agents (agent '${agent.id}' is '${agent.category}')`);
  }
}

function hasSensitiveMaterial(text) {
  const patterns = [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    /\b(?:sk|ghp|github_pat|xox[baprs]|sb_secret)_[A-Za-z0-9_-]{12,}\b/i,
    /\b(?:OPENAI|STRIPE|SUPABASE|CLOUDFLARE|GITHUB)[A-Z0-9_]*(?:KEY|TOKEN|SECRET|PASSWORD)\s*[:=]\s*["']?[^\s"'`]+/i,
  ];
  return patterns.some((pattern) => pattern.test(text));
}

function buildContextProfile(agent, taskPacket, selectedRoute, selectedModel, effort, profile) {
  const baseFiles = [
    "AGENTS.md",
    "agents/AGENTS.md",
    agent.relativePath,
    taskPacket.relativePath,
    "docs/model-routing/MODEL_ROUTING_POLICY.md",
  ];

  if (taskPacket.data?.contextBudget?.includedPaths) {
    for (const p of taskPacket.data.contextBudget.includedPaths) {
      if (fs.existsSync(path.resolve(repositoryRoot, p))) {
        baseFiles.push(p);
      }
    }
  }

  const records = baseFiles.map((p) => readText(p));
  const unique = [...new Map(records.map((r) => [r.relativePath, r])).values()];
  const totalBytes = unique.reduce((sum, r) => sum + Buffer.byteLength(r.text), 0);
  const maxBytes = taskPacket.data?.contextBudget?.maxBytes ?? contextLimitBytes;

  if (totalBytes > maxBytes) {
    throw new Error(`Context profile '${profile}' exceeds limit: ${totalBytes} > ${maxBytes} bytes`);
  }

  for (const record of unique) {
    if (hasSensitiveMaterial(record.text)) {
      throw new Error(`Secret material detected in context file: ${record.relativePath}`);
    }
  }

  const manifest = unique.map((r) => `${r.relativePath}:${sha256(r.text)}`).join("\n");
  const manifestHash = sha256(manifest);

  const header = [
    `Context Profile: ${profile}`,
    `Agent ID: ${agent.id}`,
    `Selected route: ${selectedRoute}`,
    `Selected model: ${selectedModel}`,
    `Reasoning effort: ${effort}`,
    `Manifest hash: ${manifestHash}`,
    `Head SHA: ${gitSha("HEAD")}`,
    "Execute strictly within approved task packet boundaries.",
  ].join("\n");

  const body = unique.map((r) => `\n--- BEGIN ${r.relativePath} ---\n${r.text}\n--- END ${r.relativePath} ---`).join("\n");
  return { prompt: `${header}\n${body}\n`, contextFiles: unique.map((r) => r.relativePath), totalBytes, manifestHash };
}

function createTrace(taskId, agentId, route) {
  const startedAt = new Date().toISOString();
  const compact = startedAt.replace(/[-:.TZ]/g, "");
  const runId = `${compact}-${randomUUID().slice(0, 8)}`;
  const traceDirectory = path.join(repositoryRoot, "artifacts", "traces", "codex-routing", taskId);
  fs.mkdirSync(traceDirectory, { recursive: true });
  const tracePath = path.join(traceDirectory, `${runId}-${agentId}-${route}.jsonl`);
  const append = (event) => fs.appendFileSync(tracePath, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
  return { startedAt, runId, tracePath, append };
}

function sanitizeEnvironment() {
  const allowed = new Set([
    "PATH", "Path", "PATHEXT", "SYSTEMROOT", "SystemRoot", "WINDIR", "COMSPEC",
    "TEMP", "TMP", "HOME", "USERPROFILE", "LOCALAPPDATA", "APPDATA", "SHELL",
    "LANG", "LC_ALL", "TERM", "COLORTERM",
  ]);
  return Object.fromEntries(Object.entries(process.env).filter(([key]) => allowed.has(key)));
}

function buildCommandArguments(selectedRoute, selectedModel, sandbox, localProvider, effort) {
  const commandArguments = ["exec"];
  if (selectedRoute === "qwen-local") {
    commandArguments.push(
      "--oss", "--local-provider", localProvider,
      "--ignore-user-config",
      "--disable", "apps",
      "--config", 'web_search="disabled"',
    );
  }
  commandArguments.push(
    "--model", selectedModel,
    "--config", `model_reasoning_effort="${effort}"`,
    "--sandbox", sandbox,
    "--ephemeral",
    "--strict-config",
    "--cd", repositoryRoot,
    "-",
  );
  return commandArguments;
}

function canonicalize(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    if (key === "outputHash") continue;
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

function computeOutputHash(reviewObj) {
  const canonical = canonicalize(reviewObj);
  return sha256(JSON.stringify(canonical));
}

function main() {
  const rawArguments = process.argv.slice(2);
  if (rawArguments.includes("--help")) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  const argumentsObject = parseArguments(rawArguments);
  const agents = discoverAgents();

  if (argumentsObject["self-test"]) {
    const ids = Array.from(agents.keys()).sort();
    if (!ids.includes("chief-orchestrator") || !ids.includes("codex-engineering-executor") || !ids.includes("qa-verification")) {
      throw new Error("Self-test missing core agent definitions");
    }
    const selfTestPacket = {
      format: "json",
      state: "active",
      data: {
        schemaVersion: "2.0.0",
        routingPolicy: {
          implementation: { route: "terra", effort: "high" },
          planReview: { route: "luna", effort: "high" },
          semanticReview: { route: "terra", effort: "high" },
          mergeRiskReview: { required: true, route: "sol", effort: "medium" },
        },
        allowedAgents: ["codex-engineering-executor"]
      },
    };
    const routeInfo = selectRoute("auto", undefined, packetAccess(selfTestPacket), "terra", "implementation");
    if (routeInfo.route !== "terra") throw new Error("Self-test routing failure");
    process.stdout.write(`${JSON.stringify({ status: "passed", agentCount: agents.size }, null, 2)}\n`);
    return;
  }

  const requestedRoute = argumentsObject.route ?? "auto";
  const agentId = argumentsObject.agent;
  const taskId = argumentsObject.task;
  const profile = argumentsObject.profile ?? "implementation";
  assertTaskId(taskId);
  if (!["implementation", "plan-review", "semantic-qa", "merge-risk-review"].includes(profile)) {
    throw new Error(`Unsupported launch profile: ${profile}`);
  }

  if (!agentId || !taskId) {
    throw new Error("Missing required arguments: --agent and --task\n" + usage());
  }

  const agent = agents.get(agentId);
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);

  assertActiveAgent(agent);

  const taskRecord = findTaskPacket(taskId);

  assertExecutableTaskState(taskId, taskRecord.state);

  if (taskRecord.format === "json") {
    const packetCheck = validatePacket(taskRecord.data, { strict: true, directoryState: taskRecord.state });
    if (!packetCheck.valid) throw new Error(`Task packet validation failed: ${packetCheck.errors.join("; ")}`);
  }

  const access = packetAccess(taskRecord);

  if (access.allowedAgents.length === 0) {
    throw new Error(`Task packet ${taskId} must declare at least one allowed agent`);
  }
  if (!access.allowedAgents.includes(agentId)) {
    throw new Error(`Agent ${agentId} is not whitelisted by task packet ${taskId}`);
  }

  const reviewProfile = ["plan-review", "semantic-qa", "merge-risk-review"].includes(profile);
  assertProfileAuthorization(profile, taskRecord, access, agentId);

  const routeInfo = selectRoute(requestedRoute, argumentsObject.effort, access, agent.defaultRoute, profile);
  const selectedRoute = routeInfo.route;
  const effort = routeInfo.effort;

  assertAgentRouteEffort(agent, selectedRoute, effort, access.version === "2.0.0");

  let localProvider;
  let selectedModel;
  if (selectedRoute === "qwen-local") {
    localProvider = argumentsObject["local-provider"];
    selectedModel = argumentsObject["local-model"];
    if (!["ollama", "lmstudio"].includes(localProvider)) throw new Error("Qwen local requires --local-provider ollama|lmstudio");
    if (!selectedModel || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{1,127}$/.test(selectedModel)) throw new Error("Qwen local requires --local-model installed-model-id");
  } else {
    selectedModel = modelIds[selectedRoute] ?? "gpt-5.6-terra";
  }

  const workspaceWrite = Boolean(argumentsObject["workspace-write"]);
  assertWorkspaceWriteAuthority(selectedRoute, workspaceWrite, access, taskId, agent);

  if (reviewProfile && spawnSync("git", ["status", "--porcelain=v1"], { cwd: repositoryRoot, encoding: "utf8", windowsHide: true }).stdout.trim()) {
    throw new Error("Review launches require a clean committed working tree");
  }

  const reviewedHeadSha = reviewProfile ? gitSha("HEAD") : null;
  if (reviewProfile && !reviewedHeadSha) throw new Error("Cannot determine committed review head SHA");
  const reviewedBaseSha = reviewProfile ? comparisonBaseSha() : null;

  const trace = createTrace(taskId, agentId, selectedRoute);
  trace.append({ event: "start", taskId, agentId, route: selectedRoute, model: selectedModel });

  const context = buildContextProfile(agent, taskRecord, selectedRoute, selectedModel, effort, profile);
  const sandbox = workspaceWrite ? "workspace-write" : "read-only";

  if (argumentsObject["dry-run"]) {
    trace.append({ event: "finish", status: "dry-run-success" });
    process.stdout.write(
      JSON.stringify(
        {
          status: "dry-run-success",
          taskId,
          agentId,
          selectedRoute,
          selectedModel,
          effort,
          profile,
          sandbox,
          contextBytes: context.totalBytes,
          manifestHash: context.manifestHash,
          trace_path: path.relative(repositoryRoot, trace.tracePath).replaceAll(path.sep, "/"),
        },
        null,
        2,
      ) + "\n",
    );
    return;
  }

  const commandArguments = buildCommandArguments(selectedRoute, selectedModel, sandbox, localProvider, effort);
  const spawnEnv = selectedRoute === "qwen-local" ? sanitizeEnvironment() : process.env;

  const child = spawn("codex", commandArguments, {
    cwd: repositoryRoot,
    stdio: ["pipe", "pipe", "pipe"],
    env: spawnEnv,
    windowsHide: true,
  });

  let stdoutText = "";
  let stderrText = "";

  child.stdout.on("data", (chunk) => { stdoutText += chunk.toString(); });
  child.stderr.on("data", (chunk) => { stderrText += chunk.toString(); });

  child.stdin.write(context.prompt);
  child.stdin.end();

  child.on("error", (err) => {
    trace.append({ event: "finish", status: "spawn-error", error: err.message });
    process.stderr.write(`Process spawn failed: ${err.message}\n`);
    process.exit(1);
  });

  child.on("close", (exitCode) => {
    const passed = exitCode === 0;
    if (stderrText) process.stderr.write(stderrText);

    // Validate review profile output strictly
    if (passed && reviewProfile) {
      if (gitSha("HEAD") !== reviewedHeadSha || comparisonBaseSha() !== reviewedBaseSha) {
        process.stderr.write("Review execution failed: committed head or canonical base changed during review\n");
        process.exit(1);
      }
      let parsed;
      try {
        parsed = JSON.parse(stdoutText.trim());
      } catch (e) {
        trace.append({ event: "finish", status: "review-json-parse-failed", error: e.message });
        process.stderr.write(`Review execution failed: output is not valid JSON (${e.message})\n`);
        process.exit(1);
      }

      const reviewCheck = validateReviewResult(parsed, {
        taskId,
        baseSha: reviewedBaseSha,
        headSha: reviewedHeadSha,
        reviewerAgent: agentId,
        model: selectedModel,
        reasoningEffort: effort,
        contextManifestHash: context.manifestHash,
      });
      if (!reviewCheck.valid) {
        trace.append({ event: "finish", status: "review-schema-validation-failed", errors: reviewCheck.errors });
        process.stderr.write(`Review schema validation failed:\n- ${reviewCheck.errors.join("\n- ")}\n`);
        process.exit(1);
      }

      // Check task ID, model, effort
      if (parsed.taskId !== taskId) {
        process.stderr.write(`Review result taskId mismatch: expected '${taskId}', got '${parsed.taskId}'\n`);
        process.exit(1);
      }
      if (parsed.reasoningEffort !== effort) {
        process.stderr.write(`Review result reasoningEffort mismatch: expected '${effort}', got '${parsed.reasoningEffort}'\n`);
        process.exit(1);
      }
      if (parsed.contextManifestHash !== context.manifestHash) {
        process.stderr.write(`Review result contextManifestHash mismatch: expected '${context.manifestHash}', got '${parsed.contextManifestHash}'\n`);
        process.exit(1);
      }

      // Check outputHash
      const computedHash = computeOutputHash(parsed);
      if (parsed.outputHash !== computedHash) {
        process.stderr.write(`Review result outputHash mismatch: computed '${computedHash}', payload contains '${parsed.outputHash}'\n`);
        process.exit(1);
      }
    }

    if (!reviewProfile && stdoutText) process.stdout.write(stdoutText);
    trace.append({ event: "finish", status: passed ? "success" : "failed", exitCode });
    if (!passed) process.exit(exitCode ?? 1);
  });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  Promise.resolve(main()).catch((error) => {
    process.stderr.write(`codex-route: ${error.message}\n`);
    process.exitCode = 1;
  });
}

export { allowedEfforts, assertActiveAgent, assertAgentRouteEffort, assertExecutableTaskState, assertNonTerminalTask, assertProfileAuthorization, assertTaskId, assertWorkspaceWriteAuthority, comparisonBaseSha, discoverAgents, gitSha, packetAccess, selectRoute, terminalStates };
