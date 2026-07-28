# SUT-AIOS-GOV-038 Planning Evidence

## Outcome

GOV-038 defines a bounded P2-001 V1 deterministic analytics-calculator plan
and refines P2-001 while it remains in `backlog`. No schema, calculator,
validator, verifier mapping, CI change, ingestion, report, provider, service,
or production capability was implemented.

The plan fixes two future closed schema authorities with exact field/type/bound
tables, metric-to-aggregation mapping, result variants, output/overflow bounds,
an ECMAScript six-place rounding algorithm, and complete validation,
suppression, combination, and reason-code precedence; one pure stable public API
`calculateMetricComparison(request)`, one exact future validator command, and
deterministic invalid/non-comparable output. It preserves the Phase 2 rule that
deterministic measurement precedes AI explanation.

The second QA correction records the only permitted numeric algorithm:
ECMAScript `toFixed(6)`, parsed back to a number and normalized from negative
zero, with raw and rounded output-bound checks. Its closed condition-to-code
table specifies all root/field/period/observation/context/arithmetic cases and
which later checks are suppressed or combined.

The final bounded correction classifies every nested period/context shape error
as `MALFORMED_REQUEST`, fixes left-to-right observation accumulation, and limits
the published raw result bounds to returned fields rather than private mean/rate
accumulators.

## Boundary review

The calculator core has prepared observations as its only input port and a
deterministic result as its only output port. It imports no infrastructure.
Future sources, reports, or providers are adapters that require separate
approval. Correlation and seasonality are bounded caller context or
`not-evaluated`, never inference. The calculator cannot authorize, approve,
recommend, execute, or report an intervention.

Malformed input returns a schema-valid fail-closed `invalid` result without an
exception using a fixed ordered reason-code set; zero baseline returns only
`non-comparable` with `ZERO_BASELINE`. The future test also checks
the small stable public API, hidden internals, no-infrastructure-import rule,
human approval boundary, CI/evidence/rollback expectations, and exact-command
admission prerequisite.

## Planned command

`node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs`

It is not yet admitted by the independent verifier. A separate governance task
is required for the literal shell-free mapping and near-miss rejection tests.

## Changed paths

- `docs/analytics/P2-001_DETERMINISTIC_ANALYTICS_CALCULATORS_V1_DESIGN.md`
- `tasks/backlog/SUT-AIOS-P2-001/task.json`
- `tasks/**/SUT-AIOS-GOV-038/task.json` (lifecycle)
- `docs/project/ISSUES_AND_RISKS.md` (durable risk and final QA outcome)
- `evidence/tasks/SUT-AIOS-GOV-038/verification.md`

## Checks

| Command | Result |
| --- | --- |
| `node scripts/task/validate --task SUT-AIOS-GOV-038` | Pass before activation. |
| `node scripts/task/validate --task SUT-AIOS-P2-001` | Pass after refinement. |
| `node scripts/task/validate --all` | Pass. |
| `npm run verify:fast` | Pass. |
| `git diff --check` | Pass; only CRLF working-copy warnings were emitted. |

The product validator is intentionally not run because it does not yet exist
and is not admitted in this planning task. Independent Sol QA confirmed the
planning acceptance criteria before machine task verification.

## Independent QA history

The fresh 2026-07-28 Sol QA resubmission review passed the path, packet, deep
module, hexagonal-boundary, approval, fail-closed posture, and local command
checks, but returned the design to `revision-required`. The result-number
bounds conflict with valid sums and movements, the promised decimal-safe
rounding method is not yet specified, and malformed field shapes are not yet
mapped completely to deterministic reason-code combinations. `verify:task` was
not run because semantic acceptance was not confirmed.

The final fresh Sol QA review after the second correction confirmed that the
declared output ranges, `toFixed(6)` rule, negative-zero normalization, path
boundary, and packet-authorized deterministic checks are coherent. It still
returned the plan to `revision-required` because nested period/context objects
with missing, unknown, or wrong-typed members fall between the top-level
`MALFORMED_REQUEST` rule and the rules restricted to structurally valid nested
objects. The plan also does not fix IEEE-754 observation accumulation order and
does not distinguish raw result-field bound checks from internal mean/rate
accumulators. These gaps permit conforming implementations to return different
ordered results for the same input. `verify:task` was not run because semantic
acceptance was not confirmed. The packet-authorized commands `node
scripts/task/validate --all`, `npm run verify:fast`, and `git diff --check` all
passed in this review.

The last fresh Sol QA review confirmed that the bounded correction closes the
remaining executable-contract gaps. Nested `currentPeriod`, `baselinePeriod`,
and `context` missing, unknown, and wrong-typed member cases map to
`MALFORMED_REQUEST` and suppress only dependent semantic checks. Observation
arrays accumulate in supplied order with left-to-right ECMAScript Number
addition. Numeric bounds apply to raw and rounded externally returned result
fields, while private mean/rate accumulators are required to remain finite but
are not incorrectly constrained to returned-value bounds. The reviewer also
reconfirmed the finite contract, fixed reason-code ordering, deep-module and
ports-and-adapters boundaries, exact future validator admission prerequisite,
human approval boundary, changed paths, and rollback scope. All
packet-authorized deterministic checks passed; independent machine verification
was then run exactly once and its result is referenced by the verified packet.
