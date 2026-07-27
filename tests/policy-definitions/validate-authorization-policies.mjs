import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactPath = path.join(repositoryRoot, "policies/deterministic-authorization-policies-v1.json");
const schemaPath = path.join(repositoryRoot, "schemas/authorization-policy-contract.schema.json");

const requiredPolicies = {
  platform_read_only: {
    targetAction: "read_only_platform_inspection",
    defaultEffect: "allow",
    evaluatorMode: "deterministic"
  },
  governance_gated_change: {
    targetAction: "governed_configuration_change",
    defaultEffect: "deny",
    evaluatorMode: "deterministic"
  },
  production_write_restricted: {
    targetAction: "production_write_operation",
    defaultEffect: "deny",
    evaluatorMode: "deterministic"
  }
};

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
const exactKeys = (value, expected) =>
  isObject(value) &&
  Object.keys(value).length === expected.length &&
  expected.every((key) => Object.hasOwn(value, key));
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

function validateSchemaStructure(schema, schemaDoc) {
  if (!isObject(schema) || !isObject(schemaDoc)) return false;
  if (!exactKeys(schema, ["schemaVersion", "policies", "defaults"])) return false;
  if (schema.schemaVersion !== "1.0.0") return false;
  if (!isObject(schema.policies) || !exactKeys(schema.policies, Object.keys(requiredPolicies))) return false;

  for (const [name, expected] of Object.entries(requiredPolicies)) {
    const policy = schema.policies[name];
    if (!isObject(policy) || !exactKeys(policy, ["targetAction", "defaultEffect", "evaluatorMode"])) return false;
    if (typeof policy.targetAction !== "string" || policy.targetAction !== expected.targetAction) return false;
    if (typeof policy.defaultEffect !== "string" || policy.defaultEffect !== expected.defaultEffect) return false;
    if (typeof policy.evaluatorMode !== "string" || policy.evaluatorMode !== expected.evaluatorMode) return false;
  }

  if (!isObject(schema.defaults) || !exactKeys(schema.defaults, ["defaultEffect", "failClosed", "requireExplicitAllow"])) return false;
  if (schema.defaults.defaultEffect !== "deny") return false;
  if (schema.defaults.failClosed !== true) return false;
  if (schema.defaults.requireExplicitAllow !== true) return false;

  return !containsForbiddenTerm(schema);
}

try {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  const schemaDoc = JSON.parse(await readFile(schemaPath, "utf8"));

  expect(validateSchemaStructure(artifact, schemaDoc), "committed version-1 artifact must be valid against structural and schema expectations");

  let negativeTestsRun = 0;

  // 1. Missing top-level required fields
  for (const key of ["schemaVersion", "policies", "defaults"]) {
    const candidate = copy(artifact);
    delete candidate[key];
    expect(!validateSchemaStructure(candidate, schemaDoc), `missing top-level ${key} must fail`);
    negativeTestsRun += 1;
  }

  // 2. Unexpected top-level fields
  expect(!validateSchemaStructure({ ...copy(artifact), unexpected: true }, schemaDoc), "unexpected top-level field must fail");
  negativeTestsRun += 1;

  // 3. Unsupported schema version
  expect(!validateSchemaStructure({ ...copy(artifact), schemaVersion: "2.0.0" }, schemaDoc), "unsupported schema version must fail");
  negativeTestsRun += 1;

  // 4. Type mismatches for top-level fields
  for (const badValue of [null, 123, true, [], "string"]) {
    expect(!validateSchemaStructure({ ...copy(artifact), policies: badValue }, schemaDoc), "non-object policies must fail");
    expect(!validateSchemaStructure({ ...copy(artifact), defaults: badValue }, schemaDoc), "non-object defaults must fail");
    negativeTestsRun += 2;
  }

  // 5. Missing policy rule
  for (const name of Object.keys(requiredPolicies)) {
    const candidate = copy(artifact);
    delete candidate.policies[name];
    expect(!validateSchemaStructure(candidate, schemaDoc), `missing policy ${name} must fail`);
    negativeTestsRun += 1;
  }

  // 6. Unexpected policy rule
  const unexpectedPolicy = copy(artifact);
  unexpectedPolicy.policies.extra_rule = { targetAction: "foo", defaultEffect: "deny", evaluatorMode: "deterministic" };
  expect(!validateSchemaStructure(unexpectedPolicy, schemaDoc), "unexpected policy rule must fail");
  negativeTestsRun += 1;

  // 7. Policy property field mutations & type mismatches
  for (const name of Object.keys(requiredPolicies)) {
    for (const prop of ["targetAction", "defaultEffect", "evaluatorMode"]) {
      // Missing property
      const missingProp = copy(artifact);
      delete missingProp.policies[name][prop];
      expect(!validateSchemaStructure(missingProp, schemaDoc), `missing policy prop ${name}.${prop} must fail`);
      negativeTestsRun += 1;

      // Unexpected property
      const extraProp = copy(artifact);
      extraProp.policies[name].unexpected_key = "value";
      expect(!validateSchemaStructure(extraProp, schemaDoc), `extra prop in policy ${name} must fail`);
      negativeTestsRun += 1;

      // Bad types
      for (const badValue of [null, 456, false, [], {}, ""]) {
        const badType = copy(artifact);
        badType.policies[name][prop] = badValue;
        expect(!validateSchemaStructure(badType, schemaDoc), `invalid type for ${name}.${prop} must fail`);
        negativeTestsRun += 1;
      }
    }
  }

  // 8. Invalid defaultEffect or evaluatorMode values
  const wrongEffect = copy(artifact);
  wrongEffect.policies.platform_read_only.defaultEffect = "invalid_effect";
  expect(!validateSchemaStructure(wrongEffect, schemaDoc), "invalid defaultEffect must fail");
  negativeTestsRun += 1;

  const wrongMode = copy(artifact);
  wrongMode.policies.platform_read_only.evaluatorMode = "dynamic";
  expect(!validateSchemaStructure(wrongMode, schemaDoc), "invalid evaluatorMode must fail");
  negativeTestsRun += 1;

  // 9. Defaults property mutations
  const wrongGlobalEffect = copy(artifact);
  wrongGlobalEffect.defaults.defaultEffect = "allow";
  expect(!validateSchemaStructure(wrongGlobalEffect, schemaDoc), "wrong global defaultEffect must fail");
  negativeTestsRun += 1;

  const falseFailClosed = copy(artifact);
  falseFailClosed.defaults.failClosed = false;
  expect(!validateSchemaStructure(falseFailClosed, schemaDoc), "false failClosed must fail");
  negativeTestsRun += 1;

  const falseExplicitAllow = copy(artifact);
  falseExplicitAllow.defaults.requireExplicitAllow = false;
  expect(!validateSchemaStructure(falseExplicitAllow, schemaDoc), "false requireExplicitAllow must fail");
  negativeTestsRun += 1;

  for (const badValue of [null, 999, "true", []]) {
    const badBool = copy(artifact);
    badBool.defaults.failClosed = badValue;
    expect(!validateSchemaStructure(badBool, schemaDoc), "non-boolean failClosed must fail");
    negativeTestsRun += 1;
  }

  // 10. Forbidden behavior assertions across all categories
  for (const [name, mutate] of Object.entries({
    liveEvaluation: (candidate) => { candidate.liveEvaluation = true; },
    database: (candidate) => { candidate.database = "postgres"; },
    sql: (candidate) => { candidate.sql = "SELECT 1"; },
    rls: (candidate) => { candidate.policies.platform_read_only.rls = true; },
    credential: (candidate) => { candidate.policies.platform_read_only.credential = "secret"; },
    guest: (candidate) => { candidate.guestData = true; },
    payment: (candidate) => { candidate.payment = true; },
    liveService: (candidate) => { candidate.liveService = true; }
  })) {
    const candidate = copy(artifact);
    mutate(candidate);
    expect(!validateSchemaStructure(candidate, schemaDoc), `forbidden ${name} behavior must fail`);
    negativeTestsRun += 1;
  }

  process.stdout.write(
    `${JSON.stringify({
      name: "deterministic-authorization-policies",
      passed: true,
      negativeTestsRun,
      details: `one valid artifact and ${negativeTestsRun} documented negative/mutation cases passed`
    })}\n`
  );
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ name: "deterministic-authorization-policies", passed: false, details: error.message })}\n`
  );
  process.exitCode = 1;
}
