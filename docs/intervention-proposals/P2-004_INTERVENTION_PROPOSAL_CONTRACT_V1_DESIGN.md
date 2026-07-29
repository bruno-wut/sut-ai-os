# P2-004 Intervention Proposal Contract V1 Design

## Decision and authority

P2-004 is a static Tier-0 contract boundary. It converts one canonically
validated P2-002 intelligence result into a bounded proposal for later policy,
risk, and human-approval evaluation. A proposal is advice. It is never an
authorization, approval, capability grant, executable task, verification
result, production-eligibility decision, or audit source of truth.

The future product has one closed JSON Schema Draft 2020-12 structural
authority:

- `schemas/intervention-proposal-contract-v1.schema.json`.

Every object in the schema sets `additionalProperties: false`. One runtime-safe
deep module,
`packages/intervention-proposal-contracts/src/intervention-proposal-contract-v1.mjs`,
loads and compiles that committed schema internally and exposes exactly:

```text
validateInterventionProposal(proposal, intelligenceRequest, intelligenceResult)
```

The three arguments are untrusted plain data, not authority. The module uses
the public P2-002 validation boundary to validate the request and result before
it evaluates proposal provenance. It accepts no caller-supplied schema,
validator, policy, capability registry, approval, configuration, clock, digest,
or dependency. There is no public dependency-injection interface.

The conceptual application port remains small:

```text
ProposalGenerator.generate({intelligenceRequest, intelligenceResult}) -> proposal
```

P2-004 implements only the proposal schema and its deterministic validation
module, not a generator or adapter. A future generator may sit behind that
port, but its output must pass the committed P2-004 authority.

## Deep-module and hexagonal boundary

The contract core is synchronous, side-effect free, and depends inward only on
the committed proposal authority and the public P2-002 contract boundary. It
contains no provider SDK, prompt, transport, HTTP, CLI, filesystem, database,
object storage, queue, workflow, scheduler, policy evaluator, approval service,
executor, verification provider, audit store, notification service,
environment, credential, or network import. Provider and infrastructure
behavior belongs in later adapters.

`ProposalGenerator` cannot become an `IntelligenceProvider`, policy engine,
approval authority, `ExecutorAdapter`, `VerificationProvider`, or audit source.
It does not retain P2-002 input, produce workflow state, or invoke AI. Core
callers see only the stable validator result and never Ajv, schema internals,
provider objects, storage details, or infrastructure configuration.

## Executable validator result

The public function is total and never throws for any JavaScript input. It
returns a deeply frozen closed decision with exactly `ok`, `value`, and
`rejection`:

- valid: `{ok:true, value:<deeply frozen plain-data clone>, rejection:null}`;
- invalid: `{ok:false, value:null, rejection:{schemaVersion:"1.0.0", failClosed:true, reasonCodes:[...]}}`.

No input object is returned by reference or mutated. Guarded plain-data cloning
rejects accessors, throwing proxies, symbols, functions, `bigint`, cycles,
non-finite numbers, non-plain prototypes, and any value outside the closed V1
schema before schema validation. Module-load or schema-compilation failure is
captured and every call returns only `INTERNAL_AUTHORITY_UNAVAILABLE`.

## Shared finite values

`proposalId` uses `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`; `taskId` uses
`^[A-Z][A-Z0-9-]{2,80}$`; other identifiers use
`^[a-z][a-z0-9-]{0,63}$`. Human-readable strings are trimmed, contain no
control characters other than line feed, and use the stated Unicode-code-point
bounds. Arrays preserve declared order, contain no duplicates under their
documented identity, and remain bounded.

The only outcomes, in precedence order, are:

```json
[
  "no_action",
  "gather_more_evidence",
  "recommendation",
  "prepare_draft",
  "prepare_branch_or_pr",
  "escalate_to_human"
]
```

The only requested capabilities are `analytics_read`, `repository_read`,
`repository_write`, `content_draft`, `branch_create`, `pull_request_create`,
and `staff_notification`. These are requests for later evaluation, never
grants. They do not carry paths, commands, tokens, credentials, URLs, provider
configuration, or executable parameters.

The only risk classifications are `low`, `medium`, `high`, and `critical`.
The only approval classes are `none` and `human_review`. Later deterministic
policy may deny or require a more specialized approval; V1 cannot weaken that
authority.

## Closed proposal schema V1

The root requires exactly `schemaVersion`, `proposalId`, `taskId`,
`sourceIntelligence`, `outcome`, `diagnosis`, `evidenceReferences`,
`confidence`, `recommendedAction`, `alternatives`, `affectedSystems`,
`requestedCapabilities`, `riskClassification`, `approvalRequirement`,
`verificationPlan`, `rollbackPlan`, `expectedOutcome`, and `authority`.

| Field | Exact V1 structural rule |
| --- | --- |
| `schemaVersion` | constant `1.0.0` |
| `proposalId` | proposal identifier expression above |
| `taskId` | task identifier expression above |
| `sourceIntelligence` | exactly `requestId` and `status`; status is `completed` or `insufficient_evidence` |
| `outcome` | one value from the ordered outcome enum |
| `diagnosis` | closed object described below |
| `evidenceReferences` | 0-20 unique identifiers |
| `confidence` | closed object described below |
| `recommendedAction` | closed object described below |
| `alternatives` | 0-5 closed alternative objects |
| `affectedSystems` | 1-20 sorted unique identifiers |
| `requestedCapabilities` | 0-7 unique capability values in enum order |
| `riskClassification` | one of the four V1 values |
| `approvalRequirement` | closed object described below |
| `verificationPlan` | closed object described below |
| `rollbackPlan` | closed object described below |
| `expectedOutcome` | closed object described below |
| `authority` | exact immutable non-authority posture described below |

`diagnosis` requires exactly `summary` (1-2000 code points), `causeIds`
(0-5 identifiers), and `hypothesisIds` (0-5 identifiers).

`confidence` requires exactly `score` (finite JSON number 0-1), `band`
(`insufficient`, `low`, `medium`, or `high`), and `basis` (1-500 code points).

`recommendedAction` requires exactly `kind` (the outcome enum), `description`
(1-1000), `rationale` (1-1000), and `executionAuthorized: false`.

Each alternative requires exactly `alternativeId`, `description` (1-1000),
and `tradeoff` (1-1000). Alternative IDs are unique.

`approvalRequirement` requires exactly `required`, `approvalClass`, and
`reason` (1-500). `approvalClass` is `none` only when `required` is false and
is `human_review` only when it is true. This is an advisory requirement, not
an approval record.

`verificationPlan` requires exactly `independentReviewRequired: true`,
`checks` (1-10 unique strings of 1-500), and `successCriteria` (1-10 unique
strings of 1-500). It describes future verification; it does not claim that
verification occurred.

`rollbackPlan` requires exactly `required`, `trigger`, and `steps`. `trigger`
is null or a 1-500 string; `steps` contains 0-10 unique strings of 1-500.

`expectedOutcome` requires exactly `summary` (1-1000), `measurableSignals`
(1-10 unique strings of 1-500), and `observationWindow` (1-200).

`authority` is structurally fixed to exactly:

```json
{
  "nonAuthoritative": true,
  "approved": false,
  "authorized": false,
  "executed": false,
  "independentlyVerified": false,
  "productionEligible": false
}
```

The schema contains no command, executable payload, target path, environment,
endpoint, credential, capability grant, policy result, approval identity,
verification result, audit-record identity, retention instruction, workflow
state, or provider selection.

## Provenance and cross-field semantics

The validator first obtains a valid P2-002 request/result pair through the
canonical P2-002 public boundary. `rejected` and `provider_unavailable` results
cannot produce a V1 proposal. A source-authority failure returns fail closed and
does not inspect proposal content.

For an otherwise structurally valid proposal:

1. `taskId` and `sourceIntelligence.requestId/status` must exactly match the
   canonical request/result pair.
2. `evidenceReferences` must exactly equal the source analysis
   `evidenceCitations`, in source order. Each reference therefore resolves to
   prepared evidence already validated by P2-002.
3. `diagnosis.causeIds` and `diagnosis.hypothesisIds` must be ordered unique
   subsets of source cause/hypothesis IDs. A `completed` source requires at
   least one hypothesis ID; an `insufficient_evidence` source requires both
   arrays empty.
4. Proposal confidence score and band must exactly equal the source confidence.
   The basis may summarize it but cannot raise or relabel it.
5. `affectedSystems` must be a sorted unique non-empty subset of the source
   request's allowed affected systems.
6. The proposal outcome and recommended-action kind must match each other and
   map exactly from the source selected intervention:

| Source selected intervention | Required proposal outcome |
| --- | --- |
| `no_action`, `continue_monitoring` | `no_action` |
| `gather_more_evidence` | `gather_more_evidence` |
| `prepare_recommendation` | `recommendation` |
| `prepare_draft` | `prepare_draft` |
| `prepare_branch_or_pr` | `prepare_branch_or_pr` |
| `escalate_to_human` | `escalate_to_human` |

7. An `insufficient_evidence` source maps only to `gather_more_evidence`.
8. `no_action` and `gather_more_evidence` require no requested capabilities,
   `approvalRequirement.required: false`, `approvalClass: none`, and a rollback
   plan with `required: false`, `trigger: null`, and no steps.
9. `recommendation`, `prepare_draft`, `prepare_branch_or_pr`, and
   `escalate_to_human` require human review. Any non-empty requested-capability
   list also requires human review.
10. `prepare_draft` may request only `repository_read`, `repository_write`, or
    `content_draft`; `prepare_branch_or_pr` must request `repository_read`,
    `repository_write`, `branch_create`, and `pull_request_create` in that
    order; `escalate_to_human` may request only `staff_notification`;
    `recommendation` requests none.
11. `prepare_draft` and `prepare_branch_or_pr` require a rollback plan with a
    non-null trigger and at least one step. Other outcomes require the closed
    no-rollback form because they describe no prepared mutation.
12. `critical` risk maps only to `escalate_to_human`; `high` or `critical` risk
    always requires human review. No risk value can lower later policy or
    approval requirements.

Text is treated as inert data. The validator does not interpret a sentence as
an instruction or derive authority from it.

## Deterministic failure precedence

All validation is total. One reason code is returned, except where the finite
structural pass records independent proposal-field defects in the exact order
below. Codes are unique and precedence ordered:

1. `INTERNAL_AUTHORITY_UNAVAILABLE` is exclusive for unavailable committed
   schema or P2-002 validation authority.
2. `INVALID_SOURCE_INTELLIGENCE` is exclusive for an invalid request/result
   pair or an ineligible source status.
3. `MALFORMED_PROPOSAL` covers a non-object root, unsafe plain-data boundary,
   missing/unknown property, wrong container/type, or malformed nested object.
4. `UNSUPPORTED_SCHEMA_VERSION` covers a present string version other than
   `1.0.0`.
5. Finite field codes follow schema order:
   `UNSUPPORTED_OUTCOME`, `INVALID_DIAGNOSIS`,
   `INVALID_EVIDENCE_REFERENCES`, `INVALID_CONFIDENCE`,
   `INVALID_RECOMMENDED_ACTION`, `INVALID_ALTERNATIVES`,
   `INVALID_AFFECTED_SYSTEMS`, `UNKNOWN_REQUESTED_CAPABILITY`,
   `UNSUPPORTED_RISK_CLASSIFICATION`, `INVALID_APPROVAL_REQUIREMENT`,
   `INVALID_VERIFICATION_PLAN`, `INVALID_ROLLBACK_PLAN`, and
   `INVALID_EXPECTED_OUTCOME`.
6. `SELF_AUTHORIZATION_CLAIM` covers any authority flag or action claim that is
   not the exact non-authoritative V1 value.
7. `INVALID_PROVENANCE` covers a source ID, citation, cause, hypothesis,
   confidence, affected-system, or task cross-reference mismatch.
8. `CROSS_FIELD_INCONSISTENCY` covers outcome mapping, capability, approval,
   rollback, or risk inconsistency after all dependent fields are valid.

Checks depending on a malformed parent are suppressed. Structural field codes
may combine only in the order above. `SELF_AUTHORIZATION_CLAIM`,
`INVALID_PROVENANCE`, and `CROSS_FIELD_INCONSISTENCY` are each singleton after
the structural pass. Repeated calls with equivalent plain data return the same
decision and do not depend on object-key order, time, locale, provider, or
environment.

## Verification

The exact future validator command is:

```text
node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs
```

It must load the committed schema and module; compile the schema using Ajv 2020;
validate canonical instances; reject malformed variants; prove every finite
enum, bound, outcome mapping, capability rule, approval rule, rollback rule,
provenance reference, and reason-code precedence; exercise every P2-002
eligible/ineligible source status; reject self-approval, authorization,
execution, verification, and production claims; prove caller authority cannot
be injected; test frozen cloned decisions and hostile never-throw inputs; and
inspect imports for the deep-module and hexagonal boundary.

A separate GOV-045 task must admit only that byte-for-byte command. It maps to
`node` with one fixed repository-relative path argument through the existing
`shell: false` runner and must reject whitespace, extra-argument, shell,
redirect, substitution, alternate-path, dot-path, traversal, and Windows-path
near misses. P2-004 cannot activate until GOV-044 and GOV-045 are done.

Independent Sol QA must inspect the complete diff, execute the admitted
validator and fast checks, record task-specific machine evidence, and confirm
final-head CI before merge.

## Non-goals and rollback

P2-004 does not generate a proposal, invoke AI, retrieve or retain evidence,
store prompts or outputs, create a database row, queue or schedule work, manage
retention, evaluate policy, request or record an approval, grant a capability,
issue a command, create a branch or pull request, execute a change, verify an
outcome, write audit state, notify staff, access a network or provider, or touch
production, booking, payment, inventory, pricing, guest data, credentials, SQL,
migrations, or RLS.

Rollback removes only the P2-004 schema, module, validator, documentation,
task-state change, and P2-004 evidence. It preserves P2-002 authorities and
evidence, GOV-044/GOV-045 history, all terminal records, and external systems.
