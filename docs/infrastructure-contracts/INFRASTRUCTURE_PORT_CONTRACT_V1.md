# Infrastructure Boundary and Port Contract V1

## Purpose and authority

P2-005 is a static Tier-0 contract. The closed structural authority is
`schemas/infrastructure-port-contract-v1.schema.json`; the sole canonical
instance is `policies/infrastructure-trust-zone-policy-v1.json`. The runtime-safe
surface is:

```js
validateInfrastructureBoundaryRequest(request)
```

The function obtains both committed authorities internally. Ordinary callers
cannot supply a schema, policy, contract, validator, adapter, configuration, or
dependencies. It returns a deeply frozen plain-data clone on success and a
deterministic fail-closed decision on rejection; malformed JavaScript input
never escapes as an exception.

Validation means only that a normalized descriptor conforms to this static
contract. It is not authentication, authorization, approval, capacity
reservation, dispatch permission, or evidence that recipient checks occurred.
It never performs a network call or production action.

## Trust and failure boundaries

V1 fixes three logical zones:

- `guest_public` is exposed only to guest traffic.
- `staff_control` requires authenticated staff access.
- `ai_workload` is a non-public workload zone.

All zones retain distinct credential, quota, deployment, and failure boundary
identifiers even when processes are co-located on one Mac Mini. Guest booking
availability cannot depend on Staff OS or AI OS availability. Direct guest/AI,
same-zone, reversed, and unlisted cross-zone descriptors fail closed.

The five allowed route classes are fixed:

| Route | Direction | Port operation |
| --- | --- | --- |
| `aggregate_or_lifecycle_ingest` | guest -> staff | `EventIngestionPort.ingest_batch` |
| `prepared_analytics_read` | staff -> guest | `AnalyticsSourcePort.read_aggregate` |
| `bounded_work_request` | staff -> AI | `SchedulingQueuePort.enqueue` |
| `bounded_work_result` | AI -> staff | `WorkflowExecutionPort.read_state` |
| `staff_notification` | AI -> staff | `NotificationPort.send` |

The ingest route is vocabulary for a later minimized aggregate or essential
booking-lifecycle envelope. P2-006, not this contract, defines its data and
retention authority.

## Cross-zone protocol descriptor

The canonical policy requires authenticated HTTPS POST; an audience-bound
short-lived credential with a maximum lifetime of 300 seconds; recipient-side
credential, expiry, audience, timestamp, nonce, replay, idempotency, caller
limit, and route limit checks; a 60-second timestamp-skew bound; a 300-second
replay window; one-time nonce and idempotency key; request/response maxima of
65,536 and 262,144 bytes; and a 100-10,000 millisecond timeout.

`duplicate_same_request` is rejected with
`DUPLICATE_ACCEPTED_REQUEST`. A future trusted adapter may return a previously
committed result without redispatch; this validator never retrieves or
dispatches it. Missing, stale, conflicting, unavailable, or uncertain limit
state is `unknown` and fails closed.

The descriptor's `securityEvidence`, `deliveryEvidence`, `limitEvidence`, and
`isolationEvidence` fields are normalized facts that a future recipient adapter
must establish from trusted services. Network-supplied assertions are untrusted
and must not be copied into those fields as authority. A real adapter must
independently establish cryptographic identity, time, replay/idempotency
history, rate/quota state, and isolation before later policy and approval gates
may consider dispatch.

## Provider-neutral ports

The core owns thirteen stable interfaces: `PersistencePort`,
`EventIngestionPort`, `AnalyticsSourcePort`, `SchedulingQueuePort`,
`WorkflowExecutionPort`, `ObjectStoragePort`, `NotificationPort`,
`IntelligenceProvider`, `DeploymentProvider`, `AuthenticationPort`,
`ProposalGenerator`, `ExecutorAdapter`, and `VerificationProvider`.

Their operation names are finite contract vocabulary, not implemented methods
or permissions. Adapters own provider SDKs, transport, credentials, clocks,
state, metering, error mapping, and configuration. Composition occurs outside
core. Core imports no Cloudflare, Supabase, GitHub, OpenAI, LINE, local-server,
database, queue, or other provider SDK. Replacing a provider changes an adapter
and configuration; it does not transfer policy, authorization, workflow,
approval, or audit authority.

In particular, `PersistencePort.write`, `DeploymentProvider.prepare`, and
`ExecutorAdapter.execute` grant no production permission. Every provider,
caller, request, bypass, dispatch, and production-write authority claim is
fixed false.

## Assurance and limits

Draft 2020-12 enforces closed structures, types, enums, patterns, and bounds.
The deep module enforces ordered finite policy mappings, route/zone/port
relationships, credential audience and age semantics, isolation, authority,
reason precedence, guarded plain-data cloning, and never-throw behavior.

Run the exact validator with:

```text
node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs
```

The validator compiles the schema, validates the canonical policy, exercises
all route classes and focused security/replay/idempotency/limit/isolation/
authority exploit cases, and checks the runtime import boundary. It does not
authenticate a caller or contact infrastructure.

P2-005 selects no provider, account, domain, service, credential, database,
queue, workflow, endpoint, deployment, or migration. P2-006 defines
minimisation and retention; P2-007 defines numeric resource budgets.
