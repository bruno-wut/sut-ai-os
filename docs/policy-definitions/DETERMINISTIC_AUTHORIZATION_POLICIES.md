# Static Authorization Policy Taxonomy and Defaults Contract

P1-004 is a bounded, offline V1 contract. Its only authorities are:

- `policies/deterministic-authorization-policies-v1.json`
- `schemas/authorization-policy-contract-v1.schema.json`
- `tests/policy-definitions/validate-authorization-policies-v1.mjs`

The V1 artifact defines the finite policy taxonomy and its defaults. It does **not** perform runtime authorization, identify callers, approve changes, access a service, or grant production access. P1-005 owns the separate V2 runtime evaluator.

## V1 taxonomy

| Policy | Target action | `defaultEffect` |
| --- | --- | --- |
| `platform_read_only` | `read_only_platform_inspection` | `allow` |
| `governance_gated_change` | `governed_configuration_change` | `deny` |
| `production_write_restricted` | `production_write_operation` | `deny` |

The closed defaults are `defaultEffect: "deny"`, `failClosed: true`, and `requireExplicitAllow: true`. The V1 `allow` entry is taxonomy only; it is not a runtime authorization result.

## Validation

Run the dedicated V1 validator:

```text
node tests/policy-definitions/validate-authorization-policies-v1.mjs
```

It loads the committed V1 artifact and canonical V1 schema, then verifies the documented finite contract and focused invalid mutations without network or external state.

`node tests/policy-definitions/validate-authorization-policies.mjs` remains only as a compatibility wrapper for the dedicated V1 validator. It is not a separate authority.

## Exclusions

P1-004 excludes dynamic policy evaluation, HTTP, identity or token validation, database or RLS work, credentials, production operations, guest data, payments, inventory, pricing, and network access.
