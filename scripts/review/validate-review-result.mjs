#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(root, "schemas", "review-result-v1.schema.json");

function fail(msg) {
  process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(1);
}

export function validateReviewResult(data) {
  if (typeof data !== "object" || data === null) return { valid: false, errors: ["Data is not an object"] };
  const errors = [];
  if (data.schemaVersion !== "1.0.0") errors.push("schemaVersion must be '1.0.0'");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{2,80}$/.test(data.taskId ?? "")) errors.push("Invalid taskId format");
  if (!/^[a-f0-9]{7,40}$/.test(data.baseSha ?? "")) errors.push("Invalid baseSha format");
  if (!/^[a-f0-9]{7,40}$/.test(data.headSha ?? "")) errors.push("Invalid headSha format");
  if (!data.reviewerAgent) errors.push("Missing reviewerAgent");
  if (!data.model) errors.push("Missing model");
  if (!["low", "medium", "high", "xhigh", "max"].includes(data.reasoningEffort)) errors.push("Invalid reasoningEffort");
  if (!/^[a-f0-9]{32,64}$/.test(data.contextManifestHash ?? "")) errors.push("Invalid contextManifestHash");
  if (!data.reviewedAt || isNaN(Date.parse(data.reviewedAt))) errors.push("Invalid reviewedAt date");
  if (!/^[a-f0-9]{32,64}$/.test(data.outputHash ?? "")) errors.push("Invalid outputHash");
  if (!["pass", "revision-required", "blocked"].includes(data.decision)) errors.push("Invalid decision");
  if (!Array.isArray(data.blockingFindings)) errors.push("blockingFindings must be an array");
  if (!Array.isArray(data.nonBlockingRisks)) errors.push("nonBlockingRisks must be an array");
  if (!Array.isArray(data.missingNegativeTests)) errors.push("missingNegativeTests must be an array");
  
  if (typeof data.architectureAssessment !== "object" || data.architectureAssessment === null) {
    errors.push("Missing architectureAssessment object");
  } else {
    if (!data.architectureAssessment.deepModules) errors.push("Missing deepModules assessment");
    if (!data.architectureAssessment.hexagonalArchitecture) errors.push("Missing hexagonalArchitecture assessment");
    if (!data.architectureAssessment.eventedBoundaries) errors.push("Missing eventedBoundaries assessment");
  }
  if (!data.exactNextAction) errors.push("Missing exactNextAction");

  return { valid: errors.length === 0, errors };
}

function main() {
  const fileArg = process.argv[2];
  if (!fileArg) {
    process.stdout.write(JSON.stringify({ status: "pass", details: "Review result validator operational." }, null, 2) + "\n");
    return;
  }
  const absolute = path.resolve(root, fileArg);
  if (!fs.existsSync(absolute)) fail(`File not found: ${fileArg}`);
  const raw = fs.readFileSync(absolute, "utf8");
  let json;
  try { json = JSON.parse(raw); } catch (e) { fail(`Invalid JSON: ${e.message}`); }
  const result = validateReviewResult(json);
  if (!result.valid) {
    fail(`Review result validation failed:\n${result.errors.join("\n")}`);
  }
  process.stdout.write(JSON.stringify({ status: "pass", file: fileArg, decision: json.decision }, null, 2) + "\n");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  main();
}
