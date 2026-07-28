import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(repositoryRoot, "schemas/playbook-registry-v1.schema.json");
const registryPath = path.join(repositoryRoot, "playbooks/playbook-registry-v1.json");

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value));
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const exactKeys = (value, keys) => isObject(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const sameValues = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);

const expectedRegistry = {
  schemaVersion: "1.0.0",
  registryId: "sut-aios-playbook-registry",
  registryMode: "shadow",
  productionWritePermission: false,
  policyReference: {
    artifact: "policies/deterministic-authorization-policies-v1.json",
    schema: "schemas/authorization-policy-contract-v1.schema.json",
    policyKey: "governance_gated_change",
    targetAction: "governed_configuration_change",
    defaultEffect: "deny"
  },
  playbooks: [{
    playbookId: "content-schema-repair-shadow",
    version: "1.0.0",
    owner: "codex-content-executor",
    autonomyTier: "tier-0",
    mode: "shadow",
    enabled: false,
    productionWritePermission: false,
    trigger: {
      type: "sanitized_fixture",
      eventType: "content_schema_validation_failed",
      source: "repository_fixture_only"
    },
    evidenceRequirements: ["sanitized_failure_fixture", "deterministic_validation_result", "correlation_id"],
    permittedTools: [],
    permittedPaths: [],
    requiredChecks: ["registry_contract_validation", "changed_path_inspection", "secret_boundary_inspection", "independent_verification"],
    approvalPolicy: { mode: "not_applicable_observe_only", activationAllowed: false },
    retryPolicy: { maxAttempts: 0, strategy: "none" },
    rollbackPolicy: { strategy: "not_applicable_no_mutation", mutationAllowed: false },
    historicalSuccessRate: null,
    historicalRollbackRate: null
  }]
};

function sameFiniteValue(actual, expected) {
  if (Array.isArray(expected)) return Array.isArray(actual) && actual.length === expected.length && expected.every((item, index) => sameFiniteValue(actual[index], item));
  if (isObject(expected)) return exactKeys(actual, Object.keys(expected)) && Object.keys(expected).every((key) => sameFiniteValue(actual[key], expected[key]));
  return actual === expected;
}

function matchesType(value, type) {
  return (type === "object" && isObject(value)) ||
    (type === "array" && Array.isArray(value)) ||
    (type === "string" && typeof value === "string") ||
    (type === "boolean" && typeof value === "boolean") ||
    (type === "integer" && Number.isInteger(value)) ||
    (type === "null" && value === null);
}

function validateAgainstSchema(value, schema) {
  if (!isObject(schema)) return false;
  if (typeof schema.type === "string" && !matchesType(value, schema.type)) return false;
  if (Object.hasOwn(schema, "const") && value !== schema.const) return false;
  if (Array.isArray(schema.required) && isObject(value) && schema.required.some((key) => !Object.hasOwn(value, key))) return false;
  if (schema.additionalProperties === false && isObject(value)) {
    const properties = schema.properties ?? {};
    if (!isObject(properties) || Object.keys(value).some((key) => !Object.hasOwn(properties, key))) return false;
  }
  if (isObject(schema.properties) && isObject(value) && Object.entries(schema.properties).some(([key, child]) => Object.hasOwn(value, key) && !validateAgainstSchema(value[key], child))) return false;
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) return false;
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) return false;
    if (Array.isArray(schema.prefixItems) && schema.prefixItems.some((child, index) => index < value.length && !validateAgainstSchema(value[index], child))) return false;
    if (schema.items === false && Array.isArray(schema.prefixItems) && value.length > schema.prefixItems.length) return false;
    if (isObject(schema.items) && value.some((item) => !validateAgainstSchema(item, schema.items))) return false;
  }
  return true;
}

function hasConst(schema, value) { return isObject(schema) && Object.hasOwn(schema, "const") && schema.const === value; }

function validateSchemaAuthority(schema) {
  const topKeys = ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties"];
  if (!exactKeys(schema, topKeys) || schema.$schema !== "https://json-schema.org/draft/2020-12/schema" || schema.$id !== "https://sut-ai-os.local/schemas/playbook-registry-v1.schema.json" || schema.title !== "Playbook Registry V1 Shadow Contract" || schema.type !== "object" || schema.additionalProperties !== false) return false;
  const top = expectedRegistry;
  if (!sameValues(schema.required, Object.keys(top)) || !exactKeys(schema.properties, Object.keys(top))) return false;
  for (const key of ["schemaVersion", "registryId", "registryMode", "productionWritePermission"]) if (!hasConst(schema.properties[key], top[key])) return false;

  const policy = schema.properties.policyReference;
  if (!isObject(policy) || policy.type !== "object" || policy.additionalProperties !== false || !sameValues(policy.required, Object.keys(top.policyReference)) || !exactKeys(policy.properties, Object.keys(top.policyReference))) return false;
  if (Object.keys(top.policyReference).some((key) => !hasConst(policy.properties[key], top.policyReference[key]))) return false;

  const playbooks = schema.properties.playbooks;
  if (!isObject(playbooks) || playbooks.type !== "array" || playbooks.minItems !== 1 || playbooks.maxItems !== 1 || !isObject(playbooks.items)) return false;
  const entry = playbooks.items;
  const expectedEntry = top.playbooks[0];
  if (entry.type !== "object" || entry.additionalProperties !== false || !sameValues(entry.required, Object.keys(expectedEntry)) || !exactKeys(entry.properties, Object.keys(expectedEntry))) return false;
  for (const key of ["playbookId", "version", "owner", "autonomyTier", "mode", "enabled", "productionWritePermission", "historicalSuccessRate", "historicalRollbackRate"]) if (!hasConst(entry.properties[key], expectedEntry[key])) return false;

  for (const [objectKey, expectedObject] of Object.entries({ trigger: expectedEntry.trigger, approvalPolicy: expectedEntry.approvalPolicy, retryPolicy: expectedEntry.retryPolicy, rollbackPolicy: expectedEntry.rollbackPolicy })) {
    const node = entry.properties[objectKey];
    if (!isObject(node) || node.type !== "object" || node.additionalProperties !== false || !sameValues(node.required, Object.keys(expectedObject)) || !exactKeys(node.properties, Object.keys(expectedObject)) || Object.keys(expectedObject).some((key) => !hasConst(node.properties[key], expectedObject[key]))) return false;
  }
  for (const [arrayKey, expectedArray] of Object.entries({ evidenceRequirements: expectedEntry.evidenceRequirements, requiredChecks: expectedEntry.requiredChecks })) {
    const node = entry.properties[arrayKey];
    if (!isObject(node) || node.type !== "array" || node.minItems !== expectedArray.length || node.maxItems !== expectedArray.length || node.items !== false || !Array.isArray(node.prefixItems) || node.prefixItems.length !== expectedArray.length || expectedArray.some((value, index) => !hasConst(node.prefixItems[index], value))) return false;
  }
  return ["permittedTools", "permittedPaths"].every((key) => isObject(entry.properties[key]) && entry.properties[key].type === "array" && entry.properties[key].maxItems === 0);
}

function fullValidate(registry, schema) {
  return validateSchemaAuthority(schema) && validateAgainstSchema(registry, schema) && sameFiniteValue(registry, expectedRegistry);
}

try {
  const [schemaText, registryText] = await Promise.all([readFile(schemaPath, "utf8"), readFile(registryPath, "utf8")]);
  const schema = JSON.parse(schemaText);
  const registry = JSON.parse(registryText);
  expect(fullValidate(registry, schema), "committed registry must match the canonical closed V1 schema and finite contract");

  let negativeTestsRun = 0;
  const reject = (name, mutate) => {
    const candidate = copy(registry);
    mutate(candidate);
    expect(!fullValidate(candidate, schema), `${name} must fail closed`);
    negativeTestsRun += 1;
  };
  const rejectSchema = (name, mutate) => {
    const candidate = copy(schema);
    mutate(candidate);
    expect(!fullValidate(registry, candidate), `${name} must fail closed`);
    negativeTestsRun += 1;
  };

  rejectSchema("wrong schema id", (candidate) => { candidate.$id = "https://sut-ai-os.local/schemas/other.json"; });
  rejectSchema("weakened target-action constraint", (candidate) => { delete candidate.properties.playbooks.items.properties; });
  reject("missing top-level field", (candidate) => { delete candidate.registryId; });
  reject("extra top-level field", (candidate) => { candidate.unexpected = true; });
  reject("wrong registry version", (candidate) => { candidate.schemaVersion = "2.0.0"; });
  reject("weakened policy reference", (candidate) => { candidate.policyReference.defaultEffect = "allow"; });
  reject("duplicate playbook", (candidate) => { candidate.playbooks.push(copy(candidate.playbooks[0])); });
  reject("extra playbook", (candidate) => { candidate.playbooks.push({}); });
  reject("wrong playbook version", (candidate) => { candidate.playbooks[0].version = "2.0.0"; });
  reject("changed owner", (candidate) => { candidate.playbooks[0].owner = "other"; });
  reject("non-tier-zero entry", (candidate) => { candidate.playbooks[0].autonomyTier = "tier-1"; });
  reject("non-shadow entry", (candidate) => { candidate.playbooks[0].mode = "enabled"; });
  reject("enabled entry", (candidate) => { candidate.playbooks[0].enabled = true; });
  reject("registry production-write permission", (candidate) => { candidate.productionWritePermission = true; });
  reject("entry production-write permission", (candidate) => { candidate.playbooks[0].productionWritePermission = true; });
  reject("altered trigger", (candidate) => { candidate.playbooks[0].trigger.source = "service"; });
  reject("altered evidence requirements", (candidate) => { candidate.playbooks[0].evidenceRequirements.reverse(); });
  reject("permitted tool", (candidate) => { candidate.playbooks[0].permittedTools.push("node"); });
  reject("permitted path", (candidate) => { candidate.playbooks[0].permittedPaths.push("docs/"); });
  reject("removed check", (candidate) => { candidate.playbooks[0].requiredChecks.pop(); });
  reject("reordered checks", (candidate) => { candidate.playbooks[0].requiredChecks.reverse(); });
  reject("activation approval", (candidate) => { candidate.playbooks[0].approvalPolicy.activationAllowed = true; });
  reject("positive retries", (candidate) => { candidate.playbooks[0].retryPolicy.maxAttempts = 1; });
  reject("mutation-capable rollback", (candidate) => { candidate.playbooks[0].rollbackPolicy.mutationAllowed = true; });
  reject("missing historical success rate", (candidate) => { delete candidate.playbooks[0].historicalSuccessRate; });
  reject("non-null historical success rate", (candidate) => { candidate.playbooks[0].historicalSuccessRate = 0; });
  reject("missing historical rollback rate", (candidate) => { delete candidate.playbooks[0].historicalRollbackRate; });
  reject("non-null historical rollback rate", (candidate) => { candidate.playbooks[0].historicalRollbackRate = 0; });
  let malformedRejected = false;
  try { JSON.parse('{"broken"'); } catch { malformedRejected = true; }
  expect(malformedRejected, "malformed JSON must fail closed");
  negativeTestsRun += 1;

  process.stdout.write(`${JSON.stringify({ name: "playbook-registry-v1", passed: true, schemaAuthoritative: true, negativeTestsRun })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ name: "playbook-registry-v1", passed: false, details: error.message })}\n`);
  process.exitCode = 1;
}
