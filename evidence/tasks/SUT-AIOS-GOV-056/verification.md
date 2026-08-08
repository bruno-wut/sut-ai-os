# Task Verification Evidence: SUT-AIOS-GOV-056

## Task Summary
- **Task ID**: SUT-AIOS-GOV-056
- **Title**: Workflow Optimization and Model Routing Upgrade V2
- **Owner**: codex-engineering-executor
- **Reviewer**: qa-verification
- **Date**: 2026-08-01

## Remediation & Defect Fixes Summary

### 1. Task Packet V1 Restoration
- Reverted `schemas/task-packet.schema.json` to its canonical original byte-for-byte state.
- Retained strict `additionalProperties: false`, required `branch` and `createdBy` under `worktree`, avoiding weakening of historical V1 packets.
- Implemented legacy V1 tolerance handling in `task-cli.mjs` while enforcing strict Ajv schema compilation for V2 packets.

### 2. Task Packet V2 Schema & Routing Policy
- Created `schemas/task-packet-v2.schema.json` with required `planReview` stage under `routingPolicy`.
- Enforced model route and reasoning effort restrictions per stage.

### 3. Post-Merge Reconciliation Script & Unit Tests
- Implemented `scripts/task/reconcile-merged-task.mjs` using git diff commit ranges (`GITHUB_EVENT_BEFORE..AFTER`).
- Enforced closed-fail validation: exactly 1 verified task allowed in diff range.
- Added comprehensive unit test suite `tests/task/reconcile-merged-task.test.mjs` covering zero candidates, multiple candidates, destination collisions, and clean post-merge transitions.

### 4. Launcher & Model Routing Hardening
- Updated `scripts/codex/launch.mjs`:
  - Disallowed CLI `--route` and `--effort` overrides for V2 packets.
  - Enforced agent `active` status and parsed `allowed_model_routes` / `allowed_reasoning_efforts`.
  - Restricted `workspaceWrite` to execution category agents.
  - Rejected execution attempts on terminal tasks (`done`, `cancelled`, `archived`).
  - Restored secret-stripping environment sanitizer for local Qwen processes.
  - Enforced strict SHA-bound JSON review result validation using Ajv (`schemas/review-result-v1.schema.json`) with exact 40-char Git SHA and 64-char SHA-256 hash regex patterns.

### 5. Validator Registry Authority & Static Parity
- Added `$schema` property to `schemas/validator-registry-v1.schema.json`.
- Hardened `scripts/verify/run-validator-registry.mjs` with Ajv schema compilation, uniqueness checks for IDs/paths, and minimum active validator requirement.
- Updated `policies/validator-registry-v1.json` to include `tests/policy-definitions/validate-authorization-policies-v1.mjs`.
- Refactored `tests/governance/validate-validator-registry-migration.mjs` to perform static parity checks without re-executing all validators multiple times per CI.

### 6. Guidance & Documentation Updates
- Updated `AGENTS.md`, `docs/project/TASK_WORKFLOW.md`, and `docs/project/DEFINITION_OF_DONE.md` to reflect Task Packet V2, two-PR workflow, routing policy rules, and post-merge reconciliation.

## Verification Results
- `npm run verify:fast` — **PASSED** (100% pass across all 7 verification suites).
- `node scripts/task/validate --all` — **PASSED**.
- `node scripts/codex/validate-routing.mjs` — **PASSED**.
- `node scripts/verify/run-validator-registry.mjs` — **PASSED**.
- `node tests/governance/validate-validator-registry-migration.mjs` — **PASSED**.
- `node tests/task/reconcile-merged-task.test.mjs` — **PASSED**.
