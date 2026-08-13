# P3-002-R01 executor verification

## Scope

Remediated only the bounded event-delivery application core, its deterministic
validator, and its interface documentation. The terminal P3-002 packet and
historical evidence are unchanged. No provider, transport, database, queue,
workflow, transaction, outbox, credential, production write, or deployment was
added.

## Implemented controls

- A new submission cannot reuse an existing `workId` under a different
  idempotency key. An exact request replay remains idempotent; changed work under
  the same idempotency key fails closed.
- Duplicate persisted work IDs return `PERSISTENCE_STATE_INVALID` before any
  dispatch or save, and batch results update only their selected record indexes.
- `runDue()` accepts no caller timestamp and derives eligibility only from the
  captured trusted clock. Invalid or unavailable clock output fails closed.
- The factory binds and freezes the validated clock, storage, and dispatcher
  callables and deep-clones/freezes limits at construction.
- Dispatcher inputs include the queue `idempotencyKey`.
- Dispatch-before-persist remains explicitly at-least-once in Tier-0/shadow
  mode. A transactional outbox or equivalent production delivery boundary is
  deferred to a separately governed provider-adapter task.

## Executor checks

- `npm run test:event-delivery` — passed (`75` deterministic decisions).
- `git diff --check` — passed; Git emitted only the repository's CRLF conversion
  notices.
- `npm run verify:fast` — the event-delivery validator passed first, then the
  repository-wide `node scripts/codex/validate-routing.mjs` check failed while
  this implementation and its active packet were uncommitted. That review-route
  self-test requires a clean committed head. The packet forbids changing the
  shared routing or verification scripts. The orchestrator must commit the
  bounded head and rerun this exact command before independent verification.

## Focused regression coverage

The validator covers duplicate submission IDs, duplicate stored IDs,
out-of-batch record isolation, caller/trusted-clock disagreement, invalid and
throwing clocks, post-construction port and limit mutation, idempotency-key
propagation, post-dispatch save failure, hostile port/dispatch/input values, and
the retained batching, priority, retry, pause, DLQ, backpressure, payload, and
deep-module assertions.

## Changed implementation files

- `services/event-delivery/src/event-delivery-v1.mjs`
- `tests/event-delivery/validate-event-delivery-v1.mjs`
- `docs/event-delivery/EVENT_DELIVERY_V1.md`
- `evidence/tasks/SUT-AIOS-P3-002-R01/verification.md`

The active packet, dependency/backlog entries, and risk entry were prepared by
the orchestrator in the same bounded task branch and were not altered by the
executor.

## Rollback

Revert the R01 branch while preserving terminal P3-002 and all historical task
and verification evidence. No external state exists to roll back.
