# Append-Only Audit Contract

## Purpose and boundary

This is the Phase 1 static design contract for P1-003. It defines one finite, offline audit-record artifact and one deterministic validator. It does not create an audit database, write an audit event, enforce retention, provide legal compliance, hash live data, transmit telemetry, authorize a user, or delete a record.

P1-003 may create only the committed static contract artifact and its Node-built-in validator. It must not execute SQL, access Supabase or another database, create a table, read credentials, install packages, contact a network service, or persist records outside the repository artifact.

## Version 1 artifact

P1-003 must create `packages/audit-sdk/append-only-audit-contract-v1.json`. It is a closed JSON design document with `schemaVersion` exactly `1.0.0`, a closed `record` definition, and a closed `appendOnly` definition.

`record.fields` must contain exactly these non-empty primitive-type mappings:

| Field | Purpose |
| --- | --- |
| `id` | Stable audit-record identifier. |
| `correlationId` | Connects the record to the static control-plane chain. |
| `recordedAt` | Audit-record timestamp representation. |
| `actorType` | Bounded actor category. |
| `actorId` | Opaque actor identifier; not a staff profile or credential. |
| `actionType` | Bounded action classification. |
| `outcome` | Bounded outcome classification. |
| `previousHash` | Opaque predecessor link, nullable only for the first record. |
| `recordHash` | Opaque immutable-record digest representation. |

`appendOnly` must contain exactly `insertOnly`, `immutableFields`, and `chain`. `insertOnly` is `true`; `immutableFields` is the exact ordered record-field list above; and `chain` is a closed object containing exactly `previousField`, `hashField`, and `firstRecordPreviousHash`, with values `previousHash`, `recordHash`, and `null` respectively.

The contract is intentionally a schema-level statement of append-only semantics. It does not claim that a database, object store, event log, or application runtime enforces them.

## Exclusions

The contract excludes payload bodies, guest data, payment data, inventory data, pricing data, credentials, staff identity profiles, authorization, RLS, retention, deletion, legal hold, policy decisions, deployment records, workflow execution, live hash computation, storage engine selection, SQL types, indexes, transactions, concurrency, and network services. A separately approved task is required for any excluded concern.

## Deterministic validator

P1-003 must create `tests/audit/validate-append-only-audit-contract.mjs`. The only contract command is:

```text
node tests/audit/validate-append-only-audit-contract.mjs
```

The validator must use Node built-ins only, load the committed JSON artifact, make no writes, and make no network, database, queue, package-install, or environment-secret access. It must assert:

1. The committed version-1 artifact succeeds.
2. A missing or unexpected top-level field, unsupported schema version, missing or unexpected record field, and empty primitive type fail.
3. A missing, false, or unexpected append-only definition fails.
4. A missing immutable field, reordered immutable field list, malformed chain, or incorrect chain field mapping fails.
5. Any field or design property claiming payload, guest, payment, inventory, pricing, credential, authorization, RLS, retention, deletion, policy, database, migration, or live-service behavior fails.

It exits `0` only when every case has the expected result and exits non-zero with a concise diagnostic otherwise. It must not generate a record, digest, migration, or any other artifact.

## Handoff and rollback

The P1-003 reviewer must inspect the final diff against its packet, run the exact validator and `npm run verify:fast`, then record independent evidence. The machine verifier must separately and safely admit this exact test-path command before P1-003 can claim machine verification. Revert P1-003's static contract, validator, task-state record, and evidence together if the contract needs withdrawal; do not alter databases, policy, canonical architecture sources, or live audit records.
