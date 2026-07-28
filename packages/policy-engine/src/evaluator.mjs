/** Phase 1 deterministic evaluator. Its authority is committed and internal. */
import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { validateJsonSchema, validateSchemaKeywords } from "./json-schema-evaluator.mjs";

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const deny = (reasonCode, matchedPolicy = null) => ({ decision: "deny", matchedPolicy, failClosed: true, reasonCode });

function deepFreeze(value) {
  if (!isObject(value) && !Array.isArray(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function loadPrivateAuthority(relativePath) {
  try {
    return deepFreeze(JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")));
  } catch {
    return null;
  }
}

// Parse separate private values rather than sharing mutable JSON-module objects with callers.
const policyContract = loadPrivateAuthority("../../../policies/deterministic-authorization-policies-v2.json");
const policySchema = loadPrivateAuthority("../../../schemas/authorization-policy-contract-v2.schema.json");
const contextSchema = loadPrivateAuthority("../../../schemas/evaluation-context.schema.json");
const decisionSchema = loadPrivateAuthority("../../../schemas/evaluation-decision.schema.json");
const canonicalDependencies = Object.freeze({ policyContract, policySchema, contextSchema, decisionSchema });

function canonicalAuthoritiesAreValid() {
  try {
    return validateSchemaKeywords(policySchema) && validateSchemaKeywords(contextSchema) && validateSchemaKeywords(decisionSchema) &&
      validateJsonSchema(policyContract, policySchema);
  } catch {
    return false;
  }
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

function dependenciesMatchCanonical(dependencies) {
  try {
    if (!isObject(dependencies)) return false;
    const expectedKeys = Object.keys(canonicalDependencies);
    if (Object.keys(dependencies).length !== expectedKeys.length) return false;
    if (expectedKeys.some((key) => !Object.hasOwn(dependencies, key))) return false;
    if (!canonicalAuthoritiesAreValid()) return false;
    if (!validateSchemaKeywords(dependencies.policySchema)) return false;
    if (!validateSchemaKeywords(dependencies.contextSchema)) return false;
    if (!validateSchemaKeywords(dependencies.decisionSchema)) return false;
    if (!validateJsonSchema(dependencies.policyContract, dependencies.policySchema)) return false;
    return expectedKeys.every((key) => isDeepStrictEqual(dependencies[key], canonicalDependencies[key]));
  } catch {
    return false;
  }
}

/** Test-only guard: supplied values are checked against private canonical authority and never used to evaluate. */
export function evaluatePolicyWithDependencies(requestContext, dependencies) {
  if (!dependenciesMatchCanonical(dependencies)) return deny("SCHEMA_VALIDATION_FAILED");
  return evaluatePolicy(requestContext);
}
