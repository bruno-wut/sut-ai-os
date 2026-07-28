/** Phase 1 deterministic evaluator. Its authority is committed and internal. */
import policyContract from "../../../policies/deterministic-authorization-policies-v2.json" with { type: "json" };
import policySchema from "../../../schemas/authorization-policy-contract-v2.schema.json" with { type: "json" };
import contextSchema from "../../../schemas/evaluation-context.schema.json" with { type: "json" };
import decisionSchema from "../../../schemas/evaluation-decision.schema.json" with { type: "json" };
import { validateJsonSchema, validateSchemaKeywords } from "./json-schema-evaluator.mjs";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const deny = (reasonCode, matchedPolicy = null) => ({ decision: "deny", matchedPolicy, failClosed: true, reasonCode });
const canonicalDependencies = Object.freeze({ policyContract, policySchema, contextSchema, decisionSchema });

function canonicalAuthoritiesAreValid() {
  return validateSchemaKeywords(policySchema) && validateSchemaKeywords(contextSchema) && validateSchemaKeywords(decisionSchema) &&
    validateJsonSchema(policyContract, policySchema);
}

function evaluate(requestContext) {
  if (!canonicalAuthoritiesAreValid()) return deny("SCHEMA_VALIDATION_FAILED");
  if (!isObject(requestContext) || !validateJsonSchema(requestContext, contextSchema)) return deny("INVALID_REQUEST_CONTEXT");
  if (requestContext.dataClassification !== "public") return deny("CONFIDENTIAL_DATA_RESTRICTED");

  const matched = Object.entries(policyContract.policies).find(([, rule]) => rule.targetAction === requestContext.targetAction);
  if (!matched) return deny("DEFAULT_DENY_UNMATCHED");
  const [matchedPolicy, rule] = matched;
  if (
    requestContext.principalClass !== rule.principalClass ||
    requestContext.resourceClass !== rule.resourceClass ||
    requestContext.tenantScopeRequired !== rule.tenantScopeRequired
  ) {
    return deny(matchedPolicy === "platform_read_only" ? "READ_ONLY_SAFETY_BOUNDARY_VIOLATION" : "INVALID_PRINCIPAL_OR_RESOURCE", matchedPolicy);
  }
  if (matchedPolicy === "platform_read_only" && rule.defaultEffect === "allow" && rule.approvalRequired === false) {
    return { decision: "allow", matchedPolicy, failClosed: true, reasonCode: "EXPLICIT_ALLOW_MATCHED" };
  }
  if (matchedPolicy === "governance_gated_change") return deny("GOVERNANCE_GATED_DENIED", matchedPolicy);
  if (matchedPolicy === "production_write_restricted") return deny("PRODUCTION_WRITE_RESTRICTED_DENIED", matchedPolicy);
  return deny("DEFAULT_DENY_UNMATCHED", matchedPolicy);
}

/** Normal runtime entry point. Callers cannot replace policy authority. */
export function evaluatePolicy(requestContext) {
  try {
    const result = evaluate(requestContext);
    return validateJsonSchema(result, decisionSchema) ? result : deny("SCHEMA_VALIDATION_FAILED");
  } catch {
    return deny("SCHEMA_VALIDATION_FAILED");
  }
}

/** Test-only guard: dependency injection is accepted only by exact canonical identity. */
export function evaluatePolicyWithDependencies(requestContext, dependencies) {
  if (dependencies !== canonicalDependencies) return deny("SCHEMA_VALIDATION_FAILED");
  return evaluatePolicy(requestContext);
}
