# Signed Signal Normalization V1

## Scope and authority

P3-001 implements a deterministic application-core boundary for the
`aggregate_or_lifecycle_ingest` route. The module is
`services/signal-ingestion/signal-normalizer-v1.mjs` and exports one factory:

```text
createSignalNormalizer(trustedContext) -> { normalize(request) }
```

The factory captures recipient-established verification and operational facts;
the returned operation accepts only an untrusted signed request. The request
cannot supply a schema, policy, contract, adapter, verifier, dependency,
verification key, credential, or other authority. No caller-provided callback
is invoked. The module imports only Node's standard cryptographic primitives
and contains no database, queue, workflow, network, environment, credential
store, provider SDK, AI provider, or production adapter.

Successful normalization is not authorization, persistence permission,
capacity reservation, dispatch, approval, or proof that a downstream action
ran. Every accepted value fixes `nonAuthoritative: true` and all persistence,
permanent-work-item, AI-invocation, and production-write authority flags to
false.

## Trusted adapter boundary

The exact closed trusted context contains:

- a 32-256 character HMAC verification key supplied by the recipient adapter;
- the recipient's integer current-time fact;
- recipient-established nonce and idempotency states;
- caller and route rate-limit states; and
- fresh budget authority, configuration, meter, classification, observation
  time, and maximum-age facts.

P3-001 does not read a key from a file or environment variable and commits no
real secret. Its validator uses only the visibly synthetic key
`synthetic-p3-001-hmac-test-key-0000000000000001`. A future transport adapter
must obtain live key material through its separately governed secret boundary,
establish replay/idempotency/rate/budget facts, create the normalizer, and keep
the context inaccessible to the network caller. Invalid, incomplete, accessor,
or callback-bearing context fails closed as `TRUST_CONTEXT_UNAVAILABLE`.

The context contains facts, not replaceable validation logic. There is no
verifier, schema, policy, clock callback, rate-limiter callback, or dependency
injection hook. Extra arguments to `normalize` are ignored and cannot bypass
the internally fixed checks.

## Signed request and canonicalization

The request is a closed object with these fields:

```text
schemaVersion, requestId, method, routeClass, source, audience,
issuedAtEpochSeconds, expiresAtEpochSeconds, nonce, idempotencyKey,
signatureAlgorithm, signature, bodyBytes, signal
```

`method` is exactly `POST`, `routeClass` is exactly
`aggregate_or_lifecycle_ingest`, `audience` is exactly
`staff-control-signal-ingestion`, and `signatureAlgorithm` is exactly
`hmac-sha256`. Authentication lifetime is at most 300 seconds and the maximum
future clock skew is 60 seconds.

The canonical signing representation is deterministic JSON of all request
fields except `signature`:

1. objects are serialized with keys sorted by Unicode code-unit order;
2. arrays retain their declared order;
3. strings, booleans, finite numbers, and null use JSON encoding;
4. no whitespace is emitted; and
5. HMAC-SHA256 is computed over the UTF-8 bytes and encoded as 64 lowercase
   hexadecimal characters.

The implementation calculates the HMAC itself with `createHmac` and compares
the decoded digest with `timingSafeEqual`. It never calls a supplied verifier.
`bodyBytes` must equal the UTF-8 byte length of the same canonical signal body
and may not exceed 65,536 bytes. Reordering object properties does not change
the signature; changing any signed semantic field does.

## Finite ingress contract

Only these source/category mappings can normalize:

| Recipient-authenticated source | Source class | Categories |
| --- | --- | --- |
| `google_analytics_aggregate` | `analytics_source` | hourly or daily analytics aggregate |
| `google_search_console_aggregate` | `analytics_source` | hourly or daily analytics aggregate |
| `booking_lifecycle_gateway` | `booking_control_plane` | essential booking lifecycle event |

Hourly windows are exactly 3,600,000 milliseconds and daily windows exactly
86,400,000 milliseconds. An aggregate contains 1-50 metrics sorted by unique
metric name. Each metric is a non-negative finite number with one finite unit:
`count`, `basis_points`, `milliseconds`, `bytes`, or
`currency_minor_units`. The signal marks aggregation complete and reports a
positive sample count. This contract verifies structure and cardinality, not
the external correctness of an analytics calculation.

Essential booking lifecycle input is limited to:

- `booking_created`;
- `booking_confirmed`;
- `booking_cancelled`;
- `guest_checked_in`; and
- `guest_checked_out`.

Its closed data object contains only the event type, an opaque lifecycle
reference, the fixed property scope `sut-grand-hotel`, and positive state and
change sequence integers. Guest names, email addresses, payment data, price
changes, inventory commands, free-form booking payloads, and additional fields
are not admitted. The source adapter remains responsible for producing an
appropriately minimized opaque reference.

The four P2-006 raw source-only categories are always rejected:
`raw_page_view`, `raw_click`, `raw_scroll`, and
`raw_marketing_telemetry`. Embedded raw-event/click/scroll/interaction shapes
are also rejected. AI, workflow, approval, authorization, incident,
investigation, execution, outcome, and other control-plane categories cannot
enter through this route. The endpoint never creates one work item or AI call
per accepted or rejected event.

## Operational fail-closed checks

Before returning an accepted normalized envelope, the module requires:

- valid closed request and signal shapes;
- the exact V1 route, method, algorithm, and audience;
- valid HMAC-SHA256 authentication;
- valid issue/expiry times and recipient current-time comparison;
- recipient nonce state `fresh`;
- recipient idempotency state `new`;
- request body within the exact byte limit;
- caller and route states both `within_limit`;
- budget authority `available`, configuration `valid`, and meter `fresh`;
- a budget observation no older than the configured maximum, which itself is
  bounded to 300 seconds; and
- budget state below `warning_90`.

Missing, unknown, unavailable, inconsistent, stale, malformed, replayed,
duplicate, conflicting, exceeded, warning-90, or hard-limit facts deny the
request. Duplicate-same-request is returned as a deterministic rejection and
does not redispatch; a future trusted adapter may separately return a previously
committed result under its idempotency contract.

## Result boundary and failure semantics

Every call is total: malformed input, throwing accessors and proxies, cyclic
data, symbols, functions, bigints, non-finite numbers, non-plain prototypes,
and excessive depth return a deterministic deny rather than throwing. Results
are recursively frozen plain data and inputs are not mutated.

Every result contains the exact effects record below:

```json
{
  "aiInvocations": 0,
  "permanentWorkItemsCreated": 0,
  "persistenceWrites": 0,
  "queueMessages": 0,
  "workflowStarts": 0,
  "notifications": 0,
  "productionWrites": 0
}
```

An accepted result wraps a closed P1-001 normalized system-event envelope.
Analytics inputs become `analytics.aggregate.hourly` or
`analytics.aggregate.daily`; lifecycle inputs become the corresponding
`booking.lifecycle.*` type. No accepted payload is returned by reference.

A rejection has `ok: false`, `value: null`, `failClosed: true`, and one or more
finite reason codes in committed precedence. Internal context failure is
reported as `TRUST_CONTEXT_UNAVAILABLE`; no platform exception is exposed.

## Verification and rollback

The authorized contract test is:

```text
npm run test:signal-ingestion
```

It independently constructs canonical HMACs with the synthetic key, exercises
all accepted source/category mappings, mutation and fake-verifier attacks, raw
and control-plane denial, authentication/replay/idempotency/rate/budget
failures, cardinality and lifecycle vocabulary, P1-001 envelope semantics,
zero effects, frozen outputs, input immutability, and hostile never-throw
inputs.

Rollback is branch-level removal or reversion of the P3-001 service, validator,
and documentation. Historical task and verification evidence must be
preserved. There is no deployment, live credential, production write, schema
migration, queue, workflow, AI invocation, or external resource to roll back.
