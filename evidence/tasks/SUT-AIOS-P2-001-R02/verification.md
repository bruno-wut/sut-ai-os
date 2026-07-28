# SUT-AIOS-P2-001-R02 Implementation Evidence

## Remediated boundary

R02 preserves `calculateMetricComparison(request)` as the only public runtime
interface and makes no calculator arithmetic or reason-precedence change. Ajv
8.17.1 is pinned as a development-only standards validator used solely by the
existing admitted analytics contract-validator command.

The validator now validates both committed schemas against the Draft 2020-12
metaschema, compiles them, exercises canonical valid and invalid request shapes,
validates every calculator result, proves each result matches exactly one of the
five declared variants, covers a satisfiable example for every variant, and
rejects focused malformed result shapes.

The request and result schemas and both analytics documents now identify
lexicographic correlation-ID ordering as a deterministic semantic rule that
Draft 2020-12 cannot express. The regression proves that an otherwise valid
unsorted request passes structural schema validation and returns the
schema-valid fixed `INVALID_CONTEXT` result from the calculator without
throwing.

## Scope and safety

No caller-supplied schema, validator, configuration, or dependency is accepted
by the runtime. The calculator remains a pure deep module with no infrastructure
imports. No live data, database, network service, provider, report, policy,
approval, execution, production write, SQL, migration, RLS, payment, booking,
inventory, credential, immutable snapshot, or completed P2-001 evidence/task
record was accessed or changed.

The dependency install reported one moderate development-only npm advisory. It
is recorded in `docs/project/ISSUES_AND_RISKS.md`; no audit fix or unrelated
dependency change was attempted.

## Implementation checks

| Command | Result |
| --- | --- |
| `node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs` | Pass; 55 generated-result checks plus standards-based schema and malformed-variant assertions. |
| `node scripts/task/validate --all` | Pass; all packets valid and R02 active/execution-ready. |
| `npm run verify:fast` | Pass; packet, routing, worktree, and lifecycle checks passed. |
| `git diff --check` | Pass; only line-ending conversion notices were emitted. |

Independent QA must inspect the final diff, rerun the required checks, and run
`verify:task` exactly once if acceptance is confirmed. Machine-readable evidence
belongs under `evidence/verification/SUT-AIOS-P2-001-R02/`.

## Rollback

Revert only the R02 manifest/lock entries, focused schema descriptions,
validator assertions, analytics documentation, risk entry, R02 task state, and
R02 evidence. Preserve the completed P2-001 packet, its historical evidence,
Phase 1 authorities, immutable compatibility snapshot, and external systems.
