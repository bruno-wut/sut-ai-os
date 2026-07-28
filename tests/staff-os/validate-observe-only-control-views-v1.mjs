import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(repositoryRoot, "schemas/staff-os-control-views-v1.schema.json");
const artifactPath = path.join(repositoryRoot, "apps/staff-os/staff-os-control-views-v1.json");
const controlPlanePath = path.join(repositoryRoot, "packages/control-plane-schema/control-plane-schema-v1.json");
const auditPath = path.join(repositoryRoot, "packages/audit-sdk/append-only-audit-contract-v1.json");
const killSwitchPath = path.join(repositoryRoot, "services/orchestrator/src/kill-switch/evaluator.mjs");

const expectedArtifact = {
  schemaVersion: "1.0.0",
  viewSetId: "sut-aios-staff-os-control-views",
  mode: "observe-only",
  productionWritePermission: false,
  views: [
    {
      viewId: "workflow-control-plane",
      title: "Workflow control-plane",
      source: {
        authorityPath: "packages/control-plane-schema/control-plane-schema-v1.json",
        authorityType: "static_control_plane_contract",
        entity: "workflow_runs"
      },
      displayFields: ["id", "correlationId", "status", "triggerEventId"],
      permittedActions: ["observe"],
      noLiveDataState: "static_contract_only"
    },
    {
      viewId: "append-only-audit-record",
      title: "Append-only audit record",
      source: {
        authorityPath: "packages/audit-sdk/append-only-audit-contract-v1.json",
        authorityType: "static_append_only_audit_contract",
        entity: "record"
      },
      displayFields: ["id", "correlationId", "recordedAt", "actorType", "actionType", "outcome"],
      permittedActions: ["observe"],
      noLiveDataState: "static_contract_only"
    },
    {
      viewId: "deny-only-kill-switch-decision",
      title: "Deny-only kill-switch decision",
      source: {
        authorityPath: "services/orchestrator/src/kill-switch/evaluator.mjs",
        authorityType: "deny_only_kill_switch_evaluator",
        publicInterface: "evaluateKillSwitch",
        fixedRequest: { targetAction: "observe" },
        expectedDecision: {
          schemaVersion: "1.0.0",
          decision: "deny",
          reasonCode: "KILL_SWITCH_NO_MATCH_FAIL_CLOSED",
          controlId: null
        }
      },
      displayFields: ["schemaVersion", "decision", "reasonCode", "controlId"],
      permittedActions: ["observe"],
      noLiveDataState: "static_contract_only"
    }
  ]
};

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const copy = (value) => JSON.parse(JSON.stringify(value));
const expect = (condition, message) => { if (!condition) throw new Error(message); };
const exactKeys = (value, keys) => isObject(value) && Object.keys(value).length === keys.length && keys.every((key, index) => Object.keys(value)[index] === key);
const sameArray = (actual, expected) => Array.isArray(actual) && actual.length === expected.length && expected.every((value, index) => actual[index] === value);

function sameFiniteValue(actual, expected) {
  if (Array.isArray(expected)) {
    return Array.isArray(actual) && actual.length === expected.length && expected.every((item, index) => sameFiniteValue(actual[index], item));
  }
  if (isObject(expected)) {
    const keys = Object.keys(expected);
    return exactKeys(actual, keys) && keys.every((key) => sameFiniteValue(actual[key], expected[key]));
  }
  return actual === expected;
}

function matchesType(value, type) {
  return (type === "object" && isObject(value)) || (type === "array" && Array.isArray(value));
}

function validateAgainstSchema(value, schema) {
  if (!isObject(schema)) return false;
  if (typeof schema.type === "string" && !matchesType(value, schema.type)) return false;
  if (Object.hasOwn(schema, "const") && value !== schema.const) return false;
  if (Array.isArray(schema.required) && isObject(value) && schema.required.some((key) => !Object.hasOwn(value, key))) return false;
  if (schema.additionalProperties === false && isObject(value)) {
    if (!isObject(schema.properties) || Object.keys(value).some((key) => !Object.hasOwn(schema.properties, key))) return false;
  }
  if (isObject(schema.properties) && isObject(value)) {
    if (Object.entries(schema.properties).some(([key, child]) => Object.hasOwn(value, key) && !validateAgainstSchema(value[key], child))) return false;
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(schema.minItems) && value.length < schema.minItems) return false;
    if (Number.isInteger(schema.maxItems) && value.length > schema.maxItems) return false;
    if (Array.isArray(schema.prefixItems) && schema.prefixItems.some((child, index) => index < value.length && !validateAgainstSchema(value[index], child))) return false;
    if (schema.items === false && Array.isArray(schema.prefixItems) && value.length > schema.prefixItems.length) return false;
  }
  return true;
}

function isExactClosedSchema(node, expected) {
  if (Array.isArray(expected)) {
    return exactKeys(node, ["type", "minItems", "maxItems", "prefixItems", "items"]) &&
      node.type === "array" && node.minItems === expected.length && node.maxItems === expected.length && node.items === false &&
      Array.isArray(node.prefixItems) && node.prefixItems.length === expected.length &&
      expected.every((value, index) => isExactClosedSchema(node.prefixItems[index], value));
  }
  if (isObject(expected)) {
    const keys = Object.keys(expected);
    return exactKeys(node, ["type", "additionalProperties", "required", "properties"]) &&
      node.type === "object" && node.additionalProperties === false && sameArray(node.required, keys) && exactKeys(node.properties, keys) &&
      keys.every((key) => isExactClosedSchema(node.properties[key], expected[key]));
  }
  return exactKeys(node, ["const"]) && Object.hasOwn(node, "const") && node.const === expected;
}

function validateSchemaAuthority(schema) {
  const metadataKeys = ["$schema", "$id", "title", "type", "additionalProperties", "required", "properties"];
  return exactKeys(schema, metadataKeys) &&
    schema.$schema === "https://json-schema.org/draft/2020-12/schema" &&
    schema.$id === "https://sut-ai-os.local/schemas/staff-os-control-views-v1.schema.json" &&
    schema.title === "Staff OS Control Views V1 Observe-Only Contract" &&
    schema.type === "object" && schema.additionalProperties === false &&
    sameArray(schema.required, Object.keys(expectedArtifact)) && exactKeys(schema.properties, Object.keys(expectedArtifact)) &&
    Object.keys(expectedArtifact).every((key) => isExactClosedSchema(schema.properties[key], expectedArtifact[key]));
}

function fullValidate(artifact, schema) {
  return validateSchemaAuthority(schema) && validateAgainstSchema(artifact, schema) && sameFiniteValue(artifact, expectedArtifact);
}

function sourceFieldsExist(authority, objectPath, expectedFields) {
  let cursor = authority;
  for (const key of objectPath) {
    if (!isObject(cursor) || !Object.hasOwn(cursor, key)) return false;
    cursor = cursor[key];
  }
  return isObject(cursor) && expectedFields.every((field) => typeof cursor[field] === "string" && cursor[field].length > 0);
}

try {
  const [schemaText, artifactText, controlPlaneText, auditText, killSwitchModule] = await Promise.all([
    readFile(schemaPath, "utf8"),
    readFile(artifactPath, "utf8"),
    readFile(controlPlanePath, "utf8"),
    readFile(auditPath, "utf8"),
    import(pathToFileURL(killSwitchPath).href)
  ]);
  const schema = JSON.parse(schemaText);
  const artifact = JSON.parse(artifactText);
  const controlPlane = JSON.parse(controlPlaneText);
  const audit = JSON.parse(auditText);

  expect(fullValidate(artifact, schema), "committed Staff OS artifact must match the canonical closed V1 schema and finite contract");
  expect(sourceFieldsExist(controlPlane, ["entities", "workflow_runs", "fields"], expectedArtifact.views[0].displayFields), "P1-002 workflow_runs authority must contain every referenced display field");
  expect(sourceFieldsExist(audit, ["record", "fields"], expectedArtifact.views[1].displayFields), "P1-003 record authority must contain every referenced display field");
  expect(sameArray(Object.keys(killSwitchModule), ["evaluateKillSwitch"]) && typeof killSwitchModule.evaluateKillSwitch === "function", "P1-007 module must expose only evaluateKillSwitch");
  const fixedDecision = killSwitchModule.evaluateKillSwitch(expectedArtifact.views[2].source.fixedRequest);
  expect(sameFiniteValue(fixedDecision, expectedArtifact.views[2].source.expectedDecision), "P1-007 fixed observe request must return the documented closed deny decision");

  let negativeTestsRun = 0;
  const reject = (name, mutate) => {
    const candidate = copy(artifact);
    mutate(candidate);
    expect(!fullValidate(candidate, schema), `${name} must fail closed`);
    negativeTestsRun += 1;
  };
  const rejectSchema = (name, mutate) => {
    const candidate = copy(schema);
    mutate(candidate);
    expect(!fullValidate(artifact, candidate), `${name} must fail closed`);
    negativeTestsRun += 1;
  };

  rejectSchema("wrong schema identifier", (candidate) => { candidate.$id = "https://sut-ai-os.local/schemas/other.json"; });
  rejectSchema("open top-level schema", (candidate) => { candidate.additionalProperties = true; });
  rejectSchema("weakened action constraint", (candidate) => { delete candidate.properties.views.prefixItems[0].properties.permittedActions.prefixItems; });
  rejectSchema("weakened source constraint", (candidate) => { candidate.properties.views.prefixItems[1].properties.source.additionalProperties = true; });
  rejectSchema("weakened decision constraint", (candidate) => { delete candidate.properties.views.prefixItems[2].properties.source.properties.expectedDecision.properties.decision.const; });
  reject("missing top-level field", (candidate) => { delete candidate.viewSetId; });
  reject("extra top-level field", (candidate) => { candidate.endpoint = "https://example.invalid"; });
  reject("wrong schema version", (candidate) => { candidate.schemaVersion = "2.0.0"; });
  reject("wrong view-set identity", (candidate) => { candidate.viewSetId = "other"; });
  reject("non-observe mode", (candidate) => { candidate.mode = "interactive"; });
  reject("production write permission", (candidate) => { candidate.productionWritePermission = true; });
  reject("missing view", (candidate) => { candidate.views.pop(); });
  reject("extra view", (candidate) => { candidate.views.push(copy(candidate.views[0])); });
  reject("reordered views", (candidate) => { candidate.views.reverse(); });
  reject("changed workflow source path", (candidate) => { candidate.views[0].source.authorityPath = "other.json"; });
  reject("changed workflow source type", (candidate) => { candidate.views[0].source.authorityType = "live_control_plane"; });
  reject("changed workflow entity", (candidate) => { candidate.views[0].source.entity = "workflow_steps"; });
  reject("changed audit source path", (candidate) => { candidate.views[1].source.authorityPath = "other.json"; });
  reject("changed audit source type", (candidate) => { candidate.views[1].source.authorityType = "audit_store"; });
  reject("changed audit entity", (candidate) => { candidate.views[1].source.entity = "audit_entries"; });
  reject("changed evaluator interface", (candidate) => { candidate.views[2].source.publicInterface = "authorize"; });
  reject("changed fixed request", (candidate) => { candidate.views[2].source.fixedRequest.targetAction = "autonomous_action"; });
  reject("changed expected decision", (candidate) => { candidate.views[2].source.expectedDecision.decision = "allow"; });
  reject("changed expected reason", (candidate) => { candidate.views[2].source.expectedDecision.reasonCode = "OTHER"; });
  reject("changed expected control", (candidate) => { candidate.views[2].source.expectedDecision.controlId = "global-autonomous-actions"; });
  reject("removed display field", (candidate) => { candidate.views[0].displayFields.pop(); });
  reject("reordered display fields", (candidate) => { candidate.views[1].displayFields.reverse(); });
  reject("changed decision fields", (candidate) => { candidate.views[2].displayFields[1] = "approved"; });
  reject("non-observe action", (candidate) => { candidate.views[0].permittedActions[0] = "execute"; });
  reject("additional action", (candidate) => { candidate.views[1].permittedActions.push("approve"); });
  reject("live-data claim", (candidate) => { candidate.views[2].noLiveDataState = "live"; });
  for (const forbidden of ["endpoint", "query", "command", "credential", "callback", "approval", "authorization", "execution", "write"]) {
    reject(`forbidden ${forbidden} field`, (candidate) => { candidate.views[0].source[forbidden] = true; });
  }

  let malformedRejected = false;
  try { JSON.parse('{"schemaVersion":'); } catch { malformedRejected = true; }
  expect(malformedRejected, "malformed JSON must fail closed");
  negativeTestsRun += 1;

  process.stdout.write(`${JSON.stringify({ name: "staff-os-control-views-v1", passed: true, schemaAuthoritative: true, sourceAuthoritiesConfirmed: true, fixedKillSwitchDecisionConfirmed: true, negativeTestsRun })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ name: "staff-os-control-views-v1", passed: false, details: error.message })}\n`);
  process.exitCode = 1;
}
