# P2-002 IntelligenceProvider Contracts V1 Design

## Decision and authority

P2-002 is a static provider-neutral contract boundary. It defines the data that
an application may send to an intelligence provider and the data that may come
back. It does not invoke a model, fetch evidence, generate an intervention
proposal, schedule work, authorize anything, execute anything, verify outcomes,
or persist an audit record.

The future product has exactly two closed JSON Schema Draft 2020-12 structural
authorities:

- `schemas/intelligence-provider-request-v1.schema.json`;
- `schemas/intelligence-provider-result-v1.schema.json`.

Every object in both schemas sets `additionalProperties: false`. One runtime-safe
deep module,
`packages/ai-analysis-contracts/src/intelligence-provider-contracts-v1.mjs`,
is the executable V1 semantic authority. It loads and compiles the committed
schemas internally and exposes exactly `validateIntelligenceRequest(input)` and
`validateIntelligenceResult(input, request)`. Callers and providers cannot
supply replacement schemas, validators, policies, configuration, capability
grants, approval state, or dependencies as authority.

## Deep-module and hexagonal boundary

The future outbound application port is intentionally small:

```text
IntelligenceProvider.analyze(request) -> result
```

The application core depends only on this port and the V1 contract module.
Provider SDKs, CLI process handling, authentication, timeouts, transport,
prompt construction, model parsing, retries, and provider-state detection are
private adapter responsibilities. Storage keys, database identifiers, URLs,
queue envelopes, credentials, and provider SDK objects never cross this port.

P4-004 will implement the provider-neutral gateway and committed-authority
validation. P4-005 and later provider tasks will implement adapters behind the
port. P2-004 will separately define `ProposalGenerator`. Orchestration, policy,
approval, execution, independent verification, and audit remain separate ports
and authorities. P2-002 implements contract validation only, not the
`IntelligenceProvider` port, gateway, or provider invocation.

P2-001-R02 establishes a deliberate assurance split: Draft 2020-12 validates
the committed calculator schemas structurally, while the P2-001 deep module
enforces documented semantic ordering that JSON Schema cannot express. A
`deterministic_analytics` evidence item may summarize a P2-001 result only after
that result was produced by the canonical `calculateMetricComparison(request)`
boundary and validated under the R02-assured structural-plus-semantic contract.
P2-002 does not accept a caller-supplied analytics schema, treat schema
acceptance alone as semantic proof, reorder correlation identifiers, recompute
metrics, reinterpret calculator reason codes, or import P2-001 validation
internals. The evidence digest and reference preserve provenance without
weakening that authority boundary. As in R02, JSON Schema proves structural
shape while the committed contract deep module enforces ordering,
cross-reference, classification, and variant semantics that Draft 2020-12 does
not express.

## Executable contract-module result

Both public validation functions are synchronous, total, side-effect free, and
never throw for any JavaScript input. They return a deeply frozen closed
decision with exactly `ok`, `value`, and `rejection`:

- valid: `{ok:true, value:<deeply frozen plain-data clone>, rejection:null}`;
- invalid: `{ok:false, value:null, rejection:<schema-valid rejected result>}`.

`validateIntelligenceRequest(input)` applies request structural and semantic
rules. `validateIntelligenceResult(input, request)` first validates `request`;
an invalid request returns its request rejection without inspecting or invoking
anything. For a valid request, it validates the result and all request/result
cross-references. A caller cannot mark a request as prevalidated or pass a
validator dependency. No input object is returned by reference or mutated.

Guarded plain-data cloning rejects accessors, proxies that throw, symbols,
functions, `bigint`, cycles, non-finite numbers, non-plain prototypes, and any
value that is not representable by the closed V1 schemas. Failure to load or
compile the internally committed schemas is captured once and makes both public
functions return `INTERNAL_AUTHORITY_UNAVAILABLE`; module import and calls do
not expose validation-library exceptions.

## Shared finite values

Identifiers use `^[a-z][a-z0-9-]{0,63}$`, except `requestId`, which uses
`^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`, and `taskId`, which uses
`^[A-Z][A-Z0-9-]{2,80}$`. Arrays are ordered, duplicate-free, and preserve the
caller or provider order unless a rule below states otherwise. Human-readable
strings are trimmed, contain no control characters other than line feed, and
have the stated Unicode-code-point bounds.

The only V1 purposes are `technical`, `operational`, `seo`, and `commercial`.
The only admitted data classifications are `public` and `internal`.
`confidential`, `restricted`, unknown, missing, or malformed classifications
fail closed before provider invocation. V1 never carries guest, payment,
booking, inventory, pricing-authority, credential, or secret data.

The exact analysis objective list is fixed in this order:

```json
[
  "explain_likely_causes",
  "rank_hypotheses",
  "select_intervention",
  "estimate_confidence"
]
```

The only advisory intervention selections are `no_action`,
`continue_monitoring`, `gather_more_evidence`, `prepare_recommendation`,
`prepare_draft`, `prepare_branch_or_pr`, and `escalate_to_human`. A selection is
analysis, not a proposal or permission to act.

## Closed request schema V1

The root requires exactly `schemaVersion`, `requestId`, `taskId`, `purpose`,
`analysisQuestion`, `dataClassification`, `analysisObjectives`,
`preparedEvidence`, and `allowedContext`.

| Field | Exact V1 rule |
| --- | --- |
| `schemaVersion` | constant `1.0.0` |
| `requestId` | request identifier expression above |
| `taskId` | task identifier expression above |
| `purpose` | one of the four V1 purposes |
| `analysisQuestion` | trimmed string, 1-1000 Unicode code points |
| `dataClassification` | `public` or `internal` |
| `analysisObjectives` | exactly the four values above in the stated order |
| `preparedEvidence` | 1-20 closed evidence items |
| `allowedContext` | the closed context object below |

Each prepared-evidence item requires exactly:

| Field | Exact V1 rule |
| --- | --- |
| `evidenceId` | identifier expression; unique in the request |
| `kind` | `deterministic_analytics`, `event_summary`, `audit_excerpt`, `technical_artifact`, `operational_summary`, `seo_measurement`, or `commercial_measurement` |
| `dataClassification` | `public` or `internal`; cannot exceed the request classification |
| `summary` | trimmed string, 1-500 Unicode code points |
| `facts` | 1-20 unique trimmed strings, each 1-500 Unicode code points |
| `integritySha256` | exactly 64 lowercase hexadecimal characters |

Classification ordering is `public < internal`. Therefore a `public` request
may contain only public evidence; an `internal` request may contain public or
internal evidence. Evidence is already prepared and embedded as bounded facts.
`evidenceId` and `integritySha256` provide correlation and integrity only; no
storage URI or retrieval capability is exposed.

`allowedContext` requires exactly:

| Field | Exact V1 rule |
| --- | --- |
| `affectedSystems` | 1-20 sorted unique identifiers |
| `metricIds` | 0-20 sorted unique identifiers |
| `locale` | `en` or `th` |
| `maxHypotheses` | integer 1-5 |
| `allowedInterventions` | 1-7 unique values from the intervention enum, in enum order |

The request contains no prompt, schema, validator, provider selection,
provider options, storage address, policy, approval, capability token, command,
or executable instruction.

## Closed result schema V1

The result is exactly one of four closed variants: `completed`,
`insufficient_evidence`, `rejected`, or `provider_unavailable`. Every variant
requires `schemaVersion: "1.0.0"`, `status`, `requestId`, `providerState`,
`providerIdentity`, `nonAuthoritative: true`, `failClosed`, `analysis`, and
`reasonCodes`.

`providerIdentity`, when non-null, is a closed object containing `providerId`
and `modelId`, each a trimmed string of 1-128 Unicode code points. These values are
attribution, not authority. They cannot alter validation, policy, approval, or
execution.

### Completed

`status` is `completed`; `requestId` is valid; `providerState` is `available`;
`providerIdentity` is non-null; `nonAuthoritative` is true; `failClosed` is
false; `reasonCodes` is empty; and `analysis` is the closed object below.

| Analysis field | Exact V1 rule |
| --- | --- |
| `explanation` | trimmed string, 1-2000 Unicode code points |
| `likelyCauses` | 1-5 closed cause objects |
| `rankedHypotheses` | 1 to request `maxHypotheses` closed hypothesis objects |
| `selectedIntervention` | closed intervention object |
| `confidence` | closed confidence object with band `low`, `medium`, or `high` |
| `evidenceCitations` | 1-20 unique request evidence IDs |
| `additionalEvidenceNeeded` | empty array |

A cause requires `causeId`, `statement` (1-500),
`supportingEvidenceIds` (1-20), and `counterEvidenceIds` (0-20). A hypothesis
requires `hypothesisId`, `rank`, `statement` (1-500),
`supportingEvidenceIds` (1-20), `counterEvidenceIds` (0-20), and
`confidenceScore` (finite JSON number 0-1). IDs within each collection are
unique. Ranks start at 1 and are contiguous; hypothesis confidence is
non-increasing by rank. Every cited evidence ID must occur in the request.

The selected intervention requires `kind`, `rationale` (1-1000), and
`supportingHypothesisIds` (1-5 unique IDs from the returned hypotheses). Its
kind must occur in the request's `allowedInterventions`.

Confidence requires `score` (finite JSON number 0-1), `band`, `basis`
(1-500), and `evidenceIds` (1-20 request evidence IDs). Bands map exactly:
`low` is `0 <= score < 0.5`, `medium` is `0.5 <= score < 0.8`, and `high`
is `0.8 <= score <= 1`. It is a provider estimate,
not statistical confidence, safety, truth, authorization, or approval.

### Insufficient evidence

`status` is `insufficient_evidence`; `requestId` is valid; `providerState` is
`available`; identity is non-null; `nonAuthoritative` and `failClosed` are true;
and `reasonCodes` is exactly `["INSUFFICIENT_EVIDENCE"]`. `analysis` uses the
same closed shape with these restrictions: `likelyCauses` and
`rankedHypotheses` are empty; `selectedIntervention` is exactly
`gather_more_evidence` with empty `supportingHypothesisIds`; confidence is
`{score:0, band:"insufficient", ...}`; `evidenceCitations` may contain 0-20
request evidence IDs; and `additionalEvidenceNeeded` contains 1-10 unique
trimmed strings of 1-500 Unicode code points. No alternative intervention is valid.

### Rejected

`status` is `rejected`; `requestId` is the valid request ID when safely
available, otherwise null; `providerState` and `providerIdentity` are null;
`nonAuthoritative` and `failClosed` are true; and `analysis` is null.
`reasonCodes` contains one or more unique codes in the precedence order below:

`MALFORMED_REQUEST`, `UNSUPPORTED_SCHEMA_VERSION`,
`UNSUPPORTED_DATA_CLASSIFICATION`, `UNSUPPORTED_PURPOSE`,
`INVALID_PREPARED_EVIDENCE`, `INVALID_ALLOWED_CONTEXT`,
`UNSUPPORTED_ANALYSIS_OBJECTIVES`, `MALFORMED_PROVIDER_RESULT`, and
`INTERNAL_AUTHORITY_UNAVAILABLE`.

### Provider unavailable

`status` is `provider_unavailable`; `requestId` is valid; identity is either
null or a closed attribution object; `nonAuthoritative` and `failClosed` are
true; and `analysis` is null. `providerState` is exactly one non-available state
and `reasonCodes` is exactly its corresponding singleton:

| Provider state | Reason code |
| --- | --- |
| `busy` | `PROVIDER_BUSY` |
| `rate_limited` | `PROVIDER_RATE_LIMITED` |
| `capacity_exhausted` | `PROVIDER_CAPACITY_EXHAUSTED` |
| `authentication_required` | `PROVIDER_AUTHENTICATION_REQUIRED` |
| `temporarily_unavailable` | `PROVIDER_TEMPORARILY_UNAVAILABLE` |
| `disabled` | `PROVIDER_DISABLED` |

The seventh provider state, `available`, is valid only for `completed` or
`insufficient_evidence`. No unknown or uncertain provider signal maps to
`available`; adapters must conservatively map it to
`temporarily_unavailable` or `disabled` under their later approved packet.

## Deterministic validation and precedence

All validation is total and must never throw. A future gateway constructs the
closed `rejected` result when request or provider output validation fails. It
evaluates request failures in this order, adds at most one copy of each code,
and suppresses checks that depend on a missing or malformed parent:

1. Non-object root, missing or unknown property, wrong container/type, or a
   malformed nested object: `MALFORMED_REQUEST`.
2. Present string schema version other than `1.0.0`:
   `UNSUPPORTED_SCHEMA_VERSION`.
3. Present string classification outside the V1 enum:
   `UNSUPPORTED_DATA_CLASSIFICATION`.
4. Present string purpose outside the V1 enum: `UNSUPPORTED_PURPOSE`.
5. Structurally complete evidence violating count, ID, uniqueness, order,
   string, digest, fact, or classification rules: `INVALID_PREPARED_EVIDENCE`.
6. Structurally complete context violating its bounds, IDs, order,
   uniqueness, locale, maximum, or intervention rules:
   `INVALID_ALLOWED_CONTEXT`.
7. Structurally complete objectives other than the exact fixed list:
   `UNSUPPORTED_ANALYSIS_OBJECTIVES`.

If any request code exists, provider invocation is forbidden. Rows 1-7 may
combine only in order. Provider output is then checked as one complete variant,
followed by cross-reference, rank, confidence, intervention, provider-state,
and reason-code consistency. Any defect becomes a closed `rejected` result with
exactly `["MALFORMED_PROVIDER_RESULT"]`; provider text is not partially trusted.
Failure to load or execute committed schema authority becomes exactly
`["INTERNAL_AUTHORITY_UNAVAILABLE"]`. These two codes never combine with other
codes or with a provider-unavailable result.

Malformed input of every JSON type, throwing proxies/getters, cycles, invalid
numbers, and repeated calls must return a schema-valid deterministic rejection
rather than throw. A JSON Schema validator cannot receive cycles or throwing
objects safely; the implementation must normalize through a guarded plain-data
boundary before schema validation and reject normalization failure.

## Human control, verification, and rollback

P2-002 is Tier 0 and non-authoritative. Analysis may investigate, explain,
rank, recommend a non-executing next step, and estimate confidence. It may not
approve or authorize itself, grant capabilities, issue commands, mutate state,
or claim verification. P1-005 policy evaluation and authenticated human
approval remain mandatory wherever later work could affect architecture,
security, production, payments, inventory, pricing, databases, RLS, or perform
destructive action. Missing authority, malformed input, unsupported
classification, unsupported configuration, invalid provider output, or an
unavailable provider always fails closed.

The exact validator command is:

```text
node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs
```

It must load both committed schemas and the committed contract module, compile
the schemas against Draft 2020-12, and test every variant and finite enum, all
bounds and cross-reference rules, exact provider-state/reason mappings,
classification ordering, authority replacement and self-authorization
rejection, frozen cloned decisions, malformed and adversarial never-throw
cases, and the absence of infrastructure/provider/runtime imports. A separate
governance task must admit only this
literal using `shell: false`, one fixed path argument, and near-miss rejection
coverage. P2-002 then requires independent Sol QA, machine evidence,
final-head CI, and rollback of only its product paths, state, and evidence.

## Non-goals

No provider SDK, model invocation, prompt, gateway, adapter, subscription
authentication, fallback selection, live evidence retrieval, database,
filesystem, network, environment, clock, queue, scheduler, workflow, proposal,
policy decision, approval, capability grant, executor, verification provider,
audit persistence, UI, notification, production write, SQL, migration, RLS,
payment, booking, inventory, pricing, guest data, secret, or credential behavior
is part of V1.
