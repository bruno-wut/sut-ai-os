# P1-005 Final V2 Runtime Evaluator Reconciliation & Superseding Record

## Task & Workflow Lineage

- **Primary Task ID**: `SUT-AIOS-P1-005` (*"Implement deterministic policy evaluator"*)
- **Governance Planning Tasks**: `SUT-AIOS-GOV-025`, `SUT-AIOS-GOV-026`, `SUT-AIOS-GOV-027`, `SUT-AIOS-GOV-028`, `SUT-AIOS-GOV-029`, `SUT-AIOS-GOV-031`
- **Final Assurance Closure**: `SUT-AIOS-GOV-031` (*"Finalize P1-004/P1-005 schema trust, canonical contracts, and evidence closure"*)

## Supersession Summary

GOV-031 delivers the following corrections to P1-005's assurance chain:

1. **V2-Only Runtime Authority**: The evaluator (`packages/policy-engine/src/evaluator.mjs`) strictly requires `schemaVersion: "2.0.0"` policy contracts. V1 contracts are rejected with `SCHEMA_VALIDATION_FAILED`.
2. **Neutral Shared JSON Schema Evaluator**: The schema evaluation module has been moved from `packages/policy-engine/src/json-schema-evaluator.mjs` to `scripts/verify/json-schema-evaluator.mjs`. The policy-engine module re-exports from the neutral location. This ensures P1-004 and P1-005 validators share an identical schema evaluator without cross-task coupling.
3. **Deep Structural Schema Validation**: `validateSchemaDoc()` now verifies exact `$id` identity, root type, mandatory required fields, `properties` object presence, AND nested policy property definitions (checking that each policy node contains `properties`, `required`, `targetAction`, and `defaultEffect`). A correctly named schema with empty nested definitions is now rejected.
4. **Deterministic Reason-Code Semantics**: The context schema (`schemas/evaluation-context.schema.json`) uses `type: "string", minLength: 1` (type-only) for `principalClass` and `resourceClass` instead of `enum`. This makes `INVALID_PRINCIPAL_OR_RESOURCE` deterministically reachable: invalid non-string types fail at context validation with `INVALID_REQUEST_CONTEXT`, while valid strings that don't match the V2 policy rule return `READ_ONLY_SAFETY_BOUNDARY_VIOLATION` (for `platform_read_only`) or `INVALID_PRINCIPAL_OR_RESOURCE` (for other policies).
5. **Canonical Task Packet Updated**: P1-005 `technicalObjective` and `architectureReferences` amended via formal `done → done` supersession record to reference `schemas/authorization-policy-contract-v2.schema.json` and V2-only authority.
6. **Design Document Updated**: `docs/policy-engine/DETERMINISTIC_POLICY_EVALUATOR.md` updated to reference V2 schema, neutral shared evaluator, and deterministic reason-code semantics.

## Contract Lineage & Authoritative Artifacts

1. **V2 Policy Contract Schema**: [schemas/authorization-policy-contract-v2.schema.json](../../schemas/authorization-policy-contract-v2.schema.json)
2. **Evaluation Context Schema**: [schemas/evaluation-context.schema.json](../../schemas/evaluation-context.schema.json) (type-only `principalClass` and `resourceClass`)
3. **Evaluation Decision Schema**: [schemas/evaluation-decision.schema.json](../../schemas/evaluation-decision.schema.json)
4. **V2 Policy Contract Artifact**: [policies/deterministic-authorization-policies-v2.json](../../policies/deterministic-authorization-policies-v2.json)
5. **Neutral Shared Schema Evaluator**: [scripts/verify/json-schema-evaluator.mjs](../../scripts/verify/json-schema-evaluator.mjs)
6. **Runtime Evaluator**: [packages/policy-engine/src/evaluator.mjs](../../packages/policy-engine/src/evaluator.mjs)

## Commit & CI Binding

### GOV-029 (Schema Trust & Evidence Assurance)
- **Head SHA**: `5c1b435ed6270ba15b5a6da3d4f68b31033e18fd`
- **Merge SHA**: `b588b264ede58c3ab2e8f303e5dfcfe1cf3a61c7`
- **Workflow Run**: `30290437960`
- **Job**: `90058631804`
- **Tests Passed**: 67 evaluator tests, 225 policy-definitions tests

### GOV-030 (V1 Contract Isolation)
- **Head SHA**: `29db415cc981832d5153b5f5915c69097d4c294f`
- **Merge SHA**: `4f5cac983f803950955d0aa50910800be828f939`
- **Workflow Run**: `30290810526`
- **Job**: `90059845674`
- **Regression**: All three final validators executed successfully (167 V1 tests, 207 V2 tests, 67 evaluator tests)

## Reproducible Machine Evidence

- **Policy Evaluator Validator Command**:
  ```text
  node tests/policy-engine/validate-deterministic-policy-evaluator.mjs
  ```
- **Exact Evaluator Validator Output (GOV-031)**:
  ```json
  {"name":"deterministic-policy-evaluator","passed":true,"testsRun":68,"details":"evaluatePolicy verified against V2 policy contract authority, dedicated V2 schema, and mandatory JSON schemas with positive allow case, deep weakened-schema mitigation, deterministic INVALID_PRINCIPAL_OR_RESOURCE reason code, anti-relabeling exploit defense, and 67 systematic negative/mutation cases passed"}
  ```
- **GitHub Actions CI Workflow**: [.github/workflows/validate-governance.yml](../../.github/workflows/validate-governance.yml) (Explicit step: *Run P1-005 policy evaluator validator*)
