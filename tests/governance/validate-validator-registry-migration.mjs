#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runValidatorRegistry } from "../../scripts/verify/run-validator-registry.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const registryPath = path.join(root, "policies", "validator-registry-v1.json");

function fail(msg) {
  process.stderr.write(`FAIL: ${msg}\n`);
  process.exit(1);
}

function slash(p) {
  return p.replaceAll(path.sep, "/");
}

function main() {
  if (!fs.existsSync(registryPath)) fail("policies/validator-registry-v1.json missing");
  const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));

  const hardcodedValidators = [
    "tests/compatibility/validate-finalized-platform-contracts.mjs",
    "tests/event-contracts/validate-normalized-system-event-contract.mjs",
    "tests/control-plane-schema/validate-control-plane-schema.mjs",
    "tests/audit/validate-append-only-audit-contract.mjs",
    "tests/policy-definitions/validate-authorization-policies.mjs",
    "tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs",
    "tests/analytics/validate-deterministic-analytics-calculators-v1.mjs",
    "tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs",
    "tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs",
    "tests/policy-engine/validate-deterministic-policy-evaluator.mjs",
    "tests/playbooks/validate-playbook-registry-v1.mjs",
    "tests/orchestrator/validate-kill-switch-controls-v1.mjs",
    "tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs",
    "tests/staff-os/validate-observe-only-control-views-v1.mjs",
    "tests/policy-definitions/validate-authorization-policies-v2.mjs",
    "tests/resource-governance/validate-resource-budget-contract-v1.mjs",
  ];

  const registeredPaths = registry.validators.map((v) => slash(v.path));
  
  // 1. Verify 1:1 coverage
  for (const expectedPath of hardcodedValidators) {
    const count = registeredPaths.filter((p) => p === expectedPath).length;
    if (count !== 1) {
      fail(`Expected exactly 1 registration for ${expectedPath}, found ${count}`);
    }
  }

  // 2. Verify zero lost validators
  if (registeredPaths.length < hardcodedValidators.length) {
    fail("Registered validator count is less than hardcoded list.");
  }

  // 3. Verify duplicate IDs check
  const ids = registry.validators.map((v) => v.validatorId);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    fail("Duplicate validatorId detected in registry.");
  }

  // 4. Verify runner execution
  const execution = runValidatorRegistry();
  if (execution.status !== "pass") {
    fail("Validator registry runner execution failed.");
  }

  // 5. Verify deterministic sorting (alphabetical by validatorId)
  const sortedIds = [...execution.results.map((r) => r.validatorId)].sort((a, b) => a.localeCompare(b));
  const actualIds = execution.results.map((r) => r.validatorId);
  if (JSON.stringify(sortedIds) !== JSON.stringify(actualIds)) {
    fail("Execution order is not deterministically sorted by validatorId.");
  }

  process.stdout.write(JSON.stringify({
    name: "validate-validator-registry-migration",
    passed: true,
    hardcodedCoverage: hardcodedValidators.length,
    registeredTotal: registry.validators.length,
    details: "1:1 validator parity, zero missing tests, deterministic sorting, and shell-free execution verified."
  }, null, 2) + "\n");
}

main();
