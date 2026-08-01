#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const registryPath = path.join(root, "policies", "validator-registry-v1.json");

function fail(msg) {
  process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(1);
}

function slash(p) {
  return p.replaceAll(path.sep, "/");
}

export function runValidatorRegistry() {
  if (!fs.existsSync(registryPath)) {
    fail(`Validator registry policy not found: ${registryPath}`);
  }

  const raw = fs.readFileSync(registryPath, "utf8");
  let registry;
  try {
    registry = JSON.parse(raw);
  } catch (e) {
    fail(`Invalid JSON in validator registry: ${e.message}`);
  }

  if (!Array.isArray(registry.validators)) {
    fail("Validator registry must contain a 'validators' array.");
  }

  const activeValidators = registry.validators
    .filter((v) => v.status === "active")
    .sort((a, b) => a.validatorId.localeCompare(b.validatorId));

  const results = [];
  let allPassed = true;

  for (const entry of activeValidators) {
    const { validatorId, ownerTaskId, path: relativePath, arguments: args } = entry;

    if (Array.isArray(args) && args.length > 0) {
      fail(`Validator entry '${validatorId}' specifies arguments, which is forbidden in V1.`);
    }

    if (relativePath.includes("..")) {
      fail(`Validator entry '${validatorId}' attempts path traversal: ${relativePath}`);
    }

    const normalizedPath = slash(relativePath);
    if (!normalizedPath.startsWith("tests/")) {
      fail(`Validator entry '${validatorId}' path is not under tests/: ${relativePath}`);
    }

    const absolutePath = path.resolve(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      fail(`Validator entry '${validatorId}' script not found: ${relativePath}`);
    }

    const realPath = fs.realpathSync(absolutePath);
    const realRelative = slash(path.relative(root, realPath));
    if (realPath !== absolutePath || !realRelative.startsWith("tests/")) {
      fail(`Validator entry '${validatorId}' involves a symlink or escapes tests/: ${relativePath}`);
    }

    const result = spawnSync(process.execPath, [absolutePath], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
      timeout: 300000,
      shell: false,
    });

    const passed = result.status === 0 && !result.error;
    if (!passed) allPassed = false;

    results.push({
      validatorId,
      ownerTaskId,
      path: relativePath,
      passed,
      exitCode: result.status,
      error: result.error ? result.error.message : null,
      output: `${result.stdout ?? ""}${result.stderr ?? ""}`.slice(-1000).trim(),
    });
  }

  return { status: allPassed ? "pass" : "fail", totalRun: results.length, results };
}

function main() {
  const summary = runValidatorRegistry();
  process.stdout.write(JSON.stringify(summary, null, 2) + "\n");
  if (summary.status !== "pass") process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  main();
}
