/**
 * Phase 1 Deterministic Policy Evaluator Engine (V2 Runtime Authority & Hardened Schema Trust)
 * Classification: Runtime Capability Evaluation Engine (Pure offline JS evaluation module)
 * Authoritative Sources of Truth:
 *   - schemas/authorization-policy-contract-v2.schema.json
 *   - schemas/evaluation-context.schema.json
 *   - schemas/evaluation-decision.schema.json
 *   - policies/deterministic-authorization-policies-v2.json
 */

import { validateJsonSchema, validateSchemaKeywords } from "./json-schema-evaluator.mjs";

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
 * Validates a schema document node for exact identity, mandatory structure, and keyword constraints.
 */
function validateSchemaDoc(schemaDoc, expectedExactId, mandatoryRequiredFields, checkAdditionalPropsFalse = false) {
  if (!isObject(schemaDoc)) return false;
  if (schemaDoc.$schema !== "https://json-schema.org/draft/2020-12/schema") return false;
  if (schemaDoc.$id !== expectedExactId) return false;
  if (schemaDoc.type !== "object") return false;
  if (!isObject(schemaDoc.properties)) return false;
  if (!Array.isArray(schemaDoc.required)) return false;

  for (const field of mandatoryRequiredFields) {
    if (!schemaDoc.required.includes(field)) return false;
    if (!Object.hasOwn(schemaDoc.properties, field)) return false;
  }

  if (checkAdditionalPropsFalse && schemaDoc.additionalProperties !== false) return false;

  return validateSchemaKeywords(schemaDoc);
}

/**
 * Validates V2 policy contract artifact against V2 schema structure.
 */
function validateV2Contract(contract, policySchemaDoc) {
  if (!isObject(contract) || !isObject(policySchemaDoc)) return false;
  if (contract.schemaVersion !== "2.0.0") return false;
  if (!validateJsonSchema(contract, policySchemaDoc)) return false;
  return !containsForbiddenTerm(contract);
}

/**
 * Evaluates an authorization request context deterministically against authoritative V2 policy contract & mandatory schemas.
 * @param {object} requestContext - Prevalidated internal execution context object
 * @param {object} policyContractDoc - Loaded V2 policies artifact object
 * @param {object} policySchemaDoc - Mandatory schemas/authorization-policy-contract-v2.schema.json object
 * @param {object} contextSchemaDoc - Mandatory schemas/evaluation-context.schema.json object
 * @param {object} decisionSchemaDoc - Mandatory schemas/evaluation-decision.schema.json object
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
    if (
      !validateSchemaDoc(
        decisionSchemaDoc,
        "https://sut-ai-os.local/schemas/evaluation-decision.schema.json",
        ["decision", "matchedPolicy", "failClosed", "reasonCode"],
        true
      ) ||
      !validateJsonSchema(result, decisionSchemaDoc)
    ) {
      return {
        decision: "deny",
        matchedPolicy: null,
        failClosed: true,
        reasonCode: "SCHEMA_VALIDATION_FAILED"
      };
    }
    return result;
  };

  // 1. Mandatory Schemas Identity & Structural Integrity Check (Fail closed if ANY schema is missing, weakened, or untrusted)
  const isPolicySchemaTrusted = validateSchemaDoc(
    policySchemaDoc,
    "https://sut-ai-os.local/schemas/authorization-policy-contract-v2.schema.json",
    ["schemaVersion", "policies", "defaults"]
  );

  const isContextSchemaTrusted = validateSchemaDoc(
    contextSchemaDoc,
    "https://sut-ai-os.local/schemas/evaluation-context.schema.json",
    ["principalClass", "resourceClass", "targetAction", "dataClassification", "tenantScopeRequired"],
    true
  );

  const isDecisionSchemaTrusted = validateSchemaDoc(
    decisionSchemaDoc,
    "https://sut-ai-os.local/schemas/evaluation-decision.schema.json",
    ["decision", "matchedPolicy", "failClosed", "reasonCode"],
    true
  );

  if (!isPolicySchemaTrusted || !isContextSchemaTrusted || !isDecisionSchemaTrusted) {
    return {
      decision: "deny",
      matchedPolicy: null,
      failClosed: true,
      reasonCode: "SCHEMA_VALIDATION_FAILED"
    };
  }

  // 2. Policy Contract V2 Requirement & Schema Validation
  if (!validateV2Contract(policyContractDoc, policySchemaDoc)) {
    return makeDecision("deny", null, "SCHEMA_VALIDATION_FAILED");
  }

  // 3. Request Context Schema Validation (additionalProperties: false)
  if (!isObject(requestContext) || !validateJsonSchema(requestContext, contextSchemaDoc)) {
    return makeDecision("deny", null, "INVALID_REQUEST_CONTEXT");
  }

  // 4. Confidentiality & Non-Discretionary Security Boundary Check
  const classificationLower = requestContext.dataClassification.toLowerCase();
  if (classificationLower !== "public" || containsForbiddenTerm(requestContext)) {
    return makeDecision("deny", null, "CONFIDENTIAL_DATA_RESTRICTED");
  }

  // 5. V2 Policy Artifact as Authoritative Decision Authority
  const policies = policyContractDoc.policies;
  let matchedPolicyName = null;
  let matchedPolicyRule = null;

  for (const [name, rule] of Object.entries(policies)) {
    if (isObject(rule) && rule.targetAction === requestContext.targetAction) {
      matchedPolicyName = name;
      matchedPolicyRule = rule;
      break;
    }
  }

  if (!matchedPolicyName || !matchedPolicyRule) {
    return makeDecision("deny", null, "DEFAULT_DENY_UNMATCHED");
  }

  // Compare request fields directly against the matched V2 policy rule fields as source of truth
  const matchesV2Authority =
    requestContext.principalClass === matchedPolicyRule.principalClass &&
    requestContext.resourceClass === matchedPolicyRule.resourceClass &&
    requestContext.dataClassification === matchedPolicyRule.dataClassification &&
    requestContext.tenantScopeRequired === matchedPolicyRule.tenantScopeRequired;

  if (!matchesV2Authority) {
    if (matchedPolicyName === "platform_read_only") {
      return makeDecision("deny", matchedPolicyName, "READ_ONLY_SAFETY_BOUNDARY_VIOLATION");
    }
    return makeDecision("deny", matchedPolicyName, "INVALID_PRINCIPAL_OR_RESOURCE");
  }

  if (matchedPolicyRule.defaultEffect === "allow") {
    return makeDecision("allow", matchedPolicyName, "EXPLICIT_ALLOW_MATCHED");
  }

  if (matchedPolicyName === "governance_gated_change") {
    return makeDecision("deny", matchedPolicyName, "GOVERNANCE_GATED_DENIED");
  }

  if (matchedPolicyName === "production_write_restricted") {
    return makeDecision("deny", matchedPolicyName, "PRODUCTION_WRITE_RESTRICTED_DENIED");
  }

  return makeDecision("deny", matchedPolicyName, "DEFAULT_DENY_UNMATCHED");
}
