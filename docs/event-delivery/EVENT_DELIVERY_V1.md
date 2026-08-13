# Event delivery V1

`createEventDelivery(ports)` is the Phase 3 bounded application core. Its two
operations, `submit(workRequest)` and `runDue({ nowEpochSeconds })`, accept only
scheduled checks, scheduled summaries, and already-normalized aggregate or
essential-event references. They produce deterministic, non-authoritative
decisions with `productionWritePermission: false`.

The required `clock`, `storage`, and `dispatcher` are explicit outbound ports.
The core does not select or import a database, queue, workflow engine, HTTP
transport, provider SDK, scheduler, AI service, notification service, or
credential. A future adapter may bind those ports only through a separately
approved task.

Records use an idempotency key and deterministic fingerprint. Due work is
ordered by fixed priority, time, and work ID; bounded by batch, rate, and
concurrency limits; and persisted as delivered, requeued, paused, or
dead-lettered. Retry exhaustion and permanent failure retain failure reasons.
Unavailable dispatch pauses when safe requeue is unavailable, otherwise safely
requeues. Malformed input, malformed port output, missing time, or unavailable
persistence fail closed without throwing or dropping work.

This is not a transport endpoint. A future transport adapter must enforce the
P3-001 pre-parse size and exact-request trust-fact constraints before invoking
any application core. No call made here authorizes an execution or production
write.
