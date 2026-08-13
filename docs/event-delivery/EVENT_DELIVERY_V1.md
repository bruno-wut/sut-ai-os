# Event delivery V1

`createEventDelivery(ports)` is the Phase 3 bounded application core. Its two
operations, `submit(workRequest)` and `runDue()`, accept only
scheduled checks, scheduled summaries, and already-normalized aggregate or
essential-event references. They produce deterministic, non-authoritative
decisions with `productionWritePermission: false`.

The required `clock`, `storage`, and `dispatcher` are explicit outbound ports.
The core does not select or import a database, queue, workflow engine, HTTP
transport, provider SDK, scheduler, AI service, notification service, or
credential. The factory validates once, then snapshots the limits and binds the
exact clock, storage, and dispatcher callables. Replacing or mutating the
caller's port properties after construction cannot redefine those trusted
dependencies. A future adapter may bind the ports only through a separately
approved task.

Every persisted `workId` is unique. An exact request replay under its original
idempotency key remains idempotent; reusing an idempotency key for changed work
or reusing a work ID under another key fails closed. Persisted duplicate work
IDs are invalid state and cannot dispatch. Due time comes only from the captured
clock port: `runDue()` accepts no caller timestamp. Due work is ordered by fixed
priority, time, and work ID; bounded by batch, rate, and concurrency limits;
updated by selected record position rather than by a global work-ID lookup; and
persisted as delivered, requeued, paused, or dead-lettered. Retry exhaustion and
permanent failure retain failure reasons. Unavailable dispatch pauses when safe
requeue is unavailable, otherwise safely requeues. Malformed input, malformed
port output, missing time, ambiguous persistence state, or unavailable
persistence fail closed without throwing or dropping work.

Dispatcher inputs carry both `workId` and the queue `idempotencyKey`. The core
still dispatches before saving the resulting state. If that save fails, the
durable record remains eligible and a later run may deliver it again. This is an
explicit at-least-once Tier-0/shadow limitation, not an exactly-once guarantee.
A real provider binding requires a separately governed transactional outbox or
equivalent idempotent delivery boundary before production use.

This is not a transport endpoint. A future transport adapter must enforce the
P3-001 pre-parse size and exact-request trust-fact constraints before invoking
any application core. No call made here authorizes an execution or production
write.
