# P2-007 Resource Budget Contract V1 Design

## Decision, authority, and scope

P2-007 is a static Tier-0 resource-classification contract. It classifies one
declared Staff/AI resource snapshot against committed thresholds and workload
ceilings. It does not read a provider meter, reserve capacity, change a quota,
throttle a process, enqueue work, schedule a workflow, send a notification, or
alter booking or production behavior.

The implementation has one closed JSON Schema Draft 2020-12 structural
authority:

- `schemas/resource-budget-contract-v1.schema.json`.

It has one committed canonical finite policy:

- `policies/resource-budget-policy-v1.json`.

One runtime-safe deep module,
`packages/resource-governance-contracts/src/resource-budget-contract-v1.mjs`,
loads and compiles both committed authorities internally and exports exactly:

```text
evaluateResourceBudget(observation)
```

The public function accepts no schema, policy, thresholds, provider adapter,
meter client, clock, queue, scheduler, workflow, notifier, filesystem,
environment, credential, or dependency injection. Extra JavaScript arguments
are ignored. The committed policy, not the caller, fixes dimensions,
thresholds, state mappings, workload ceilings, reason precedence, and decision
semantics. A declared hard limit is observation data supplied by a future
trusted adapter; it is not a caller-defined threshold authority.

The module is total and never throws, does not mutate its input, and returns a
recursively frozen plain-data result. It imports no infrastructure SDK,
provider package, repository verification script, queue, workflow, scheduler,
network, filesystem, environment, or clock authority. Static classification is
non-authoritative and cannot reserve, pause, requeue, dead-letter, block,
execute, approve, notify, or write anything.

## Canonical policy root

The schema root describes the canonical policy and requires exactly these
fields. The committed artifact presents them in this order; property order is
not a JSON Schema semantic:

1. `schemaVersion`, exact `1.0.0`;
2. `policyId`, exact `resource-budget-policy-v1`;
3. `resourceDimensions`, the exact ordered eleven-item array below;
4. `thresholdBasisPoints`, exact closed object with `warning50: 5000`,
   `warning75: 7500`, `warning90: 9000`, and `hardLimit: 10000`;
5. `budgetStates`, the exact ordered six-item threshold-state array below;
6. `meterStates`, the exact ordered seven-item metering array below;
7. `budgetAuthorityStates`, exact ordered array `available`, `missing`,
   `unavailable`, `inconsistent`, `unknown`;
8. `configurationStates`, exact ordered array `valid`, `missing`,
   `unsupported`, `inconsistent`, `unknown`;
9. `workloadZones`, exact ordered array `staff_control`, `ai_workload`;
10. `decisionOutcomes`, the exact ordered six-item outcome array below;
11. `workloadCeilings`, the exact closed ceilings below;
12. `decisionRules`, the exact state-to-outcome mappings below;
13. `bookingIsolation`, the exact closed five-field isolation rule below;
14. `reasonPrecedence`, the exact ordered reason-code array below; and
15. `authority`, the exact closed seven-field non-authority object below.

Every object is closed with `additionalProperties: false`. Arrays use exact
finite values, bounds, uniqueness, and canonical order where the policy is
authoritative.

## Resource dimensions and units

The committed V1 dimensions and their units are:

| Dimension | Unit |
| --- | --- |
| `worker_requests` | `requests` |
| `worker_cpu_milliseconds` | `milliseconds` |
| `queue_operations` | `operations` |
| `workflow_steps` | `steps` |
| `persistence_size_bytes` | `bytes` |
| `persistence_growth_bytes` | `bytes` |
| `persistence_egress_bytes` | `bytes` |
| `runner_minutes` | `minutes` |
| `ai_invocations` | `invocations` |
| `ai_tokens` | `tokens` |
| `notification_messages` | `messages` |

Each observation evaluates exactly one dimension. The future adapter supplies
integer `usedUnits`, `reservedUnits`, and `hardLimitUnits` in the dimension's
fixed unit. Values are bounded to JavaScript safe non-negative integers. The
module uses integer arithmetic (for example `BigInt`) to calculate
`usageBasisPoints = floor((usedUnits + reservedUnits) * 10000 /
hardLimitUnits)` without floating-point threshold drift. The published result
caps displayed usage at `10001`: `10000` means exactly at the hard limit and
`10001` means over it. A zero, absent, non-integer, unsafe, or contradictory
limit is not estimated; it fails closed.

The policy does not contain provider-specific account limits. A structurally
valid declared limit still does not prove that a live provider configured it or
that the observation is truthful. P5-006 must establish adapter and saturation
evidence before any runtime activation.

## Closed observation shape

The schema `$defs.resourceBudgetObservation` is a closed object requiring
exactly:

| Field | V1 meaning |
| --- | --- |
| `schemaVersion` | Exact `1.0.0`. |
| `observationId` | `^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$`. |
| `resourceDimension` | One of the eleven canonical dimensions. |
| `unit` | The canonical unit for the selected dimension. |
| `workloadZone` | `staff_control`, `ai_workload`, or the explicit negative test values `guest_public` and `booking_control_plane`. |
| `budgetAuthorityState` | One of the five authority states above. |
| `configurationState` | One of the five configuration states above. |
| `meterState` | One of the seven meter states below. |
| `usedUnits` | Safe non-negative integer or `null` for a fail-closed missing metric. |
| `reservedUnits` | Safe non-negative integer or `null` for a fail-closed missing metric. |
| `hardLimitUnits` | Positive safe integer or `null` for a fail-closed missing limit. |
| `observedAt` | Canonical UTC RFC 3339 string with second precision or `null`. |
| `meterAgeSeconds` | Safe non-negative integer or `null`. |
| `workloadControls` | The exact closed workload-control object below. |
| `bookingIsolation` | The exact closed isolation-claim object below. |
| `authorityClaims` | The exact closed false-claim object below. |

The schema accepts the finite negative states and nullable measurement fields
so the semantic module can return stable reasons rather than unstable schema
messages. Unknown strings, absent required properties, extra properties, and
wrong types are malformed. No prompt, event, guest, booking, credential,
provider configuration, command, payload, schema, policy, or dependency field
exists.

### Metering and configuration states

The exact meter states are:

1. `fresh`
2. `missing`
3. `unavailable`
4. `stale`
5. `inconsistent`
6. `uncertain`
7. `unknown`

Only `budgetAuthorityState: available`, `configurationState: valid`, and
`meterState: fresh` may reach threshold classification. `fresh` additionally
requires all three numeric fields, a valid `observedAt`, and
`meterAgeSeconds <= 300`. The contract does not obtain a clock and therefore
does not establish that the declared timestamp or age is truthful. Missing,
unavailable, stale, inconsistent, uncertain, or unknown authority,
configuration, meter, metric, limit, timestamp, or age always produces a
fail-closed result. No last-known value or estimate is substituted.

### Workload controls

`workloadControls` requires exactly:

- `batchingMode`: `bounded_batch`, `scheduled_summary`, `governed_case`,
  `per_event`, or `unbounded`;
- `batchSize`: positive integer or `null`;
- `deduplicationRequired`: boolean;
- `idempotencyRequired`: boolean;
- `backpressureRequired`: boolean;
- `rateLimitPerMinute`: positive integer or `null`;
- `concurrencyLimit`: positive integer or `null`;
- `retryLimit`: non-negative integer or `null`;
- `retryAttempt`: non-negative integer or `null`;
- `deadLetterHandlingRequired`: boolean;
- `priorityQueueRequired`: boolean;
- `summaryMode`: `scheduled_summary`, `governed_case`, `continuous`, or
  `per_event`;
- `perGuestInteractionUnitOfWork`: boolean;
- `perEventAiInvocation`: boolean; and
- `safeToRequeue`: boolean.

The canonical ceilings are `maxBatchSize: 500`,
`maxRateLimitPerMinute: 1000`, `maxConcurrency: 8`, `maxRetryLimit: 3`, and
`maxMeterAgeSeconds: 300`. A valid workload uses a bounded batch, scheduled
summary, or governed case; requires deduplication, idempotency, backpressure,
a rate bound, a concurrency bound, bounded retry, dead-letter handling, and a
priority queue; and prohibits per-guest-interaction work and per-event AI.
`retryAttempt` must not exceed `retryLimit`.

These values are conservative contract ceilings, not provider settings. A later
packet may define a stricter committed policy version. Callers cannot relax V1
through extra arguments or look-alike policy objects.

### Booking isolation and authority claims

`bookingIsolation` requires exactly five fields:

- `bookingWorkload: false`;
- `sharesQuotaWithBooking: false`;
- `sharesCredentialsWithBooking: false`;
- `sharesDeploymentWithBooking: false`; and
- `sharesFailureBoundaryWithBooking: false`.

`workloadZone: guest_public` or `booking_control_plane`, any true isolation
claim, or any mismatch with the committed isolation policy is rejected. P2-007
cannot evaluate or consume booking capacity and cannot reduce booking
availability.

`authorityClaims` requires exactly:

- `callerSuppliesPolicy: false`;
- `callerSuppliesThresholds: false`;
- `decisionAuthorizesScheduling: false`;
- `decisionAuthorizesExecution: false`;
- `decisionAuthorizesNotification: false`;
- `decisionAuthorizesProductionWrite: false`; and
- `productionWriteGranted: false`.

The module pre-scans recognizable authority claims before ordinary structural
validation so an attempted self-authorization cannot be hidden behind another
malformed field.

## Threshold states and deterministic outcomes

The exact budget states are:

1. `below_warning`
2. `warning_50`
3. `warning_75`
4. `warning_90`
5. `hard_limit_reached`
6. `hard_limit_exceeded`

The exact non-authoritative outcomes are:

1. `continue_candidate`
2. `warn_continue_candidate`
3. `throttle_candidate`
4. `pause_candidate`
5. `requeue_candidate`
6. `block_candidate`

The canonical mapping is:

| Usage interval | State | Outcome |
| --- | --- | --- |
| `< 5000` basis points | `below_warning` | `continue_candidate` |
| `5000..7499` | `warning_50` | `warn_continue_candidate` |
| `7500..8999` | `warning_75` | `throttle_candidate` |
| `9000..9999` | `warning_90` | `requeue_candidate` only when safe and retry remains; otherwise `pause_candidate` |
| `10000` | `hard_limit_reached` | `block_candidate` |
| `> 10000` | `hard_limit_exceeded` | `block_candidate` |

Invalid authority, configuration, workload controls, or booking isolation maps
to `block_candidate`. Metering uncertainty and missing measurement map to
`requeue_candidate` only when `safeToRequeue` is true, retry/dead-letter
controls are valid, and `retryAttempt < retryLimit`; otherwise they map to
`pause_candidate`. These are proposal-like classifications only: no result is
a queue instruction or execution authorization.

The public result variants are mutually exclusive. A threshold-classified
result is:

```text
ok: true
value:
  schemaVersion: "1.0.0"
  observationId: <copied identifier>
  resourceDimension: <canonical dimension>
  budgetState: <one of six states>
  usageBasisPoints: <0..10001>
  reasonCode: WITHIN_BUDGET | WARNING_50_REACHED | WARNING_75_REACHED |
              WARNING_90_REACHED | HARD_LIMIT_REACHED | HARD_LIMIT_EXCEEDED
  outcome: <one of six outcomes>
  failClosed: <true for warning_90 and hard-limit states, otherwise false>
  nonAuthoritative: true
  schedulingAuthorized: false
  executionAuthorized: false
  notificationAuthorized: false
  productionWriteAuthorized: false
rejection: null
```

A malformed, uncertain, boundary-violating, or workload-invalid result is:

```text
ok: false
value: null
rejection:
  schemaVersion: "1.0.0"
  failClosed: true
  outcome: pause_candidate | requeue_candidate | block_candidate
  reasonCodes: <ordered, de-duplicated finite codes>
```

`INTERNAL_AUTHORITY_UNAVAILABLE` is always a singleton `block_candidate`
because no other conclusion is trustworthy when committed authority cannot be
loaded or compiled.

## Rejection precedence

The module returns all applicable reasons in this exact order, de-duplicated,
except for the singleton internal-authority failure:

1. `INTERNAL_AUTHORITY_UNAVAILABLE`
2. `CALLER_AUTHORITY_INJECTION`
3. `MALFORMED_OBSERVATION`
4. `UNSUPPORTED_SCHEMA_VERSION`
5. `UNKNOWN_RESOURCE_DIMENSION`
6. `UNIT_MISMATCH`
7. `UNSUPPORTED_WORKLOAD_ZONE`
8. `BOOKING_WORKLOAD_PROHIBITED`
9. `BOOKING_QUOTA_BOUNDARY_VIOLATION`
10. `BOOKING_CREDENTIAL_BOUNDARY_VIOLATION`
11. `BOOKING_DEPLOYMENT_BOUNDARY_VIOLATION`
12. `BOOKING_FAILURE_BOUNDARY_VIOLATION`
13. `BUDGET_AUTHORITY_MISSING`
14. `BUDGET_AUTHORITY_UNAVAILABLE`
15. `BUDGET_AUTHORITY_INCONSISTENT`
16. `BUDGET_AUTHORITY_UNKNOWN`
17. `CONFIGURATION_MISSING`
18. `UNSUPPORTED_CONFIGURATION`
19. `CONFIGURATION_INCONSISTENT`
20. `CONFIGURATION_UNKNOWN`
21. `METER_MISSING`
22. `METER_UNAVAILABLE`
23. `METER_STALE`
24. `METER_INCONSISTENT`
25. `METER_UNCERTAIN`
26. `METER_UNKNOWN`
27. `METRIC_MISSING`
28. `HARD_LIMIT_MISSING`
29. `METERING_TIMESTAMP_MISSING`
30. `METER_AGE_INVALID`
31. `UNBOUNDED_BATCHING`
32. `DEDUPLICATION_REQUIRED`
33. `IDEMPOTENCY_REQUIRED`
34. `BACKPRESSURE_REQUIRED`
35. `RATE_LIMIT_REQUIRED`
36. `CONCURRENCY_LIMIT_REQUIRED`
37. `RETRY_LIMIT_REQUIRED`
38. `RETRY_ATTEMPT_INVALID`
39. `DEAD_LETTER_HANDLING_REQUIRED`
40. `PRIORITY_QUEUE_REQUIRED`
41. `CONTINUOUS_OR_PER_EVENT_SUMMARY_PROHIBITED`
42. `PER_INTERACTION_WORK_PROHIBITED`
43. `PER_EVENT_AI_INVOCATION_PROHIBITED`
44. `WORKLOAD_CEILING_EXCEEDED`
45. `SELF_AUTHORIZATION_CLAIM`
46. `PRODUCTION_WRITE_CLAIM`

Unknown enum values may fail structural validation before the semantic module
can distinguish their family. The module emits the most specific listed
unknown reason when the relevant field is safely readable as a string;
otherwise it emits `MALFORMED_OBSERVATION`. Raw Ajv messages are never exposed.

## Schema, semantic, and operational limits

The exact validator compiles the schema with the repository-approved Draft
2020-12 validator, validates the canonical policy, validates all result
variants, and independently asserts every finite array, mapping, ceiling,
precedence entry, and import boundary.

JSON Schema and the private semantic module cannot prove that a provider meter
is truthful, an account limit is current, the declared age matches wall-clock
time, a workload actually deduplicates or applies backpressure, a retry was
enqueued, a dead letter exists, a notification was delivered, or booking
capacity is externally isolated. No clock or provider is consulted. P2-007
classifies closed metadata only; runtime adapters and P5-006 must establish
external facts with separately approved evidence.

## Required validator matrix

The exact validator command is:

```text
node tests/resource-governance/validate-resource-budget-contract-v1.mjs
```

It must cover at least:

- Draft 2020-12 schema compilation; canonical-policy validation; closed root,
  nested objects, exact arrays/order/mappings/ceilings; and result-variant
  exclusivity and satisfiability;
- one valid case for every dimension/unit, workload zone, threshold boundary
  immediately below/at/above 50%, 75%, 90%, and 100%, and every outcome;
- deterministic integer behavior for zero use, reserved capacity, safe maximum
  integers, exact hard limit, and over-limit capping without floating drift;
- every budget-authority, configuration, and meter state, plus null, absent,
  zero, negative, non-integer, unsafe, contradictory, stale-age, and malformed
  measurement/timestamp cases;
- guest or booking zones and each shared booking quota, credential, deployment,
  and failure boundary individually and together;
- unbounded/per-event batches, absent or oversized batch/rate/concurrency/retry
  bounds, retry-attempt exhaustion, missing dedupe/idempotency/backpressure,
  missing dead-letter/priority handling, continuous/per-event summaries,
  per-interaction work, and per-event AI;
- safe requeue versus pause behavior for uncertainty and warning-90, and hard
  limit block behavior regardless of requeue claim;
- authority, scheduling, execution, notification, or production-write claims;
  caller-supplied schema/policy/threshold/config/validator properties or extra
  arguments, including weakened look-alike authorities, without changing the
  committed result;
- `null`, arrays, primitives, cycles, throwing proxies/getters, deeply nested
  input, mutation after invocation, repeated calls, and extra payload-like
  fields: every case returns a valid deterministic decision and never throws;
- no provider/infra SDK, clock, environment, filesystem, network, meter, queue,
  workflow, scheduler, notifier, credential, or repository-verification-script
  import in the runtime-safe module; and
- explicit assertions that no result authorizes, reserves, schedules, pauses,
  requeues, blocks, dead-letters, notifies, executes, writes, or affects booking.

The validator is not admitted by this task. GOV-054 must admit only the exact
literal before P2-007 activation and independent machine verification.

## Non-goals and handoff

P2-007 creates no provider integration, live meter, account quota, service,
database, table, SQL, migration, RLS, queue, scheduler, workflow, worker,
process control, backpressure mechanism, rate limiter, concurrency manager,
retry, dead letter, priority queue, notification, AI invocation, credential,
network call, booking access, production write, or capacity reservation. Its
outputs cannot authorize or prove any operation. Phase 3 adapters must consume
this authority inward through ports; P5-006 must test real saturation and
booking isolation before higher-volume activation.
