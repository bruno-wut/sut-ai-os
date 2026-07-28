# Verification policy

Verification is independent only when a verifier identity and model are recorded separately from the task packet owner. An implementation agent cannot self-verify. Verified work remains implementation plus deterministic checks plus independent review plus recorded evidence.

## Available commands

- `verify:fast` runs only local governance checks detected in this repository: task packet validation, Codex-routing self-tests, worktree fixture, and task lifecycle fixture.
- `verify:changed` performs deterministic changed-path collection; `verify:security-boundaries` scans changed readable files for configured secret patterns without printing values.
- `verify:task` loads a canonical task packet, checks the final diff against allowed/forbidden paths, runs its safe required-test commands, records independent verifier identity/model, and writes JSON evidence below `evidence/verification/<task-id>/`.
- `verify:full` combines the available local checks and explicitly lists unavailable capabilities.

`verify:content`, `verify:storefront`, `verify:ibe`, and `verify:staff-os` currently return `blocked`: their detected commands belong to the immutable compatibility baseline or no independently runnable subsystem exists. They must be enabled only from an approved implementation worktree; the verification framework never builds in `reference/finalized-platform/`.

## Task verification

```text
npm run verify:task -- --task SUT-AIOS-AREA-001 --verifier-agent qa-verification --verifier-model gpt-5.6-terra --acceptance-confirmed
```

Without `--acceptance-confirmed`, semantic acceptance criteria remain `pending` and the result is `revision_required`; a tool cannot infer business acceptance. A failed required test yields `fail`; an unsafe/unavailable required command or self-verification yields `blocked`. In all non-pass cases, `productionEligible` is false. It is also false unless the task explicitly grants production-write permission.

Required-command execution remains fail closed. The sole directly admitted npm audit form is the exact literal `npm audit --omit=dev`. On Windows, `verify:task` launches `process.execPath` with `shell: false` and the deterministically derived bundled npm CLI path (`node_modules/npm/bin/npm-cli.js` beside the Node executable) followed only by `audit` and `--omit=dev`; a missing CLI path blocks execution. On other platforms it launches `npm` directly with `shell: false` and the fixed arguments `audit` and `--omit=dev`. A zero audit exit passes, while a nonzero exit or process-execution error fails the required test. `npm audit`, audit commands with additional arguments, shell operators, mutation-capable forms such as `npm audit fix`, and every other npm command remain unsupported and yield `blocked`.

GitHub governance resolves a `task/` branch only against exact task IDs that already exist in the repository. The canonical task-ID form may have one optional uppercase alphanumeric suffix of 1–16 characters after the three-digit sequence, such as `SUT-AIOS-P1-006-PLAN`. A following branch description must be a lowercase alphanumeric hyphenated slug. Longest exact identity wins, so `SUT-AIOS-P1-006-PLAN` binds to its own packet and evidence rather than to `SUT-AIOS-P1-006`. Unknown, doubled, punctuated, overlength, or additional uppercase suffix forms fail closed.

The only directly admitted commands beneath `tests/` are the exact literals `node tests/compatibility/validate-finalized-platform-contracts.mjs`, `node tests/event-contracts/validate-normalized-system-event-contract.mjs`, `node tests/control-plane-schema/validate-control-plane-schema.mjs`, `node tests/audit/validate-append-only-audit-contract.mjs`, `node tests/policy-definitions/validate-authorization-policies.mjs`, `node tests/policy-definitions/validate-authorization-policies-v1.mjs`, `node tests/policy-definitions/validate-authorization-policies-v2.mjs`, `node tests/policy-engine/validate-deterministic-policy-evaluator.mjs`, `node tests/playbooks/validate-playbook-registry-v1.mjs`, and `node tests/orchestrator/validate-kill-switch-controls-v1.mjs`. `verify:task` launches `node` with `shell: false` and exactly one fixed validator-path argument for each. Arguments, whitespace variations, alternate paths, shell operators, and every other `node tests/...` form remain unsupported and yield `blocked`. This permits the deterministic P0-003 and P1-001 through P1-007 validators only; it does not create a generic test-command runner.

Large logs, traces, screenshots, and reports belong in `artifacts/`; result JSON stores concise references only. Do not add secrets or raw webhook payloads to evidence.
