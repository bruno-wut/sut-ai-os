import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateJsonSchema } from "../../packages/policy-engine/src/json-schema-evaluator.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const v1ArtifactPath = path.join(repositoryRoot, "policies/deterministic-authorization-policies-v1.json");
const v2ArtifactPath = path.join(repositoryRoot, "policies/deterministic-authorization-policies-v2.json");
const schemaPath = path.join(repositoryRoot, "schemas/authorization-policy-contract.schema.json");

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

function fullValidate(artifact, schemaDoc) {
  if (!isObject(schemaDoc) || schemaDoc.$schema !== "https://json-schema.org/draft/2020-12/schema") return false;
  if (!validateJsonSchema(artifact, schemaDoc)) return false;
  if (containsForbiddenTerm(artifact)) return false;
  return true;
}

try {
  const v1Artifact = JSON.parse(await readFile(v1ArtifactPath, "utf8"));
  const v2Artifact = JSON.parse(await readFile(v2ArtifactPath, "utf8"));
  const schemaDoc = JSON.parse(await readFile(schemaPath, "utf8"));

  // Primary assertions: validate both v1 and v2 artifacts against authoritative JSON schemaDoc
  expect(fullValidate(v1Artifact, schemaDoc), "committed version-1 artifact must be valid against authoritative JSON schemaDoc");
  expect(fullValidate(v2Artifact, schemaDoc), "committed version-2 artifact must be valid against authoritative JSON schemaDoc");

  let negativeTestsRun = 0;
  const artifact = v2Artifact;

  // --- CATEGORY 1: Corrupted or mutated schema documents ---
  const badSchemaDraft = copy(schemaDoc);
  badSchemaDraft.$schema = "https://json-schema.org/draft-04/schema";
  expect(!fullValidate(artifact, badSchemaDraft), "corrupted schema draft must fail");
  negativeTestsRun += 1;

  const badSchemaType = copy(schemaDoc);
  badSchemaType.type = "array";
  expect(!fullValidate(artifact, badSchemaType), "mutated schema type must fail");
  negativeTestsRun += 1;

  const badSchemaProperties = copy(schemaDoc);
  delete badSchemaProperties.properties;
  expect(!fullValidate(artifact, badSchemaProperties), "deleted schema properties must fail");
  negativeTestsRun += 1;

  const corruptedSchemaConst = copy(schemaDoc);
  corruptedSchemaConst.properties.defaults.properties.defaultEffect.const = "allow";
  expect(!fullValidate(artifact, corruptedSchemaConst), "corrupted schema defaultEffect const must fail");
  negativeTestsRun += 1;

  const corruptedSchemaFailClosed = copy(schemaDoc);
  corruptedSchemaFailClosed.properties.defaults.properties.failClosed.const = false;
  expect(!fullValidate(artifact, corruptedSchemaFailClosed), "corrupted schema failClosed const must fail");
  negativeTestsRun += 1;

  // --- CATEGORY 2: Non-string schemaVersion values ---
  for (const badVersion of [100, 1.0, true, false, null, [], {}]) {
    const candidate = copy(artifact);
    candidate.schemaVersion = badVersion;
    expect(!fullValidate(candidate, schemaDoc), `non-string schemaVersion (${JSON.stringify(badVersion)}) must fail`);
    negativeTestsRun += 1;
  }

  // --- CATEGORY 3: Invalid types for each policy object ---
  for (const badPolicyValue of [123, 45.6, "platform_read_only", true, false, null, [1, 2]]) {
    const candidate = copy(artifact);
    candidate.policies.platform_read_only = badPolicyValue;
    expect(!fullValidate(candidate, schemaDoc), `invalid policy object type (${JSON.stringify(badPolicyValue)}) must fail`);
    negativeTestsRun += 1;
  }

  // --- CATEGORY 4: Missing and unexpected fields inside defaults ---
  for (const field of ["defaultEffect", "failClosed", "requireExplicitAllow"]) {
    const candidate = copy(artifact);
    delete candidate.defaults[field];
    expect(!fullValidate(candidate, schemaDoc), `missing defaults field ${field} must fail`);
    negativeTestsRun += 1;
  }

  const extraDefaultCandidate = copy(artifact);
  extraDefaultCandidate.defaults.extraField = "unauthorized";
  expect(!fullValidate(extraDefaultCandidate, schemaDoc), "unexpected field inside defaults must fail");
  negativeTestsRun += 1;

  // --- CATEGORY 5: Invalid types for defaults.defaultEffect and requireExplicitAllow ---
  for (const badEffect of ["allow", "foo", 123, true, false, null, []]) {
    const candidate = copy(artifact);
    candidate.defaults.defaultEffect = badEffect;
    expect(!fullValidate(candidate, schemaDoc), `invalid defaultEffect (${JSON.stringify(badEffect)}) must fail`);
    negativeTestsRun += 1;
  }

  for (const badExplicitAllow of ["true", "false", 1, 0, null, [], {}]) {
    const candidate = copy(artifact);
    candidate.defaults.requireExplicitAllow = badExplicitAllow;
    expect(!fullValidate(candidate, schemaDoc), `invalid requireExplicitAllow (${JSON.stringify(badExplicitAllow)}) must fail`);
    negativeTestsRun += 1;
  }

  for (const badFailClosed of ["true", "false", 1, 0, null, [], {}]) {
    const candidate = copy(artifact);
    candidate.defaults.failClosed = badFailClosed;
    expect(!fullValidate(candidate, schemaDoc), `invalid failClosed (${JSON.stringify(badFailClosed)}) must fail`);
    negativeTestsRun += 1;
  }

  // --- CATEGORY 6: Disagreement between schema and artifact ---
  const schemaDisagreement = copy(artifact);
  schemaDisagreement.policies.platform_read_only.targetAction = "wrong_action_string";
  expect(!fullValidate(schemaDisagreement, schemaDoc), "schema/artifact disagreement on targetAction must fail");
  negativeTestsRun += 1;

  const schemaDisagreementEffect = copy(artifact);
  schemaDisagreementEffect.policies.governance_gated_change.defaultEffect = "allow";
  expect(!fullValidate(schemaDisagreementEffect, schemaDoc), "schema/artifact disagreement on defaultEffect must fail");
  negativeTestsRun += 1;

  // --- CATEGORY 7: Systematic type & missing field mutations across all policy targets ---
  const policyKeys = ["platform_read_only", "governance_gated_change", "production_write_restricted"];
  const propKeys = ["targetAction", "defaultEffect", "evaluatorMode"];

  for (const policyKey of policyKeys) {
    // Missing policy node
    const missingPolicy = copy(artifact);
    delete missingPolicy.policies[policyKey];
    expect(!fullValidate(missingPolicy, schemaDoc), `missing policy ${policyKey} must fail`);
    negativeTestsRun += 1;

    for (const propKey of propKeys) {
      // Missing policy property
      const missingProp = copy(artifact);
      delete missingProp.policies[policyKey][propKey];
      expect(!fullValidate(missingProp, schemaDoc), `missing property ${policyKey}.${propKey} must fail`);
      negativeTestsRun += 1;

      // Unexpected property
      const extraProp = copy(artifact);
      extraProp.policies[policyKey].unexpectedProperty = "value";
      expect(!fullValidate(extraProp, schemaDoc), `unexpected property in ${policyKey} must fail`);
      negativeTestsRun += 1;

      // Invalid property types
      for (const badVal of [null, 999, true, false, [], {}]) {
        const badType = copy(artifact);
        badType.policies[policyKey][propKey] = badVal;
        expect(!fullValidate(badType, schemaDoc), `invalid type for ${policyKey}.${propKey} must fail`);
        negativeTestsRun += 1;
      }
    }
  }

  // --- CATEGORY 8: Systematic forbidden terms assertions ---
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
    expect(!fullValidate(candidate, schemaDoc), `forbidden ${name} behavior must fail`);
    negativeTestsRun += 1;
  }

  process.stdout.write(
    `${JSON.stringify({
      name: "deterministic-authorization-policies",
      passed: true,
      schemaAuthoritative: true,
      negativeTestsRun,
      details: `v1 and v2 artifacts verified against shared Draft 2020-12 JSON Schema evaluator and ${negativeTestsRun} systematic schema/artifact mutation cases passed`
    })}\n`
  );
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ name: "deterministic-authorization-policies", passed: false, details: error.message })}\n`
  );
  process.exitCode = 1;
}
