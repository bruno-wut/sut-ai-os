import { readFile } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharedPolicyContract from "../../policies/deterministic-authorization-policies-v2.json" with { type: "json" };
import sharedPolicySchema from "../../schemas/authorization-policy-contract-v2.schema.json" with { type: "json" };
import { evaluatePolicy, evaluatePolicyWithDependencies } from "../../packages/policy-engine/src/evaluator.mjs";
import { validateJsonSchema } from "../../packages/policy-engine/src/json-schema-evaluator.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const load = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), "utf8"));
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const copy = (value) => JSON.parse(JSON.stringify(value));
const validReadContext = { principalClass: "bounded_agent_or_staff", resourceClass: "repository_public_metadata", targetAction: "read_only_platform_inspection", dataClassification: "public", tenantScopeRequired: true };

try {
  const [v1Artifact, v2Artifact, v2Schema, contextSchema, decisionSchema] = await Promise.all([
    load("policies/deterministic-authorization-policies-v1.json"), load("policies/deterministic-authorization-policies-v2.json"),
    load("schemas/authorization-policy-contract-v2.schema.json"), load("schemas/evaluation-context.schema.json"), load("schemas/evaluation-decision.schema.json")
  ]);
  let testsRun = 0;
  const assertDecision = (context, message) => {
    let result;
    try { result = evaluatePolicy(context); } catch (error) { throw new Error(`${message}: threw ${error.message}`); }
    expect(validateJsonSchema(result, decisionSchema), `${message}: invalid decision ${JSON.stringify(result)}`);
    testsRun += 1;
    return result;
  };

  let result = assertDecision(validReadContext, "valid read context");
  expect(result.decision === "allow" && result.reasonCode === "EXPLICIT_ALLOW_MATCHED", "only canonical read context may allow");

  for (const [context, reasonCode] of [
    [{ ...validReadContext, targetAction: "governed_configuration_change" }, "GOVERNANCE_GATED_DENIED"],
    [{ ...validReadContext, targetAction: "production_write_operation" }, "PRODUCTION_WRITE_RESTRICTED_DENIED"],
    [{ ...validReadContext, dataClassification: "confidential" }, "CONFIDENTIAL_DATA_RESTRICTED"],
    [{ ...validReadContext, dataClassification: "restricted" }, "CONFIDENTIAL_DATA_RESTRICTED"],
    [{ ...validReadContext, principalClass: "anonymous" }, "READ_ONLY_SAFETY_BOUNDARY_VIOLATION"],
    [{ ...validReadContext, resourceClass: "other" }, "READ_ONLY_SAFETY_BOUNDARY_VIOLATION"],
    [{ ...validReadContext, tenantScopeRequired: false }, "READ_ONLY_SAFETY_BOUNDARY_VIOLATION"],
    [{ ...validReadContext, targetAction: "unmatched" }, "INVALID_REQUEST_CONTEXT"]
  ]) {
    result = assertDecision(context, `negative context ${JSON.stringify(context)}`);
    expect(result.decision === "deny" && result.reasonCode === reasonCode, `expected ${reasonCode}`);
  }

  const canonicalDependencyValues = { policyContract: v2Artifact, policySchema: v2Schema, contextSchema, decisionSchema };
  result = evaluatePolicyWithDependencies(validReadContext, canonicalDependencyValues);
  expect(result.decision === "allow" && result.reasonCode === "EXPLICIT_ALLOW_MATCHED", "test-only dependency guard must accept canonical values"); testsRun += 1;

  // The historical exploit mutated shared JSON-module objects and relabelled the allow rule.
  // The evaluator's separately parsed private authority must remain unchanged.
  const originalSharedRule = copy(sharedPolicyContract.policies.platform_read_only);
  const originalSharedTargetSchema = copy(sharedPolicySchema.properties.policies.properties.platform_read_only.properties.targetAction);
  try {
    sharedPolicyContract.policies.platform_read_only.targetAction = "production_write_operation";
    sharedPolicySchema.properties.policies.properties.platform_read_only.properties.targetAction = { type: "string" };
    result = assertDecision({ ...validReadContext, targetAction: "production_write_operation" }, "shared-module mutation exploit");
    expect(result.decision === "deny" && result.reasonCode === "PRODUCTION_WRITE_RESTRICTED_DENIED", "shared-module mutation must not relabel production write as allow");
  } finally {
    sharedPolicyContract.policies.platform_read_only = originalSharedRule;
    sharedPolicySchema.properties.policies.properties.platform_read_only.properties.targetAction = originalSharedTargetSchema;
  }

  // Test-only dependencies are validated by value against private canonical authority.
  const relabelledContract = copy(v2Artifact);
  relabelledContract.policies.platform_read_only.targetAction = "production_write_operation";
  const weakenedPolicySchema = copy(v2Schema);
  weakenedPolicySchema.properties.policies.properties.platform_read_only.properties.targetAction = { type: "string" };
  result = evaluatePolicyWithDependencies({ ...validReadContext, targetAction: "production_write_operation" }, { policyContract: relabelledContract, policySchema: weakenedPolicySchema, contextSchema, decisionSchema });
  expect(result.decision === "deny" && result.reasonCode === "SCHEMA_VALIDATION_FAILED", "weakened schema plus relabelled production write must fail closed"); testsRun += 1;

  const weakenedContextSchema = copy(contextSchema);
  weakenedContextSchema.properties.dataClassification = {};
  result = evaluatePolicyWithDependencies({ ...validReadContext, dataClassification: 7 }, { policyContract: v2Artifact, policySchema: v2Schema, contextSchema: weakenedContextSchema, decisionSchema });
  expect(result.decision === "deny" && result.reasonCode === "SCHEMA_VALIDATION_FAILED", "weakened context dependency cannot throw or authorize"); testsRun += 1;

  result = evaluatePolicyWithDependencies(validReadContext, { policyContract: v1Artifact, policySchema: v2Schema, contextSchema, decisionSchema });
  expect(result.decision === "deny" && result.reasonCode === "SCHEMA_VALIDATION_FAILED", "V1 artifact must be rejected by V2 runtime"); testsRun += 1;

  const throwingGetter = { ...validReadContext };
  Object.defineProperty(throwingGetter, "dataClassification", { enumerable: true, get() { throw new Error("malformed getter"); } });
  const throwingProxy = new Proxy({}, { ownKeys() { throw new Error("malformed proxy"); } });
  const circular = { ...validReadContext, extra: true };
  circular.self = circular;
  const malformedInputs = [
    ["null", null], ["undefined", undefined], ["number", 0], ["boolean", true], ["string", "request"],
    ["array", []], ["empty object", {}], ["non-string classification", { ...validReadContext, dataClassification: 8 }],
    ["additional property", { ...validReadContext, extra: true }], ["array principal", { ...validReadContext, principalClass: [] }],
    ["throwing getter", throwingGetter], ["throwing proxy", throwingProxy], ["circular object", circular]
  ];
  for (const [label, malformed] of malformedInputs) {
    result = assertDecision(malformed, `malformed input: ${label}`);
    expect(result.decision === "deny", `${label} must deny`);
    const repeated = assertDecision(malformed, `repeated malformed input: ${label}`);
    expect(isDeepStrictEqual(repeated, result), `${label} must return a deterministic deny`);
  }

  process.stdout.write(`${JSON.stringify({ name: "deterministic-policy-evaluator", passed: true, testsRun, details: "Canonical V2 runtime authority, closed dependency injection, V1 rejection, malformed-input fail-closed behavior, and focused relabelling regressions passed" })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ name: "deterministic-policy-evaluator", passed: false, details: error.message })}\n`);
  process.exitCode = 1;
}
