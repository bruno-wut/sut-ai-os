import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { evaluatePolicy } from "../../packages/policy-engine/src/evaluator.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactPath = path.join(repositoryRoot, "policies/deterministic-authorization-policies-v1.json");
const schemaPath = path.join(repositoryRoot, "schemas/authorization-policy-contract.schema.json");

const copy = (val) => JSON.parse(JSON.stringify(val));
const expect = (condition, description) => {
  if (!condition) throw new Error(description);
};

try {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const schemaDoc = JSON.parse(await readFile(schemaPath, "utf8"));

  let testsRun = 0;

  // --- POSITIVE TEST CASES ---
  const validReadContext = {
    principalClass: "bounded_agent_or_staff",
    resourceClass: "repository_public_metadata",
    targetAction: "read_only_platform_inspection",
    dataClassification: "public",
    tenantScopeRequired: true
  };

  const allowResult = evaluatePolicy(validReadContext, artifact, schemaDoc);
  expect(allowResult.decision === "allow", "valid read_only_platform_inspection request must evaluate to allow");
  expect(allowResult.matchedPolicy === "platform_read_only", "valid read_only request must match platform_read_only");
  expect(allowResult.failClosed === true, "evaluatePolicy result must carry failClosed === true");
  expect(allowResult.reasonCode === "EXPLICIT_ALLOW_MATCHED", "allowed result must carry EXPLICIT_ALLOW_MATCHED reason code");
  testsRun += 1;

  // --- NEGATIVE & MUTATION TEST CASES ---

  // 1. Invalid or corrupted schema or contract document
  const badSchema = copy(schemaDoc);
  badSchema.$schema = "invalid_draft";
  const badSchemaResult = evaluatePolicy(validReadContext, artifact, badSchema);
  expect(badSchemaResult.decision === "deny" && badSchemaResult.reasonCode === "SCHEMA_VALIDATION_FAILED", "corrupted schema must fail closed with SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  const badContract = copy(artifact);
  badContract.defaults.defaultEffect = "allow";
  const badContractResult = evaluatePolicy(validReadContext, badContract, schemaDoc);
  expect(badContractResult.decision === "deny" && badContractResult.reasonCode === "SCHEMA_VALIDATION_FAILED", "corrupted contract defaults must fail closed with SCHEMA_VALIDATION_FAILED");
  testsRun += 1;

  // 2. Non-object or empty request context
  for (const badContext of [null, undefined, 123, "context", true, false, []]) {
    const res = evaluatePolicy(badContext, artifact, schemaDoc);
    expect(res.decision === "deny" && res.reasonCode === "INVALID_REQUEST_CONTEXT", `non-object requestContext (${JSON.stringify(badContext)}) must fail closed`);
    testsRun += 1;
  }

  // 3. Missing required fields in requestContext
  for (const reqKey of ["principalClass", "resourceClass", "targetAction", "dataClassification", "tenantScopeRequired"]) {
    const candidate = copy(validReadContext);
    delete candidate[reqKey];
    const res = evaluatePolicy(candidate, artifact, schemaDoc);
    expect(res.decision === "deny" && res.reasonCode === "INVALID_REQUEST_CONTEXT", `missing context key ${reqKey} must fail closed`);
    testsRun += 1;
  }

  // 4. Type mismatches for requestContext fields
  for (const badVal of [null, 123, true, [], {}]) {
    const candidate = copy(validReadContext);
    candidate.principalClass = badVal;
    const res = evaluatePolicy(candidate, artifact, schemaDoc);
    expect(res.decision === "deny" && res.reasonCode === "INVALID_REQUEST_CONTEXT", `invalid principalClass type (${JSON.stringify(badVal)}) must fail closed`);
    testsRun += 1;
  }

  for (const badBool of ["true", "false", 1, 0, null, [], {}]) {
    const candidate = copy(validReadContext);
    candidate.tenantScopeRequired = badBool;
    const res = evaluatePolicy(candidate, artifact, schemaDoc);
    expect(res.decision === "deny" && res.reasonCode === "INVALID_REQUEST_CONTEXT", `invalid tenantScopeRequired type (${JSON.stringify(badBool)}) must fail closed`);
    testsRun += 1;
  }

  // 5. Read-only safety boundary: tenantScopeRequired === false
  const noTenantScope = copy(validReadContext);
  noTenantScope.tenantScopeRequired = false;
  const noTenantRes = evaluatePolicy(noTenantScope, artifact, schemaDoc);
  expect(noTenantRes.decision === "deny" && noTenantRes.reasonCode === "READ_ONLY_SAFETY_BOUNDARY_VIOLATION", "tenantScopeRequired === false must violate safety boundary");
  testsRun += 1;

  // 6. Confidential & restricted data classifications
  for (const confidentialClass of ["confidential", "restricted", "guest_pii", "payment_metadata", "internal_secret"]) {
    const candidate = copy(validReadContext);
    candidate.dataClassification = confidentialClass;
    const res = evaluatePolicy(candidate, artifact, schemaDoc);
    expect(res.decision === "deny" && res.reasonCode === "CONFIDENTIAL_DATA_RESTRICTED", `confidential data classification ${confidentialClass} must be denied`);
    testsRun += 1;
  }

  // 7. Forbidden operational behavior terms in context
  for (const term of ["guest_data", "payment_card", "sql_query", "database_table", "rls_policy", "secret_credential"]) {
    const candidate = copy(validReadContext);
    candidate.resourceClass = term;
    const res = evaluatePolicy(candidate, artifact, schemaDoc);
    expect(res.decision === "deny" && res.reasonCode === "CONFIDENTIAL_DATA_RESTRICTED", `context with forbidden term ${term} must be denied`);
    testsRun += 1;
  }

  // 8. Governed configuration change target action
  const governedContext = {
    principalClass: "bounded_agent_or_staff",
    resourceClass: "system_config",
    targetAction: "governed_configuration_change",
    dataClassification: "public",
    tenantScopeRequired: true
  };
  const governedRes = evaluatePolicy(governedContext, artifact, schemaDoc);
  expect(governedRes.decision === "deny" && governedRes.matchedPolicy === "governance_gated_change" && governedRes.reasonCode === "GOVERNANCE_GATED_DENIED", "governed configuration change must be denied");
  testsRun += 1;

  // 9. Production write operation target action
  const prodWriteContext = {
    principalClass: "bounded_agent_or_staff",
    resourceClass: "production_db",
    targetAction: "production_write_operation",
    dataClassification: "public",
    tenantScopeRequired: true
  };
  const prodWriteRes = evaluatePolicy(prodWriteContext, artifact, schemaDoc);
  expect(prodWriteRes.decision === "deny" && prodWriteRes.matchedPolicy === "production_write_restricted" && prodWriteRes.reasonCode === "PRODUCTION_WRITE_RESTRICTED_DENIED", "production write operation must be denied");
  testsRun += 1;

  // 10. Unrecognized target action
  const randomContext = copy(validReadContext);
  randomContext.targetAction = "unrecognized_action_string";
  const randomRes = evaluatePolicy(randomContext, artifact, schemaDoc);
  expect(randomRes.decision === "deny" && randomRes.matchedPolicy === null && randomRes.reasonCode === "DEFAULT_DENY_UNMATCHED", "unrecognized targetAction must trigger default deny");
  testsRun += 1;

  process.stdout.write(
    `${JSON.stringify({
      name: "deterministic-policy-evaluator",
      passed: true,
      testsRun,
      details: `evaluatePolicy verified with positive allow case and ${testsRun - 1} systematic negative/mutation cases passed`
    })}\n`
  );
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ name: "deterministic-policy-evaluator", passed: false, details: error.message })}\n`
  );
  process.exitCode = 1;
}
