import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const launcher = path.join(scriptDirectory, "launch.mjs");
const repositoryRoot = path.resolve(scriptDirectory, "..", "..");

function run(argumentsList, expectedSuccess, label) {
  const result = spawnSync(process.execPath, [launcher, ...argumentsList], {
    cwd: repositoryRoot,
    encoding: "utf8",
    windowsHide: true,
  });
  const succeeded = result.status === 0;
  if (succeeded !== expectedSuccess) {
    throw new Error(`${label} failed: exit=${result.status}; stderr=${result.stderr.trim()}`);
  }
  return { label, status: expectedSuccess ? "passed" : "rejected-as-required", stdout: result.stdout.trim() };
}

const internalCheck = run(["--self-test"], true, "internal route/model mapping");
const terraCheck = run(["--route", "terra", "--agent", "codex-engineering-executor", "--task", "SUT-AIOS-GOV-002", "--workspace-write", "--dry-run"], true, "Terra implementation dry-run");
const terraResult = JSON.parse(terraCheck.stdout);
const tracePath = path.join(repositoryRoot, terraResult.trace_path);
const traceEvents = fs.readFileSync(tracePath, "utf8").trim().split(/\r?\n/).map((line) => JSON.parse(line));
const traceText = JSON.stringify(traceEvents);
if (traceEvents.length !== 2 || traceEvents[0].event !== "start" || traceEvents[1].event !== "finish") {
  throw new Error("Trace must contain exactly one start and one finish event");
}
if (!traceEvents.every((event) => event.model === "gpt-5.6-terra") || !terraResult.start_time || !terraResult.finish_time) {
  throw new Error("Trace is missing model or timestamps");
}
if (/(prompt|environment|secret|api_key|token)/i.test(traceText)) {
  throw new Error("Trace contains a forbidden sensitive field name");
}

const checks = [
  { label: internalCheck.label, status: internalCheck.status },
  { label: terraCheck.label, status: terraCheck.status },
  run(["--route", "auto", "--agent", "codex-engineering-executor", "--task", "SUT-AIOS-GOV-002", "--dry-run"], true, "automatic packet route"),
  run(["--route", "sol", "--agent", "qa-verification", "--task", "SUT-AIOS-GOV-002", "--dry-run"], true, "Sol escalation dry-run"),
  run(["--route", "luna", "--agent", "codex-engineering-executor", "--task", "SUT-AIOS-GOV-002", "--dry-run"], false, "unsafe Luna downgrade"),
  run(["--route", "terra", "--agent", "not-a-real-agent", "--task", "SUT-AIOS-GOV-002", "--dry-run"], false, "unknown agent"),
  run(["--route", "terra", "--agent", "codex-engineering-executor", "--task", "MISSING-TASK", "--dry-run"], false, "missing task packet"),
  run(["--route", "qwen-local", "--agent", "codex-engineering-executor", "--task", "SUT-AIOS-GOV-002", "--local-provider", "ollama", "--local-model", "qwen-placeholder", "--dry-run"], false, "unauthorized Qwen substitution"),
  { label: "start/finish/model trace without prompt or secret fields", status: "passed" },
];

for (const check of checks) delete check.stdout;

process.stdout.write(`${JSON.stringify({ status: "passed", checks }, null, 2)}\n`);
