# Normalized System Event Contract

## Purpose and boundary

This is the Phase 1 static contract for a normalized system event. It is an interoperability boundary for later control-plane, audit, and workflow work; it is not an ingestion endpoint, queue message, database record, log transport, or authorization decision.

P1-001 creates only the schema and deterministic validator described below. It must not connect to a service, emit an event, write a database, read credentials, or accept live payloads.

## Version 1 envelope

The implementation artifact is `packages/event-contracts/normalized-system-event.schema.json`. Its root object is closed (`additionalProperties: false`) and requires exactly these envelope fields:

| Field | Contract |
| --- | --- |
| `schemaVersion` | The exact string `1.0.0`. A new incompatible envelope requires a new version and a separately approved task. |
| `eventId` | A non-empty string identifier for this event. |
| `correlationId` | A non-empty string identifier linking related events. It is an opaque identifier, not a guest or credential field. |
| `source` | A closed object with required, non-empty string fields `system` and `component`. |
| `type` | A non-empty lower-case dot-separated event type matching `^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$`. |
| `severity` | One of `info`, `warning`, `error`, or `critical`. |
| `occurredAt` | An RFC 3339 `date-time` string. |
| `payload` | A JSON object. Its contents are deliberately open in version 1, but it may not alter the closed envelope or substitute for required envelope fields. |

The schema must reject missing required fields, extra envelope fields, empty identifiers or source fields, malformed event types, unsupported severity values, invalid timestamps, and non-object payloads. The schema must not infer event delivery semantics, authentication, retries, ordering, idempotency, retention, personal-data classification, or authorization from the envelope.

## Deterministic validator

P1-001 must create `tests/event-contracts/validate-normalized-system-event-contract.mjs`. The only task-authorized contract command is:

```text
node tests/event-contracts/validate-normalized-system-event-contract.mjs
```

The validator must run without network, database, queue, environment-secret, package-install, or application dependencies. It must load the committed schema and assert all of the following finite cases:

1. One valid event with a closed envelope and object payload succeeds.
2. One case for each missing required envelope field fails.
3. An unexpected envelope field fails.
4. Empty `eventId`, `correlationId`, and source fields fail.
5. Malformed `type`, unsupported `severity`, invalid `occurredAt`, and non-object `payload` each fail.

It must exit `0` only when every assertion has the expected result and exit non-zero with a concise diagnostic otherwise. It must not write generated artifacts. The implementation may use Node built-ins only unless a separate approved task authorizes a dependency.

## Handoff and rollback

The P1-001 reviewer must inspect the final diff against its packet, run the exact command above and `npm run verify:fast`, and record independent evidence. Revert P1-001's schema, validator, task-state record, and evidence together if the contract requires withdrawal; do not mutate downstream tasks or canonical architecture sources.
