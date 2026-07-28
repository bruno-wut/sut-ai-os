# P1-005 canonical architecture reconciliation

P1-005's final runtime authority is V2-only and internal to `evaluatePolicy(requestContext)`. It loads these committed artifacts itself:

- `policies/deterministic-authorization-policies-v2.json`
- `schemas/authorization-policy-contract-v2.schema.json`
- `schemas/evaluation-context.schema.json`
- `schemas/evaluation-decision.schema.json`

P1-004 V1 remains a static taxonomy contract. It is explicitly rejected as a non-canonical runtime dependency. Caller-supplied schemas and contracts cannot redirect runtime authorization; malformed input always returns a valid deterministic deny decision.

This Phase 1 evaluator permits only the explicit public, tenant-scoped read-only context. It denies governance-gated and production-write actions, restricted classifications, invalid bounds, unmatched actions, and malformed input. It has no production-system or network integration.

Historical implementation and verification artifacts are retained under `evidence/verification/` without alteration. This reconciliation deliberately does not assert a separate GitHub approval, evidence run, transition, CI result, or merge SHA not established for the final consolidation. Separate-identity approval is deferred under the current single-maintainer model.
