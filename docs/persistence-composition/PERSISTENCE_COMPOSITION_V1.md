# Persistence Composition V1

## Purpose and authority

P3-004 implements a fixture-only, provider-neutral `PersistencePort` composition
boundary. The domain-facing deep module exports one constructor,
`createPersistencePort(adapter)`, and the returned port exposes one stable
`execute(request)` operation. Adapter selection remains outside the core in
`composePersistencePort(configuration)`.

The committed P2-006 classifier and P2-007 budget evaluator are the internal
authorities for metadata eligibility and capacity classification. A caller may
provide observations and candidate facts, but cannot replace their schema,
policy, validator, thresholds, retention configuration, or implementation.
Neither upstream decision authorizes a production write; a successful P3-004
decision is likewise fixture-only, non-authoritative, and grants no external
side effect or production-write capability.

## Stable request boundary

`execute(request)` accepts a closed V1 request containing:

- a request ID and one P2-005 operation: `read`, `write`, `append`, or
  `delete_expired`;
- a record reference containing only an identifier, SHA-256 content digest, and
  bounded byte count—never a guest or application payload;
- one canonical P2-006 data-governance candidate;
- one canonical P2-007 resource observation; and
- closed authority claims that must all be false.

The port runs the P2-006 classification and P2-007 evaluation before calling an
adapter. Raw source-only telemetry, per-interaction persistence, per-interaction
queues/workflows, and per-event or per-interaction AI work are rejected. The
operation must match the P2-006 action reference. A valid hourly aggregate that
uses the `aggregate` action may subsequently be read under that same reference;
reads do not require relabelling it as `retain`. Capacity must use the exact
operation-specific dimension:

| Operation | Required P2-007 dimension |
| --- | --- |
| `read` | `persistence_egress_bytes` |
| `write` | `persistence_growth_bytes` |
| `append` | `persistence_growth_bytes` |
| `delete_expired` | `persistence_size_bytes` |

Only `continue_candidate`, `warn_continue_candidate`, and `throttle_candidate`
capacity outcomes may reach the fixture adapter. Warning-90, hard-limit,
unknown, missing, stale, inconsistent, unavailable, malformed, booking-shared,
or otherwise fail-closed decisions are rejected before adapter invocation.

P2-006 describes retention eligibility rather than retention authorization.
`delete_expired` in P3-004 therefore exercises only an in-memory fixture seam;
it does not schedule deletion, establish due state, satisfy legal compliance,
or authorize a production lifecycle action. P3-005 must supply separately
governed fixture lifecycle controls. Protected audit and failed-attempt history
cannot use a destructive retention reference. Before any fixture deletion, the
reference adapter requires the requested category and artifact class to match
the persisted record, then independently refuses deletion of a protected audit
record.

## Reference composition

Two committed adapters prove substitution without changing domain logic:

- `reference-map-v1` stores immutable revision histories in a process-local map;
- `reference-journal-v1` stores immutable revisions in a process-local journal.

Both are newly constructed per composition, deterministic, memory-only, and
selected through the closed configuration `{ schemaVersion, adapterId }`.
Missing, malformed, or unsupported selection yields a port that fails closed.
The core captures the adapter identity and function at construction, so later
mutation of the supplied object cannot redirect an established port.

For every existing `recordId`, both adapters bind append history to the original
`dataCategory`, `artifactClass`, and `retentionAction`. An append that attempts
to relabel any of those fields returns `RECORD_IDENTITY_CONFLICT` without
changing the current revision. This prevents an ordinary aggregate from joining
a protected audit history and prevents a protected record from being appended
to an ordinary history.

Delete has a deliberately different comparison. A valid `scheduled_delete`
action is expected to differ from the action stored when an ordinary record was
written or appended, so deletion matches only the immutable `dataCategory` and
`artifactClass`. Classification drift still returns `RECORD_IDENTITY_CONFLICT`
before mutation. The protected-audit guard then runs before deletion. Thus a
valid ordinary record can be deleted, while an ordinary deletion request cannot
erase protected audit history by reusing its `recordId`.

Adapter output is treated as untrusted. Its status must match the requested
operation, its record must match the governed request identity, and extra
authority fields are rejected. Throws and malformed adapter output become
deterministic denials.

## Architectural boundary

The core imports only the P2-006 and P2-007 runtime-safe modules. It imports no
composition service, repository verification script, Cloudflare, Supabase,
database, queue, AI, local-server, network, filesystem, environment, process,
credential, or clock facility. Provider-specific behavior belongs in a later
approved adapter and must preserve the same inward-facing interface.

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

The task validator covers both adapters, substitution, all four finite
operations, aggregate-action write/read, positive ordinary scheduled deletion,
protected-history identity collisions in both directions, same-ID ordinary
deletion against protected history, pre-mutation delete guards,
protected-delete preservation, P2-006 category/retention rejection, P2-007
capacity and booking isolation, caller-authority injection, hostile adapters,
malformed input, immutability, closed decisions, and import boundaries.

## Rollback

Revert the P3-004 core, reference composition, validator, documentation, task
evidence, and lifecycle record. No external state, account, credential, or
provider resource exists to undo.
