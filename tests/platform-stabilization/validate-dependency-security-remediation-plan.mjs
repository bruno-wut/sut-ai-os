#!/usr/bin/env node

import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(testDirectory, "..", "..");
const contractDirectory = path.join(root, "docs", "platform-stabilization");
const schemaPath = path.join(contractDirectory, "dependency-security-remediation-plan.schema.json");
const planPath = path.join(contractDirectory, "dependency-security-remediation-plan.json");

const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
const plan = JSON.parse(fs.readFileSync(planPath, "utf8"));

// This evaluator intentionally supports only the JSON Schema 2020-12 keywords
// used by this contract. Schema vocabulary is checked first and fails closed if
// an unsupported keyword is introduced; this is not a general JSON Schema engine.
const supportedKeywords = new Set([
  "$defs",
  "$id",
  "$ref",
  "$schema",
  "additionalProperties",
  "const",
  "contains",
  "enum",
  "format",
  "items",
  "minimum",
  "minItems",
  "minLength",
  "pattern",
  "properties",
  "required",
  "title",
  "type",
  "uniqueItems",
]);
const supportedTypes = new Set(["array", "boolean", "integer", "object", "string"]);

function escapePointer(value) {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function inspectSchemaVocabulary(node, pointer = "#") {
  assert(node && typeof node === "object" && !Array.isArray(node), `${pointer} must be a schema object`);

  for (const keyword of Object.keys(node)) {
    assert(supportedKeywords.has(keyword), `${pointer} uses unsupported schema keyword ${keyword}`);
  }
  if (node.type !== undefined) {
    assert.equal(typeof node.type, "string", `${pointer}/type must be a string in this contract subset`);
    assert(supportedTypes.has(node.type), `${pointer}/type uses unsupported type ${node.type}`);
  }
  if (node.$ref !== undefined) {
    assert.equal(typeof node.$ref, "string", `${pointer}/$ref must be a string`);
    assert(node.$ref.startsWith("#/"), `${pointer}/$ref must be a local JSON Pointer`);
  }
  if (node.format !== undefined) {
    assert.equal(node.format, "date", `${pointer}/format uses unsupported format ${node.format}`);
  }
  if (node.additionalProperties !== undefined) {
    assert(
      typeof node.additionalProperties === "boolean" ||
        (node.additionalProperties && typeof node.additionalProperties === "object" && !Array.isArray(node.additionalProperties)),
      `${pointer}/additionalProperties must be a boolean or schema object`,
    );
  }

  for (const [keyword, children] of [
    ["properties", node.properties],
    ["$defs", node.$defs],
  ]) {
    if (children === undefined) continue;
    assert(children && typeof children === "object" && !Array.isArray(children), `${pointer}/${keyword} must be an object`);
    for (const [name, child] of Object.entries(children)) {
      inspectSchemaVocabulary(child, `${pointer}/${keyword}/${escapePointer(name)}`);
    }
  }

  for (const keyword of ["items", "contains"]) {
    if (node[keyword] !== undefined) inspectSchemaVocabulary(node[keyword], `${pointer}/${keyword}`);
  }
  if (node.additionalProperties && typeof node.additionalProperties === "object") {
    inspectSchemaVocabulary(node.additionalProperties, `${pointer}/additionalProperties`);
  }
}

function resolveLocalReference(reference) {
  const segments = reference
    .slice(2)
    .split("/")
    .map((segment) => segment.replaceAll("~1", "/").replaceAll("~0", "~"));
  let value = schema;
  for (const segment of segments) {
    assert(value && Object.hasOwn(value, segment), `Unresolvable local schema reference: ${reference}`);
    value = value[segment];
  }
  return value;
}

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  if (Number.isInteger(value)) return "integer";
  return typeof value;
}

function validDate(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function validate(instance, schemaNode, instancePointer = "", errors = []) {
  if (schemaNode.$ref !== undefined) {
    validate(instance, resolveLocalReference(schemaNode.$ref), instancePointer, errors);
  }

  if (schemaNode.type !== undefined && valueType(instance) !== schemaNode.type) {
    errors.push(`${instancePointer || "/"}: expected ${schemaNode.type}, received ${valueType(instance)}`);
    return errors;
  }
  if (schemaNode.const !== undefined && !isDeepStrictEqual(instance, schemaNode.const)) {
    errors.push(`${instancePointer || "/"}: value does not match const`);
  }
  if (schemaNode.enum !== undefined && !schemaNode.enum.some((candidate) => isDeepStrictEqual(instance, candidate))) {
    errors.push(`${instancePointer || "/"}: value is not in enum`);
  }

  if (typeof instance === "string") {
    if (schemaNode.minLength !== undefined && [...instance].length < schemaNode.minLength) {
      errors.push(`${instancePointer || "/"}: string is shorter than minLength ${schemaNode.minLength}`);
    }
    if (schemaNode.pattern !== undefined && !new RegExp(schemaNode.pattern, "u").test(instance)) {
      errors.push(`${instancePointer || "/"}: string does not match pattern ${schemaNode.pattern}`);
    }
    if (schemaNode.format === "date" && !validDate(instance)) {
      errors.push(`${instancePointer || "/"}: string is not a valid full-date`);
    }
  }

  if (Number.isInteger(instance) && schemaNode.minimum !== undefined && instance < schemaNode.minimum) {
    errors.push(`${instancePointer || "/"}: integer is below minimum ${schemaNode.minimum}`);
  }

  if (Array.isArray(instance)) {
    if (schemaNode.minItems !== undefined && instance.length < schemaNode.minItems) {
      errors.push(`${instancePointer || "/"}: array has fewer than ${schemaNode.minItems} items`);
    }
    if (schemaNode.uniqueItems) {
      for (let index = 0; index < instance.length; index += 1) {
        for (let prior = 0; prior < index; prior += 1) {
          if (isDeepStrictEqual(instance[index], instance[prior])) {
            errors.push(`${instancePointer || "/"}: items ${prior} and ${index} are not unique`);
          }
        }
      }
    }
    if (schemaNode.items !== undefined) {
      instance.forEach((item, index) =>
        validate(item, schemaNode.items, `${instancePointer}/${index}`, errors),
      );
    }
    if (schemaNode.contains !== undefined) {
      const hasMatch = instance.some((item, index) => {
        const candidateErrors = [];
        validate(item, schemaNode.contains, `${instancePointer}/${index}`, candidateErrors);
        return candidateErrors.length === 0;
      });
      if (!hasMatch) errors.push(`${instancePointer || "/"}: array does not satisfy contains`);
    }
  }

  if (instance && typeof instance === "object" && !Array.isArray(instance)) {
    const properties = schemaNode.properties ?? {};
    for (const requiredProperty of schemaNode.required ?? []) {
      if (!Object.hasOwn(instance, requiredProperty)) {
        errors.push(`${instancePointer || "/"}: missing required property ${requiredProperty}`);
      }
    }
    for (const [property, propertySchema] of Object.entries(properties)) {
      if (Object.hasOwn(instance, property)) {
        validate(instance[property], propertySchema, `${instancePointer}/${escapePointer(property)}`, errors);
      }
    }
    const extras = Object.keys(instance).filter((property) => !Object.hasOwn(properties, property));
    if (schemaNode.additionalProperties === false) {
      for (const property of extras) {
        errors.push(`${instancePointer || "/"}: additional property ${property} is not allowed`);
      }
    } else if (schemaNode.additionalProperties && typeof schemaNode.additionalProperties === "object") {
      for (const property of extras) {
        validate(
          instance[property],
          schemaNode.additionalProperties,
          `${instancePointer}/${escapePointer(property)}`,
          errors,
        );
      }
    }
  }

  return errors;
}

inspectSchemaVocabulary(schema);
const schemaErrors = validate(plan, schema);
assert.deepEqual(schemaErrors, [], `Plan does not conform to schema:\n${schemaErrors.join("\n")}`);

// Cross-field and policy assertions not expressed by the JSON Schema contract.
const targets = new Map(plan.auditTargets.map((target) => [target.id, target]));
assert.deepEqual(
  [...targets.keys()].sort(),
  ["astro-storefront", "compatibility-root", "governance-workspace"],
);

for (const target of targets.values()) {
  const counted = target.counts.critical + target.counts.high + target.counts.moderate + target.counts.low;
  assert.equal(target.counts.total, counted, `${target.id} severity total must be internally consistent`);
  assert.equal(target.result === "pass", target.exitCode === 0, `${target.id} result and exit code disagree`);
  const findingPackages = target.findings.map((finding) => finding.package);
  assert.equal(new Set(findingPackages).size, findingPackages.length, `${target.id} repeats a finding package`);
}

assert.deepEqual(targets.get("governance-workspace").counts, {
  critical: 0,
  high: 0,
  moderate: 0,
  low: 0,
  total: 0,
});
assert.deepEqual(targets.get("compatibility-root").counts, {
  critical: 0,
  high: 6,
  moderate: 0,
  low: 0,
  total: 6,
});
assert.deepEqual(targets.get("astro-storefront").counts, {
  critical: 0,
  high: 6,
  moderate: 0,
  low: 1,
  total: 7,
});

const waveOrders = plan.remediationWaves.map((wave) => wave.order);
assert.deepEqual(waveOrders, waveOrders.map((_, index) => index + 1));
const futureCommands = plan.releaseGates.flatMap((gate) => gate.commands);
assert(futureCommands.includes("npm audit --omit=dev"));
assert(!futureCommands.some((command) => /npm audit fix(?:\s+--force)?/.test(command)));
assert(!futureCommands.some((command) => /\bdeploy(?:ment)?\b/i.test(command)));

process.stdout.write(
  `${JSON.stringify({
    status: "pass",
    validation: "schema-driven",
    schemaVocabulary: "exact-keywords-used-by-contract",
    supportedKeywords: [...supportedKeywords].sort(),
    contract: path.relative(root, planPath).replaceAll(path.sep, "/"),
    schema: path.relative(root, schemaPath).replaceAll(path.sep, "/"),
    auditTargets: plan.auditTargets.length,
    remediationWaves: plan.remediationWaves.length,
    releaseGates: plan.releaseGates.length,
  })}\n`,
);
