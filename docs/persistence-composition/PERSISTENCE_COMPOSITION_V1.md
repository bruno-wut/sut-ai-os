# Persistence Composition V1

## Purpose and authority

P3-004 implements a fixture-only, provider-neutral `PersistencePort` composition
boundary. The domain-facing deep module exports the normal constructor
`createPersistencePort(adapter)`, and the returned port exposes one stable
`execute(request)` operation. Adapter selection remains outside the core in
`composePersistencePort(configuration)`.

The committed P2-006 classifier and P2-007 budget evaluator are the internal
authorities for metadata eligibility and capacity classification. A caller may
provide a P2-006 candidate, but cannot provide a capacity observation or replace
either authority's schema, policy, validator, thresholds, retention
configuration, or implementation. Neither upstream decision authorizes a
production write; a successful P3-004 decision is likewise fixture-only,
non-authoritative, and grants no external side effect or production-write
capability.

## Stable request boundary

`execute(request)` accepts a closed V1 request containing:

- a request ID and one P2-005 operation: `read`, `write`, `append`, or
  `delete_expired`;
- a record reference containing only an identifier, SHA-256 content digest,
  bounded byte count, and `expectedRevision` - never a guest or application
  payload. `expectedRevision` is required only for `delete_expired` and is
  `null` for other operations;
- one canonical P2-006 data-governance candidate; and
- closed authority claims that must all be false.

The port runs P2-006 classification and P2-007 evaluation before calling an
adapter. Raw source-only telemetry, per-interaction persistence,
per-interaction queues/workflows, and per-event or per-interaction AI work are
rejected. The operation must match the P2-006 action reference. A valid hourly
aggregate using the `aggregate` action may subsequently be read under that same
reference; reads do not require relabelling it as `retain`.

Capacity uses the exact operation-specific P2-007 dimension:

| Operation | Required dimension |
| --- | --- |
| `read` | `persistence_egress_bytes` |
| `write` | `persistence_growth_bytes` |
| `append` | `persistence_growth_bytes` |
| `delete_expired` | `persistence_size_bytes` |

The normal constructor captures the committed fixture-only capacity source. It
obtains a closed envelope binding request ID, operation, record ID, digest, and
byte count to the observation. Before P2-007 evaluation, the core requires the
operation-specific dimension and requires `reservedUnits` to equal the bound
record byte count. Caller fields named `capacityObservation` or
`capacitySource` are authority injection. Extra constructor arguments cannot
replace the normal authority. `createPersistencePortForTesting` is an explicit
test-only seam restricted to committed test-source identities; composition does
not use it.

Only `continue_candidate`, `warn_continue_candidate`, and `throttle_candidate`
capacity outcomes may reach the fixture adapter. Warning-90, hard-limit,
unknown, missing, stale, inconsistent, unavailable, malformed, unbound,
booking-shared, or otherwise fail-closed decisions are rejected before adapter
invocation. Capacity evaluation reserves nothing and authorizes no scheduling,
requeue, notification, external side effect, or production action.

P2-006 describes retention eligibility rather than retention authorization.
`delete_expired` exercises only an in-memory fixture seam; it does not schedule
deletion, establish due state, satisfy legal compliance, or authorize a
production lifecycle action. P3-005 must supply separately governed fixture
lifecycle controls. Protected audit and failed-attempt history cannot use a
destructive retention reference.

## Reference composition

Two committed adapters prove substitution without changing domain logic:

- `reference-map-v1` stores immutable revision histories in a process-local map;
- `reference-journal-v1` stores immutable revisions in a process-local journal.

Both are newly constructed per composition, deterministic, memory-only, and
selected through `{ schemaVersion, adapterId }`. Missing, malformed, or
unsupported selection yields a port that fails closed. The core captures the
adapter identity and function at construction, so later object mutation cannot
redirect an established port.

For every existing `recordId`, both adapters bind append history to the original
`dataCategory`, `artifactClass`, and `retentionAction`. Relabelling returns
`RECORD_IDENTITY_CONFLICT` without changing the current revision. This prevents
ordinary and protected histories from being combined.

Delete deliberately compares only immutable `dataCategory` and `artifactClass`
because the valid `scheduled_delete` action differs from the stored action. The
protected-audit guard then runs before `expectedRevision` is compared with the
current record. A stale revision returns `REVISION_CONFLICT` and leaves the
latest record intact. A successful adapter result must independently match the
requested digest, byte count, and expected revision at the deep-module boundary.
Thus a current ordinary record can be deleted, while stale callers and ordinary
requests reusing a protected `recordId` cannot erase current or audit history.

Append propagates `requestId` as the immutable adapter idempotency key. Both
adapters store the exact append fingerprint and original result. An exact replay
returns the original revision without another append; conflicting reuse returns
`IDEMPOTENCY_CONFLICT` without mutation. This fixture-local ledger does not
claim distributed or production transaction guarantees.

Adapter output is untrusted. Its status must match the requested operation, its
record must match the governed request identity, and extra authority fields are
rejected. Throws and malformed output become deterministic denials.

## Architectural boundary

The core imports only the P2-006 and P2-007 runtime-safe modules. It imports no
composition service, repository verification script, Cloudflare, Supabase,
database, queue, AI, local-server, network, filesystem, environment, process,
credential, or clock facility. Provider-specific behavior belongs in a later
approved adapter and must preserve the inward-facing interface.

This implementation creates no database, SQL, migration, provider account,
credential, network request, queue message, workflow, model invocation,
notification, production write, booking behavior, payment behavior, inventory
behavior, or pricing behavior. In-memory fixture state disappears with the
process and is not durable evidence or production storage.

## Deterministic verification

```text
npm run test:persistence-composition
npm run verify:fast
git diff --check
```

The validator covers both adapters, substitution, all four operations,
aggregate-action write/read, stale/current revision deletion, append replay and
conflicting reuse, protected-history collisions, same-ID ordinary deletion
against protected history, pre-mutation guards, internal capacity authority and
request/size binding, P2-006 and P2-007 failures, caller-authority injection,
hostile adapters, malformed input, immutability, closed decisions, and import
boundaries.

## Rollback

Revert the P3-004 core, reference composition, validator, documentation, task
evidence, and lifecycle record. No external state, account, credential, or
provider resource exists to undo.
