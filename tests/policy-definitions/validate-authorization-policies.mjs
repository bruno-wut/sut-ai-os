import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactPath = path.join(repositoryRoot, "policies/deterministic-authorization-policies-v1.json");

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

function validate(schema) {
  if (!exactKeys(schema, ["schemaVersion", "policies", "defaults"])) return false;
  if (schema.schemaVersion !== "1.0.0") return false;
  if (!isObject(schema.policies) || !exactKeys(schema.policies, Object.keys(requiredPolicies))) return false;

  for (const [name, expected] of Object.entries(requiredPolicies)) {
    const policy = schema.policies[name];
    if (!exactKeys(policy, ["targetAction", "defaultEffect", "evaluatorMode"])) return false;
    if (policy.targetAction !== expected.targetAction) return false;
    if (policy.defaultEffect !== expected.defaultEffect) return false;
    if (policy.evaluatorMode !== expected.evaluatorMode) return false;
  }

  if (!isObject(schema.defaults) || !exactKeys(schema.defaults, ["defaultEffect", "failClosed", "requireExplicitAllow"])) return false;
  if (schema.defaults.defaultEffect !== "deny") return false;
  if (schema.defaults.failClosed !== true) return false;
  if (schema.defaults.requireExplicitAllow !== true) return false;

  return !containsForbiddenTerm(schema);
}

try {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  expect(validate(artifact), "committed version-1 artifact must be valid");

  // Top level fields
  for (const key of ["schemaVersion", "policies", "defaults"]) {
    const candidate = copy(artifact);
    delete candidate[key];
    expect(!validate(candidate), `missing top-level ${key} must fail`);
  }
  expect(!validate({ ...copy(artifact), unexpected: true }), "unexpected top-level field must fail");
  expect(!validate({ ...copy(artifact), schemaVersion: "2.0.0" }), "unsupported schema version must fail");

  // Policy rules
  const missingPolicy = copy(artifact);
  delete missingPolicy.policies.platform_read_only;
  expect(!validate(missingPolicy), "missing required policy must fail");

  const unexpectedPolicy = copy(artifact);
  unexpectedPolicy.policies.unexpected_rule = { targetAction: "foo", defaultEffect: "deny", evaluatorMode: "deterministic" };
  expect(!validate(unexpectedPolicy), "unexpected policy rule must fail");

  const emptyPrimitive = copy(artifact);
  emptyPrimitive.policies.platform_read_only.targetAction = "";
  expect(!validate(emptyPrimitive), "empty primitive type must fail");

  // Defaults assertions
  const wrongDefaultEffect = copy(artifact);
  wrongDefaultEffect.defaults.defaultEffect = "allow";
  expect(!validate(wrongDefaultEffect), "wrong defaultEffect must fail");

  const falseFailClosed = copy(artifact);
  falseFailClosed.defaults.failClosed = false;
  expect(!validate(falseFailClosed), "false failClosed must fail");

  const falseRequireExplicitAllow = copy(artifact);
  falseRequireExplicitAllow.defaults.requireExplicitAllow = false;
  expect(!validate(falseRequireExplicitAllow), "false requireExplicitAllow must fail");

  // Forbidden behavior assertions
  for (const [name, mutate] of Object.entries({
    liveEvaluation: (candidate) => { candidate.liveEvaluation = true; },
    database: (candidate) => { candidate.database = "postgres"; },
    sql: (candidate) => { candidate.sql = "SELECT 1"; },
    rls: (candidate) => { candidate.policies.platform_read_only.rls = true; },
    credential: (candidate) => { candidate.policies.platform_read_only.credential = "string"; },
    guest: (candidate) => { candidate.guestData = true; },
    payment: (candidate) => { candidate.payment = true; },
    liveService: (candidate) => { candidate.liveService = true; }
  })) {
    const candidate = copy(artifact);
    mutate(candidate);
    expect(!validate(candidate), `forbidden ${name} behavior must fail`);
  }

  process.stdout.write(
    `${JSON.stringify({
      name: "deterministic-authorization-policies",
      passed: true,
      details: "one valid artifact and all documented invalid cases have the expected result"
    })}\n`
  );
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ name: "deterministic-authorization-policies", passed: false, details: error.message })}\n`
  );
  process.exitCode = 1;
}
