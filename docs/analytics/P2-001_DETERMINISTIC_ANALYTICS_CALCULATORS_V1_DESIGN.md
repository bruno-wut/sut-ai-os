# P2-001 Deterministic Analytics Calculators V1 Design

## Decision and authority

P2-001 is a local deterministic measurement boundary, not a connector, report,
intelligence provider, policy engine, or action engine. It accepts prepared
finite numeric observations and neither obtains nor persists them.

The future product has exactly two closed JSON Schema Draft 2020-12 authorities:
`schemas/deterministic-analytics-calculator-request-v1.schema.json` and
`schemas/deterministic-analytics-calculator-result-v1.schema.json`; one public
module; one deterministic validator; and documentation. Every schema object
sets `additionalProperties: false`. The core internally uses committed V1
authority; callers cannot supply schemas, validators, policies, configuration,
or dependencies as authority.

## Stable API and hexagonal core

The only public entry point is `calculateMetricComparison(request)`. Validation,
rounding, reason-code selection, confidence, and frozen-result construction are
private. The core imports no database, filesystem, network, environment, clock,
queue, provider SDK, or platform-specific dependency. Prepared observations are
its only input port and its deterministic result its only output port. Any future
event/audit reader, analytics source, report renderer, or provider integration
is a separately approved adapter outside the core and public API.

P1-001 events and P1-003 audit records may establish later provenance, but
P2-001 never queries, persists, mutates, imports mutable authority from, or
redefines either contract.

## Closed request schema V1

The closed root requires exactly `metricId`, `segmentId`, `aggregation`,
`currentPeriod`, `baselinePeriod`, `currentObservations`,
`baselineObservations`, and `context`.

| Field | Exact type and bounds |
| --- | --- |
| `metricId` | string enum: `event-count`, `event-value-sum`, `event-value-mean`, `event-rate` |
| `segmentId` | string matching `^[a-z][a-z0-9-]{0,63}$` |
| `aggregation` | string enum: `sum`, `mean`, `rate` |
| `currentPeriod` | closed `{start,end}` of real UTC `YYYY-MM-DD` dates; `start <= end` |
| `baselinePeriod` | same; `start <= end` and `baselinePeriod.end < currentPeriod.start` |
| observations | two arrays, each 1–366 JSON numbers in `[-1000000000,1000000000]` |
| `context` | closed object below |

The only metric mappings are `event-count -> sum`, `event-value-sum -> sum`,
`event-value-mean -> mean`, and `event-rate -> rate`. `context` requires
`anomalyDurationDays` (integer 0–366), `correlatedDeploymentIds` and
`correlatedCampaignIds` (sorted duplicate-free arrays of 0–20 IDs matching the
same segment expression), and `seasonalityStatus` (`not-evaluated` or
`caller-declared`). Context is display-only and never changes results or
confidence.

Draft 2020-12 expresses the correlation-array shape, item bound, identifier
pattern, and uniqueness, but it cannot express lexicographic array ordering.
The request schema therefore accepts an otherwise structurally valid unsorted
array, while the deterministic calculator enforces ascending order as semantic
validation and returns `INVALID_CONTEXT`. This documented semantic layer is
part of the V1 request contract; schema-valid does not by itself mean the
request is semantically valid for calculation.

Each nested `currentPeriod`, `baselinePeriod`, and `context` object is closed.
Any missing, unknown, or wrong-typed nested field is `MALFORMED_REQUEST`, not
`INVALID_PERIOD` or `INVALID_CONTEXT`; its semantic checks are then suppressed.

## Closed result schema V1, bounds, and rounding

Every closed result requires `schemaVersion` constant `1.0.0`, request identity
and periods, `status`, four result values, two sample sizes, `confidenceBand`,
`context`, and `reasonCodes`.

| Status | Exact shape |
| --- | --- |
| `ok` | all values numeric, sample sizes 1–366, `reasonCodes:[]`, confidence `insufficient`, `low`, `medium`, or `high` |
| `non-comparable` | valid request identity/context and current/baseline/absolute values, `percentageMovement:null`, sample sizes 1–366, confidence `not-applicable`, exactly `reasonCodes:["ZERO_BASELINE"]` |
| `invalid` | all four values `null`, sample sizes `0`, confidence `not-applicable`, ordered invalid codes; fixed identity `{metricId:null,segmentId:null,aggregation:null,currentPeriod:null,baselinePeriod:null}` and fixed empty/not-evaluated context |

For `sum`, current/baseline bounds are `[-366000000000,366000000000]`; for
`mean` and `rate`, `[-1000000000,1000000000]`. In every valid variant absolute
movement is `[-732000000000,732000000000]` and a non-null percentage is
`[-1000000,1000000]`. The result schema expresses aggregation-specific bounds.

`sum` is arithmetic sum; `mean` and `rate` are arithmetic mean of prepared
values. Each input array is accumulated left-to-right in its supplied order
using ECMAScript Number addition; no sorting, set conversion, parallel
reduction, or re-association is permitted. Absolute movement is current minus baseline; percentage is absolute
movement divided by absolute baseline, times 100. Every raw intermediate must
be finite. The stated raw and rounded bounds apply only to externally returned
result fields, not to private accumulators used to derive valid `mean` or
`rate` values. Exact V1 rounding is
`Number.parseFloat(value.toFixed(6))`, using ECMAScript
`Number.prototype.toFixed` with six digits, followed by
`Object.is(result, -0) ? 0 : result`. The rounded value is checked against the
same bound. This gives a Node/ECMAScript-defined IEEE-754 algorithm with no
locale or library. Exceeding a bound, non-finite arithmetic, or failure of either
bound check is `NUMERIC_OVERFLOW`; values are never clipped. A valid zero
baseline bypasses percentage calculation and returns `non-comparable`.

Confidence uses only the smaller sample size: 1–2 insufficient, 3–6 low, 7–29
medium, 30–366 high. It is never an inference, safety, authorization, or
approval claim.

## Complete validation, suppression, and precedence

The complete code set is `MALFORMED_REQUEST`, `UNKNOWN_METRIC`,
`INVALID_SEGMENT`, `AGGREGATION_MISMATCH`, `INVALID_PERIOD`,
`EMPTY_OBSERVATIONS`, `OBSERVATION_LIMIT_EXCEEDED`, `NON_FINITE_OBSERVATION`,
`INVALID_CONTEXT`, `NUMERIC_OVERFLOW`, and `ZERO_BASELINE`. Evaluate this table
in row order; add at most one copy of each code.

| Order | Condition | Code | Suppression and combination |
| --- | --- | --- | --- |
| 1 | root is null, array, or not a plain object | `MALFORMED_REQUEST` | return immediately; all later rows suppressed |
| 2 | missing/unknown root field, or wrong top type/container | `MALFORMED_REQUEST` | inspect present independent well-typed fields; suppress rules needing malformed/missing field |
| 3 | present string metric outside enum | `UNKNOWN_METRIC` | suppress mapping only; other independent rows continue |
| 4 | present string segment fails expression | `INVALID_SEGMENT` | other independent rows continue |
| 5 | present string aggregation outside enum or not mapped to known metric | `AGGREGATION_MISMATCH` | arithmetic suppressed; other independent rows continue |
| 6 | closed, structurally valid period has invalid date, reversed date, or overlapping/not-earlier baseline | `INVALID_PERIOD` | nested missing/unknown/wrong fields are row 2 `MALFORMED_REQUEST`; suppress only comparisons needing malformed period |
| 7 | structurally valid observation array is empty | `EMPTY_OBSERVATIONS` | inspect other array; no entries in empty array |
| 8 | structurally valid observation array exceeds 366 | `OBSERVATION_LIMIT_EXCEEDED` | inspect both supplied arrays without arithmetic |
| 9 | entry is non-number, non-finite, or outside request bounds | `NON_FINITE_OBSERVATION` | one code covers all entry defects; arithmetic suppressed |
| 10 | closed, structurally valid context fails duration, enum, ID, count, duplicate, or ordering rule | `INVALID_CONTEXT` | nested missing/unknown/wrong fields are row 2 `MALFORMED_REQUEST`; one code covers semantic context defects |
| 11 | no preceding code, but raw/rounded arithmetic is non-finite or out of output bounds | `NUMERIC_OVERFLOW` | stop; zero-baseline suppressed |
| 12 | no preceding code and rounded baseline is zero | `ZERO_BASELINE` | sole-code non-comparable; percentage suppressed |

Rows 1–10 may combine only in the listed order and produce the fixed invalid
variant. Rows 11–12 run only when rows 1–10 have no code. `ZERO_BASELINE` never
combines with invalid codes. This covers every root, closed field, period,
observation, context, and arithmetic condition without throwing.

## Human control, verification, and rollback

P2-001 is Tier 0 and non-authoritative. AI may later explain its prepared
output, never authorize a proposal or action. Production-impacting use remains
deterministic-policy and authenticated-human-approval gated. Malformed input,
future-adapter failure, or authority failure fails closed and does no action.

The exact validator command is:

```text
node tests/analytics/validate-deterministic-analytics-calculators-v1.mjs
```

It must test all table rules, variants, output bounds, rounding edges, repeated
never-throw behavior, authority replacement rejection, sole public API, and no
infrastructure imports. It also compiles both authorities through a
standards-compliant Draft 2020-12 validator, exercises canonical valid and
invalid requests, validates every generated result, rejects malformed result
variants, and proves each generated result matches exactly one declared
variant. A separate governance task must admit only this literal
with `shell: false`, fixed path argument, and near-miss rejection tests. P2-001
then needs independent Sol QA, machine evidence, final-head CI, and rollback of
only its product paths/state/evidence.

## Non-goals

No live data, database, network, credentials, guest data, audit-store query,
AI/provider call, executive report, ingestion, recommendation, policy decision,
approval, execution, scheduling, queue, notification, production write, SQL,
migration, RLS, payment, booking, or inventory behavior is part of V1.
