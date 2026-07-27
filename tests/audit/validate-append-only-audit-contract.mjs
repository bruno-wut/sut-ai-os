import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const artifactPath = path.join(repositoryRoot, "packages/audit-sdk/append-only-audit-contract-v1.json");

const requiredRecordFields = [
  "id",
  "correlationId",
  "recordedAt",
  "actorType",
  "actorId",
  "actionType",
  "outcome",
  "previousHash",
  "recordHash"
];

const primitiveTypes = new Set(["string", "integer", "number", "boolean"]);
const forbiddenTerms = new Set([
  "payload",
  "guest",
  "payment",
  "inventory",
  "pricing",
  "credential",
  "credentials",
  "authorization",
  "rls",
  "retention",
  "deletion",
  "policy",
  "database",
  "migration",
  "liveservice",
  "liveService"
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
      if (lower.includes(term.toLowerCase())) return true;
    }
    return false;
  }
  if (isObject(value)) {
    return Object.entries(value).some(
      ([key, child]) =>
        forbiddenTerms.has(key) || containsForbiddenTerm(key) || containsForbiddenTerm(child)
    );
  }
  if (Array.isArray(value)) {
    return value.some((item) => containsForbiddenTerm(item));
  }
  return false;
}

function validate(schema) {
  if (!exactKeys(schema, ["schemaVersion", "record", "appendOnly"])) return false;
  if (schema.schemaVersion !== "1.0.0") return false;
  if (!isObject(schema.record) || !exactKeys(schema.record, ["fields"])) return false;
  if (!exactKeys(schema.record.fields, requiredRecordFields)) return false;

  for (const field of requiredRecordFields) {
    const typeVal = schema.record.fields[field];
    if (typeof typeVal !== "string" || typeVal.length === 0 || !primitiveTypes.has(typeVal)) {
      return false;
    }
  }

  if (!isObject(schema.appendOnly) || !exactKeys(schema.appendOnly, ["insertOnly", "immutableFields", "chain"])) return false;
  if (schema.appendOnly.insertOnly !== true) return false;
  if (!Array.isArray(schema.appendOnly.immutableFields)) return false;
  if (schema.appendOnly.immutableFields.length !== requiredRecordFields.length) return false;
  for (let i = 0; i < requiredRecordFields.length; i += 1) {
    if (schema.appendOnly.immutableFields[i] !== requiredRecordFields[i]) return false;
  }

  if (!isObject(schema.appendOnly.chain) || !exactKeys(schema.appendOnly.chain, ["previousField", "hashField", "firstRecordPreviousHash"])) return false;
  if (schema.appendOnly.chain.previousField !== "previousHash") return false;
  if (schema.appendOnly.chain.hashField !== "recordHash") return false;
  if (schema.appendOnly.chain.firstRecordPreviousHash !== null) return false;

  return !containsForbiddenTerm(schema);
}

try {
  const artifact = JSON.parse(await readFile(artifactPath, "utf8"));
  expect(validate(artifact), "committed version-1 artifact must be valid");

  // Top level fields
  for (const key of ["schemaVersion", "record", "appendOnly"]) {
    const candidate = copy(artifact);
    delete candidate[key];
    expect(!validate(candidate), `missing top-level ${key} must fail`);
  }
  expect(!validate({ ...copy(artifact), unexpected: true }), "unexpected top-level field must fail");
  expect(!validate({ ...copy(artifact), schemaVersion: "2.0.0" }), "unsupported schema version must fail");

  // Record fields
  const missingRecordField = copy(artifact);
  delete missingRecordField.record.fields.id;
  expect(!validate(missingRecordField), "missing required record field must fail");

  const unexpectedRecordField = copy(artifact);
  unexpectedRecordField.record.fields.unexpected = "string";
  expect(!validate(unexpectedRecordField), "unexpected record field must fail");

  const emptyPrimitive = copy(artifact);
  emptyPrimitive.record.fields.actorId = "";
  expect(!validate(emptyPrimitive), "empty primitive type must fail");

  // Append-only definitions
  const missingAppendOnly = copy(artifact);
  delete missingAppendOnly.appendOnly;
  expect(!validate(missingAppendOnly), "missing appendOnly must fail");

  const falseInsertOnly = copy(artifact);
  falseInsertOnly.appendOnly.insertOnly = false;
  expect(!validate(falseInsertOnly), "insertOnly false must fail");

  const missingImmutable = copy(artifact);
  missingImmutable.appendOnly.immutableFields.pop();
  expect(!validate(missingImmutable), "missing immutable field must fail");

  const reorderedImmutable = copy(artifact);
  const temp = reorderedImmutable.appendOnly.immutableFields[0];
  reorderedImmutable.appendOnly.immutableFields[0] = reorderedImmutable.appendOnly.immutableFields[1];
  reorderedImmutable.appendOnly.immutableFields[1] = temp;
  expect(!validate(reorderedImmutable), "reordered immutable field list must fail");

  const malformedChain = copy(artifact);
  delete malformedChain.appendOnly.chain.hashField;
  expect(!validate(malformedChain), "malformed chain must fail");

  const incorrectChainMapping = copy(artifact);
  incorrectChainMapping.appendOnly.chain.previousField = "wrongField";
  expect(!validate(incorrectChainMapping), "incorrect chain field mapping must fail");

  const incorrectChainNull = copy(artifact);
  incorrectChainNull.appendOnly.chain.firstRecordPreviousHash = "0000";
  expect(!validate(incorrectChainNull), "incorrect chain first record previous hash must fail");

  // Forbidden behavior assertions
  for (const [name, mutate] of Object.entries({
    payload: (candidate) => { candidate.record.fields.payload = "string"; },
    guest: (candidate) => { candidate.guestData = true; },
    payment: (candidate) => { candidate.payment = true; },
    inventory: (candidate) => { candidate.inventory = true; },
    pricing: (candidate) => { candidate.pricing = true; },
    credential: (candidate) => { candidate.record.fields.credential = "string"; },
    authorization: (candidate) => { candidate.authorization = "allowed"; },
    rls: (candidate) => { candidate.rls = true; },
    retention: (candidate) => { candidate.retention = "30days"; },
    deletion: (candidate) => { candidate.deletion = true; },
    policy: (candidate) => { candidate.policy = "enforce"; },
    database: (candidate) => { candidate.database = "postgres"; },
    migration: (candidate) => { candidate.migration = true; },
    liveService: (candidate) => { candidate.liveService = true; }
  })) {
    const candidate = copy(artifact);
    mutate(candidate);
    expect(!validate(candidate), `forbidden ${name} behavior must fail`);
  }

  process.stdout.write(
    `${JSON.stringify({
      name: "append-only-audit-contract",
      passed: true,
      details: "one valid artifact and all documented invalid cases have the expected result"
    })}\n`
  );
} catch (error) {
  process.stdout.write(
    `${JSON.stringify({ name: "append-only-audit-contract", passed: false, details: error.message })}\n`
  );
  process.exitCode = 1;
}
