# Deterministic Policy Evaluator Design Specification

## 1. Classification & Overview

- **Task Classification**: **Runtime Capability Evaluation Engine** (Pure offline JS evaluation module).
- **Primary Task ID**: `SUT-AIOS-P1-005` (*"Implement deterministic policy evaluator"*)
- **Governance Planning Tasks**: `SUT-AIOS-GOV-025`, `SUT-AIOS-GOV-027`, `SUT-AIOS-GOV-031`
- **Verifier Admission Task**: `SUT-AIOS-GOV-026`

This document defines the technical architecture, security semantics, authoritative sources of truth, non-goals, and executable verification plan for the Phase 1 deterministic policy evaluator engine ([evaluator.mjs](../../packages/policy-engine/src/evaluator.mjs)).

## 2. Authoritative Sources of Truth

The policy evaluator engine evaluates authorization requests strictly against four immutable repository sources of truth:
1. **V2 Policy Contract Schema**: [schemas/authorization-policy-contract-v2.schema.json](../../schemas/authorization-policy-contract-v2.schema.json) (V2-only authority; V1 contracts are rejected at runtime)
2. **Evaluation Context Schema**: [schemas/evaluation-context.schema.json](../../schemas/evaluation-context.schema.json) (type-only `string` + `minLength: 1` for `principalClass` and `resourceClass`)
3. **Evaluation Decision Schema**: [schemas/evaluation-decision.schema.json](../../schemas/evaluation-decision.schema.json)
4. **V2 Policy Contract Artifact**: [policies/deterministic-authorization-policies-v2.json](../../policies/deterministic-authorization-policies-v2.json)

The evaluator engine MUST load and validate policy contracts against their JSON schema using the neutral shared Draft 2020-12 evaluator ([json-schema-evaluator.mjs](../../scripts/verify/json-schema-evaluator.mjs)) prior to processing any evaluation request. Deep structural schema verification (exact `$id` identity, root type, mandatory required fields, and nested policy property definitions) is enforced before schema evaluation proceeds. If schema validation fails, the evaluator engine enters a fail-closed state and rejects all input evaluations with `SCHEMA_VALIDATION_FAILED`.

## 3. Precise Scope & Context Boundaries

P1-005 delivers a pure, deterministic, zero-dependency Node.js ES module under `packages/policy-engine/`:
- [evaluator.mjs](../../packages/policy-engine/src/evaluator.mjs): Core evaluation function `evaluatePolicy(requestContext, policyContractDoc, policySchemaDoc, contextSchemaDoc, decisionSchemaDoc)`.
- Input Evaluation Context (`requestContext`):
  ```json
  {
    "principalClass": "bounded_agent_or_staff",
    "resourceClass": "repository_public_metadata",
    "targetAction": "read_only_platform_inspection",
    "dataClassification": "public",
    "tenantScopeRequired": true
  }
  ```
  *Tenant Trust Boundary*: `requestContext` represents a prevalidated internal execution context constructed by trusted kernel/dispatcher components. It MUST NOT be constructed directly from untrusted external HTTP request bodies or raw client inputs.

- Output Evaluation Decision:
  ```json
  {
    "decision": "allow" | "deny",
    "matchedPolicy": "platform_read_only" | "governance_gated_change" | "production_write_restricted" | null,
    "failClosed": true,
    "reasonCode": "EXPLICIT_ALLOW_MATCHED" | "READ_ONLY_SAFETY_BOUNDARY_VIOLATION" | "GOVERNANCE_GATED_DENIED" | "PRODUCTION_WRITE_RESTRICTED_DENIED" | "CONFIDENTIAL_DATA_RESTRICTED" | "INVALID_PRINCIPAL_OR_RESOURCE" | "INVALID_REQUEST_CONTEXT" | "SCHEMA_VALIDATION_FAILED" | "DEFAULT_DENY_UNMATCHED"
  }
  ```

## 4. Explicit Non-Goals & Boundaries

P1-005 explicitly excludes and MUST NOT implement:
- HTTP endpoints, REST routers, or web application servers.
- JWT, OAuth2, session tokens, or API key validation.
- Database access, SQL queries, Supabase client calls, or Row-Level Security (RLS) policies.
- Network requests, RPC calls, or message queue consumers.
- Production write operations, pricing mutations, or credential handling.

## 5. Non-Discretionary Security Semantics & Anti-Exploit Defenses

1. **Schema-Bound Context Validation**: `requestContext` is validated against `schemas/evaluation-context.schema.json` with `additionalProperties: false`. Any unexpected, missing, or malformed field returns `{ decision: "deny", reasonCode: "INVALID_REQUEST_CONTEXT" }`.
2. **Principal & Resource Authorization**: The evaluator compares `principalClass` and `resourceClass` from the request context against the matched V2 policy rule's authoritative values. On `platform_read_only`, mismatches return `{ decision: "deny", reasonCode: "READ_ONLY_SAFETY_BOUNDARY_VIOLATION" }`. On other policies, mismatches return `{ decision: "deny", reasonCode: "INVALID_PRINCIPAL_OR_RESOURCE" }`. The context schema defines `principalClass` and `resourceClass` as `type: "string", minLength: 1` (type-only), so invalid non-string types fail at context validation with `INVALID_REQUEST_CONTEXT`, while valid strings that don't match the V2 policy rule reach the deterministic `INVALID_PRINCIPAL_OR_RESOURCE` or `READ_ONLY_SAFETY_BOUNDARY_VIOLATION` reason code.
3. **Confidentiality Protection**: Any evaluation context with `dataClassification` of `"confidential"`, `"restricted"`, `"guest_pii"`, or `"payment_metadata"` returns `{ decision: "deny", reasonCode: "CONFIDENTIAL_DATA_RESTRICTED" }`.
4. **Anti-Relabeling Exploit Defense**: Matching policy rules is bound to exact schema constants (`read_only_platform_inspection` with `defaultEffect: "allow"`). Mutating a contract to rename a write operation into a read-only policy rule evaluates to `deny`.
5. **Decision Schema Integrity**: Output decision objects are validated against `schemas/evaluation-decision.schema.json` before being returned.

## 6. Executable Verification Plan

The exact test command for P1-005 is:
```text
node tests/policy-engine/validate-deterministic-policy-evaluator.mjs
```

The task-specific validator must:
1. Load all authoritative JSON schemas and policy contract artifacts.
2. Verify positive allow decisions for authorized `platform_read_only` requests.
3. Systematically test negative & mutation cases (production write relabeling attack, unauthorized principals/resources, unexpected fields, bad types, confidential data, schema corruptions).
4. Run explicitly in CI workflow [.github/workflows/validate-governance.yml](../../.github/workflows/validate-governance.yml).
5. Produce reproducible verification evidence bound to the exact head commit SHA.
