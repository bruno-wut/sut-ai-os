import { spawn, spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { computeReviewOutputHash, validateReviewResult } from "../review/validate-review-result.mjs";
import { computeReviewScopeHash, validateLauncherTraceEvents, validatePacket, validateRequiredReviewArtifacts } from "../task/task-cli.mjs";

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
const reviewOutputLimitBytes = 1024 * 1024;
const reviewProgressIntervalBytes = 64 * 1024;
const stageByProfile = Object.freeze({ implementation: "implementation", "plan-review": "planReview", "semantic-qa": "semanticReview", "merge-risk-review": "mergeRiskReview" });
const reviewAssessmentFields = Object.freeze([
  "decision",
  "blockingFindings",
  "nonBlockingRisks",
  "missingNegativeTests",
  "architectureAssessment",
  "exactNextAction",
]);
const reviewAssessmentFocus = Object.freeze({
  "plan-review": "Assess whether the planned implementation is bounded, testable, and consistent with the packet before merge-risk concerns are considered.",
  "semantic-qa": "Assess the implemented behavior, negative cases, data minimisation, and forbidden-path compliance against the packet and governed context.",
  "merge-risk-review": "Assess the exact committed diff for merge risks, rollback adequacy, evidence integrity, and any remaining governance boundary violation.",
});

function usage() {
  return `Usage:
  node scripts/codex/launch.mjs --route <auto|sol|terra|luna|qwen-local> --agent <agent-id> --task <task-id> [--effort <low|medium|high|xhigh|max>] [--profile <plan-review|implementation|semantic-qa|merge-risk-review>] [--workspace-write] [--dry-run]`;
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
}

function gitSha(base = "HEAD", root = repositoryRoot) {
  try {
    const r = spawnSync("git", ["rev-parse", base], { cwd: root, encoding: "utf8", windowsHide: true });
    if (r.error || r.status !== 0) return null;
    const value = r.stdout?.trim();
    if (!/^[0-9a-f]{40}$/i.test(value ?? "")) return null;
    const object = spawnSync("git", ["cat-file", "-e", `${value}^{commit}`], { cwd: root, encoding: "utf8", windowsHide: true });
    if (object.error || object.status !== 0) return null;
    return value;
  } catch {
    return null;
  }
}

function comparisonBaseSha(root = repositoryRoot) {
  const configured = process.env.GOVERNED_BASE_SHA;
  const configuredRef = process.env.GOVERNED_BASE_REF;
  if (configuredRef && configuredRef !== "origin/main") throw new Error("GOVERNED_BASE_REF must be the canonical origin/main ref");
  const canonical = gitSha("origin/main", root);
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

function readText(relativePath, root = repositoryRoot) {
  const absolutePath = path.resolve(root, relativePath);
  const relative = path.relative(root, absolutePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Context path escapes repository: ${relativePath}`);
  }
  const realPath = fs.realpathSync(absolutePath);
  const realRelative = path.relative(fs.realpathSync(root), realPath);
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

function findTaskPacket(taskId, root = repositoryRoot) {
  const matches = [];
  for (const state of taskStates) {
    const jsonPath = path.join("tasks", state, taskId, "task.json");
    const markdownPath = path.join("tasks", state, taskId, "TASK.md");
    if (fs.existsSync(path.join(root, jsonPath))) {
      const record = readText(jsonPath, root);
      let data;
      try { data = JSON.parse(record.text); } catch { throw new Error(`Cannot parse canonical JSON task packet: ${record.relativePath}`); }
      matches.push({ ...record, state, format: "json", data });
    } else if (fs.existsSync(path.join(root, markdownPath))) {
      matches.push({ ...readText(markdownPath, root), state, format: "markdown" });
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
      routingComplexity: packet.data.routingComplexity,
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
    const stageName = stageByProfile[profile];
    if (!stageName || !packetAccess.routingPolicy[stageName]) {
      throw new Error(`Task Packet V2 is missing routingPolicy.${stageName ?? profile}`);
    }
    packetRoute = packetAccess.routingPolicy[stageName].route;
    packetEffort = packetAccess.routingPolicy[stageName].effort;
  }

  const reservedDeepReview = (packetRoute === "luna" && packetEffort === "max") || (packetRoute === "sol" && packetEffort === "xhigh");
  if (isV2 && reservedDeepReview && packetAccess.routingComplexity !== "high-complexity") {
    throw new Error("luna/max semantic review and sol/xhigh escalation require routingComplexity: high-complexity");
  }

  const selectedRoute = requestedRoute === "auto" ? packetRoute : requestedRoute;
  const selectedEffort = isV2 ? packetEffort : (cliEffort ?? packetEffort);

  if (packetRoute === "qwen-local" || selectedRoute === "qwen-local") {
    if (packetRoute !== "qwen-local" || selectedRoute !== "qwen-local") {
      throw new Error("Qwen local is an isolated route and cannot be substituted for or by a hosted model");
    }
    return { route: selectedRoute, effort: selectedEffort };
  }

  // V1 packets retain their packet-governed route so changed V2 agent defaults
  // cannot silently escalate legacy task execution.
  if (!packetAccess.routingPolicy) {
    if (routeRank[selectedRoute] < routeRank[packetRoute]) {
      throw new Error(`Unsafe model downgrade: ${selectedRoute} is below required route ${packetRoute}`);
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
    const stageName = stageByProfile[profile];
    const stageAgent = taskRecord.data.routingPolicy?.[stageName]?.agent;
    if (!stageAgent) throw new Error(`Task Packet V2 is missing routingPolicy.${stageName}.agent`);
    if (stageAgent !== agentId) throw new Error(`Agent ${agentId} is not authorized for V2 ${stageName}`);
    if (profile === "implementation" && ![taskRecord.data.owner, taskRecord.data.defaultAgent].includes(agentId)) {
      throw new Error(`Implementation agent ${agentId} is not the V2 task owner/default agent`);
    }
    if (reviewProfile && taskRecord.data.owner === agentId) {
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

function buildMergeRiskContext(baseSha, headSha, options = {}) {
  if (!/^[0-9a-f]{40}$/i.test(baseSha ?? "") || !/^[0-9a-f]{40}$/i.test(headSha ?? "")) {
    throw new Error("Cannot build merge-risk context for invalid commit SHAs");
  }
  const run = options.runGit ?? ((args) => {
    const result = spawnSync("git", args, { cwd: repositoryRoot, encoding: "utf8", windowsHide: true });
    if (result.error || result.status !== 0) throw new Error("Cannot build canonical merge-risk review context");
    return result.stdout ?? "";
  });
  const fullContextPaths = new Set(options.fullContextPaths ?? []);
  const changedPathOutput = run(["diff", "--no-renames", "--name-only", "-z", baseSha, headSha, "--"]);
  const changedPaths = changedPathOutput.split("\0").filter(Boolean);
  for (const changedPath of changedPaths) {
    if (/[\r\n\0]/.test(changedPath)) throw new Error("Cannot represent ambiguous changed path in merge-risk context");
  }
  const patches = changedPaths.map((changedPath) => {
    const patch = run(["diff", "--no-ext-diff", "--no-renames", "--unified=8", baseSha, headSha, "--", changedPath]).trim();
    if (!patch) throw new Error(`Canonical merge-risk diff is missing changed path: ${changedPath}`);
    const historicalEvidence = /^evidence\/(?:reviews|verification)\//.test(changedPath);
    const taskPacket = /^tasks\/[^/]+\/[^/]+\/task\.json$/.test(changedPath);
    const separatelyIncludedDocument = fullContextPaths.has(changedPath) && /^(?:docs\/|evidence\/tasks\/).+\.md$/i.test(changedPath);
    if (historicalEvidence || taskPacket || separatelyIncludedDocument) {
      return [
        `Changed path: ${JSON.stringify(changedPath)}`,
        historicalEvidence
          ? "Historical machine-generated evidence patch: bounded digest (current exact verification and prerequisite reviews are included separately in full)."
          : taskPacket
            ? "Task lifecycle packet patch: bounded digest (the full current task packet is included separately in governed context)."
            : "Governed documentation patch: bounded digest (the full current document is included separately in governed context).",
        `Patch bytes: ${Buffer.byteLength(patch)}`,
        `Patch SHA-256: ${sha256(patch)}`,
      ].join("\n");
    }
    return `Changed path: ${JSON.stringify(changedPath)}\nPatch:\n${patch}`;
  });
  return [
    "Generated merge-risk review material (read-only):",
    `Canonical base SHA: ${baseSha}`,
    `Reviewed head SHA: ${headSha}`,
    "Changed paths:",
    changedPaths.length ? changedPaths.map((changedPath) => JSON.stringify(changedPath)).join("\n") : "(none)",
    "Canonical base-to-head path material (inline patches for implementation; bounded digests only for historical machine-generated evidence, the separately included current task packet, and separately included governed documentation):",
    patches.length ? patches.join("\n\n") : "(no textual diff)",
  ].join("\n");
}

function validateContextMaterial(records, generatedText, maxBytes) {
  const totalBytes = records.reduce((sum, record) => sum + Buffer.byteLength(record.text), 0) + Buffer.byteLength(generatedText);
  if (totalBytes > maxBytes) throw new Error(`Context profile exceeds limit: ${totalBytes} > ${maxBytes} bytes`);
  for (const record of records) {
    if (hasSensitiveMaterial(record.text)) throw new Error(`Secret material detected in context file: ${record.relativePath}`);
  }
  if (generatedText && hasSensitiveMaterial(generatedText)) throw new Error("Secret material detected in generated merge-risk context");
  return totalBytes;
}

function buildContextProfile(agent, taskPacket, selectedRoute, selectedModel, effort, profile, options = {}) {
  const root = options.root ?? repositoryRoot;
  const boundHeadSha = options.headSha ?? gitSha("HEAD");
  const boundBaseSha = options.baseSha ?? (profile === "merge-risk-review" ? comparisonBaseSha() : null);
  const baseFiles = [
    "AGENTS.md",
    "agents/AGENTS.md",
    agent.relativePath,
    taskPacket.relativePath,
    "docs/model-routing/MODEL_ROUTING_POLICY.md",
  ];

  if (taskPacket.data?.contextBudget?.includedPaths) {
    for (const p of taskPacket.data.contextBudget.includedPaths) {
      if (fs.existsSync(path.resolve(root, p))) {
        baseFiles.push(p);
      }
    }
  }

  const taskId = taskPacket.data?.taskId;
  const headSha = boundHeadSha;
  const exactVerificationPath = taskId && headSha ? `evidence/verification/${taskId}/verification-${headSha}.json` : null;
  if (exactVerificationPath && fs.existsSync(path.resolve(root, exactVerificationPath))) baseFiles.push(exactVerificationPath);
  if (profile === "merge-risk-review" && taskId && headSha) {
    for (const prerequisiteProfile of ["plan-review", "semantic-qa"]) {
      const prerequisitePath = path.relative(root, reviewArtifactPath(taskId, prerequisiteProfile, headSha, root)).replaceAll(path.sep, "/");
      if (fs.existsSync(path.resolve(root, prerequisitePath))) {
        baseFiles.push(prerequisitePath);
        try {
          const prerequisite = JSON.parse(fs.readFileSync(path.resolve(root, prerequisitePath), "utf8"));
          if (typeof prerequisite.tracePath === "string" && fs.existsSync(path.resolve(root, prerequisite.tracePath))) baseFiles.push(prerequisite.tracePath);
        } catch {
          // The shared evidence-sequence gate reports malformed prerequisite evidence.
        }
      }
    }
  }

  const records = baseFiles.map((p) => readText(p, root));
  const unique = [...new Map(records.map((r) => [r.relativePath, r])).values()];
  const mergeRiskContext = profile === "merge-risk-review" ? buildMergeRiskContext(boundBaseSha, boundHeadSha, { fullContextPaths: unique.map((record) => record.relativePath) }) : "";
  const maxBytes = taskPacket.data?.contextBudget?.maxBytes ?? contextLimitBytes;
  let totalBytes;
  try {
    totalBytes = validateContextMaterial(unique, mergeRiskContext, maxBytes);
  } catch (error) {
    if (error.message.startsWith("Context profile exceeds limit:")) {
      throw new Error(error.message.replace("Context profile", `Context profile '${profile}'`));
    }
    throw error;
  }

  const contextManifest = unique.map((r) => ({ path: r.relativePath, sha256: sha256(r.text) }));
  if (mergeRiskContext) contextManifest.push({ path: "generated/merge-risk-context", sha256: sha256(mergeRiskContext) });
  const manifest = contextManifest.map((r) => `${r.path}:${r.sha256}`).join("\n");
  const manifestHash = sha256(manifest);

  const header = [
    `Context Profile: ${profile}`,
    `Agent ID: ${agent.id}`,
    `Selected route: ${selectedRoute}`,
    `Selected model: ${selectedModel}`,
    `Reasoning effort: ${effort}`,
    `Manifest hash: ${manifestHash}`,
    `Head SHA: ${boundHeadSha}`,
    "Execute strictly within approved task packet boundaries.",
  ].join("\n");

  const body = unique.map((r) => `\n--- BEGIN ${r.relativePath} ---\n${r.text}\n--- END ${r.relativePath} ---`).join("\n");
  const reviewPrompt = buildReviewAssessmentPrompt(profile);
  const generated = mergeRiskContext ? `\n--- BEGIN generated/merge-risk-context ---\n${mergeRiskContext}\n--- END generated/merge-risk-context ---\n` : "";
  return { prompt: `${header}${reviewPrompt ? `\n\n${reviewPrompt}` : ""}${generated}\n${body}\n`, contextFiles: unique.map((r) => r.relativePath), contextManifest, totalBytes, manifestHash };
}

function buildReviewAssessmentPrompt(profile) {
  const stage = stageByProfile[profile];
  if (!stage || stage === "implementation") return "";
  return [
    "Independent Workflow V2 review instructions:",
    `- Requested stage: ${stage}.`,
    `- ${reviewAssessmentFocus[profile]}`,
    "- Review only the governed context. Do not edit files, invoke tools, contact providers, or claim deployment or production authority.",
    "- Return exactly one JSON object, with no Markdown, prose, code fence, or second JSON value.",
    "- The object must contain exactly these assessment fields: decision, blockingFindings, nonBlockingRisks, missingNegativeTests, architectureAssessment, exactNextAction.",
    "- decision must be pass, revision-required, or blocked. A pass decision requires an empty blockingFindings array.",
    "- architectureAssessment must contain exactly deepModules, hexagonalArchitecture, and eventedBoundaries as non-empty strings.",
    "- The launcher binds immutable task, SHA, agent, model, effort, context, run, trace, timestamp, and output-hash fields, then requires schemas/review-result-v1.schema.json before persistence.",
  ].join("\n");
}

function parseReviewAssessment(stdoutText) {
  const trimmed = stdoutText.trim();
  if (!trimmed) throw new Error("review stdout is empty");
  assertNoDuplicateJsonKeys(trimmed);
  let assessment;
  try {
    assessment = JSON.parse(trimmed);
  } catch (error) {
    throw new Error(`review stdout must be exactly one JSON object (${error.message})`);
  }
  if (!assessment || typeof assessment !== "object" || Array.isArray(assessment)) {
    throw new Error("review stdout must be a JSON object");
  }
  const keys = Object.keys(assessment).sort();
  const expected = [...reviewAssessmentFields].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    throw new Error("review stdout must contain exactly the required assessment fields");
  }
  if (assessment.decision === "pass" && Array.isArray(assessment.blockingFindings) && assessment.blockingFindings.length > 0) {
    throw new Error("review stdout cannot combine decision pass with blocking findings");
  }
  return assessment;
}

function assertNoDuplicateJsonKeys(jsonText) {
  let index = 0;
  const skipWhitespace = () => { while (/\s/.test(jsonText[index] ?? "")) index += 1; };
  const parseString = () => {
    const start = index;
    index += 1;
    while (index < jsonText.length) {
      if (jsonText[index] === "\\") { index += 2; continue; }
      if (jsonText[index] === '"') { index += 1; return JSON.parse(jsonText.slice(start, index)); }
      index += 1;
    }
    throw new Error("review stdout contains an unterminated JSON string");
  };
  const parseValue = () => {
    skipWhitespace();
    if (jsonText[index] === "{") return parseObject();
    if (jsonText[index] === "[") {
      index += 1;
      skipWhitespace();
      if (jsonText[index] === "]") { index += 1; return; }
      while (index < jsonText.length) {
        parseValue();
        skipWhitespace();
        if (jsonText[index] === "]") { index += 1; return; }
        if (jsonText[index] !== ",") throw new Error("review stdout contains invalid JSON array syntax");
        index += 1;
      }
      throw new Error("review stdout contains an unterminated JSON array");
    }
    if (jsonText[index] === '"') { parseString(); return; }
    const match = jsonText.slice(index).match(/^(?:-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null)/);
    if (!match) throw new Error("review stdout contains invalid JSON value syntax");
    index += match[0].length;
  };
  const parseObject = () => {
    index += 1;
    const keys = new Set();
    skipWhitespace();
    if (jsonText[index] === "}") { index += 1; return; }
    while (index < jsonText.length) {
      if (jsonText[index] !== '"') throw new Error("review stdout contains invalid JSON object syntax");
      const key = parseString();
      if (keys.has(key)) throw new Error(`review stdout contains duplicate JSON member: ${key}`);
      keys.add(key);
      skipWhitespace();
      if (jsonText[index] !== ":") throw new Error("review stdout contains invalid JSON object syntax");
      index += 1;
      parseValue();
      skipWhitespace();
      if (jsonText[index] === "}") { index += 1; return; }
      if (jsonText[index] !== ",") throw new Error("review stdout contains invalid JSON object syntax");
      index += 1;
      skipWhitespace();
    }
    throw new Error("review stdout contains an unterminated JSON object");
  };
  parseValue();
  skipWhitespace();
  if (index !== jsonText.length) throw new Error("review stdout must be exactly one JSON object");
}

function createTrace(taskId, agentId, route, profile, dryRun = false) {
  const startedAt = new Date().toISOString();
  const compact = startedAt.replace(/[-:.TZ]/g, "");
  const runId = `${compact}-${randomUUID().slice(0, 8)}`;
  const traceDirectory = !dryRun && stageByProfile[profile] && stageByProfile[profile] !== "implementation"
    ? path.join(repositoryRoot, "evidence", "reviews", taskId, "traces")
    : path.join(repositoryRoot, "artifacts", "traces", "codex-routing", taskId);
  fs.mkdirSync(traceDirectory, { recursive: true });
  const tracePath = path.join(traceDirectory, `${runId}-${agentId}-${route}.jsonl`);
  const append = (event) => fs.appendFileSync(tracePath, `${JSON.stringify(event)}\n`, { encoding: "utf8", mode: 0o600 });
  return { startedAt, runId, tracePath, append };
}

function emitProgress(trace, details) {
  const event = {
    event: "review-progress",
    runId: trace.runId,
    taskId: details.taskId,
    profile: details.profile,
    status: details.status,
    ...(details.stream ? { stream: details.stream } : {}),
    ...(Number.isInteger(details.bytes) ? { bytes: details.bytes } : {}),
    ...(details.signal ? { signal: details.signal } : {}),
  };
  trace.append(event);
  process.stderr.write(`${JSON.stringify(event)}\n`);
}

function childIsRunning(child) {
  return Boolean(child?.pid) && child.exitCode == null && child.signalCode == null;
}

function processGroupIsRunning(pid, killFn = process.kill) {
  try { killFn(-pid, 0); return true; }
  catch (error) { return error?.code !== "ESRCH"; }
}

function waitForProcessGroupExit(pid, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5000;
  const pollMs = options.pollMs ?? 25;
  const schedule = options.setTimeoutFn ?? setTimeout;
  const isRunning = options.processGroupIsRunning ?? processGroupIsRunning;
  return new Promise((resolve) => {
    const started = Date.now();
    const poll = () => {
      if (!isRunning(pid)) { resolve({ status: "terminated" }); return; }
      if (Date.now() - started >= timeoutMs) { resolve({ status: "failed", reason: "process-group-still-running" }); return; }
      schedule(poll, pollMs);
    };
    poll();
  });
}

function terminateChildTree(child, options = {}) {
  const platform = options.platform ?? process.platform;
  if (platform === "win32") {
    if (!childIsRunning(child)) return Promise.resolve({ status: "already-exited" });
    const spawnFn = options.spawnFn ?? spawn;
    const timeoutMs = options.timeoutMs ?? 5000;
    const schedule = options.setTimeoutFn ?? setTimeout;
    const cancelSchedule = options.clearTimeoutFn ?? clearTimeout;
    return new Promise((resolve) => {
      let settled = false;
      let timer = null;
      let terminator;
      const settle = (result) => {
        if (settled) return;
        settled = true;
        if (timer) cancelSchedule(timer);
        resolve(result);
      };
      try {
        terminator = spawnFn("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore", windowsHide: true });
      } catch (error) {
        settle({ status: "failed", reason: "spawn-error", message: error.message });
        return;
      }
      terminator.once("error", (error) => settle({ status: "failed", reason: "spawn-error", message: error.message }));
      terminator.once("close", (exitCode) => settle(exitCode === 0 ? { status: "terminated" } : { status: "failed", reason: "nonzero-exit", exitCode }));
      timer = schedule(() => {
        try { terminator.kill(); } catch { /* timeout remains the authoritative failure */ }
        settle({ status: "failed", reason: "timeout" });
      }, timeoutMs);
      if (typeof timer?.unref === "function") timer.unref();
    });
  }
  const signal = options.signal ?? "SIGKILL";
  if (!childIsRunning(child)) return Promise.resolve({ status: "already-exited" });
  const isGroupRunning = options.processGroupIsRunning ?? processGroupIsRunning;
  if (!isGroupRunning(child.pid, options.killProcessGroup ?? process.kill)) return Promise.resolve({ status: "already-exited" });
  try {
    (options.killProcessGroup ?? process.kill)(-child.pid, signal);
  } catch (error) {
    return Promise.resolve({ status: "failed", reason: "signal-error", message: error.message });
  }
  if (signal !== "SIGKILL") return Promise.resolve({ status: "signalled" });
  return waitForProcessGroupExit(child.pid, { ...options, processGroupIsRunning: isGroupRunning });
}

function createReviewCancellationController(child, emit, options = {}) {
  const platform = options.platform ?? process.platform;
  const graceMs = options.graceMs ?? 5000;
  const settleMs = options.settleMs ?? 5000;
  const schedule = options.setTimeoutFn ?? setTimeout;
  const cancelSchedule = options.clearTimeoutFn ?? clearTimeout;
  const terminate = options.terminateChildTree ?? terminateChildTree;
  const confirmProcessGroupExit = options.waitForProcessGroupExit ?? ((pid) => waitForProcessGroupExit(pid, options));
  const onTerminationFailure = options.onTerminationFailure ?? (() => {});
  let requested = false;
  let timer = null;
  let settleTimer = null;
  let termination = null;
  let failureReported = false;
  let childClosed = false;
  let escalated = false;
  const reportFailure = (result, signal) => {
    if (failureReported) return result;
    failureReported = true;
    emit({ status: "cancellation-failed", signal });
    onTerminationFailure(result);
    return result;
  };
  const observeTermination = (resultPromise, signal, requireExit) => Promise.resolve(resultPromise).then((result) => {
    if (result?.status === "failed") return reportFailure(result, signal);
    if (requireExit && !childClosed) {
      settleTimer = schedule(() => reportFailure({ status: "failed", reason: "child-still-running" }, signal), settleMs);
      if (typeof settleTimer?.unref === "function") settleTimer.unref();
    }
    return result;
  });
  const escalate = (signal) => {
    if (escalated) return termination;
    if (!childIsRunning(child)) return termination ?? Promise.resolve({ status: "already-exited" });
    escalated = true;
    emit({ status: "cancellation-escalated", signal });
    termination = observeTermination(terminate(child, { platform, signal: "SIGKILL" }), signal, platform === "win32");
    return termination;
  };
  const request = (signal) => {
    if (requested || !childIsRunning(child)) return false;
    requested = true;
    emit({ status: "cancellation-requested", signal });
    if (platform === "win32") {
      // Node cannot deliver console SIGINT/SIGTERM to a Windows child tree.
      // Resolve and terminate the tree while the original PID is still live;
      // never retain that PID for delayed reuse-prone escalation.
      termination = escalate(signal);
      return true;
    }
    termination = observeTermination(terminate(child, { platform, signal: signal === "SIGTERM" ? "SIGTERM" : "SIGINT" }), signal, false);
    timer = schedule(() => {
      escalate(signal);
    }, graceMs);
    if (typeof timer?.unref === "function") timer.unref();
    return true;
  };
  return {
    request,
    get requested() { return requested; },
    get termination() { return termination; },
    get childClosed() { return childClosed; },
    confirmChildClosed() {
      childClosed = true;
      if (timer) cancelSchedule(timer);
      if (settleTimer) cancelSchedule(settleTimer);
      timer = null;
      settleTimer = null;
    },
    ensureTerminated(signal = "SIGTERM") {
      return platform === "win32" || childClosed || !childIsRunning(child) ? (termination ?? Promise.resolve({ status: "already-exited" })) : escalate(signal);
    },
    confirmProcessGroupTerminated(signal = "SIGTERM") {
      if (platform === "win32") return termination ?? Promise.resolve({ status: "already-exited" });
      return observeTermination(confirmProcessGroupExit(child.pid), signal, false);
    },
    complete() {
      if (timer) cancelSchedule(timer);
      if (settleTimer) cancelSchedule(settleTimer);
      timer = null;
      settleTimer = null;
    },
  };
}

async function completeCancelledReview(cancellation, terminal) {
  cancellation.confirmChildClosed();
  const result = await cancellation.ensureTerminated();
  const groupResult = result?.status === "failed" ? result : await cancellation.confirmProcessGroupTerminated();
  cancellation.complete();
  if (groupResult?.status === "failed" || !cancellation.childClosed) {
    terminal.complete("failed", 1);
    return "failed";
  }
  terminal.complete("cancelled", 130);
  return "cancelled";
}

function createReviewTerminalController(trace, emit, setExitCode = (code) => { process.exitCode = code; }) {
  let terminal = null;
  return {
    complete(status, exitCode, emitTerminalProgress = true) {
      if (terminal) return false;
      terminal = status;
      if (emitTerminalProgress) emit({ status });
      trace.append({ event: "finish", status: status === "completed" ? "success" : status, exitCode });
      if (exitCode) setExitCode(exitCode);
      return true;
    },
    get status() { return terminal; },
  };
}

function appendBoundedReviewOutput(state, chunk, limit = reviewOutputLimitBytes) {
  const bytes = Buffer.byteLength(chunk);
  state.bytes += bytes;
  if (state.bytes > limit) return false;
  if (state.capture !== false) state.text += chunk.toString();
  return true;
}

function collectBoundedReviewOutput(stream, state, chunk, progress, options = {}) {
  const limit = options.limit ?? reviewOutputLimitBytes;
  const interval = options.interval ?? reviewProgressIntervalBytes;
  if (!Number.isInteger(interval) || interval < 1) throw new Error("Review progress interval must be a positive integer");
  if (!appendBoundedReviewOutput(state, chunk, limit)) return false;
  const emitted = state.progressEvents ?? 0;
  const lastBytes = state.lastProgressBytes ?? 0;
  if (emitted === 0 || state.bytes - lastBytes >= interval) {
    progress({ status: "child-output", stream, bytes: state.bytes });
    state.progressEvents = emitted + 1;
    state.lastProgressBytes = state.bytes;
  }
  return true;
}

function attachChildProcessStreams(child, { prompt, onStdout, onStderr, onFailure }) {
  let failure = null;
  const failOnce = (stream, error) => {
    if (failure) return false;
    failure = { stream, error };
    onFailure(stream, error);
    return true;
  };
  child.stdout.on("data", onStdout);
  child.stderr.on("data", onStderr);
  child.stdin.on("error", (error) => failOnce("stdin", error));
  child.stdout.on("error", (error) => failOnce("stdout", error));
  child.stderr.on("error", (error) => failOnce("stderr", error));
  try {
    child.stdin.write(prompt);
    child.stdin.end();
  } catch (error) {
    failOnce("stdin", error);
  }
  return { get failure() { return failure; } };
}

function completeReviewPreflightFailure(error, { progress, terminal, writeError = (message) => process.stderr.write(message) }) {
  progress({ status: "preflight-failed" });
  writeError(`Review preflight failed: ${error.message}\n`);
  terminal.complete("failed", 1);
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

function buildLauncherBoundReviewResult(assessment, binding) {
  if (!assessment || typeof assessment !== "object" || Array.isArray(assessment)) {
    throw new Error("Review execution failed: assessment must be a JSON object");
  }
  const result = {
    schemaVersion: "1.0.0",
    taskId: binding.taskId,
    baseSha: binding.baseSha,
    headSha: binding.headSha,
    reviewerAgent: binding.reviewerAgent,
    model: binding.model,
    reasoningEffort: binding.reasoningEffort,
    contextManifestHash: binding.contextManifestHash,
    reviewedAt: binding.reviewedAt,
    stage: binding.stage,
    runId: binding.runId,
    tracePath: binding.tracePath,
    outputHash: "",
    decision: assessment.decision,
    blockingFindings: assessment.blockingFindings,
    nonBlockingRisks: assessment.nonBlockingRisks,
    missingNegativeTests: assessment.missingNegativeTests,
    architectureAssessment: assessment.architectureAssessment,
    exactNextAction: assessment.exactNextAction,
  };
  result.outputHash = computeReviewOutputHash(result);
  return result;
}

function prepareCodexAppReviewResult(assessment, { taskId, profile, runId, reviewedAt = new Date().toISOString() }) {
  assertTaskId(taskId);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(runId ?? "")) throw new Error("Codex app run ID is invalid");
  const taskRecord = findTaskPacket(taskId);
  const stageName = stageByProfile[profile];
  if (!stageName || stageName === "implementation") throw new Error(`Unsupported Codex app review profile: ${profile}`);
  assertExecutableTaskState(taskId, taskRecord.state);
  if (taskRecord.format !== "json") throw new Error("Codex app structured reviews require a JSON Task Packet V2");
  const packetCheck = validatePacket(taskRecord.data, { strict: true, directoryState: taskRecord.state });
  if (!packetCheck.valid) throw new Error(`Task packet validation failed: ${packetCheck.errors.join("; ")}`);
  const access = packetAccess(taskRecord);
  const stage = taskRecord.data?.routingPolicy?.[stageName];
  if (!stage?.agent) throw new Error(`Task Packet V2 is missing routingPolicy.${stageName}.agent`);
  const agent = discoverAgents().get(stage.agent);
  assertActiveAgent(agent);
  if (!access.allowedAgents.includes(stage.agent)) throw new Error(`Agent ${stage.agent} is not whitelisted by task packet ${taskId}`);
  assertProfileAuthorization(profile, taskRecord, access, stage.agent);
  const routeInfo = selectRoute("auto", undefined, access, agent.defaultRoute, profile);
  assertAgentRouteEffort(agent, routeInfo.route, routeInfo.effort, true);
  const model = modelIds[routeInfo.route];
  if (!model) throw new Error(`Codex app reviews require a hosted route for ${stageName}`);
  const headSha = gitSha("HEAD");
  if (!headSha) throw new Error("Cannot determine committed review head SHA");
  const reviewStatus = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: repositoryRoot, encoding: "utf8", windowsHide: true }).stdout;
  if (!reviewWorktreeIsClean(reviewStatus, taskId, headSha)) throw new Error("Codex app reviews require a clean committed working tree");
  const baseSha = comparisonBaseSha();
  const context = buildContextProfile(agent, taskRecord, routeInfo.route, model, routeInfo.effort, profile);
  const reviewResult = buildLauncherBoundReviewResult(assessment, {
    taskId, baseSha, headSha, reviewerAgent: stage.agent, model, reasoningEffort: routeInfo.effort,
    contextManifestHash: context.manifestHash, reviewedAt, stage: stageName, runId,
    tracePath: `evidence/reviews/${taskId}/runs/${runId}.json`,
  });
  return { reviewResult, contextManifest: context.contextManifest, reviewedTaskScopeHash: computeReviewScopeHash(taskRecord.data) };
}

function reviewArtifactPath(taskId, profile, headSha, root = repositoryRoot) {
  const stage = stageByProfile[profile];
  if (!stage || stage === "implementation") throw new Error(`No review artifact path for profile: ${profile}`);
  return path.join(root, "evidence", "reviews", taskId, `${stage}-${headSha}.json`);
}

function reviewWorktreeIsClean(statusText, taskId, headSha) {
  const allowed = new Set([
    ...["planReview", "semanticReview", "mergeRiskReview"].map((stage) => `?? evidence/reviews/${taskId}/${stage}-${headSha}.json`),
    `?? evidence/verification/${taskId}/verification-${headSha}.json`,
  ]);
  return statusText.trim().split(/\r?\n/).filter(Boolean).every((line) => {
    if (allowed.has(line)) return true;
    const file = line.slice(3).replaceAll("\\", "/");
    return line.startsWith("?? ") && (
      (file.startsWith(`evidence/reviews/${taskId}/runs/`) && file.endsWith(".json"))
      || (file.startsWith(`evidence/reviews/${taskId}/traces/`) && file.endsWith(".jsonl"))
    );
  });
}

function exactHeadVerificationPath(taskId, headSha, root = repositoryRoot) {
  return path.join(root, "evidence", "verification", taskId, `verification-${headSha}.json`);
}

function validateExactHeadVerification(record, taskId, headSha) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return false;
  return record.schemaVersion === "1.0.0"
    && record.taskId === taskId
    && record.headSha === headSha
    && record.status === "pass"
    && record.productionEligible === false
    && typeof record.reviewer === "string"
    && record.reviewer.length > 0
    && Array.isArray(record.checks)
    && record.checks.length > 0;
}

function requireExactHeadVerification(taskId, headSha, root = repositoryRoot) {
  const target = exactHeadVerificationPath(taskId, headSha, root);
  let record;
  try { record = JSON.parse(fs.readFileSync(target, "utf8")); }
  catch { throw new Error(`Exact-head verification evidence is missing for ${taskId} at ${headSha}`); }
  if (!validateExactHeadVerification(record, taskId, headSha)) throw new Error(`Exact-head verification evidence is invalid for ${taskId} at ${headSha}`);
  return target;
}

function requireContextManifestFile(contextManifest, relativePath, root) {
  const normalized = relativePath.replaceAll(path.sep, "/");
  const target = path.resolve(root, normalized);
  const entry = contextManifest.find((item) => item?.path === normalized);
  if (!entry || entry.sha256 !== sha256(fs.readFileSync(target))) {
    throw new Error(`Review context does not bind required evidence: ${normalized}`);
  }
}

function validateCurrentContextManifest(contextManifest, { root = repositoryRoot, profile }) {
  const rootRealPath = fs.realpathSync(root);
  const seen = new Set();
  for (const entry of contextManifest) {
    if (!entry || typeof entry.path !== "string" || typeof entry.sha256 !== "string" || seen.has(entry.path)) throw new Error("Review context manifest contains an invalid or duplicate entry");
    seen.add(entry.path);
    if (entry.path === "generated/merge-risk-context") {
      if (profile !== "merge-risk-review" || !/^[0-9a-f]{64}$/i.test(entry.sha256)) throw new Error("Generated merge-risk context binding is invalid");
      continue;
    }
    if (path.isAbsolute(entry.path) || entry.path.includes("..")) throw new Error(`Review context path escapes repository: ${entry.path}`);
    const target = path.resolve(root, entry.path);
    const relative = path.relative(root, target);
    if (relative.startsWith("..") || path.isAbsolute(relative) || !fs.existsSync(target)) throw new Error(`Review context path is missing or escapes repository: ${entry.path}`);
    const realTarget = fs.realpathSync(target);
    const realRelative = path.relative(rootRealPath, realTarget);
    if (realRelative.startsWith("..") || path.isAbsolute(realRelative)) throw new Error(`Review context symlink escapes repository: ${entry.path}`);
    if (sha256(fs.readFileSync(realTarget)) !== entry.sha256) throw new Error(`Review context file changed before persistence: ${entry.path}`);
  }
}

function assertReviewRevisionUnchanged(reviewResult, currentHeadSha, currentBaseSha) {
  if (reviewResult.headSha !== currentHeadSha || reviewResult.baseSha !== currentBaseSha) throw new Error("Codex app review revision changed before persistence");
}

function revalidateCurrentReviewBinding(reviewResult, { getHead = () => gitSha("HEAD"), getBase = comparisonBaseSha, onFailure = () => {} } = {}) {
  try {
    assertReviewRevisionUnchanged(reviewResult, getHead(), getBase());
    return true;
  } catch (error) {
    onFailure(error);
    return false;
  }
}

function requireReviewEvidenceSequence({ taskRecord, profile, baseSha, headSha, contextManifest, root = repositoryRoot }) {
  const packet = taskRecord.data ?? taskRecord;
  const taskId = packet.taskId;
  const exactVerification = requireExactHeadVerification(taskId, headSha, root);
  requireContextManifestFile(contextManifest, path.relative(root, exactVerification), root);
  if (profile !== "merge-risk-review") return;

  const prerequisiteStages = ["planReview", "semanticReview"];
  const errors = validateRequiredReviewArtifacts(packet, root, headSha, baseSha, prerequisiteStages);
  if (errors.length > 0) throw new Error(`Merge-risk review prerequisite evidence is invalid: ${errors.join("; ")}`);
  for (const stage of prerequisiteStages) {
    const artifactPath = path.join(root, "evidence", "reviews", taskId, `${stage}-${headSha}.json`);
    const review = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    requireContextManifestFile(contextManifest, path.relative(root, artifactPath), root);
    requireContextManifestFile(contextManifest, review.tracePath, root);
  }
}

function assertCompleteLauncherTracePrefix(events, { taskId, agentId, route, model, profile, runId }) {
  const starts = events.filter((event) => event?.event === "start");
  if (starts.length !== 1 || events[0] !== starts[0]) throw new Error("Launcher trace must begin with exactly one start event");
  const start = starts[0];
  for (const [key, expected] of Object.entries({ taskId, agentId, route, model, profile })) {
    if (start[key] !== expected) throw new Error(`Launcher trace start does not bind ${key}`);
  }
  const childStarts = events.filter((event) => event?.event === "review-progress" && event.status === "child-started");
  if (childStarts.length !== 1 || events[1] !== childStarts[0]) throw new Error("Launcher trace must record exactly one child-started event immediately after start");
  for (const [key, expected] of Object.entries({ runId, taskId, profile })) {
    if (childStarts[0][key] !== expected) throw new Error(`Launcher trace child-started does not bind ${key}`);
  }
}

function persistReviewResult(reviewResult, { taskId, profile, headSha, root = repositoryRoot, beforeFinalValidation = () => {} }) {
  const expectedStage = stageByProfile[profile];
  if (reviewResult.stage !== expectedStage) throw new Error(`Review result stage '${reviewResult.stage}' does not match requested ${expectedStage}`);
  const validateAuthority = () => {
    const taskRecord = findTaskPacket(taskId, root);
    if (taskRecord.format !== "json" || taskRecord.data.schemaVersion !== "2.0.0") throw new Error("Direct review-result persistence requires a current V2 task packet");
    const packetCheck = validatePacket(taskRecord.data, { strict: true, directoryState: taskRecord.state, root });
    if (!packetCheck.valid || taskRecord.state !== "review") throw new Error(`Direct review-result persistence requires a valid V2 task packet in review: ${packetCheck.errors.join("; ")}`);
    const stageAuthority = taskRecord.data.routingPolicy?.[expectedStage];
    const validation = validateReviewResult(reviewResult, { taskId, baseSha: comparisonBaseSha(root), headSha: gitSha("HEAD", root), reviewerAgent: stageAuthority?.agent, model: modelIds[stageAuthority?.route], reasoningEffort: stageAuthority?.effort });
    if (!validation.valid) throw new Error(`Refusing to persist invalid review result: ${validation.errors.join("; ")}`);
    if (reviewResult.tracePath.includes("/runs/")) throw new Error("Direct review-result persistence requires the Codex-app atomic envelope adapter");
    if (reviewResult.tracePath !== `evidence/reviews/${taskId}/traces/${reviewResult.runId}-${stageAuthority.agent}-${stageAuthority.route}.jsonl`) throw new Error("Direct review-result persistence requires the canonical task-scoped trace path");
    return taskRecord;
  };
  const readAndValidateTrace = (taskRecord) => {
    let events;
    try { events = fs.readFileSync(path.join(root, reviewResult.tracePath), "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line)); }
    catch { throw new Error("Direct review-result persistence requires a valid bound launcher trace"); }
    const traceErrors = validateLauncherTraceEvents(events, { packet: taskRecord.data, result: reviewResult, stage: expectedStage, root });
    if (traceErrors.length) throw new Error(`Direct review-result persistence requires a strict bound launcher trace: ${traceErrors.join("; ")}`);
    return events;
  };
  readAndValidateTrace(validateAuthority());
  beforeFinalValidation();
  const finalTaskRecord = validateAuthority();
  const finalEvents = readAndValidateTrace(finalTaskRecord);
  const bound = finalEvents.find((event) => event.event === "review-bound");
  requireReviewEvidenceSequence({ taskRecord: finalTaskRecord, profile, baseSha: reviewResult.baseSha, headSha: reviewResult.headSha, contextManifest: bound.contextManifest, root });
  return prepareReviewResultPersistence(reviewResult, { taskId, profile, headSha, root }).finalize();
}

function prepareAtomicPublication(serialized, destination, pending, conflictMessage) {
  if (fs.existsSync(destination)) {
    if (fs.readFileSync(destination, "utf8") !== serialized) throw new Error(conflictMessage);
    return { abort() {}, finalize() { return destination; } };
  }
  fs.mkdirSync(path.dirname(pending), { recursive: true });
  if (fs.existsSync(pending)) {
    if (fs.readFileSync(pending, "utf8") !== serialized) throw new Error(`Staged publication conflicts with run identity: ${pending}`);
  } else {
    fs.writeFileSync(pending, serialized, { encoding: "utf8", mode: 0o600, flag: "wx" });
  }
  return {
    abort() { fs.rmSync(pending, { force: true }); },
    finalize() {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      if (fs.existsSync(destination)) {
        if (fs.readFileSync(destination, "utf8") !== serialized) throw new Error(conflictMessage);
        fs.rmSync(pending, { force: true });
      } else {
        fs.renameSync(pending, destination);
      }
      return destination;
    },
  };
}

function finalizePreparedReviewPublication(preparedPersistence, { terminal, trace, progress = () => {}, writeError = () => {}, setExitCode = (code) => { process.exitCode = code; } }) {
  terminal.complete("completed", 0);
  try {
    return preparedPersistence.finalize();
  } catch (error) {
    preparedPersistence.abort();
    progress({ status: "review-persistence-failed" });
    trace.append({ event: "finish", status: "failed", exitCode: 1 });
    writeError(`Review persistence failed: ${error.message}\n`);
    setExitCode(1);
    return null;
  }
}

function prepareReviewResultPersistence(reviewResult, { taskId, profile, headSha, root = repositoryRoot }) {
  const expectedStage = stageByProfile[profile];
  if (reviewResult.stage !== expectedStage) throw new Error(`Review result stage '${reviewResult.stage}' does not match requested ${expectedStage}`);
  const expected = { taskId, headSha };
  const validation = validateReviewResult(reviewResult, expected);
  if (!validation.valid) throw new Error(`Refusing to prepare invalid review result: ${validation.errors.join("; ")}`);
  const destination = reviewArtifactPath(taskId, profile, headSha, root);
  const pendingDirectory = path.join(root, "artifacts", "traces", "pending-review-results", taskId);
  const serialized = `${JSON.stringify(reviewResult, null, 2)}\n`;
  const publication = prepareAtomicPublication(serialized, destination, path.join(pendingDirectory, `${reviewResult.runId}-result.json.tmp`), `Review artifact already exists for ${taskId} ${expectedStage} at ${headSha}`);
  const stagedPath = fs.existsSync(destination) ? destination : path.join(pendingDirectory, `${reviewResult.runId}-result.json.tmp`);
  const prepared = JSON.parse(fs.readFileSync(stagedPath, "utf8"));
  const preparedValidation = validateReviewResult(prepared, expected);
  if (!preparedValidation.valid) {
    publication.abort();
    throw new Error(`Prepared review result failed validation: ${preparedValidation.errors.join("; ")}`);
  }
  return {
    abort() { publication.abort(); },
    finalize() {
      publication.finalize();
      return path.relative(root, destination).replaceAll(path.sep, "/");
    },
  };
}

function validateCodexAppFinalBinding(prepared, { taskId, profile, headSha, taskRecord, currentHeadSha, currentBaseSha, expectedContextManifest }) {
  const { reviewResult, contextManifest, reviewedTaskScopeHash } = prepared;
  const expectedStage = stageByProfile[profile];
  const currentStage = taskRecord.data?.routingPolicy?.[expectedStage];
  const currentModel = modelIds[currentStage?.route];
  const suppliedManifestHash = sha256(contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));
  const authorityValidation = validateReviewResult(reviewResult, {
    taskId,
    baseSha: currentBaseSha,
    headSha: currentHeadSha,
    reviewerAgent: currentStage?.agent,
    model: currentModel,
    reasoningEffort: currentStage?.effort,
    contextManifestHash: suppliedManifestHash,
  });
  const suppliedByPath = new Map(contextManifest.map((entry) => [entry.path, entry.sha256]));
  const expectedByPath = new Map(expectedContextManifest.map((entry) => [entry.path, entry.sha256]));
  const manifestDifference = {
    missing: [...expectedByPath.keys()].filter((item) => !suppliedByPath.has(item)),
    unexpected: [...suppliedByPath.keys()].filter((item) => !expectedByPath.has(item)),
    changed: [...expectedByPath].filter(([item, hash]) => suppliedByPath.has(item) && suppliedByPath.get(item) !== hash).map(([item]) => item),
  };
  const manifestMatches = contextManifest.length === expectedContextManifest.length
    && manifestDifference.missing.length === 0
    && manifestDifference.unexpected.length === 0
    && manifestDifference.changed.length === 0;
  const errors = [
    ...authorityValidation.errors,
    ...(headSha !== currentHeadSha ? ["caller headSha does not match current HEAD"] : []),
    ...(!currentStage?.agent ? ["reviewerAgent is missing from current routing policy"] : []),
    ...(!currentModel ? ["model route is invalid in current routing policy"] : []),
    ...(reviewResult.stage !== expectedStage ? ["stage does not match profile"] : []),
    ...(!manifestMatches ? [`context manifest does not match the complete current review profile: ${JSON.stringify(manifestDifference)}`] : []),
    ...(reviewedTaskScopeHash !== computeReviewScopeHash(taskRecord.data) ? ["reviewed task scope does not match the current packet"] : []),
  ];
  if (errors.length > 0) throw new Error(`Codex app review authority changed before persistence: ${errors.join("; ")}`);
}

function persistCodexAppReviewResult(prepared, { taskId, profile, headSha, root = repositoryRoot }) {
  const { reviewResult, contextManifest, reviewedTaskScopeHash } = prepared;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(reviewResult?.runId ?? "")) throw new Error("Codex app run ID is invalid");
  const expectedStage = stageByProfile[profile];
  const resultValidation = validateReviewResult(reviewResult, { taskId, headSha });
  if (!resultValidation.valid || reviewResult.stage !== expectedStage) throw new Error(`Refusing to persist invalid Codex app review: ${[...resultValidation.errors, ...(reviewResult.stage !== expectedStage ? ["stage does not match profile"] : [])].join("; ")}`);
  const tracePath = `evidence/reviews/${taskId}/runs/${reviewResult.runId}.json`;
  if (reviewResult.tracePath !== tracePath) throw new Error("Codex app review tracePath must match its runId");
  if (!Array.isArray(contextManifest) || contextManifest.length === 0) throw new Error("Codex app review context manifest is missing");
  const manifestHash = sha256(contextManifest.map((entry) => `${entry.path}:${entry.sha256}`).join("\n"));
  if (reviewResult.contextManifestHash !== manifestHash) throw new Error("Codex app review context manifest does not match its governed files");
  const taskEntry = contextManifest.find((entry) => entry.path === `tasks/review/${taskId}/task.json`);
  if (!taskEntry || !/^[0-9a-f]{64}$/i.test(reviewedTaskScopeHash ?? "")) throw new Error("Codex app review does not bind the exact reviewed task scope");
  const taskRecord = findTaskPacket(taskId, root);
  if (reviewedTaskScopeHash !== computeReviewScopeHash(taskRecord.data)) throw new Error("Codex app reviewed task scope does not match the current packet");
  requireReviewEvidenceSequence({ taskRecord, profile, baseSha: reviewResult.baseSha, headSha, contextManifest, root });
  const trace = { source: "codex-app", status: "success", runId: reviewResult.runId, taskId: reviewResult.taskId, baseSha: reviewResult.baseSha, headSha: reviewResult.headSha, stage: reviewResult.stage, reviewerAgent: reviewResult.reviewerAgent, model: reviewResult.model, reasoningEffort: reviewResult.reasoningEffort, contextManifestHash: reviewResult.contextManifestHash, outputHash: reviewResult.outputHash, contextManifest, reviewedTaskScopeHash };
  const target = path.join(root, tracePath);
  const traceSerialized = `${JSON.stringify(trace, null, 2)}\n`;
  const resultTarget = reviewArtifactPath(taskId, profile, headSha, root);
  const resultSerialized = `${JSON.stringify(reviewResult, null, 2)}\n`;
  if (fs.existsSync(target) && fs.readFileSync(target, "utf8") !== traceSerialized) throw new Error(`Codex app run envelope already exists for ${reviewResult.runId}`);
  if (fs.existsSync(resultTarget) && fs.readFileSync(resultTarget, "utf8") !== resultSerialized) throw new Error(`Review artifact already exists for ${taskId} ${expectedStage} at ${headSha}`);
  if (path.resolve(root) === path.resolve(repositoryRoot)) assertReviewRevisionUnchanged(reviewResult, gitSha("HEAD"), comparisonBaseSha());
  validateCurrentContextManifest(contextManifest, { root, profile });
  const currentTaskRecord = findTaskPacket(taskId, root);
  const currentStage = currentTaskRecord.data?.routingPolicy?.[expectedStage];
  const currentModel = modelIds[currentStage?.route];
  const currentBaseSha = comparisonBaseSha();
  const currentHeadSha = gitSha("HEAD");
  const currentAgent = discoverAgents().get(currentStage?.agent);
  assertActiveAgent(currentAgent);
  const expectedContext = buildContextProfile(currentAgent, currentTaskRecord, currentStage.route, currentModel, currentStage.effort, profile, { root, headSha: currentHeadSha, baseSha: currentBaseSha });
  validateCodexAppFinalBinding(prepared, { taskId, profile, headSha, taskRecord: currentTaskRecord, currentHeadSha, currentBaseSha, expectedContextManifest: expectedContext.contextManifest });
  validateCurrentContextManifest(expectedContext.contextManifest, { root, profile });
  if (path.resolve(root) === path.resolve(repositoryRoot)) {
    const finalStatus = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: root, encoding: "utf8", windowsHide: true }).stdout;
    if (!reviewWorktreeIsClean(finalStatus, taskId, currentHeadSha)) throw new Error("Codex app final publication requires a clean review worktree");
  }
  requireReviewEvidenceSequence({ taskRecord: currentTaskRecord, profile, baseSha: currentBaseSha, headSha, contextManifest, root });
  const pendingDirectory = path.join(root, "artifacts", "traces", "pending-review-results", taskId);
  const resultPublication = prepareReviewResultPersistence(reviewResult, { taskId, profile, headSha, root });
  let tracePublication;
  try {
    tracePublication = prepareAtomicPublication(traceSerialized, target, path.join(pendingDirectory, `${reviewResult.runId}-run.json.tmp`), `Codex app run envelope already exists for ${reviewResult.runId}`);
  } catch (error) {
    resultPublication.abort();
    throw error;
  }
  try {
    const reviewPath = resultPublication.finalize();
    tracePublication.finalize();
    return reviewPath;
  } catch (error) {
    resultPublication.abort();
    tracePublication.abort();
    throw new Error(`Codex app atomic publication failed; exact partial publication is recoverable by rerunning the same run: ${error.message}`);
  }
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
          implementation: { agent: "codex-engineering-executor", route: "terra", effort: "high" },
          planReview: { agent: "engineering-planner", route: "sol", effort: "high" },
          semanticReview: { agent: "qa-verification", route: "luna", effort: "high" },
          mergeRiskReview: { agent: "qa-verification", required: true, route: "sol", effort: "high" },
        },
        routingComplexity: "routine",
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

  const reviewedHeadSha = reviewProfile ? gitSha("HEAD") : null;
  if (reviewProfile && !reviewedHeadSha) throw new Error("Cannot determine committed review head SHA");
  const reviewStatus = reviewProfile ? spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: repositoryRoot, encoding: "utf8", windowsHide: true }).stdout : "";
  if (reviewProfile && !reviewWorktreeIsClean(reviewStatus, taskId, reviewedHeadSha)) {
    throw new Error("Review launches require a clean committed working tree");
  }
  const dryRun = Boolean(argumentsObject["dry-run"]);

  const trace = createTrace(taskId, agentId, selectedRoute, profile, dryRun);
  trace.append({ event: "start", taskId, agentId, route: selectedRoute, model: selectedModel, profile });
  const progress = (details) => emitProgress(trace, { taskId, profile, ...details });
  const terminal = reviewProfile ? createReviewTerminalController(trace, progress) : null;
  let reviewedBaseSha = null;
  let context;
  try {
    reviewedBaseSha = reviewProfile ? comparisonBaseSha() : null;
    context = buildContextProfile(agent, taskRecord, selectedRoute, selectedModel, effort, profile);
    if (reviewProfile && !dryRun) {
      requireReviewEvidenceSequence({ taskRecord, profile, baseSha: reviewedBaseSha, headSha: reviewedHeadSha, contextManifest: context.contextManifest });
    }
  } catch (error) {
    if (!reviewProfile) throw error;
    completeReviewPreflightFailure(error, { progress, terminal });
    return;
  }
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
    detached: reviewProfile && process.platform !== "win32",
  });

  let stdoutText = "";
  let stderrText = "";
  const reviewStdout = { bytes: 0, text: "", capture: true };
  const reviewStderr = { bytes: 0, text: "", capture: false };
  let outputOverflow = false;
  const cancellation = reviewProfile ? createReviewCancellationController(child, progress, {
    onTerminationFailure: (result) => {
      process.stderr.write(`Review cancellation failed closed: ${result.reason ?? "unknown"}\n`);
      terminal.complete("failed", 1);
      for (const stream of [child.stdin, child.stdout, child.stderr]) {
        try { stream.destroy(); } catch { /* fail-closed cleanup is best effort */ }
      }
      try { child.kill("SIGKILL"); } catch { /* the direct child may already be unavailable */ }
      child.unref();
    },
  }) : null;
  const onSigint = () => cancellation?.request("SIGINT");
  const onSigterm = () => cancellation?.request("SIGTERM");
  if (reviewProfile) {
    process.once("SIGINT", onSigint);
    process.once("SIGTERM", onSigterm);
    progress({ status: "child-started" });
  }

  const collectReviewOutput = (stream, state, chunk) => {
    if (!collectBoundedReviewOutput(stream, state, chunk, progress) && !outputOverflow) {
      outputOverflow = true;
      progress({ status: "output-limit-exceeded", stream, bytes: state.bytes });
      cancellation.request("SIGTERM");
    }
  };
  let processFailure = null;
  const failChildProcess = (kind, error, stream = null) => {
    if (processFailure) return false;
    processFailure = { kind, stream, error };
    if (reviewProfile) {
      progress({ status: kind === "stream" ? "child-stream-error" : "spawn-error", ...(stream ? { stream } : {}) });
      terminal.complete("failed", 1);
      try { cancellation?.request("SIGTERM"); } catch { /* terminal state already failed closed */ }
    } else {
      trace.append({ event: "finish", status: kind === "stream" ? "stream-error" : "spawn-error" });
      process.exitCode = 1;
    }
    process.stderr.write(`${kind === "stream" ? `Child ${stream} stream failed` : "Process spawn failed"}: ${error.message}\n`);
    return true;
  };

  child.on("error", (err) => {
    failChildProcess("spawn", err);
  });

  const childStreams = attachChildProcessStreams(child, {
    prompt: context.prompt,
    onStdout: (chunk) => {
      if (reviewProfile) collectReviewOutput("stdout", reviewStdout, chunk);
      else stdoutText += chunk.toString();
    },
    onStderr: (chunk) => {
      if (reviewProfile) collectReviewOutput("stderr", reviewStderr, chunk);
      else stderrText += chunk.toString();
    },
    onFailure: (stream, error) => failChildProcess("stream", error, stream),
  });

  child.on("close", async (exitCode) => {
    if (reviewProfile) {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
    }
    if (processFailure || childStreams.failure) {
      cancellation?.confirmChildClosed();
      cancellation?.complete();
      if (reviewProfile) terminal.complete("failed", 1);
      return;
    }
    const passed = exitCode === 0;
    if (stderrText && !reviewProfile) process.stderr.write(stderrText);
    if (reviewProfile && reviewStderr.bytes > 0) progress({ status: "child-stderr-redacted", bytes: reviewStderr.bytes });

    if (reviewProfile && outputOverflow) {
      cancellation.confirmChildClosed();
      await cancellation.ensureTerminated();
      cancellation.complete();
      terminal.complete("failed", 1);
      return;
    }

    if (reviewProfile && cancellation?.requested) {
      await completeCancelledReview(cancellation, terminal);
      return;
    }
    cancellation?.complete();

    // Validate review profile output strictly
    if (passed && reviewProfile) {
      if (!revalidateCurrentReviewBinding({ headSha: reviewedHeadSha, baseSha: reviewedBaseSha }, {
        onFailure: (error) => {
          progress({ status: "review-binding-changed" });
          process.stderr.write(`Review execution failed: committed head or canonical base changed during review: ${error.message}\n`);
          terminal.complete("failed", 1);
        },
      })) return;
      let parsed;
      try {
        parsed = parseReviewAssessment(reviewStdout.text);
      } catch (e) {
        progress({ status: "review-output-invalid" });
        process.stderr.write(`Review execution failed: ${e.message}\n`);
        terminal.complete("failed", 1);
        return;
      }

      const launcherReview = buildLauncherBoundReviewResult(parsed, {
        taskId,
        baseSha: reviewedBaseSha,
        headSha: reviewedHeadSha,
        reviewerAgent: agentId,
        model: selectedModel,
        reasoningEffort: effort,
        contextManifestHash: context.manifestHash,
        reviewedAt: new Date().toISOString(),
        stage: stageByProfile[profile],
        runId: trace.runId,
        tracePath: path.relative(repositoryRoot, trace.tracePath).replaceAll(path.sep, "/"),
      });
      const reviewCheck = validateReviewResult(launcherReview, {
        taskId, baseSha: reviewedBaseSha, headSha: reviewedHeadSha, reviewerAgent: agentId,
        model: selectedModel, reasoningEffort: effort, contextManifestHash: context.manifestHash,
      });
      if (!reviewCheck.valid) {
        progress({ status: "review-schema-validation-failed" });
        process.stderr.write(`Review schema validation failed:\n- ${reviewCheck.errors.join("\n- ")}\n`);
        terminal.complete("failed", 1);
        return;
      }

      try {
        const finalTaskRecord = findTaskPacket(taskId);
        const finalStage = finalTaskRecord.data.routingPolicy[stageByProfile[profile]];
        const finalAgent = discoverAgents().get(finalStage.agent);
        const finalHead = gitSha("HEAD");
        const finalBase = comparisonBaseSha();
        const finalContext = buildContextProfile(finalAgent, finalTaskRecord, finalStage.route, modelIds[finalStage.route], finalStage.effort, profile, { headSha: finalHead, baseSha: finalBase });
        validateCodexAppFinalBinding({ reviewResult: launcherReview, contextManifest: context.contextManifest, reviewedTaskScopeHash: computeReviewScopeHash(taskRecord.data) }, { taskId, profile, headSha: reviewedHeadSha, taskRecord: finalTaskRecord, currentHeadSha: finalHead, currentBaseSha: finalBase, expectedContextManifest: finalContext.contextManifest });
        validateCurrentContextManifest(finalContext.contextManifest, { profile });
        const finalStatus = spawnSync("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd: repositoryRoot, encoding: "utf8", windowsHide: true }).stdout;
        if (!reviewWorktreeIsClean(finalStatus, taskId, finalHead)) throw new Error("CLI final publication requires a clean review worktree");
        requireReviewEvidenceSequence({ taskRecord: finalTaskRecord, profile, baseSha: finalBase, headSha: finalHead, contextManifest: finalContext.contextManifest });
      } catch (error) {
        progress({ status: "review-binding-changed" });
        process.stderr.write(`Review persistence binding changed during execution: ${error.message}\n`);
        terminal.complete("failed", 1);
        return;
      }

      trace.append({
        event: "review-bound",
        runId: launcherReview.runId,
        taskId: launcherReview.taskId,
        baseSha: launcherReview.baseSha,
        headSha: launcherReview.headSha,
        stage: launcherReview.stage,
        reviewerAgent: launcherReview.reviewerAgent,
        model: launcherReview.model,
        reasoningEffort: launcherReview.reasoningEffort,
        contextManifestHash: launcherReview.contextManifestHash,
        outputHash: launcherReview.outputHash,
        contextManifest: context.contextManifest,
        reviewedTaskScopeHash: computeReviewScopeHash(taskRecord.data),
      });
      let preparedPersistence;
      try {
        const traceEvents = fs.readFileSync(trace.tracePath, "utf8").trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
        assertCompleteLauncherTracePrefix(traceEvents, { taskId, agentId, route: selectedRoute, model: selectedModel, profile, runId: trace.runId });
        preparedPersistence = prepareReviewResultPersistence(launcherReview, { taskId, profile, headSha: reviewedHeadSha });
      } catch (error) {
        progress({ status: "review-persistence-failed" });
        process.stderr.write(`Review persistence preparation failed: ${error.message}\n`);
        terminal.complete("failed", 1);
        return;
      }
      const reviewPath = finalizePreparedReviewPublication(preparedPersistence, { terminal, trace, progress, writeError: (message) => process.stderr.write(message) });
      if (!reviewPath) return;
      process.stdout.write(`${JSON.stringify({ status: "review-persisted", taskId, stage: launcherReview.stage, decision: launcherReview.decision, reviewPath })}\n`);
    }

    if (!reviewProfile && stdoutText) process.stdout.write(stdoutText);
    if (reviewProfile) terminal.complete(passed ? "completed" : "failed", passed ? 0 : (exitCode ?? 1));
    else {
      trace.append({ event: "finish", status: passed ? "success" : "failed", exitCode });
      if (!passed) process.exit(exitCode ?? 1);
    }
  });
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) {
  Promise.resolve(main()).catch((error) => {
    process.stderr.write(`codex-route: ${error.message}\n`);
    process.exitCode = 1;
  });
}

export { allowedEfforts, appendBoundedReviewOutput, assertActiveAgent, assertAgentRouteEffort, assertCompleteLauncherTracePrefix, assertExecutableTaskState, assertNonTerminalTask, assertProfileAuthorization, assertReviewRevisionUnchanged, assertTaskId, assertWorkspaceWriteAuthority, attachChildProcessStreams, buildLauncherBoundReviewResult, buildMergeRiskContext, buildReviewAssessmentPrompt, childIsRunning, collectBoundedReviewOutput, comparisonBaseSha, completeCancelledReview, completeReviewPreflightFailure, createReviewCancellationController, createReviewTerminalController, discoverAgents, exactHeadVerificationPath, finalizePreparedReviewPublication, gitSha, hasSensitiveMaterial, packetAccess, parseReviewAssessment, persistCodexAppReviewResult, persistReviewResult, prepareCodexAppReviewResult, prepareReviewResultPersistence, requireReviewEvidenceSequence, revalidateCurrentReviewBinding, reviewArtifactPath, reviewWorktreeIsClean, selectRoute, terminalStates, terminateChildTree, validateCodexAppFinalBinding, validateContextMaterial, validateCurrentContextManifest, validateExactHeadVerification, waitForProcessGroupExit };
