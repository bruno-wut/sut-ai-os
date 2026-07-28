# P1-004 canonical architecture reconciliation

P1-004's final authority is deliberately static and V1-only:

- `policies/deterministic-authorization-policies-v1.json`
- `schemas/authorization-policy-contract-v1.schema.json`
- `tests/policy-definitions/validate-authorization-policies-v1.mjs`

The historical combined validator is a compatibility wrapper only. P1-004 defines finite taxonomy and defaults; it does not implement runtime authorization and has no dependency on P1-005.

Historical implementation and verification records remain retained under `evidence/verification/` as records of their original runs. This reconciliation is the current canonical architecture statement and does not restate historical approval, transition, CI, or merge claims.

Separate-identity approval is deferred because the current repository has a single maintainer identity.
