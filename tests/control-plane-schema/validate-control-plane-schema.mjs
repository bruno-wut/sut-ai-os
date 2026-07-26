import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactPath = path.join(repositoryRoot, "packages/control-plane-schema/control-plane-schema-v1.json");
const entityFields = {
  system_events: ["id", "correlationId", "type", "occurredAt"],
  workflow_runs: ["id", "correlationId", "status", "triggerEventId"],
  workflow_steps: ["id", "workflowRunId", "sequence", "status"],
  action_proposals: ["id", "workflowRunId", "status", "riskLevel"],
  approval_requests: ["id", "proposalId", "status"],
  agent_runs: ["id", "workflowRunId", "agentId", "status"],
  tool_executions: ["id", "agentRunId", "toolName", "status"],
  verification_results: ["id", "workflowRunId", "status", "verifiedAt"]
};
const relationshipTargets = {
  workflow_runs: { triggerEventId: "system_events" },
  workflow_steps: { workflowRunId: "workflow_runs" },
  action_proposals: { workflowRunId: "workflow_runs" },
  approval_requests: { proposalId: "action_proposals" },
  agent_runs: { workflowRunId: "workflow_runs" },
  tool_executions: { agentRunId: "agent_runs" },
  verification_results: { workflowRunId: "workflow_runs" }
};
const primitiveTypes = new Set(["string", "integer", "number", "boolean"]);
const forbiddenTerms = new Set(["migration", "rls", "credential", "credentials", "personalData", "retention", "policy", "audit", "liveService"]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value, expected) => isObject(value) && Object.keys(value).length === expected.length && expected.every((key) => Object.hasOwn(value, key));
const copy = (value) => JSON.parse(JSON.stringify(value));
const expect = (condition, description) => { if (!condition) throw new Error(description); };

function validate(schema) {
  if (!exactKeys(schema, ["schemaVersion", "entities"]) || schema.schemaVersion !== "1.0.0" || !isObject(schema.entities)) return false;
  const names = Object.keys(entityFields);
  if (!exactKeys(schema.entities, names)) return false;
  for (const name of names) {
    const entity = schema.entities[name];
    if (!exactKeys(entity, ["fields", "relationships"]) || !isObject(entity.fields) || !isObject(entity.relationships)) return false;
    const fields = entityFields[name];
    if (!exactKeys(entity.fields, fields) || fields.some((field) => typeof entity.fields[field] !== "string" || entity.fields[field].length === 0 || !primitiveTypes.has(entity.fields[field]))) return false;
    const targetFields = relationshipTargets[name] ?? {};
    if (Object.keys(entity.relationships).length !== Object.keys(targetFields).length) return false;
    for (const declaration of Object.values(entity.relationships)) {
      if (!exactKeys(declaration, ["field", "referencesEntity", "referencesField"])) return false;
      if (!Object.hasOwn(targetFields, declaration.field) || declaration.referencesEntity !== targetFields[declaration.field] || declaration.referencesField !== "id") return false;
      if (!Object.hasOwn(schema.entities, declaration.referencesEntity) || !Object.hasOwn(schema.entities[declaration.referencesEntity].fields, "id")) return false;
    }
  }
  const containsForbiddenTerm = (value) => isObject(value) && Object.entries(value).some(([key, child]) => forbiddenTerms.has(key) || containsForbiddenTerm(child));
  return !containsForbiddenTerm(schema);
}

try {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  expect(validate(artifact), "committed version-1 artifact must be valid");

  for (const key of ["schemaVersion", "entities"]) {
    const candidate = copy(artifact);
    delete candidate[key];
    expect(!validate(candidate), `missing top-level ${key} must fail`);
  }
  expect(!validate({ ...copy(artifact), unexpected: true }), "unexpected top-level field must fail");
  expect(!validate({ ...copy(artifact), schemaVersion: "2.0.0" }), "unsupported schema version must fail");

  const missingEntity = copy(artifact);
  delete missingEntity.entities.system_events;
  expect(!validate(missingEntity), "missing required entity must fail");
  const unexpectedEntity = copy(artifact);
  unexpectedEntity.entities.audit_entries = { fields: { id: "string" }, relationships: {} };
  expect(!validate(unexpectedEntity), "unexpected entity must fail");
  const unexpectedFieldDefinition = copy(artifact);
  unexpectedFieldDefinition.entities.workflow_runs.fields.status = "object";
  expect(!validate(unexpectedFieldDefinition), "unexpected required-field definition must fail");

  const missingField = copy(artifact);
  delete missingField.entities.workflow_steps.fields.sequence;
  expect(!validate(missingField), "missing required entity field must fail");
  const emptyPrimitive = copy(artifact);
  emptyPrimitive.entities.agent_runs.fields.agentId = "";
  expect(!validate(emptyPrimitive), "empty primitive type must fail");
  const malformedRelationship = copy(artifact);
  delete malformedRelationship.entities.workflow_runs.relationships.triggerEvent.referencesField;
  expect(!validate(malformedRelationship), "malformed relationship object must fail");
  const absentRelationshipEntity = copy(artifact);
  absentRelationshipEntity.entities.workflow_runs.relationships.triggerEvent.referencesEntity = "missing_entity";
  expect(!validate(absentRelationshipEntity), "relationship to an absent entity must fail");
  const nonIdReference = copy(artifact);
  nonIdReference.entities.workflow_runs.relationships.triggerEvent.referencesField = "eventId";
  expect(!validate(nonIdReference), "relationship that does not reference id must fail");

  for (const [name, mutate] of Object.entries({
    migration: (candidate) => { candidate.migration = true; },
    rls: (candidate) => { candidate.entities.system_events.rls = true; },
    credential: (candidate) => { candidate.entities.system_events.fields.credential = "string"; },
    personalData: (candidate) => { candidate.entities.system_events.personalData = true; },
    retention: (candidate) => { candidate.entities.system_events.retention = "forever"; },
    policy: (candidate) => { candidate.entities.system_events.policy = "allow"; },
    audit: (candidate) => { candidate.audit = true; },
    liveService: (candidate) => { candidate.liveService = true; }
  })) {
    const candidate = copy(artifact);
    mutate(candidate);
    expect(!validate(candidate), `forbidden ${name} behavior must fail`);
  }

  process.stdout.write(`${JSON.stringify({ name: "control-plane-schema", passed: true, details: "one valid artifact and all documented invalid cases have the expected result" })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ name: "control-plane-schema", passed: false, details: error.message })}\n`);
  process.exitCode = 1;
}
