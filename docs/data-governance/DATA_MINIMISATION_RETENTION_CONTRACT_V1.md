# Data Minimisation and Retention Contract V1

## Purpose and authority

P2-006 is a static Tier-0 metadata-classification contract. Its committed
structural authority is
`schemas/data-minimisation-retention-contract-v1.schema.json`; its committed
finite semantic authority is
`policies/data-minimisation-retention-policy-v1.json`. The runtime-safe deep
module exposes only:

```js
classifyDataGovernanceCandidate(candidate)
```

The module loads both authorities internally. Ordinary callers cannot supply a
schema, policy, validator, retention configuration, adapter, or dependency.
Extra JavaScript arguments are ignored. Results are cloned, recursively frozen,
deterministic plain data, and malformed or hostile input never escapes an
exception.

Classification success is non-authoritative. It does not authorize collection,
persistence, an AI invocation, a lifecycle action, or a production write. It
does not establish compliance or prove that an operation occurred.

## Permanent data boundary

Raw page views, clicks, scrolls, and marketing telemetry remain managed by the
authoritative analytics source. Their only valid classification is
`source_system_only` with no queue, workflow, or AI intent and the candidate
action `retain_at_source`.

AI OS may classify only these metadata categories as future candidates:

- hourly and daily analytics aggregates;
- essential booking lifecycle events;
- anomalies and incidents;
- investigations and recommendations;
- intervention proposals;
- approvals, executions, and outcomes; and
- required audit evidence.

The candidate is a closed descriptor. It contains no payload, guest identity,
booking content, payment data, credential, prompt body, telemetry body, or
evidence body. No permanent AI OS row, queue message, workflow, or AI call may
be requested per guest interaction. AI invocation per individual system event
is also prohibited; scheduled summaries or governed cases are the only
classifiable AI/workflow shape.

## Finite mappings

The canonical policy fixes sixteen category rules. Raw telemetry maps only to
`analytics_source`, `source_system_managed`, `source_only`, and
`retain_at_source`. Hourly and daily aggregate categories use their matching
interval. Booking lifecycle metadata uses `booking_control_plane`; governed AI
OS records use `ai_os_control_plane`; required audit evidence uses
`repository_evidence` and `audit_evidence`.

The action vocabulary is only `retain_at_source`, `aggregate`,
`scheduled_delete`, `archive`, `transfer_eligible`, and `retain`. These are
candidate classifications, not commands. `aggregate` is restricted to the
hourly aggregate category. Required audit evidence may only classify as
`archive`, `transfer_eligible`, or `retain` while preserving the original and
failed-attempt history without rewrite.

Accepted decisions distinguish:

- `source_only` for raw telemetry;
- `future_lifecycle_candidate` for eligible semantic metadata; and
- `protected_preservation_only` for required audit evidence.

Every accepted decision sets `nonAuthoritative: true`,
`actionAuthorized: false`, and `productionWriteAuthorized: false`.

## Fail-closed behavior

Rejections contain de-duplicated reasons in the canonical 22-code precedence.
Internal-authority failure is singleton. Caller authority injection is checked
before ordinary candidate structure. Specific reasons cover malformed input,
unknown taxonomy values, raw-source boundary violations, prohibited workload
cardinality, interval/source/artifact/action mismatches, protected-history
conflicts, self-authorization, and production-write claims.

The deterministic contract command is:

```text
node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs
```

It compiles the committed Draft 2020-12 schema and policy, checks the exact
finite mappings and exclusive decision variants, validates all returned
decisions, exercises real boundary and authority-redirection paths, and inspects
the deep-module import boundary.

## Limits and downstream handoff

JSON Schema and metadata classification cannot prove payload minimisation,
aggregation correctness, source-system behavior, legal retention, retention
due state, archive or transfer preservation in an external system, or completed
lifecycle action. P2-006 includes no duration, clock, legal hold, jurisdiction,
storage location, or provider configuration.

A later separately approved lifecycle controller must obtain trusted facts and
an approved retention configuration, fail closed when authority is absent, and
independently preserve the P1-003 append-only contract and failed-attempt
history. P2-006 performs no data access, ingestion, aggregation, persistence,
queueing, workflow, AI invocation, deletion, archival, transfer, or production
operation.
