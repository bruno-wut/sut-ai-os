# Signal-ingestion normalization contract V1

## Purpose and public surface

P3-001 adds one provider-neutral Tier-0 core function:

```js
normalizeSignalEnvelope(envelope)
```

The function accepts plain data only and returns a deeply frozen, machine-readable accepted or rejected decision. It has no imports, provider adapter, network route, clock, credential reader, persistence, queue, workflow, AI, notification, execution, deployment, production, booking, payment, inventory, or pricing capability. It does not expose Staff OS or AI OS control paths.

This is a normalization boundary, not a deployed endpoint. A future separately approved transport adapter must authenticate the source and establish the signature, audience, timestamp, replay, idempotency, byte-size, rate, and budget facts from trusted recipient-side services before constructing the envelope. Network-supplied assertions are not trusted authority.

## Closed source and signal vocabulary

The root fields are exactly `schemaVersion`, `requestId`, `source`, `security`, `delivery`, `limits`, and `signal`. Version 1 admits only the `aggregate_or_lifecycle_ingest` route and these source/category mappings:

| Source ID | Source class | Admitted categories |
| --- | --- | --- |
| `analytics_aggregate_source` | `analytics_source` | `hourly_analytics_aggregate`, `daily_analytics_aggregate` |
| `booking_lifecycle_source` | `booking_control_plane` | `essential_booking_lifecycle_event` |

Aggregate payloads contain only a metric name, finite value, bounded sample count, and an exact hourly or daily period. Essential-event payloads contain only an approved event type, its matching state, and a bounded occurrence count. The finite essential-event types are `checkout.completion.declined`, `payment.webhook.failed`, and `booking.hold.conflicts_increased`. No guest, booking, payment, credential, click, page-view, telemetry-event, or provider payload is accepted.

Raw page views, clicks, scrolls, marketing telemetry, clickstreams, embedded event arrays, and individual interaction categories fail closed with `RAW_CLICKSTREAM_REJECTED` or `PER_EVENT_SIGNAL_REJECTED`. Other categories and source/category relabelling also fail closed.

## Bounded recipient-established claims

- The authentication and signature statuses must both be `verified`, the audience must be `signal-ingestion-v1`, and credential age must be at most 300 seconds.
- Request and receipt timestamps must be canonical UTC second timestamps with no more than 60 seconds of skew. A signal cannot be future-dated or older than 172,800 seconds at receipt.
- A nonce must be fresh and unseen. The idempotency key must be new. Replays, conflicts, and duplicate accepted requests are rejected; this core never retrieves a prior result or redispatches.
- The declared request body limit is 65,536 bytes.
- Caller and route rate facts must be fresh 60-second windows. Their configured ceiling is 1,000 requests per minute, and the observed count including this request cannot exceed the declared limit.
- The budget authority, configuration, and meter must be available, valid, and fresh. Meter age is at most 300 seconds. The only dimension is one `worker_requests`/`requests` normalization unit, the hard limit is at most 1,000,000 units, and projected use must remain below the hard limit.
- Aggregate sample count is at most 1,000,000. Essential-event occurrence count is at most 500. One envelope normalizes one bounded aggregate or essential-event signal; it does not create a batch, work item, or downstream action.

Missing, unknown, stale, malformed, inconsistent, at-limit, or over-limit claims reject deterministically. The core cannot prove that an adapter established those facts honestly; a later adapter and independent saturation/replay verification must do so before any runtime activation.

## Machine-readable decisions and no authority

Success returns `{ ok: true, value, rejection: null }`. `value.disposition` is exactly `normalized_only`, `value.nonAuthoritative` is `true`, and `value.normalizedSignal` is a closed normalized event-shaped record. Every field in `value.authority` is `false`, including authentication, authorization, persistence, queue, workflow, AI invocation, notification, execution, production write, booking, payment, inventory, and pricing authority.

Failure returns `{ ok: false, value: null, rejection }`. The rejection has schema version `1.0.0`, `failClosed: true`, and one deterministic reason code. Malformed JavaScript values, cycles, throwing accessors, proxies, authority injection, unknown sources, unauthenticated requests, invalid timestamps, replay, missing/conflicting idempotency, oversize requests, stale or exceeded rate and budget claims, raw clickstream, per-event telemetry, source/category mismatch, and malformed signal variants are covered by hostile tests.

Run the exact deterministic validator:

```text
npm run test:signal-ingestion
```

Passing this validator is implementation evidence only. It is not independent review, SHA-bound semantic or merge-risk evidence, deployment evidence, or task completion.
