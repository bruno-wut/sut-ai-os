# SUT-AIOS-P2-004 Implementation Evidence

## Scope and outcome

Implemented the bounded static Intervention Proposal Contract V1 only:

- one closed Draft 2020-12 proposal schema;
- one runtime-safe deep module with the sole public function
  `validateInterventionProposal(proposal, intelligenceRequest, intelligenceResult)`;
- canonical P2-002 request/result provenance validation through its public
  boundary;
- deterministic structural, non-authority, provenance, and cross-field
  fail-closed decisions;
- one exact admitted deterministic validator; and
- product documentation and durable risk status.

No proposal generator, provider invocation, policy, approval, capability grant,
workflow, persistence, retention, queue, scheduler, executor, verification
service, audit store, notification, network, credential, production write, or
external behavior was added.

## Changed files

- `schemas/intervention-proposal-contract-v1.schema.json`
- `packages/intervention-proposal-contracts/src/intervention-proposal-contract-v1.mjs`
- `tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs`
- `docs/intervention-proposals/INTERVENTION_PROPOSAL_CONTRACT_V1.md`
- `docs/project/ISSUES_AND_RISKS.md`
- `evidence/tasks/SUT-AIOS-P2-004/verification.md`
- `tasks/review/SUT-AIOS-P2-004/task.json` after lifecycle transition

## Deterministic implementation checks

| Command | Result |
| --- | --- |
| `node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs` | Passed: 221 focused finite-value, bound, provenance, authority-isolation, hostile-input, clone/freeze, and import-boundary cases. |
| `node scripts/task/validate --all` | Passed: all canonical packets valid; P2-004 active and execution-ready before review transition. |
| `npm run verify:fast` | Passed: task validation, routing validation, worktree self-test, and task-tool self-test. |
| `git diff --check` | Passed with no whitespace errors. |

The validator compiles and metaschema-validates the committed schema with Ajv
2020, verifies closed object authorities, checks all finite outcomes,
capabilities, risks and approval classes, exercises exact source mappings and
reason precedence, rejects self-authorization and caller authority injection,
and proves valid results are detached deeply frozen plain-data clones.

## Architecture inspection

The module loads the proposal schema and P2-002 public validators internally.
It accepts no caller-provided authority or dependency injection. Its core has no
provider, transport, storage, queue, workflow, scheduler, policy, approval,
executor, verification, audit, notification, filesystem, clock, environment,
credential, or network import. Text is inert and the module performs no side
effect.

## Review and machine evidence

Independent Sol review and the single task-specific `verify:task` cycle remain
for the QA reviewer. The implementer has not run `verify:task` and is not the
completion authority. QA must bind machine evidence under
`evidence/verification/SUT-AIOS-P2-004/` to the final reviewed diff.

## Limitations and rollback

This is a static validation contract, not a proposal generator or runtime
execution capability. It does not make an accepted proposal authorized,
approved, executable, independently verified, production eligible, or
authoritative.

Rollback removes only the P2-004 schema, deep module, validator, product
documentation, task-state transition, risk entry, and P2-004 evidence. Preserve
P2-002 authorities and evidence, GOV-044/GOV-045 history, terminal packets,
canonical architecture sources, immutable snapshots, and all external systems.
