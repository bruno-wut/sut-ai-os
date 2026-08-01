#!/usr/bin/env node
import fs from "node:fs";
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

export function validateReviewResult(data) {
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Data is not an object"] };
  }

  const valid = validateSchema(data);
  const errors = valid ? [] : validateSchema.errors.map((e) => `${e.instancePath || "data"} ${e.message}`);

  // Enforce semantic rule: decision == "pass" implies blockingFindings MUST be empty
  if (data.decision === "pass" && Array.isArray(data.blockingFindings) && data.blockingFindings.length > 0) {
    errors.push("Decision 'pass' requires blockingFindings to be empty");
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
