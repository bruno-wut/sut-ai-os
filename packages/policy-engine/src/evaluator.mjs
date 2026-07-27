/**
 * Phase 1 Deterministic Policy Evaluator Engine
 * Classification: Runtime Capability Evaluation Engine (Pure offline JS evaluation module)
 * Authoritative Sources of Truth:
 *   - schemas/authorization-policy-contract.schema.json
 *   - schemas/evaluation-context.schema.json
 *   - schemas/evaluation-decision.schema.json
 *   - policies/deterministic-authorization-policies-v2.json
 */

import { validateJsonSchema } from "./json-schema-evaluator.mjs";

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
 * Validates policy contract artifact against authoritative schema.
 */
function validateContract(contract, schemaDoc) {
  if (!isObject(contract) || !isObject(schemaDoc)) return false;
  if (!validateJsonSchema(contract, schemaDoc)) return false;
  return !containsForbiddenTerm(contract);
}

/**
 * Evaluates an authorization request context deterministically against authoritative policy contract & schemas.
 * @param {object} requestContext - Prevalidated internal execution context object
 * @param {object} policyContractDoc - Loaded policies artifact object
 * @param {object} policySchemaDoc - Loaded schemas/authorization-policy-contract.schema.json object
 * @param {object} contextSchemaDoc - Loaded schemas/evaluation-context.schema.json object
 * @param {object} decisionSchemaDoc - Loaded schemas/evaluation-decision.schema.json object
 * @returns {object} Evaluation result object { decision, matchedPolicy, failClosed, reasonCode }
 */
export function evaluatePolicy(requestContext, policyContractDoc, policySchemaDoc, contextSchemaDoc, decisionSchemaDoc) {
  const makeDecision = (decision, matchedPolicy, reasonCode) => {
    const result = {
      decision,
      matchedPolicy,
      failClosed: true,
      reasonCode
    };
    if (decisionSchemaDoc && !validateJsonSchema(result, decisionSchemaDoc)) {
      return {
        decision: "deny",
        matchedPolicy: null,
        failClosed: true,
        reasonCode: "SCHEMA_VALIDATION_FAILED"
      };
    }
    return result;
  };

  // 1. Policy Contract & Schema Integrity Check
  if (!validateContract(policyContractDoc, policySchemaDoc)) {
    return makeDecision("deny", null, "SCHEMA_VALIDATION_FAILED");
  }

  // 2. Request Context Structure & Schema Validation (additionalProperties: false)
  if (!isObject(requestContext)) {
    return makeDecision("deny", null, "INVALID_REQUEST_CONTEXT");
  }

  if (contextSchemaDoc && !validateJsonSchema(requestContext, contextSchemaDoc)) {
    return makeDecision("deny", null, "INVALID_REQUEST_CONTEXT");
  }

  // Basic property validation if schemaDoc not passed
  const requiredContextKeys = [
    "principalClass",
    "resourceClass",
    "targetAction",
    "dataClassification",
    "tenantScopeRequired"
  ];

  for (const key of requiredContextKeys) {
    if (!Object.hasOwn(requestContext, key)) {
      return makeDecision("deny", null, "INVALID_REQUEST_CONTEXT");
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
    return makeDecision("deny", null, "INVALID_REQUEST_CONTEXT");
  }

  // 3. Principal and Resource Authorization Check
  if (
    requestContext.principalClass !== "bounded_agent_or_staff" ||
    requestContext.resourceClass !== "repository_public_metadata"
  ) {
    return makeDecision("deny", null, "INVALID_PRINCIPAL_OR_RESOURCE");
  }

  // 4. Confidentiality & Non-Discretionary Security Boundary Check
  const classificationLower = requestContext.dataClassification.toLowerCase();
  if (
    classificationLower !== "public" ||
    containsForbiddenTerm(requestContext)
  ) {
    return makeDecision("deny", null, "CONFIDENTIAL_DATA_RESTRICTED");
  }

  // 5. Policy Matching & Anti-Relabeling Exploit Defense
  const policies = policyContractDoc.policies;

  // Exact rule match for platform_read_only
  if (
    requestContext.targetAction === "read_only_platform_inspection" &&
    policies?.platform_read_only?.targetAction === "read_only_platform_inspection" &&
    policies?.platform_read_only?.defaultEffect === "allow"
  ) {
    if (requestContext.dataClassification === "public" && requestContext.tenantScopeRequired === true) {
      return makeDecision("allow", "platform_read_only", "EXPLICIT_ALLOW_MATCHED");
    }
    return makeDecision("deny", "platform_read_only", "READ_ONLY_SAFETY_BOUNDARY_VIOLATION");
  }

  if (
    requestContext.targetAction === "governed_configuration_change" ||
    policies?.governance_gated_change?.targetAction === requestContext.targetAction
  ) {
    return makeDecision("deny", "governance_gated_change", "GOVERNANCE_GATED_DENIED");
  }

  if (
    requestContext.targetAction === "production_write_operation" ||
    policies?.production_write_restricted?.targetAction === requestContext.targetAction
  ) {
    return makeDecision("deny", "production_write_restricted", "PRODUCTION_WRITE_RESTRICTED_DENIED");
  }

  // 6. Default Deny Fallback
  return makeDecision("deny", null, "DEFAULT_DENY_UNMATCHED");
}
