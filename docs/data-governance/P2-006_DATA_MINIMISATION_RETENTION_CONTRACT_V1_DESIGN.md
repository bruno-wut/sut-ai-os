# P2-006 Data Minimisation and Retention Contract V1 Design

## Decision, authority, and scope

P2-006 is a static Tier-0 classification contract. It defines which data
categories may cross into AI OS, the only aggregate intervals accepted in V1,
the prohibited interaction-level workload shapes, and which retention actions
may be considered by a future lifecycle controller. It performs no ingestion,
aggregation, persistence, queueing, workflow start, AI invocation, deletion,
archival, transfer, or production operation.

The future implementation has one closed JSON Schema Draft 2020-12 structural
authority:

- `schemas/data-minimisation-retention-contract-v1.schema.json`.

It has one committed canonical finite policy:

- `policies/data-minimisation-retention-policy-v1.json`.

One runtime-safe deep module,
`packages/data-governance-contracts/src/data-minimisation-retention-contract-v1.mjs`,
loads and compiles both committed authorities internally and exports exactly:

```text
classifyDataGovernanceCandidate(candidate)
```

The candidate is untrusted metadata, never authority. The public function
accepts no schema, policy, retention configuration, clock, provider, adapter,
storage client, queue, workflow, filesystem, environment, credential, or
dependency injection. Extra JavaScript arguments are ignored. A successful
result means only that the descriptor is a structurally valid candidate under
the committed V1 taxonomy. It is not data-quality proof, legal advice,
retention-due proof, authorization, approval, persistence permission, lifecycle
instruction, production-write permission, or evidence that an operation ran.

The schema root describes the canonical policy and requires exactly these
fields. The committed artifact presents them in this order; object-property
order is not a JSON Schema semantic:

1. `schemaVersion`, exact `1.0.0`;
2. `policyId`, exact `data-minimisation-retention-policy-v1`;
3. `rawSourceOnlyCategories`, the four-item ordered array below;
4. `aiOsEligibleCategories`, the twelve-item ordered array below;
5. `artifactClasses`, the ten-item ordered array below;
6. `aggregationIntervals`, exact ordered array `source_only`, `hourly`,
   `daily`, `not_applicable`;
7. `actionCandidates`, the six-item ordered array below;
8. `categoryRules`, sixteen closed rules in category order containing the exact
   source, artifact, interval, storage, action, and eligibility mappings;
9. `workloadRules`, the six closed booleans below;
10. `retentionRules`, the closed non-authority object below;
11. `reasonPrecedence`, the ordered 22-code array below; and
12. `authority`, the closed six-field non-authority object below.

`workloadRules` fixes
`perInteractionPermanentRowAllowed: false`,
`perInteractionQueueAllowed: false`,
`perInteractionWorkflowAllowed: false`,
`perInteractionAiInvocationAllowed: false`,
`perSystemEventAiInvocationAllowed: false`, and
`scheduledSummaryOrGovernedCaseOnly: true`.

`retentionRules` fixes
`eligibilityMode: future_lifecycle_candidate_only`,
`configuredDurationIncluded: false`, `dueStateEvaluated: false`,
`legalComplianceEstablished: false`, and protected-history actions exactly
`["archive", "transfer_eligible", "retain"]`.

`authority` fixes `nonAuthoritative: true` and
`classificationAuthorizesPersistence: false`,
`classificationAuthorizesLifecycleAction: false`,
`classificationAuthorizesAiInvocation: false`,
`classificationEstablishesCompliance: false`, and
`productionWriteGranted: false`.

## Data boundary

Raw interaction telemetry remains in its authoritative analytics source. The
four source-only categories are fixed in this order:

1. `raw_page_view`
2. `raw_click`
3. `raw_scroll`
4. `raw_marketing_telemetry`

For those categories the only valid descriptor uses
`source_system_managed`, `source_system_only`, `not_applicable`, and
`retain_at_source`. It has no AI OS persistence, queue, workflow, or AI
invocation intent. Source-system retention remains the source system's concern;
P2-006 does not configure or execute it.

The only AI-OS-eligible semantic categories are fixed in this order:

1. `hourly_analytics_aggregate`
2. `daily_analytics_aggregate`
3. `essential_booking_lifecycle_event`
4. `anomaly`
5. `incident`
6. `investigation`
7. `recommendation`
8. `intervention_proposal`
9. `approval`
10. `execution`
11. `outcome`
12. `required_audit_evidence`

Eligibility is taxonomy only. It does not authorize collecting the underlying
data, and the descriptor contains no payload, guest identifier, booking data,
credential, prompt body, or evidence body. A downstream domain contract must
separately establish payload semantics, minimisation, authorization, and source
facts.

## Closed candidate shape

The schema `$defs.dataGovernanceCandidate` is a closed object with exactly
these required fields:

| Field | V1 meaning |
| --- | --- |
| `schemaVersion` | Exact `1.0.0`. |
| `candidateId` | `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`. |
| `dataCategory` | One of the sixteen categories above. |
| `sourceClass` | `analytics_source`, `booking_control_plane`, `ai_os_control_plane`, or `repository_evidence`. |
| `artifactClass` | One of the ten classes below. |
| `aggregationInterval` | `source_only`, `hourly`, `daily`, or `not_applicable`. |
| `requestedAction` | One of the six non-authoritative action candidates below. |
| `handlingIntent` | Closed workload/cardinality object below. |
| `historyProtection` | Closed append-only/failed-history object below. |
| `authorityClaims` | Closed object whose five fields must all be `false`. |

Every object in the schema sets `additionalProperties: false`. Arrays use
finite enums, bounds, and uniqueness where applicable. The candidate has no
free-form data or payload field.

### Handling intent

`handlingIntent` requires exactly:

- `storage`: `source_system_only`, `temporary_ai_os`, or `durable_ai_os`;
- `queue`: `none`, `batched_aggregate_or_lifecycle`, or
  `individual_guest_interaction`;
- `workflow`: `none`, `scheduled_summary_or_governed_case`, or
  `individual_guest_interaction`;
- `aiInvocation`: `none`, `scheduled_summary_or_governed_case`,
  `individual_guest_interaction`, or `individual_system_event`;
- `onePermanentRowPerInteraction`: boolean.

`individual_guest_interaction`, `individual_system_event`, and a true
`onePermanentRowPerInteraction` are rejection shapes, not eligible work. The
schema accepts these finite negative values so the semantic module can return a
specific deterministic reason rather than treating them as unknown syntax.

### History protection

`historyProtection` requires exactly:

- `kind`: `none`, `append_only_audit`, or `failed_attempt_history`;
- `originalRecordPreserved`: boolean;
- `failedAttemptHistoryPreserved`: boolean;
- `rewriteRequested`: boolean.

`required_audit_evidence` requires artifact class `audit_evidence`, protection
kind `append_only_audit` or `failed_attempt_history`, both preservation flags
true, and `rewriteRequested: false`. Other categories require `kind: none`,
both preservation flags true, and `rewriteRequested: false`; those true flags
assert that the requested classification does not weaken separately governed
history. P2-006 does not reinterpret or modify the P1-003 append-only contract.

### Authority claims

`authorityClaims` requires exactly:

- `callerSuppliesAuthority: false`;
- `classificationAuthorizesPersistence: false`;
- `classificationAuthorizesLifecycleAction: false`;
- `classificationAuthorizesAiInvocation: false`;
- `productionWriteGranted: false`.

The module also pre-scans these claims before ordinary structural validation so
an attempted authority injection cannot be hidden behind another malformed
field.

## Canonical category mappings

The committed policy fixes these source, artifact, interval, storage, and
action combinations. Comma-separated artifact or action entries are finite
sets, not caller configuration.

| Data category | Source | Allowed artifact class | Interval | Storage | Eligible action candidates |
| --- | --- | --- | --- | --- | --- |
| `raw_page_view` | `analytics_source` | `source_system_managed` | `source_only` | `source_system_only` | `retain_at_source` |
| `raw_click` | `analytics_source` | `source_system_managed` | `source_only` | `source_system_only` | `retain_at_source` |
| `raw_scroll` | `analytics_source` | `source_system_managed` | `source_only` | `source_system_only` | `retain_at_source` |
| `raw_marketing_telemetry` | `analytics_source` | `source_system_managed` | `source_only` | `source_system_only` | `retain_at_source` |
| `hourly_analytics_aggregate` | `analytics_source` | `temporary_ingestion_record`, `analytics_aggregate` | `hourly` | temporary or durable AI OS | `aggregate`, `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `daily_analytics_aggregate` | `analytics_source` | `temporary_ingestion_record`, `analytics_aggregate` | `daily` | temporary or durable AI OS | `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `essential_booking_lifecycle_event` | `booking_control_plane` | `temporary_ingestion_record`, `booking_lifecycle_record` | `not_applicable` | temporary or durable AI OS | `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `anomaly` | `ai_os_control_plane` | `debug_log`, `incident_record` | `not_applicable` | temporary or durable AI OS | `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `incident` | `ai_os_control_plane` | `debug_log`, `incident_record` | `not_applicable` | temporary or durable AI OS | `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `investigation` | `ai_os_control_plane` | `ai_prompt`, `ai_output` | `not_applicable` | temporary or durable AI OS | `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `recommendation` | `ai_os_control_plane` | `ai_prompt`, `ai_output` | `not_applicable` | temporary or durable AI OS | `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `intervention_proposal` | `ai_os_control_plane` | `ai_prompt`, `ai_output` | `not_applicable` | temporary or durable AI OS | `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `approval` | `ai_os_control_plane` | `workflow_execution_detail` | `not_applicable` | temporary or durable AI OS | `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `execution` | `ai_os_control_plane` | `workflow_execution_detail` | `not_applicable` | temporary or durable AI OS | `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `outcome` | `ai_os_control_plane` | `workflow_execution_detail` | `not_applicable` | temporary or durable AI OS | `scheduled_delete`, `archive`, `transfer_eligible`, `retain` |
| `required_audit_evidence` | `repository_evidence` | `audit_evidence` | `not_applicable` | `durable_ai_os` | `archive`, `transfer_eligible`, `retain` |

The ten artifact/retention classes are therefore:

1. `source_system_managed`
2. `temporary_ingestion_record`
3. `debug_log`
4. `ai_prompt`
5. `ai_output`
6. `workflow_execution_detail`
7. `analytics_aggregate`
8. `booking_lifecycle_record`
9. `incident_record`
10. `audit_evidence`

The six requested-action values are:

1. `retain_at_source`
2. `aggregate`
3. `scheduled_delete`
4. `archive`
5. `transfer_eligible`
6. `retain`

`aggregate` is eligible only for an hourly aggregate or a temporary ingestion
record whose semantic category is `hourly_analytics_aggregate`. Daily
aggregates, lifecycle events, governed records, audit evidence, and failed
attempt history cannot be reclassified as aggregate candidates. `archive` and
`transfer_eligible` mean only that a future controller may evaluate an
unchanged, protected record; neither action may rewrite or delete protected
history.

No duration, due date, legal hold, jurisdictional rule, storage location, or
provider appears in V1. The canonical policy marks lifecycle actions as
`future_lifecycle_candidate_only`. A future approved retention configuration
and P3-005 must establish due/not-due facts. Missing authority then fails
closed; P2-006 success cannot fill that gap.

## Workload/cardinality rules

All source-only raw telemetry requires queue, workflow, and AI intents `none`.
It cannot be copied into temporary storage as an evasion.

AI-OS-eligible categories may use a bounded batch/lifecycle queue descriptor,
but this remains only static classification. Workflow and AI intents may be
`scheduled_summary_or_governed_case`; no category may request a workflow or AI
invocation per guest interaction. No category, including an essential booking
lifecycle event, may request AI invocation per individual system event.

This preserves the permanent rule: no permanent AI OS row, queue message,
workflow, or AI invocation per page view, click, scroll, or marketing event;
and no continuous model invocation for individual system events.

## Result contract

The public function is total and never throws. It returns a recursively frozen,
plain-data decision and does not mutate the input.

Accepted (shape notation, where `candidate` is the exact closed candidate
object rather than a string or reference):

```text
ok: true
value:
  schemaVersion: "1.0.0"
  candidate: <normalized dataGovernanceCandidate>
  eligibility: source_only | future_lifecycle_candidate | protected_preservation_only
  nonAuthoritative: true
  actionAuthorized: false
  productionWriteAuthorized: false
rejection: null
```

Rejected:

```json
{
  "ok": false,
  "value": null,
  "rejection": {
    "schemaVersion": "1.0.0",
    "failClosed": true,
    "reasonCodes": ["ONE_OR_MORE_FINITE_CODES"]
  }
}
```

The module returns all applicable semantic reasons in the exact precedence
below, de-duplicated. `INTERNAL_AUTHORITY_UNAVAILABLE` is a singleton because
no other conclusion is trustworthy when committed authority cannot compile.

1. `INTERNAL_AUTHORITY_UNAVAILABLE`
2. `CALLER_AUTHORITY_INJECTION`
3. `MALFORMED_CANDIDATE`
4. `UNSUPPORTED_SCHEMA_VERSION`
5. `UNKNOWN_DATA_CATEGORY`
6. `UNKNOWN_SOURCE_CLASS`
7. `UNKNOWN_ARTIFACT_CLASS`
8. `RAW_TELEMETRY_SOURCE_BOUNDARY_VIOLATION`
9. `PROHIBITED_PER_INTERACTION_PERSISTENCE`
10. `PROHIBITED_PER_INTERACTION_QUEUE`
11. `PROHIBITED_PER_INTERACTION_WORKFLOW`
12. `PROHIBITED_PER_INTERACTION_AI_INVOCATION`
13. `PROHIBITED_PER_EVENT_AI_INVOCATION`
14. `AGGREGATION_INTERVAL_MISMATCH`
15. `CATEGORY_SOURCE_MISMATCH`
16. `CATEGORY_ARTIFACT_MISMATCH`
17. `RETENTION_ACTION_NOT_ELIGIBLE`
18. `PROTECTED_HISTORY_CONFLICT`
19. `APPEND_ONLY_AUDIT_CONFLICT`
20. `FAILED_ATTEMPT_HISTORY_CONFLICT`
21. `SELF_AUTHORIZATION_CLAIM`
22. `PRODUCTION_WRITE_CLAIM`

Unknown enum values may fail schema validation before the module can safely
distinguish their family; the module emits the most specific listed unknown
reason when the relevant field is present as a string, otherwise
`MALFORMED_CANDIDATE`. Structural schema errors are not exposed as unstable Ajv
messages.

## Schema and semantic limits

The exact validator compiles the schema with the repository-approved Draft
2020-12 validator and validates the canonical policy, representative
candidates, and every produced decision. It also independently checks the
finite mappings and module import boundary.

JSON Schema cannot prove that an aggregate was calculated correctly, that a
payload contains no guest or personal data, that raw telemetry stayed in a
source system, that a lifecycle action is due, that a legal obligation permits
an action, that an archive/transfer preserved an external record, or that a
caller truthfully described its workload cardinality. P2-006 intentionally
accepts metadata only and performs finite semantic cross-field checks in the
private-authority module. Adapters and later approved tasks must establish
external facts. Any uncertainty remains fail-closed.

## Required validator matrix

The exact validator command is:

```text
node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs
```

It must cover at least:

- schema metaschema compilation, canonical-policy validation, closed root and
  nested objects, exact arrays/order/mappings, and decision-variant exclusivity;
- one valid source-only case for each raw category and valid representative
  cases for every eligible semantic category, artifact class, interval, action,
  protection kind, and eligibility result;
- raw page view, click, scroll, and marketing telemetry attempting temporary or
  durable AI OS storage, a queue message, workflow, or AI invocation;
- one permanent row per guest interaction, individual-interaction queue and
  workflow requests, individual-interaction AI, and individual-system-event AI
  including an otherwise valid essential lifecycle event;
- hourly/daily interval swaps, daily re-aggregation, category/source mismatch,
  category/artifact mismatch, unknown category/source/artifact/action, and
  malformed or extra payload-like fields;
- scheduled-delete or aggregate requests for append-only audit evidence and
  failed-attempt history; rewrite or preservation weakening for archive and
  transfer candidates; unknown/conflicting retention classification;
- authority, persistence, lifecycle, AI-invocation, or production-write claims;
- caller-supplied schema/policy/validator/configuration through properties or
  extra arguments, including a weakened look-alike authority, without changing
  the committed result;
- `null`, arrays, primitives, proxies/getters that throw, cycles, deeply nested
  values, mutation after invocation, and repeated calls: every case returns a
  valid deterministic decision and never throws;
- no provider/storage SDK, clock, environment, filesystem, queue, workflow,
  network, credential, or repository-verification-script import in the core
  module; and
- explicit assertions that accepted classification remains non-authoritative,
  performs no action, and does not claim compliance or retention enforcement.

The validator is not admitted by this task. GOV-051 must admit only the exact
literal before P2-006 activation and independent machine verification.

## Non-goals and handoff

P2-006 creates no provider integration, data store, table, SQL, migration, RLS,
queue, workflow, scheduler, retention job, deletion, archive, transfer, local
storage, source-system API, guest-data access, AI call, credential, network
service, production write, legal-retention determination, or audit rewrite.
P3-005 may later compose fixture-only lifecycle decisions using this authority;
actual lifecycle operations require separate approval and evidence.
