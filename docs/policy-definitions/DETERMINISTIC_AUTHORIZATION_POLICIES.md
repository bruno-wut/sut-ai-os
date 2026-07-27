# Static Authorization Policy Taxonomy and Defaults Contract

## Purpose and boundary

This is the Phase 1 static design contract for P1-004. It defines one finite, offline static authorization policy taxonomy and defaults artifact (`policies/deterministic-authorization-policies-v1.json`), its formal JSON schema (`schemas/authorization-policy-contract.schema.json`), and one exhaustive deterministic validator (`tests/policy-definitions/validate-authorization-policies.mjs`).

This contract is a **policy taxonomy and default settings design document**, **not an operational authorization enforcement system**. It does not define or create:
- Live Policy Decision Points (PDP) or Policy Enforcement Points (PEP).
- Dynamic evaluation logic, JWT/OAuth token processing, or RBAC/ABAC middleware.
- Database tables, Row-Level Security (RLS) policies, or API authentication.
- Cryptographic provenance or live identity evaluation.

P1-004 may create only the committed static contract artifacts and Node-built-in validator. It must not execute SQL, access Supabase or another database, read credentials, install packages, contact a network service, or evaluate dynamic runtime rules.

## Version 1 artifact & schema binding

P1-004 creates `policies/deterministic-authorization-policies-v1.json`, which binds strictly to `schemas/authorization-policy-contract.schema.json`. It is a closed JSON design document with `schemaVersion` exactly `1.0.0`, a closed `policies` map, and a closed `defaults` definition.

### Policy taxonomy

| Policy | Target Action | Default Effect | Evaluator Mode |
| --- | --- | --- | --- |
| `platform_read_only` | `read_only_platform_inspection` | `allow` | `deterministic` |
| `governance_gated_change` | `governed_configuration_change` | `deny` | `deterministic` |
| `production_write_restricted` | `production_write_operation` | `deny` | `deterministic` |

### Default security posture

`defaults` must contain exactly:
- `defaultEffect: "deny"`
- `failClosed: true`
- `requireExplicitAllow: true`

## Semantic safety boundary for `platform_read_only`

The default effect `allow` for `platform_read_only` applies **strictly to public, non-confidential static repository inspection and documentation**.

It is explicitly subject to the following non-discretionary boundaries:
1. **No Confidential Data Access**: `platform_read_only` does **NOT** grant authorization to access guest personal data, payment credentials, internal system secrets, environment keys, or unredacted audit telemetry.
2. **Tenant Scope Required**: Any future operational evaluation must require explicit `tenantScopeRequired: true` and data classification checks.
3. **Prerequisites for Runtime Evaluator Integration**: Before any downstream task (such as P1-005) implements a runtime policy evaluator, each policy rule must be extended with explicit contextual bounds:
   ```json
   {
     "principalClass": "bounded_agent_or_staff",
     "resourceClass": "repository_public_metadata",
     "dataClassification": "public",
     "tenantScopeRequired": true,
     "approvalRequired": false,
     "effect": "allow"
   }
   ```

## Exclusions

The contract excludes dynamic policy evaluation, JWT validation, OAuth2 roles, staff identity profiles, guest data, payment operations, inventory/pricing mutation, RLS policies, SQL functions, live network calls, and database storage. A separately approved task is required for any excluded concern.

## Deterministic validator

P1-004 creates `tests/policy-definitions/validate-authorization-policies.mjs`. The contract command is:

```text
node tests/policy-definitions/validate-authorization-policies.mjs
```

The validator uses Node built-ins only, loads the committed JSON artifact and its JSON schema, makes no writes, and makes no network, database, queue, package-install, or environment-secret access. It asserts:

1. The committed version-1 artifact succeeds structural, schema-bound, and semantic validation.
2. Missing or unexpected top-level fields, unsupported schema versions, missing or unexpected policy rules, and empty primitive types fail.
3. Missing, false, or unexpected default definitions fail (`defaultEffect` !== `"deny"`, `failClosed` !== `true`, `requireExplicitAllow` !== `true`).
4. Type mismatches (`null`, numbers, arrays, booleans) for any object or field fail.
5. Exhaustive mutation testing across all fields and forbidden terms (live evaluation, database, SQL, RLS, credential, guest, payment, live service) fail closed.

It exits `0` only when every positive and negative case has the expected result and exits non-zero with a concise diagnostic otherwise.

## Handoff and rollback

The P1-004 reviewer must inspect the final diff against its packet, run the exact validator and `npm run verify:fast`, then record independent evidence. Revert P1-004's static contract, schema, validator, task-state record, and evidence together if the contract needs withdrawal.
