# Deterministic Policy Evaluator (P1-005)

P1-005 is a pure, deterministic V2 runtime evaluator. Its normal public interface is:

```js
evaluatePolicy(requestContext)
```

It obtains all authority internally from committed repository artifacts:

- `policies/deterministic-authorization-policies-v2.json`
- `schemas/authorization-policy-contract-v2.schema.json`
- `schemas/evaluation-context.schema.json`
- `schemas/evaluation-decision.schema.json`

V1 is a separate static contract and is not a runtime authority. The evaluator never accepts a caller-supplied contract or schema as authorization authority. A test-only dependency function exists solely to prove that non-canonical dependencies, including V1, are denied.

## Phase 1 decision boundary

The evaluator validates the complete request context and always returns a valid, fail-closed decision. It allows only the canonical public, tenant-scoped `read_only_platform_inspection` context. It denies unmatched actions, governance-gated changes, production-write operations, confidential or restricted classifications, invalid principal/resource bounds, and malformed input with deterministic reason codes. Internal validation failures return `SCHEMA_VALIDATION_FAILED`; malformed inputs never throw.

P1-005 has no HTTP surface, identity system, database, SQL, RLS, secrets, network access, production write, pricing, inventory, booking, or payment behavior.

## Verification

```text
node tests/policy-definitions/validate-authorization-policies-v2.mjs
node tests/policy-engine/validate-deterministic-policy-evaluator.mjs
```

The CI workflow explicitly runs the V1 validator, V2 validator, and policy evaluator validator.
