/**
 * Phase 1 Deterministic Policy Evaluator Engine
 * Classification: Runtime Capability Evaluation Engine (Pure offline JS evaluation module)
 * Authoritative Sources of Truth:
 *   - schemas/authorization-policy-contract.schema.json
 *   - policies/deterministic-authorization-policies-v1.json
 */

const forbiddenTerms = new Set([
  "database",
  "sql",
  "rls",
  "credential",
  "credentials",
  "guest",
  "payment",
  "liveservice",
  "live_service",
  "confidential",
  "guest_pii",
  "payment_metadata"
]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function containsForbiddenTerm(value) {
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    for (const term of forbiddenTerms) {
      if (lower.includes(term)) return true;
    }
    return false;
  }
  if (isObject(value)) {
    return Object.entries(value).some(
      ([key, child]) => forbiddenTerms.has(key.toLowerCase()) || containsForbiddenTerm(key) || containsForbiddenTerm(child)
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenTerm(item));
  }
  return false;
}

/**
 * Validates policy contract artifact against schema structure.
 */
function validateContractAgainstSchema(contract, schemaDoc) {
  if (!isObject(contract) || !isObject(schemaDoc)) return false;
  if (schemaDoc.$schema !== "https://json-schema.org/draft/2020-12/schema") return false;
  if (contract.schemaVersion !== "1.0.0") return false;
  if (!isObject(contract.policies) || !isObject(contract.defaults)) return false;
  if (contract.defaults.defaultEffect !== "deny" || contract.defaults.failClosed !== true || contract.defaults.requireExplicitAllow !== true) return false;

  const requiredPolicies = ["platform_read_only", "governance_gated_change", "production_write_restricted"];
  for (const name of requiredPolicies) {
    const policy = contract.policies[name];
    if (!isObject(policy) || typeof policy.targetAction !== "string" || typeof policy.defaultEffect !== "string" || policy.evaluatorMode !== "deterministic") {
      return false;
    }
  }

  return !containsForbiddenTerm(contract);
}

/**
 * Evaluates an authorization request context deterministically against authoritative policy contract & schema.
 * @param {object} requestContext - Context object containing principalClass, resourceClass, targetAction, dataClassification, tenantScopeRequired
 * @param {object} policyContractDoc - Loaded policies/deterministic-authorization-policies-v1.json object
 * @param {object} schemaDoc - Loaded schemas/authorization-policy-contract.schema.json object
 * @returns {object} Evaluation result object { decision, matchedPolicy, failClosed, reasonCode }
 */
export function evaluatePolicy(requestContext, policyContractDoc, schemaDoc) {
  // 1. Schema & Contract Integrity Check (Fail-closed if schema/contract is invalid)
  if (!validateContractAgainstSchema(policyContractDoc, schemaDoc)) {
    return {
      decision: "deny",
      matchedPolicy: null,
      failClosed: true,
      reasonCode: "SCHEMA_VALIDATION_FAILED"
    };
  }

  // 2. Request Context Structure & Type Validation
  if (!isObject(requestContext)) {
    return {
      decision: "deny",
      matchedPolicy: null,
      failClosed: true,
      reasonCode: "INVALID_REQUEST_CONTEXT"
    };
  }

  const requiredContextKeys = [
    "principalClass",
    "resourceClass",
    "targetAction",
    "dataClassification",
    "tenantScopeRequired"
  ];

  for (const key of requiredContextKeys) {
    if (!Object.hasOwn(requestContext, key)) {
      return {
        decision: "deny",
        matchedPolicy: null,
        failClosed: true,
        reasonCode: "INVALID_REQUEST_CONTEXT"
      };
    }
  }

  if (
    typeof requestContext.principalClass !== "string" ||
    typeof requestContext.resourceClass !== "string" ||
    typeof requestContext.targetAction !== "string" ||
    typeof requestContext.dataClassification !== "string" ||
    typeof requestContext.tenantScopeRequired !== "boolean" ||
    requestContext.principalClass.trim() === "" ||
    requestContext.resourceClass.trim() === "" ||
    requestContext.targetAction.trim() === ""
  ) {
    return {
      decision: "deny",
      matchedPolicy: null,
      failClosed: true,
      reasonCode: "INVALID_REQUEST_CONTEXT"
    };
  }

  // 3. Confidentiality & Non-Discretionary Security Boundary Check
  const classificationLower = requestContext.dataClassification.toLowerCase();
  if (
    classificationLower !== "public" ||
    containsForbiddenTerm(requestContext)
  ) {
    return {
      decision: "deny",
      matchedPolicy: null,
      failClosed: true,
      reasonCode: "CONFIDENTIAL_DATA_RESTRICTED"
    };
  }

  // 4. Policy Matching Logic
  const policies = policyContractDoc.policies;

  if (requestContext.targetAction === policies.platform_read_only.targetAction) {
    if (requestContext.dataClassification === "public" && requestContext.tenantScopeRequired === true) {
      return {
        decision: "allow",
        matchedPolicy: "platform_read_only",
        failClosed: true,
        reasonCode: "EXPLICIT_ALLOW_MATCHED"
      };
    }
    return {
      decision: "deny",
      matchedPolicy: "platform_read_only",
      failClosed: true,
      reasonCode: "READ_ONLY_SAFETY_BOUNDARY_VIOLATION"
    };
  }

  if (requestContext.targetAction === policies.governance_gated_change.targetAction) {
    return {
      decision: "deny",
      matchedPolicy: "governance_gated_change",
      failClosed: true,
      reasonCode: "GOVERNANCE_GATED_DENIED"
    };
  }

  if (requestContext.targetAction === policies.production_write_restricted.targetAction) {
    return {
      decision: "deny",
      matchedPolicy: "production_write_restricted",
      failClosed: true,
      reasonCode: "PRODUCTION_WRITE_RESTRICTED_DENIED"
    };
  }

  // 5. Default Deny Fallback
  return {
    decision: "deny",
    matchedPolicy: null,
    failClosed: true,
    reasonCode: "DEFAULT_DENY_UNMATCHED"
  };
}
