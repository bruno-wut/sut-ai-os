# Deterministic Authorization Policies Contract

## Purpose and boundary

This is the Phase 1 static design contract for P1-004. It defines one finite, offline authorization-policy contract artifact and one deterministic validator. It does not create a live Policy Decision Point (PDP), Policy Enforcement Point (PEP), evaluation engine, database table, RLS policy, API middleware, or external authorization service.

P1-004 may create only the committed static contract artifact and its Node-built-in validator. It must not execute SQL, access Supabase or another database, read credentials, install packages, contact a network service, or evaluate runtime rules.

## Version 1 artifact

P1-004 must create `policies/deterministic-authorization-policies-v1.json`. It is a closed JSON design document with `schemaVersion` exactly `1.0.0`, a closed `policies` map, and a closed `defaults` definition.

`policies` must define closed policy rules with exact non-empty primitive-type mappings:

| Policy | Target Action | Default Effect | Evaluator Mode |
| --- | --- | --- | --- |
| `platform_read_only` | Read-only platform inspection | `allow` | `deterministic` |
| `governance_gated_change` | Governed configuration change | `deny` | `deterministic` |
| `production_write_restricted` | Production write operation | `deny` | `deterministic` |

`defaults` must contain `defaultEffect: "deny"`, `failClosed: true`, and `requireExplicitAllow: true`.

## Exclusions

The contract excludes dynamic policy evaluation, JWT validation, OAuth2 roles, staff identity profiles, guest data, payment operations, inventory/pricing mutation, RLS policies, SQL functions, live network calls, and database storage. A separately approved task is required for any excluded concern.

## Deterministic validator

P1-004 must create `tests/policy-definitions/validate-authorization-policies.mjs`. The only contract command is:

```text
node tests/policy-definitions/validate-authorization-policies.mjs
```

The validator must use Node built-ins only, load the committed JSON artifact, make no writes, and make no network, database, queue, package-install, or environment-secret access. It must assert:

1. The committed version-1 artifact succeeds.
2. A missing or unexpected top-level field, unsupported schema version, missing or unexpected policy rule, and empty primitive type fail.
3. A missing, false, or unexpected default definition fails (`defaultEffect` !== `"deny"`, `failClosed` !== `true`, `requireExplicitAllow` !== `true`).
4. Any field or design property claiming live evaluation, database, SQL, RLS, credential, guest, payment, or live-service behavior fails.

It exits `0` only when every case has the expected result and exits non-zero with a concise diagnostic otherwise.

## Handoff and rollback

The P1-004 reviewer must inspect the final diff against its packet, run the exact validator and `npm run verify:fast`, then record independent evidence. The machine verifier must separately and safely admit this exact test-path command before P1-004 can claim machine verification. Revert P1-004's static contract, validator, task-state record, and evidence together if the contract needs withdrawal.
