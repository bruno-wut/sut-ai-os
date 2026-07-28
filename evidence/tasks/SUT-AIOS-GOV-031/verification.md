# GOV-031 Final Schema Trust, Canonical Contracts & Evidence Closure

## Scope

- **Task ID**: `SUT-AIOS-GOV-031`
- **Objective**: Finalize P1-004/P1-005 schema trust, canonical contracts, and evidence closure.
- **Base Commit**: `cb9dde3` (`origin/main`)

## Implementations Delivered

### P1-004 Improvements
1. **V1 Validator Independence**: V1 validator now imports from neutral `scripts/verify/json-schema-evaluator.mjs` — no P1-005 dependency.
2. **Deep Structural Schema Validation**: `fullValidateV1()` verifies nested policy property definitions (each policy node must contain `properties`, `required`, `targetAction`, `defaultEffect`). Deeply weakened schemas with correct root shape but empty nested definitions are rejected.
3. **Old Combined Validator Retired**: `tests/policy-definitions/validate-authorization-policies.mjs` is now a clean V1 compatibility wrapper delegating to `validate-authorization-policies-v1.mjs`.
4. **Commit-Bound Evidence**: `evidence/tasks/SUT-AIOS-P1-004/reconciliation.md` binds exact GOV-030 head SHA, merge SHA, workflow run ID, and job ID.

### P1-005 Improvements
5. **Deep Schema-Weakening Closure**: `validateSchemaDoc()` in evaluator now verifies nested policy property definitions. Deeply weakened policy/context/decision schemas are rejected with `SCHEMA_VALIDATION_FAILED`.
6. **Nested Schema Corruption Tests**: 3 new deeply weakened schema tests (policy schema with empty nested defs, weakened policy schema + relabeling contract, weakened context schema).
7. **Reason-Code Determinism**: Context schema uses `type: "string", minLength: 1` for `principalClass`/`resourceClass` (type-only). `INVALID_PRINCIPAL_OR_RESOURCE` is deterministically reachable on non-`platform_read_only` policies. `READ_ONLY_SAFETY_BOUNDARY_VIOLATION` is returned for `platform_read_only` mismatches.
8. **Canonical Specification Updated**: P1-005 task packet amended with `supersededBy` and `supersessionNote` fields. Design document updated to V2-only authority, neutral shared evaluator, and deterministic reason-code semantics.
9. **Commit-Bound Evidence**: `evidence/tasks/SUT-AIOS-P1-005/reconciliation.md` binds GOV-029 head/merge/workflow/job and GOV-030 head/merge/workflow/job.

### Shared
10. **Neutral Shared Schema Evaluator**: `scripts/verify/json-schema-evaluator.mjs` created as a neutral shared module. `packages/policy-engine/src/json-schema-evaluator.mjs` re-exports from it.

## Verification Results

| Check | Command | Status | Detail |
|---|---|---|---|
| V1 Policy Contract | `node tests/policy-definitions/validate-authorization-policies-v1.mjs` | **PASS** | 167 exhaustive V1 mutation tests |
| V2 Policy Contract | `node tests/policy-definitions/validate-authorization-policies-v2.mjs` | **PASS** | 208 systematic V2 mutation tests |
| Policy Evaluator | `node tests/policy-engine/validate-deterministic-policy-evaluator.mjs` | **PASS** | 68 systematic test cases |
| V1 Wrapper | `node tests/policy-definitions/validate-authorization-policies.mjs` | **PASS** | Delegates to V1 validator |
| Verifier Self-Test | `node scripts/verify/verify-cli.mjs --self-test` | **PASS** | 57 checks |
| Fast Verification | `npm run verify:fast` | **PASS** | 4/4 sub-checks |
| Task Verification | `npm run verify:task -- --task SUT-AIOS-GOV-031` | **PASS** | `status: pass` |
| Prohibited Paths | Changed-path inspection | **PASS** | `forbiddenPathsUntouched: true` |

## Note on Independent Approval

Per the user's directive, genuine independent PR approval from a separate GitHub identity is required after CI succeeds on this PR. The implementer account cannot self-approve.
