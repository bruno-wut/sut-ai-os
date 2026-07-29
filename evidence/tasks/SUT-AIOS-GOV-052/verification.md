# SUT-AIOS-GOV-052 implementation evidence

## Outcome

Added one distinct fixed final-head CI step for the already admitted P2-006
validator:

`node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs`

The step immediately follows repository fast verification and contains no
interpolation, matrix, dynamic path, arguments, shell operator, credential,
external service, or deployment behavior. Verification policy and the risk
register state that this check proves only the committed static P2-006 merge
candidate; it performs no data access, classification, storage, retention
operation, workflow, AI invocation, or production action.

## Changed files

- `.github/workflows/validate-governance.yml`
- `docs/verification/VERIFICATION_POLICY.md`
- `docs/project/ISSUES_AND_RISKS.md`
- `evidence/tasks/SUT-AIOS-GOV-052/verification.md`
- `tasks/review/SUT-AIOS-GOV-052/task.json` after lifecycle handoff

No P2-006 product artifact, generic runner, verifier admission, package,
dependency, schema, test, policy artifact, service, credential, data source,
storage system, or external system was changed.

## Implementer checks

| Command | Result |
| --- | --- |
| `node scripts/task/validate --all` | Pass; all canonical packets valid, including active GOV-052 and verified P2-006. |
| `node scripts/github/validate-governance.mjs` | Pass; governance metadata, paths, schemas, policies, agents, and secret checks passed. |
| `npm run verify:fast` | Pass; task validation, routing, worktree, and lifecycle checks passed. |
| `git diff --check` | Pass. |

## Independent verification

Independent Sol QA and the single authorized task-specific machine-verification
run remain required. Final-head GitHub Actions remains required before merge.
The implementer is not the completion authority.

## Limitations and rollback

Passing this step proves only the static contract on the merge candidate. It
does not prove payload minimisation, aggregation correctness, legal retention,
due state, source behavior, external preservation, or a completed lifecycle
action.

Rollback only the fixed CI step, verification-policy statement, GOV-052 risk
entry, task state, and GOV-052 evidence. Preserve P2-006 product/evidence,
GOV-050/GOV-051 history, terminal records, canonical sources, immutable
snapshots, and all external systems.
