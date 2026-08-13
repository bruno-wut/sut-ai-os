#!/usr/bin/env node
import fs from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(root, "schemas", "review-result-v1.schema.json");

const ajv = new Ajv2020({ allErrors: true, strict: true, strictTypes: false });
ajv.addFormat("date-time", { validate: (str) => !isNaN(Date.parse(str)) });

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const validateSchema = ajv.compile(schema);

function fail(msg) {
  process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(1);
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().filter((key) => key !== "outputHash").map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function computeReviewOutputHash(data) {
  return createHash("sha256").update(JSON.stringify(canonicalize(data))).digest("hex");
}

export function validateReviewResult(data, expected = {}) {
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Data is not an object"] };
  }

  const valid = validateSchema(data);
  const errors = valid ? [] : validateSchema.errors.map((e) => `${e.instancePath || "data"} ${e.message}`);

  // Enforce semantic rule: decision == "pass" implies blockingFindings MUST be empty
  if (data.decision === "pass" && Array.isArray(data.blockingFindings) && data.blockingFindings.length > 0) {
    errors.push("Decision 'pass' requires blockingFindings to be empty");
  }

  for (const field of ["taskId", "baseSha", "headSha", "reviewerAgent", "model", "reasoningEffort", "contextManifestHash"]) {
    if (expected[field] !== undefined && data[field] !== expected[field]) errors.push(`${field} does not match the expected bound value`);
  }
  if (typeof data.outputHash === "string" && data.outputHash !== computeReviewOutputHash(data)) errors.push("outputHash does not match the canonical review result");
  if (typeof data.tracePath === "string") {
    const segments = data.tracePath.split("/");
    if (path.isAbsolute(data.tracePath) || data.tracePath.includes("\\") || data.tracePath.includes(":") || segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
      errors.push("tracePath must be a contained repository-relative path without traversal components");
    }
  }
  if (typeof data.tracePath === "string" && data.tracePath.includes("/runs/") && data.tracePath !== `evidence/reviews/${data.taskId}/runs/${data.runId}.json`) {
    errors.push("Codex app tracePath must match runId");
  }
  if (typeof data.tracePath === "string" && data.tracePath.includes("/traces/")) {
    const prefix = `evidence/reviews/${data.taskId}/traces/${data.runId}-${data.reviewerAgent}-`;
    if (!data.tracePath.startsWith(prefix) || !data.tracePath.endsWith(".jsonl")) errors.push("Launcher tracePath must match taskId, runId, and reviewerAgent");
  }

  return { valid: errors.length === 0, errors };
}

function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    fail("Usage: node scripts/review/validate-review-result.mjs <path-to-review-result.json>");
  }

  const absolute = path.resolve(root, fileArg);
  if (!fs.existsSync(absolute)) fail(`File not found: ${fileArg}`);
  const raw = fs.readFileSync(absolute, "utf8");
  let json;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    fail(`Invalid JSON: ${e.message}`);
  }

  const result = validateReviewResult(json);
  if (!result.valid) {
    fail(`Review result validation failed:\n- ${result.errors.join("\n- ")}`);
  }

  process.stdout.write(JSON.stringify({ status: "pass", file: fileArg, decision: json.decision }, null, 2) + "\n");
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && (path.resolve(process.argv[1]) === currentFile || path.resolve(process.argv[1]) === fs.realpathSync(currentFile))) {
  main();
}
