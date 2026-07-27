import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema, validateSchemaKeywords } from "../../packages/policy-engine/src/json-schema-evaluator.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const v1ArtifactPath = path.join(repositoryRoot, "policies/deterministic-authorization-policies-v1.json");
const v1SchemaPath = path.join(repositoryRoot, "schemas/authorization-policy-contract-v1.schema.json");

const forbiddenTerms = new Set([
  "liveevaluation",
  "live_evaluation",
  "database",
  "sql",
  "rls",
  "credential",
  "credentials",
  "guest",
  "payment",
  "liveservice",
  "live_service"
]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value));
const expect = (condition, description) => {
  if (!condition) throw new Error(description);
};

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
      ([key, child]) =>
        forbiddenTerms.has(key.toLowerCase()) || containsForbiddenTerm(key) || containsForbiddenTerm(child)
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenTerm(item));
  }
  return false;
}

function fullValidateV1(artifact, schemaDoc) {
  if (!isObject(schemaDoc)) return false;
  if (schemaDoc.$schema !== "https://json-schema.org/draft/2020-12/schema") return false;
  if (schemaDoc.$id !== "https://sut-ai-os.local/schemas/authorization-policy-contract-v1.schema.json") return false;
  if (schemaDoc.type !== "object") return false;
  if (!isObject(schemaDoc.properties) || !Array.isArray(schemaDoc.required)) return false;
  for (const field of ["schemaVersion", "policies", "defaults"]) {
    if (!schemaDoc.required.includes(field) || !Object.hasOwn(schemaDoc.properties, field)) return false;
  }
  if (!validateSchemaKeywords(schemaDoc)) return false;
  if (!validateJsonSchema(artifact, schemaDoc)) return false;
  if (containsForbiddenTerm(artifact)) return false;
  return true;
}

try {
  const v1Artifact = JSON.parse(await readFile(v1ArtifactPath, "utf8"));
  const v1SchemaDoc = JSON.parse(await readFile(v1SchemaPath, "utf8"));

  // Primary assertion: validate V1 artifact strictly against dedicated V1 schema
  expect(fullValidateV1(v1Artifact, v1SchemaDoc), "committed version-1 artifact must be valid against dedicated V1 JSON schemaDoc");

  let negativeTestsRun = 0;
  const artifact = v1Artifact;
  const schemaDoc = v1SchemaDoc;

  // --- CATEGORY 1: Corrupted or mutated schema documents ---
  const badSchemaDraft = copy(schemaDoc);
  badSchemaDraft.$schema = "https://json-schema.org/draft-04/schema";
  expect(!fullValidateV1(artifact, badSchemaDraft), "corrupted schema draft must fail");
  negativeTestsRun += 1;

  const badSchemaId = copy(schemaDoc);
  badSchemaId.$id = "https://sut-ai-os.local/schemas/wrong-v1-id.json";
  expect(!fullValidateV1(artifact, badSchemaId), "wrong schema $id must fail");
  negativeTestsRun += 1;

  const badSchemaType = copy(schemaDoc);
  badSchemaType.type = "array";
  expect(!fullValidateV1(artifact, badSchemaType), "mutated schema type must fail");
  negativeTestsRun += 1;

  const badSchemaProperties = copy(schemaDoc);
  delete badSchemaProperties.properties;
  expect(!fullValidateV1(artifact, badSchemaProperties), "deleted schema properties must fail");
  negativeTestsRun += 1;

  const corruptedSchemaConst = copy(schemaDoc);
  corruptedSchemaConst.properties.defaults.properties.defaultEffect.const = "allow";
  expect(!fullValidateV1(artifact, corruptedSchemaConst), "corrupted schema defaultEffect const must fail");
  negativeTestsRun += 1;

  const corruptedSchemaFailClosed = copy(schemaDoc);
  corruptedSchemaFailClosed.properties.defaults.properties.failClosed.const = false;
  expect(!fullValidateV1(artifact, corruptedSchemaFailClosed), "corrupted schema failClosed const must fail");
  negativeTestsRun += 1;

  // Structurally weakened schema with valid $schema and $id
  const weakenedSchema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    $id: "https://sut-ai-os.local/schemas/authorization-policy-contract-v1.schema.json"
  };
  expect(!fullValidateV1(artifact, weakenedSchema), "structurally weakened schema with valid $schema and $id must fail");
  negativeTestsRun += 1;

  // --- CATEGORY 2: Missing top-level required fields ---
  for (const topField of ["schemaVersion", "policies", "defaults"]) {
    const candidate = copy(artifact);
    delete candidate[topField];
    expect(!fullValidateV1(candidate, schemaDoc), `missing top-level field ${topField} must fail`);
    negativeTestsRun += 1;
  }

  // --- CATEGORY 3: Unexpected top-level properties ---
  const extraTopCandidate = copy(artifact);
  extraTopCandidate.unexpectedTopField = "unauthorized";
  expect(!fullValidateV1(extraTopCandidate, schemaDoc), "unexpected top-level property must fail");
  negativeTestsRun += 1;

  // --- CATEGORY 4: Non-string and empty/whitespace schemaVersion values ---
  for (const badVersion of [100, 1.0, true, false, null, [], {}, "", "   ", "\t\n"]) {
    const candidate = copy(artifact);
    candidate.schemaVersion = badVersion;
    expect(!fullValidateV1(candidate, schemaDoc), `invalid schemaVersion (${JSON.stringify(badVersion)}) must fail`);
    negativeTestsRun += 1;
  }

  // --- CATEGORY 5: Invalid types for each policy object ---
  for (const badPolicyValue of [123, 45.6, "platform_read_only", true, false, null, [1, 2]]) {
    const candidate = copy(artifact);
    candidate.policies.platform_read_only = badPolicyValue;
    expect(!fullValidateV1(candidate, schemaDoc), `invalid policy object type (${JSON.stringify(badPolicyValue)}) must fail`);
    negativeTestsRun += 1;
  }

  // --- CATEGORY 6: Missing and unexpected fields inside defaults ---
  for (const field of ["defaultEffect", "failClosed", "requireExplicitAllow"]) {
    const candidate = copy(artifact);
    delete candidate.defaults[field];
    expect(!fullValidateV1(candidate, schemaDoc), `missing defaults field ${field} must fail`);
    negativeTestsRun += 1;
  }

  const extraDefaultCandidate = copy(artifact);
  extraDefaultCandidate.defaults.extraField = "unauthorized";
  expect(!fullValidateV1(extraDefaultCandidate, schemaDoc), "unexpected field inside defaults must fail");
  negativeTestsRun += 1;

  // --- CATEGORY 7: Invalid types for defaults.defaultEffect and requireExplicitAllow ---
  for (const badEffect of ["allow", "foo", 123, true, false, null, [], ""]) {
    const candidate = copy(artifact);
    candidate.defaults.defaultEffect = badEffect;
    expect(!fullValidateV1(candidate, schemaDoc), `invalid defaultEffect (${JSON.stringify(badEffect)}) must fail`);
    negativeTestsRun += 1;
  }

  for (const badExplicitAllow of ["true", "false", 1, 0, null, [], {}]) {
    const candidate = copy(artifact);
    candidate.defaults.requireExplicitAllow = badExplicitAllow;
    expect(!fullValidateV1(candidate, schemaDoc), `invalid requireExplicitAllow (${JSON.stringify(badExplicitAllow)}) must fail`);
    negativeTestsRun += 1;
  }

  for (const badFailClosed of ["true", "false", 1, 0, null, [], {}]) {
    const candidate = copy(artifact);
    candidate.defaults.failClosed = badFailClosed;
    expect(!fullValidateV1(candidate, schemaDoc), `invalid failClosed (${JSON.stringify(badFailClosed)}) must fail`);
    negativeTestsRun += 1;
  }

  // --- CATEGORY 8: Disagreement between schema and artifact ---
  const schemaDisagreement = copy(artifact);
  schemaDisagreement.policies.platform_read_only.targetAction = "wrong_action_string";
  expect(!fullValidateV1(schemaDisagreement, schemaDoc), "schema/artifact disagreement on targetAction must fail");
  negativeTestsRun += 1;

  const schemaDisagreementEffect = copy(artifact);
  schemaDisagreementEffect.policies.governance_gated_change.defaultEffect = "allow";
  expect(!fullValidateV1(schemaDisagreementEffect, schemaDoc), "schema/artifact disagreement on defaultEffect must fail");
  negativeTestsRun += 1;

  // --- CATEGORY 9: Exhaustive V1 policy property mutations across all policy targets ---
  const policyKeys = ["platform_read_only", "governance_gated_change", "production_write_restricted"];
  const propKeys = ["targetAction", "defaultEffect", "evaluatorMode"];

  for (const policyKey of policyKeys) {
    // Missing policy node
    const missingPolicy = copy(artifact);
    delete missingPolicy.policies[policyKey];
    expect(!fullValidateV1(missingPolicy, schemaDoc), `missing policy ${policyKey} must fail`);
    negativeTestsRun += 1;

    for (const propKey of propKeys) {
      // Missing policy property
      const missingProp = copy(artifact);
      delete missingProp.policies[policyKey][propKey];
      expect(!fullValidateV1(missingProp, schemaDoc), `missing property ${policyKey}.${propKey} must fail`);
      negativeTestsRun += 1;

      // Unexpected property
      const extraProp = copy(artifact);
      extraProp.policies[policyKey].unexpectedProperty = "value";
      expect(!fullValidateV1(extraProp, schemaDoc), `unexpected property in ${policyKey} must fail`);
      negativeTestsRun += 1;

      // Empty and whitespace values
      for (const badVal of ["", "   ", "\t\n", null, 999, true, false, [], {}]) {
        const badType = copy(artifact);
        badType.policies[policyKey][propKey] = badVal;
        expect(!fullValidateV1(badType, schemaDoc), `invalid/empty value for ${policyKey}.${propKey} must fail`);
        negativeTestsRun += 1;
      }
    }
  }

  // --- CATEGORY 10: Simultaneous removal of multiple schema protections ---
  const multiRemovedCandidate = copy(artifact);
  delete multiRemovedCandidate.defaults;
  delete multiRemovedCandidate.policies.platform_read_only.targetAction;
  delete multiRemovedCandidate.schemaVersion;
  expect(!fullValidateV1(multiRemovedCandidate, schemaDoc), "simultaneous removal of multiple schema protections must fail");
  negativeTestsRun += 1;

  // --- CATEGORY 11: Systematic forbidden terms assertions ---
  for (const [name, mutate] of Object.entries({
    liveEvaluation: (c) => { c.liveEvaluation = true; },
    database: (c) => { c.database = "postgres"; },
    sql: (c) => { c.sql = "SELECT 1"; },
    rls: (c) => { c.policies.platform_read_only.rls = true; },
    credential: (c) => { c.policies.platform_read_only.credential = "secret"; },
    guest: (c) => { c.guestData = true; },
    payment: (c) => { c.payment = true; },
    liveService: (c) => { c.liveService = true; }
  })) {
    const candidate = copy(artifact);
    mutate(candidate);
    expect(!fullValidateV1(candidate, schemaDoc), `forbidden ${name} behavior must fail`);
    negativeTestsRun += 1;
  }

  process.stdout.write(
    `${JSON.stringify({
      name: "deterministic-authorization-policies-v1",
      passed: true,
      schemaAuthoritative: true,
      negativeTestsRun,
      details: `V1 policy artifact verified against dedicated V1 Draft 2020-12 JSON Schema evaluator and ${negativeTestsRun} exhaustive V1 mutation cases passed`
    })}\n`
  );
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ name: "deterministic-authorization-policies-v1", passed: false, details: error.message })}\n`
  );
  process.exitCode = 1;
}
