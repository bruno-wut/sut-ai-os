import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePolicy } from "../../packages/policy-engine/src/evaluator.mjs";
import { validateJsonSchema } from "../../packages/policy-engine/src/json-schema-evaluator.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const v1ArtifactPath = path.join(repositoryRoot, "policies/deterministic-authorization-policies-v1.json");
const v2ArtifactPath = path.join(repositoryRoot, "policies/deterministic-authorization-policies-v2.json");
const policySchemaPath = path.join(repositoryRoot, "schemas/authorization-policy-contract.schema.json");
const contextSchemaPath = path.join(repositoryRoot, "schemas/evaluation-context.schema.json");
const decisionSchemaPath = path.join(repositoryRoot, "schemas/evaluation-decision.schema.json");

const copy = (val) => JSON.parse(JSON.stringify(val));
const expect = (condition, description) => {
  if (!condition) throw new Error(description);
};

try {
  const v1Artifact = JSON.parse(await readFile(v1ArtifactPath, "utf8"));
  const v2Artifact = JSON.parse(await readFile(v2ArtifactPath, "utf8"));
  const policySchemaDoc = JSON.parse(await readFile(policySchemaPath, "utf8"));
  const contextSchemaDoc = JSON.parse(await readFile(contextSchemaPath, "utf8"));
  const decisionSchemaDoc = JSON.parse(await readFile(decisionSchemaPath, "utf8"));

  let testsRun = 0;
  const artifact = v2Artifact;

  // Helper assertion wrapper verifying exact decision schema compliance
  const evaluateAndAssert = (context, contractDoc, pSchemaDoc = policySchemaDoc) => {
    const res = evaluatePolicy(context, contractDoc, pSchemaDoc, contextSchemaDoc, decisionSchemaDoc);
    expect(validateJsonSchema(res, decisionSchemaDoc), `decision object ${JSON.stringify(res)} must strictly satisfy decisionSchemaDoc`);
    return res;
  };

  // --- 1. POSITIVE ALLOW TEST CASE ---
  const validReadContext = {
    principalClass: "bounded_agent_or_staff",
    resourceClass: "repository_public_metadata",
    targetAction: "read_only_platform_inspection",
    dataClassification: "public",
    tenantScopeRequired: true
  };

  const allowResult = evaluateAndAssert(validReadContext, artifact);
  expect(allowResult.decision === "allow", "valid read_only_platform_inspection request must evaluate to allow");
  expect(allowResult.matchedPolicy === "platform_read_only", "valid read_only request must match platform_read_only");
  expect(allowResult.failClosed === true, "evaluatePolicy result must carry failClosed === true");
  expect(allowResult.reasonCode === "EXPLICIT_ALLOW_MATCHED", "allowed result must carry EXPLICIT_ALLOW_MATCHED reason code");
  testsRun += 1;

  // --- 2. EXPLOIT MITIGATION: PRODUCTION WRITE RELABELING ATTACK ---
  const relabeledContract = copy(artifact);
  relabeledContract.policies.platform_read_only.targetAction = "production_write_operation";
  const exploitContext = {
    principalClass: "bounded_agent_or_staff",
    resourceClass: "repository_public_metadata",
    targetAction: "production_write_operation",
    dataClassification: "public",
    tenantScopeRequired: true
  };
  const exploitResult = evaluateAndAssert(exploitContext, relabeledContract);
  expect(exploitResult.decision === "deny", "production write relabeling exploit must evaluate to DENY");
  expect(exploitResult.reasonCode !== "EXPLICIT_ALLOW_MATCHED", "relabeling exploit must NOT produce EXPLICIT_ALLOW_MATCHED");
  testsRun += 1;

  // --- 3. PRINCIPAL AND RESOURCE AUTHORIZATION BOUNDS ---
  for (const badPrincipal of ["anonymous", "untrusted_user", "external_service", "guest", "admin"]) {
    const candidate = copy(validReadContext);
    candidate.principalClass = badPrincipal;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && (res.reasonCode === "INVALID_PRINCIPAL_OR_RESOURCE" || res.reasonCode === "INVALID_REQUEST_CONTEXT"), `unauthorized principalClass (${badPrincipal}) must be denied`);
    testsRun += 1;
  }

  for (const badResource of ["arbitrary_public_resource", "production_db", "user_profile", "guest_ledger"]) {
    const candidate = copy(validReadContext);
    candidate.resourceClass = badResource;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && (res.reasonCode === "INVALID_PRINCIPAL_OR_RESOURCE" || res.reasonCode === "INVALID_REQUEST_CONTEXT"), `unauthorized resourceClass (${badResource}) must be denied`);
    testsRun += 1;
  }

  // --- 4. UNEXPECTED REQUEST FIELDS (additionalProperties: false) ---
  const extraFieldCandidate = copy(validReadContext);
  extraFieldCandidate.unexpectedProperty = "unauthorized_payload";
  const extraRes = evaluateAndAssert(extraFieldCandidate, artifact);
  expect(extraRes.decision === "deny" && extraRes.reasonCode === "INVALID_REQUEST_CONTEXT", "unexpected context properties must fail closed with INVALID_REQUEST_CONTEXT");
  testsRun += 1;

  // --- 5. SCHEMA CORRUPTION BEYOND $schema ---
  const missingPoliciesContract = copy(artifact);
  delete missingPoliciesContract.policies;
  const missingPolRes = evaluateAndAssert(validReadContext, missingPoliciesContract);
  expect(missingPolRes.decision === "deny" && missingPolRes.reasonCode === "SCHEMA_VALIDATION_FAILED", "contract missing policies object must trigger SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  const corruptedDefaultsContract = copy(artifact);
  corruptedDefaultsContract.defaults.requireExplicitAllow = false;
  const corruptDefRes = evaluateAndAssert(validReadContext, corruptedDefaultsContract);
  expect(corruptDefRes.decision === "deny" && corruptDefRes.reasonCode === "SCHEMA_VALIDATION_FAILED", "corrupted defaults must trigger SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  // --- 6. INVALID TYPES & EMPTY/WHITESPACE VALUES FOR ALL CONTEXT FIELDS ---
  for (const badContext of [null, undefined, 123, "context_string", true, false, []]) {
    const res = evaluateAndAssert(badContext, artifact);
    expect(res.decision === "deny" && res.reasonCode === "INVALID_REQUEST_CONTEXT", `non-object requestContext (${JSON.stringify(badContext)}) must fail closed`);
    testsRun += 1;
  }

  for (const reqKey of ["principalClass", "resourceClass", "targetAction", "dataClassification", "tenantScopeRequired"]) {
    const candidate = copy(validReadContext);
    delete candidate[reqKey];
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && res.reasonCode === "INVALID_REQUEST_CONTEXT", `missing context key ${reqKey} must fail closed`);
    testsRun += 1;
  }

  for (const badVal of [null, 999, true, false, [], {}, "", "   ", "\t\n"]) {
    const candidate = copy(validReadContext);
    candidate.principalClass = badVal;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && (res.reasonCode === "INVALID_REQUEST_CONTEXT" || res.reasonCode === "INVALID_PRINCIPAL_OR_RESOURCE"), `invalid principalClass (${JSON.stringify(badVal)}) must fail closed`);
    testsRun += 1;
  }

  for (const badBool of ["true", "false", 1, 0, null, [], {}]) {
    const candidate = copy(validReadContext);
    candidate.tenantScopeRequired = badBool;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && res.reasonCode === "INVALID_REQUEST_CONTEXT", `invalid tenantScopeRequired (${JSON.stringify(badBool)}) must fail closed`);
    testsRun += 1;
  }

  // --- 7. SAFETY BOUNDARY: tenantScopeRequired === false ---
  const noTenantScope = copy(validReadContext);
  noTenantScope.tenantScopeRequired = false;
  const noTenantRes = evaluateAndAssert(noTenantScope, artifact);
  expect(noTenantRes.decision === "deny" && noTenantRes.reasonCode === "READ_ONLY_SAFETY_BOUNDARY_VIOLATION", "tenantScopeRequired === false must violate safety boundary");
  testsRun += 1;

  // --- 8. CONFIDENTIAL DATA CLASSIFICATIONS & FORBIDDEN TERMS ---
  for (const confidentialClass of ["confidential", "restricted", "guest_pii", "payment_metadata"]) {
    const candidate = copy(validReadContext);
    candidate.dataClassification = confidentialClass;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && res.reasonCode === "CONFIDENTIAL_DATA_RESTRICTED", `confidential data classification ${confidentialClass} must be denied`);
    testsRun += 1;
  }

  for (const term of ["guest_data", "payment_card", "sql_query", "database_table", "rls_policy", "secret_credential"]) {
    const candidate = copy(validReadContext);
    candidate.targetAction = term;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && (res.reasonCode === "CONFIDENTIAL_DATA_RESTRICTED" || res.reasonCode === "INVALID_REQUEST_CONTEXT"), `context with forbidden term ${term} must be denied`);
    testsRun += 1;
  }

  // --- 9. GOVERNED & PRODUCTION WRITE DENIALS ---
  const governedContext = {
    principalClass: "bounded_agent_or_staff",
    resourceClass: "repository_public_metadata",
    targetAction: "governed_configuration_change",
    dataClassification: "public",
    tenantScopeRequired: true
  };
  const governedRes = evaluateAndAssert(governedContext, artifact);
  expect(governedRes.decision === "deny" && governedRes.matchedPolicy === "governance_gated_change" && governedRes.reasonCode === "GOVERNANCE_GATED_DENIED", "governed configuration change must be denied");
  testsRun += 1;

  const prodWriteContext = {
    principalClass: "bounded_agent_or_staff",
    resourceClass: "repository_public_metadata",
    targetAction: "production_write_operation",
    dataClassification: "public",
    tenantScopeRequired: true
  };
  const prodWriteRes = evaluateAndAssert(prodWriteContext, artifact);
  expect(prodWriteRes.decision === "deny" && prodWriteRes.matchedPolicy === "production_write_restricted" && prodWriteRes.reasonCode === "PRODUCTION_WRITE_RESTRICTED_DENIED", "production write operation must be denied");
  testsRun += 1;

  // --- 10. UNRECOGNIZED TARGET ACTION & V1 COMPATIBILITY ---
  const v1Res = evaluateAndAssert(validReadContext, v1Artifact);
  expect(v1Res.decision === "allow" && v1Res.matchedPolicy === "platform_read_only", "v1 policy contract must also evaluate correctly");
  testsRun += 1;

  process.stdout.write(
    `${JSON.stringify({
      name: "deterministic-policy-evaluator",
      passed: true,
      testsRun,
      details: `evaluatePolicy verified against authoritative JSON schemas with positive allow case, anti-relabeling exploit defense, and ${testsRun - 1} systematic negative/mutation cases passed`
    })}\n`
  );
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ name: "deterministic-policy-evaluator", passed: false, details: error.message })}\n`
  );
  process.exitCode = 1;
}
