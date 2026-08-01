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

The only directly admitted commands beneath `tests/` are the exact literals `node tests/compatibility/validate-finalized-platform-contracts.mjs`, `node tests/event-contracts/validate-normalized-system-event-contract.mjs`, `node tests/control-plane-schema/validate-control-plane-schema.mjs`, `node tests/audit/validate-append-only-audit-contract.mjs`, `node tests/policy-definitions/validate-authorization-policies.mjs`, `node tests/policy-definitions/validate-authorization-policies-v1.mjs`, `node tests/policy-definitions/validate-authorization-policies-v2.mjs`, `node tests/policy-engine/validate-deterministic-policy-evaluator.mjs`, `node tests/playbooks/validate-playbook-registry-v1.mjs`, `node tests/orchestrator/validate-kill-switch-controls-v1.mjs`, `node tests/staff-os/validate-observe-only-control-views-v1.mjs`, `node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs`, `node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs`, `node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs`, `node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs`, `node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs`, and `node tests/resource-governance/validate-resource-budget-contract-v1.mjs`. `verify:task` launches `node` with `shell: false` and exactly one fixed validator-path argument for each. Arguments, whitespace variations, alternate paths, traversal, redirects, substitutions, shell operators, and every other `node tests/...` form remain unsupported and yield `blocked`. The P2-007 resource-budget literal is admitted only for its separately approved static contract validator; it does not authorize resource-control behavior or create a generic test-command runner. Admission of the P2-006 literal likewise does not create or execute the future product validator, schema, canonical policy, or runtime module; access or classify data; establish payload minimisation or aggregation; schedule, perform, or prove deletion, archival, or transfer; invoke storage, queues, workflows, AI, or external services; or authorize production eligibility. P2-006 product implementation and independent verification remain separately governed.

The GitHub `Governance / validate` workflow executes the exact P2-002 validator
after dependency installation and repository fast verification. This explicit CI
step proves the merge candidate's provider-neutral contract artifacts; it does
not broaden verifier admission or add provider, workflow, authorization, or
production capability.

The same workflow executes the exact P2-004 validator
`node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs`
as a distinct fixed step after dependency installation and repository fast
verification. This final-head check proves only the committed static proposal
contract merge candidate. It does not generate a proposal, grant a capability,
authorize or approve an action, invoke a provider or workflow, execute a change,
record an audit event, or create production capability.

The same workflow executes the exact P2-005 validator
`node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs`
as a distinct fixed step after dependency installation and repository fast
verification. This final-head check proves only the committed static
infrastructure-port contract merge candidate. It does not authenticate or
authorize a caller, establish live trust or recipient facts, reserve capacity,
dispatch a call, configure an adapter or provider, access infrastructure, or
create production capability.

The same workflow executes the exact P2-006 validator
`node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs`
as a distinct fixed step after dependency installation and repository fast
verification. This final-head check proves only the committed static data-
minimisation and retention contract merge candidate. It does not access or
classify live data, prove payload minimisation or aggregation, establish legal
retention or due state, schedule or perform deletion, aggregation, archival, or
transfer, invoke storage, queues, workflows, AI, or external services, or
create production capability.

The same workflow executes the exact P2-007 validator
`node tests/resource-governance/validate-resource-budget-contract-v1.mjs`
as a distinct fixed step immediately after repository fast verification. This
final-head check proves only the committed static resource-budget contract on
the merge candidate. It does not establish live resource usage or capacity,
control a workload, schedule, pause, requeue, block, notify, execute, affect
booking operations, or create production capability.

Large logs, traces, screenshots, and reports belong in `artifacts/`; result JSON stores concise references only. Do not add secrets or raw webhook payloads to evidence.
