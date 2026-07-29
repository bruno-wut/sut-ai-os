# SUT-AIOS-P2-006 implementation evidence

## Outcome

The bounded static implementation is ready for independent Sol review. It
defines one closed Draft 2020-12 structural authority, one canonical finite
data-minimisation and retention policy, one private-authority classification
deep module, one exact validator, and product documentation. It accesses no
data source and performs no lifecycle or production action.

The module exports only
`classifyDataGovernanceCandidate(candidate)`. It loads committed schema and
policy authority internally, ignores extra JavaScript arguments, clones and
recursively freezes returned data, mutates no input, and never throws for
malformed or hostile inputs. A success is explicitly non-authoritative and
sets both action and production-write authority false.

## Changed files

- `schemas/data-minimisation-retention-contract-v1.schema.json`
- `policies/data-minimisation-retention-policy-v1.json`
- `packages/data-governance-contracts/src/data-minimisation-retention-contract-v1.mjs`
- `tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs`
- `docs/data-governance/DATA_MINIMISATION_RETENTION_CONTRACT_V1.md`
- `docs/project/ISSUES_AND_RISKS.md`
- `evidence/tasks/SUT-AIOS-P2-006/verification.md`
- `tasks/review/SUT-AIOS-P2-006/task.json` after lifecycle handoff

## Contract assurance

- four raw telemetry categories can only remain source-system-managed, with no
  AI OS row, queue, workflow, or AI invocation intent;
- twelve eligible semantic categories, ten artifact classes, four intervals,
  six candidate actions, sixteen exact category rules, and three eligibility
  results are finite and deterministic;
- aggregate intervals, source classes, artifact classes, storage classes, and
  candidate actions are checked against the committed policy;
- append-only audit and failed-attempt history cannot be deleted, aggregated,
  rewritten, or classified without both preservation flags;
- caller-supplied weakened schemas, policies, configurations, adapters, and
  dependencies cannot redirect authority;
- malformed, cyclic, accessor, proxy, and deeply nested input produces valid
  deterministic frozen denial data without escaping an exception;
- the core imports only committed JSON authorities and the approved Ajv runtime
  dependency, with no provider SDK, clock, filesystem, environment, network,
  queue, workflow, repository-verification, or execution dependency.

## Deterministic checks

The implementer runs the packet-authorized commands before handoff and records
their exact results here. `verify:task` is reserved for independent QA.

| Command | Result |
| --- | --- |
| `node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs` | Pass; 1,395 deterministic cases. |
| `node scripts/task/validate --all` | Pass; every canonical packet valid and P2-006 review/execution-ready. |
| `node scripts/github/validate-governance.mjs` | Pass; task/branch matched, changed paths permitted, schema/policy JSON valid, and no secret match. |
| `npm run verify:fast` | Pass; packet, routing, worktree, and lifecycle checks passed. |
| `git diff --check` | Pass; line-ending conversion notice only, no whitespace error. |

## Assumptions and limitations

- Candidate descriptors are untrusted metadata. Static conformance cannot prove
  payload minimisation, aggregation correctness, legal retention, due state,
  source behavior, external preservation, or completed action.
- No duration, legal rule, provider, storage location, or live fact source is
  selected. P3-005 must later compose separately approved fixture-only
  authority and fail closed when it is missing.
- The local worktree uses an ignored junction to an existing repository
  `node_modules` installation so the pinned Ajv runtime dependency can execute;
  no dependency or package manifest was changed.

## Rollback

Revert only the five P2-006 product artifacts, this task evidence/state, and
the P2-006 risk entry. Preserve GOV-050/GOV-051 history, P1-003/P2-001/P2-005
terminal records, protected audit and failed-attempt history, canonical sources,
immutable snapshots, and every external system. No external state exists to
roll back.
