# Deterministic Policy Evaluator Design Specification

## 1. Classification & Overview

- **Task Classification**: **Runtime Capability Evaluation Engine** (Pure offline JS evaluation module).
- **Primary Task ID**: `SUT-AIOS-P1-005` (*"Implement deterministic policy evaluator"*)
- **Governance Planning Task**: `SUT-AIOS-GOV-025`
- **Verifier Admission Task**: `SUT-AIOS-GOV-026`

This document defines the technical architecture, security semantics, authoritative sources of truth, non-goals, and executable verification plan for the Phase 1 deterministic policy evaluator engine (`packages/policy-engine/src/evaluator.mjs`).

## 2. Authoritative Source of Truth

The policy evaluator engine evaluates authorization requests strictly against two immutable repository sources of truth:
1. **Authoritative JSON Schema**: [schemas/authorization-policy-contract.schema.json](file:///c:/Users/Bruno%20Browny/.gemini/antigravity/scratch/sut-ai-os/schemas/authorization-policy-contract.schema.json)
2. **Policy Contract Artifact**: [policies/deterministic-authorization-policies-v1.json](file:///c:/Users/Bruno%20Browny/.gemini/antigravity/scratch/sut-ai-os/policies/deterministic-authorization-policies-v1.json)

The evaluator engine MUST load and validate the policy contract against its JSON schema prior to processing any evaluation request. If schema validation fails, the evaluator engine enters a fail-closed state and rejects all input evaluations.

## 3. Precise Scope

P1-005 delivers a pure, deterministic, zero-dependency Node.js ES module under `packages/policy-engine/`:
- `packages/policy-engine/src/evaluator.mjs`: Core evaluation function `evaluatePolicy(requestContext, policyContractDoc, schemaDoc)`.
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
- Output Evaluation Decision:
  ```json
  {
    "decision": "allow" | "deny",
    "matchedPolicy": "platform_read_only" | null,
    "failClosed": true,
    "reasonCode": "EXPLICIT_ALLOW_MATCHED" | "DEFAULT_DENY_UNMATCHED" | "CONFIDENTIAL_DATA_RESTRICTED" | "SCHEMA_VALIDATION_FAILED"
  }
  ```

## 4. Explicit Non-Goals & Boundaries

P1-005 explicitly excludes and MUST NOT implement:
- HTTP endpoints, REST routers, or web application servers.
- JWT, OAuth2, session tokens, or API key validation.
- Database access, SQL queries, Supabase client calls, or Row-Level Security (RLS) policies.
- Network requests, RPC calls, or message queue consumers.
- Production write operations, pricing mutations, or credential handling.

## 5. Non-Discretionary Security Semantics

1. **Fail-Closed Posture**: Any missing, `null`, invalid, or unexpected field in `requestContext` MUST result in an explicit `{ decision: "deny", reasonCode: "INVALID_REQUEST_CONTEXT" }`.
2. **Confidentiality Protection**: Any evaluation context referencing `dataClassification` of `"confidential"`, `"restricted"`, `"guest_pii"`, or `"payment_metadata"` MUST return `{ decision: "deny", reasonCode: "CONFIDENTIAL_DATA_RESTRICTED" }`.
3. **`platform_read_only` Rule Boundary**: `platform_read_only` evaluates to `allow` ONLY when:
   - `targetAction === "read_only_platform_inspection"`
   - `dataClassification === "public"`
   - `tenantScopeRequired === true`
   In all other cases, the evaluator returns `deny`.
4. **Governed & Production Write Denial**: Actions matching `governed_configuration_change` or `production_write_operation` MUST evaluate to `deny` under P1-005.

## 6. Executable Verification Plan

The exact test command for P1-005 is:
```text
node tests/policy-engine/validate-deterministic-policy-evaluator.mjs
```

The task-specific validator must:
1. Load `schemas/authorization-policy-contract.schema.json` and `policies/deterministic-authorization-policies-v1.json`.
2. Verify all valid evaluation contexts yield correct decision outputs.
3. Systematically test negative & mutation cases (missing fields, bad types, confidential data, unexpected actions, schema corruption).
4. Run explicitly in CI workflow `.github/workflows/validate-governance.yml`.
5. Produce reproducible verification evidence bound to the exact head commit SHA.
