import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePolicy } from "../../packages/policy-engine/src/evaluator.mjs";
import { validateJsonSchema } from "../../scripts/verify/json-schema-evaluator.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const v1ArtifactPath = path.join(repositoryRoot, "policies/deterministic-authorization-policies-v1.json");
const v2ArtifactPath = path.join(repositoryRoot, "policies/deterministic-authorization-policies-v2.json");
const v2PolicySchemaPath = path.join(repositoryRoot, "schemas/authorization-policy-contract-v2.schema.json");
const contextSchemaPath = path.join(repositoryRoot, "schemas/evaluation-context.schema.json");
const decisionSchemaPath = path.join(repositoryRoot, "schemas/evaluation-decision.schema.json");

const copy = (val) => JSON.parse(JSON.stringify(val));
const expect = (condition, description) => {
  if (!condition) throw new Error(description);
};

try {
  const v1Artifact = JSON.parse(await readFile(v1ArtifactPath, "utf8"));
  const v2Artifact = JSON.parse(await readFile(v2ArtifactPath, "utf8"));
  const v2PolicySchemaDoc = JSON.parse(await readFile(v2PolicySchemaPath, "utf8"));
  const contextSchemaDoc = JSON.parse(await readFile(contextSchemaPath, "utf8"));
  const decisionSchemaDoc = JSON.parse(await readFile(decisionSchemaPath, "utf8"));

  let testsRun = 0;
  const artifact = v2Artifact;

  // Unconditional decision assertion test helper
  const evaluateAndAssert = (context, contractDoc, pSchemaDoc = v2PolicySchemaDoc, cSchemaDoc = contextSchemaDoc, dSchemaDoc = decisionSchemaDoc) => {
    const res = evaluatePolicy(context, contractDoc, pSchemaDoc, cSchemaDoc, dSchemaDoc);
    // Unconditional assertion against trusted decisionSchemaDoc
    expect(validateJsonSchema(res, decisionSchemaDoc), `decision object ${JSON.stringify(res)} must strictly satisfy decisionSchemaDoc`);
    return res;
  };

  // --- 1. POSITIVE ALLOW TEST CASE (V2 CONTRACT AUTHORITY & DEDICATED V2 SCHEMA) ---
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

  // --- 2. RUNTIME REJECTION OF V1 CONTRACT ---
  const v1Rejection = evaluateAndAssert(validReadContext, v1Artifact);
  expect(v1Rejection.decision === "deny" && v1Rejection.reasonCode === "SCHEMA_VALIDATION_FAILED", "V1 policy contract must be rejected in P1-005 runtime evaluation with SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  // --- 3. MISSING MANDATORY SCHEMAS ---
  expect(evaluateAndAssert(validReadContext, artifact, null, contextSchemaDoc, decisionSchemaDoc).reasonCode === "SCHEMA_VALIDATION_FAILED", "missing v2PolicySchemaDoc must fail with SCHEMA_VALIDATION_FAILED");
  expect(evaluateAndAssert(validReadContext, artifact, v2PolicySchemaDoc, null, decisionSchemaDoc).reasonCode === "SCHEMA_VALIDATION_FAILED", "missing contextSchemaDoc must fail with SCHEMA_VALIDATION_FAILED");
  expect(evaluatePolicy(validReadContext, artifact, v2PolicySchemaDoc, contextSchemaDoc, null).reasonCode === "SCHEMA_VALIDATION_FAILED", "missing decisionSchemaDoc must fail with SCHEMA_VALIDATION_FAILED");
  testsRun += 3;

  // --- 4. STRUCTURALLY WEAKENED & DEEPLY CORRUPTED SCHEMAS ---
  const weakenedPolicySchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://sut-ai-os.local/schemas/authorization-policy-contract-v2.schema.json"
  };
  expect(evaluateAndAssert(validReadContext, artifact, weakenedPolicySchema, contextSchemaDoc, decisionSchemaDoc).reasonCode === "SCHEMA_VALIDATION_FAILED", "structurally weakened policy schema must fail with SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  const deeplyWeakenedPolicySchema = copy(v2PolicySchemaDoc);
  delete deeplyWeakenedPolicySchema.properties.policies.properties.platform_read_only.properties;
  expect(evaluateAndAssert(validReadContext, artifact, deeplyWeakenedPolicySchema, contextSchemaDoc, decisionSchemaDoc).reasonCode === "SCHEMA_VALIDATION_FAILED", "deeply weakened policy schema must fail with SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  // Deeply weakened policy schema combined with production-write relabeling contract
  const relabeledContract = copy(artifact);
  relabeledContract.policies.platform_read_only.targetAction = "production_write_operation";
  expect(evaluateAndAssert(validReadContext, relabeledContract, deeplyWeakenedPolicySchema, contextSchemaDoc, decisionSchemaDoc).reasonCode === "SCHEMA_VALIDATION_FAILED", "weakened policy schema + relabeling contract must fail with SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  const weakenedContextSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://sut-ai-os.local/schemas/evaluation-context.schema.json"
  };
  expect(evaluateAndAssert(validReadContext, artifact, v2PolicySchemaDoc, weakenedContextSchema, decisionSchemaDoc).reasonCode === "SCHEMA_VALIDATION_FAILED", "structurally weakened context schema must fail with SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  const weakenedDecisionSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://sut-ai-os.local/schemas/evaluation-decision.schema.json"
  };
  expect(evaluatePolicy(validReadContext, artifact, v2PolicySchemaDoc, contextSchemaDoc, weakenedDecisionSchema).reasonCode === "SCHEMA_VALIDATION_FAILED", "structurally weakened decision schema must fail with SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  // Wrong $id schema identity test
  const wrongIdPolicySchema = copy(v2PolicySchemaDoc);
  wrongIdPolicySchema.$id = "https://sut-ai-os.local/schemas/wrong-policy-id.json";
  expect(evaluateAndAssert(validReadContext, artifact, wrongIdPolicySchema, contextSchemaDoc, decisionSchemaDoc).reasonCode === "SCHEMA_VALIDATION_FAILED", "schema with wrong $id must fail with SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  // --- 5. UNSUPPORTED SCHEMA KEYWORDS ---
  const unsupportedKeywordSchema = copy(v2PolicySchemaDoc);
  unsupportedKeywordSchema.unsupportedKeyword = true;
  expect(evaluateAndAssert(validReadContext, artifact, unsupportedKeywordSchema, contextSchemaDoc, decisionSchemaDoc).reasonCode === "SCHEMA_VALIDATION_FAILED", "schema with unsupported keyword must fail with SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  // --- 6. V2 CONTRACTS MISSING CONTEXTUAL FIELDS ---
  const v2ContextualFields = ["principalClass", "resourceClass", "dataClassification", "tenantScopeRequired", "approvalRequired"];
  for (const field of v2ContextualFields) {
    const candidate = copy(artifact);
    delete candidate.policies.platform_read_only[field];
    const res = evaluateAndAssert(validReadContext, candidate);
    expect(res.decision === "deny" && res.reasonCode === "SCHEMA_VALIDATION_FAILED", `V2 contract missing ${field} must fail with SCHEMA_VALIDATION_FAILED`);
    testsRun += 1;
  }

  // --- 7. EXPLOIT MITIGATION: PRODUCTION WRITE RELABELING ATTACK ---
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

  // --- 8. PRINCIPAL AND RESOURCE AUTHORIZATION BOUNDS (REASON CODE DETERMINISM) ---
  // read_only_platform_inspection routes to platform_read_only → mismatches return READ_ONLY_SAFETY_BOUNDARY_VIOLATION
  for (const badPrincipal of ["anonymous", "untrusted_user", "external_service", "admin"]) {
    const candidate = copy(validReadContext);
    candidate.principalClass = badPrincipal;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && res.reasonCode === "READ_ONLY_SAFETY_BOUNDARY_VIOLATION", `unauthorized principalClass (${badPrincipal}) on platform_read_only must return READ_ONLY_SAFETY_BOUNDARY_VIOLATION`);
    testsRun += 1;
  }
  // "guest" is a forbidden term and is caught at the confidentiality boundary before policy matching
  {
    const guestCandidate = copy(validReadContext);
    guestCandidate.principalClass = "guest";
    const guestRes = evaluateAndAssert(guestCandidate, artifact);
    expect(guestRes.decision === "deny" && guestRes.reasonCode === "CONFIDENTIAL_DATA_RESTRICTED", "principalClass 'guest' must be denied at confidentiality boundary");
    testsRun += 1;
  }

  for (const badResource of ["arbitrary_public_resource", "production_db", "user_profile"]) {
    const candidate = copy(validReadContext);
    candidate.resourceClass = badResource;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && res.reasonCode === "READ_ONLY_SAFETY_BOUNDARY_VIOLATION", `unauthorized resourceClass (${badResource}) on platform_read_only must return READ_ONLY_SAFETY_BOUNDARY_VIOLATION`);
    testsRun += 1;
  }
  // "guest_ledger" contains forbidden term "guest" and is caught at confidentiality boundary
  {
    const guestLedgerCandidate = copy(validReadContext);
    guestLedgerCandidate.resourceClass = "guest_ledger";
    const guestLedgerRes = evaluateAndAssert(guestLedgerCandidate, artifact);
    expect(guestLedgerRes.decision === "deny" && guestLedgerRes.reasonCode === "CONFIDENTIAL_DATA_RESTRICTED", "resourceClass 'guest_ledger' must be denied at confidentiality boundary");
    testsRun += 1;
  }

  // Non-platform_read_only policy routes: mismatches return INVALID_PRINCIPAL_OR_RESOURCE
  for (const badPrincipal of ["anonymous", "untrusted_user"]) {
    const candidate = copy(validReadContext);
    candidate.targetAction = "governed_configuration_change";
    candidate.principalClass = badPrincipal;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && res.reasonCode === "INVALID_PRINCIPAL_OR_RESOURCE", `unauthorized principalClass (${badPrincipal}) on governance_gated_change must return INVALID_PRINCIPAL_OR_RESOURCE`);
    testsRun += 1;
  }

  // --- 9. UNEXPECTED REQUEST FIELDS (additionalProperties: false) ---
  const extraFieldCandidate = copy(validReadContext);
  extraFieldCandidate.unexpectedProperty = "unauthorized_payload";
  const extraRes = evaluateAndAssert(extraFieldCandidate, artifact);
  expect(extraRes.decision === "deny" && extraRes.reasonCode === "INVALID_REQUEST_CONTEXT", "unexpected context properties must fail closed with INVALID_REQUEST_CONTEXT");
  testsRun += 1;

  // --- 10. MUTATIONS OF EVERY REQUEST-CONTEXT FIELD & INVALID TYPES ---
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

  for (const badVal of [null, 999, true, false, [], {}]) {
    const candidate = copy(validReadContext);
    candidate.principalClass = badVal;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && res.reasonCode === "INVALID_REQUEST_CONTEXT", `non-string principalClass (${JSON.stringify(badVal)}) must fail closed with INVALID_REQUEST_CONTEXT`);
    testsRun += 1;
  }

  for (const badBool of ["true", "false", 1, 0, null, [], {}]) {
    const candidate = copy(validReadContext);
    candidate.tenantScopeRequired = badBool;
    const res = evaluateAndAssert(candidate, artifact);
    expect(res.decision === "deny" && res.reasonCode === "INVALID_REQUEST_CONTEXT", `invalid tenantScopeRequired (${JSON.stringify(badBool)}) must fail closed`);
    testsRun += 1;
  }

  // --- 11. SAFETY BOUNDARY: tenantScopeRequired === false ---
  const noTenantScope = copy(validReadContext);
  noTenantScope.tenantScopeRequired = false;
  const noTenantRes = evaluateAndAssert(noTenantScope, artifact);
  expect(noTenantRes.decision === "deny" && noTenantRes.reasonCode === "READ_ONLY_SAFETY_BOUNDARY_VIOLATION", "tenantScopeRequired === false must violate safety boundary with READ_ONLY_SAFETY_BOUNDARY_VIOLATION");
  testsRun += 1;

  // --- 12. CONFIDENTIAL DATA CLASSIFICATIONS & FORBIDDEN TERMS ---
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

  // --- 13. GOVERNED & PRODUCTION WRITE DENIALS ---
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

  process.stdout.write(
    `${JSON.stringify({
      name: "deterministic-policy-evaluator",
      passed: true,
      testsRun,
      details: `evaluatePolicy verified against V2 policy contract authority, dedicated V2 schema, and mandatory JSON schemas with positive allow case, deep weakened-schema mitigation, deterministic INVALID_PRINCIPAL_OR_RESOURCE reason code, anti-relabeling exploit defense, and ${testsRun - 1} systematic negative/mutation cases passed`
    })}\n`
  );
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ name: "deterministic-policy-evaluator", passed: false, details: error.message })}\n`
  );
  process.exitCode = 1;
}
