# Intervention Proposal Contract V1

## Purpose and authority

P2-004 defines a static Tier-0 boundary for turning one validated P2-002
intelligence result into a reviewable proposal. The committed structural
authority is
`schemas/intervention-proposal-contract-v1.schema.json`. The committed
semantic authority is the private-authority deep module at
`packages/intervention-proposal-contracts/src/intervention-proposal-contract-v1.mjs`.

A proposal is advice. It never authorizes itself or another action, grants a
capability, records approval, proves verification, establishes production
eligibility, or becomes an audit source of truth.

## Stable public boundary

The module exposes exactly one synchronous function:

```js
validateInterventionProposal(proposal, intelligenceRequest, intelligenceResult)
```

All three arguments are untrusted plain data. Callers cannot supply a schema,
validator, capability registry, policy, approval, provider, configuration, or
other replacement authority. The module loads the committed V1 schema
internally and uses only P2-002's public `validateIntelligenceRequest` and
`validateIntelligenceResult` boundary for source validation.

The result is a deeply frozen, closed plain-data decision:

```json
{"ok":true,"value":"<detached frozen proposal clone>","rejection":null}
```

or:

```json
{
  "ok": false,
  "value": null,
  "rejection": {
    "schemaVersion": "1.0.0",
    "failClosed": true,
    "reasonCodes": ["MALFORMED_PROPOSAL"]
  }
}
```

The function does not mutate or return an input by reference and never throws
for malformed JavaScript input. Unsafe values such as accessors, proxies,
symbols, functions, `bigint`, cycles, non-finite numbers, and non-plain
objects fail closed.

## Finite proposal

Every schema object is closed. The proposal contains the exact V1 fields for
source identity, diagnosis, evidence references, confidence, recommended
action, alternatives, affected systems, capability requests, risk, advisory
approval requirement, future verification and rollback plans, expected
outcome, and the immutable non-authority posture.

The finite outcomes are:

1. `no_action`
2. `gather_more_evidence`
3. `recommendation`
4. `prepare_draft`
5. `prepare_branch_or_pr`
6. `escalate_to_human`

The finite capability requests are `analytics_read`, `repository_read`,
`repository_write`, `content_draft`, `branch_create`,
`pull_request_create`, and `staff_notification`. They are requests for later
policy and approval evaluation, not capability grants. They contain no paths,
commands, credentials, URLs, provider configuration, or executable payload.

The risk values are `low`, `medium`, `high`, and `critical`. The advisory
approval classes are `none` and `human_review`. Later policy may deny a
proposal or require stronger approval; V1 cannot weaken that authority.

## Provenance and semantic rules

The source request and result must first pass the canonical P2-002 boundary.
Only `completed` and `insufficient_evidence` results are eligible. Rejected,
provider-unavailable, malformed, or authority-unavailable sources fail closed
before proposal content is considered.

For an eligible source:

- task, request, and result status must match exactly;
- evidence references must equal the source citations in source order;
- cause and hypothesis IDs must be ordered subsets of source IDs;
- a completed result requires a source hypothesis, while an insufficient result
  permits neither cause nor hypothesis claims;
- confidence score and band must equal the source values;
- affected systems must be a sorted non-empty subset of the request authority;
- outcome and recommended-action kind must match the selected intervention;
- no-action and evidence-gathering proposals request no capability, approval,
  or rollback;
- recommendations request no capability and require human review;
- draft preparation may request only repository read/write or content draft;
- branch/PR preparation requests exactly repository read, repository write,
  branch create, and pull-request create in that order;
- human escalation may request only staff notification;
- draft and branch/PR preparation require a bounded rollback plan; and
- critical risk is valid only for human escalation, while high and critical
  risk always require human review.

The authority block is always:

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

Text remains inert data. The validator never interprets prose as an instruction
or derives authority from it.

## Deterministic rejection precedence

`INTERNAL_AUTHORITY_UNAVAILABLE` and `INVALID_SOURCE_INTELLIGENCE` are
exclusive and precede proposal inspection. Unsafe or incomplete proposal shape
returns `MALFORMED_PROPOSAL`; a present unsupported string version returns
`UNSUPPORTED_SCHEMA_VERSION`.

Independent finite field defects may combine in this exact order:

```text
UNSUPPORTED_OUTCOME
INVALID_DIAGNOSIS
INVALID_EVIDENCE_REFERENCES
INVALID_CONFIDENCE
INVALID_RECOMMENDED_ACTION
INVALID_ALTERNATIVES
INVALID_AFFECTED_SYSTEMS
UNKNOWN_REQUESTED_CAPABILITY
UNSUPPORTED_RISK_CLASSIFICATION
INVALID_APPROVAL_REQUIREMENT
INVALID_VERIFICATION_PLAN
INVALID_ROLLBACK_PLAN
INVALID_EXPECTED_OUTCOME
```

After the structural pass, authority/action claims return the singleton
`SELF_AUTHORIZATION_CLAIM`, source cross-reference mismatch returns the
singleton `INVALID_PROVENANCE`, and outcome/capability/approval/risk/rollback
mismatch returns the singleton `CROSS_FIELD_INCONSISTENCY`.

## Architecture and non-goals

This module is a small application boundary. It imports no provider, transport,
database, filesystem, queue, workflow, scheduler, policy, approval, executor,
verification, audit, notification, credential, clock, environment, or network
authority. A future `ProposalGenerator` may produce untrusted proposal data
behind a provider-neutral port; it is not implemented here.

P2-004 does not invoke AI, generate or retain content, persist data, schedule
work, evaluate policy, request or record approval, grant capabilities, execute
commands, create branches or pull requests, notify staff, verify outcomes, or
touch production, booking, payment, inventory, pricing, guest data, SQL,
migrations, credentials, or RLS.

## Deterministic verification

Run the separately admitted exact command:

```text
node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs
```

It compiles the committed Draft 2020-12 schema, exercises the finite contract,
provenance and exploit boundaries, inspects imports, and proves total,
fail-closed, cloned, deeply frozen decisions. Independent Sol QA remains the
completion authority.
