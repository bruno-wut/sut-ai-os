/**
 * Pure, neutral, deterministic JSON Schema evaluator module.
 * Shared across verification frameworks, contract validators, and runtime evaluators.
 * Explicitly enforces a closed supported-keyword subset:
 *   $schema, $id, title, type, const, enum, required, properties, additionalProperties, minLength.
 * Rejects unknown or unsupported schema keywords to ensure fail-closed execution.
 */

const supportedKeywords = new Set([
  "$schema",
  "$id",
  "title",
  "type",
  "const",
  "enum",
  "required",
  "properties",
  "additionalProperties",
  "minLength"
]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Validates a schema document node for unsupported keywords.
 * @param {object} schemaNode - Schema object to inspect
 * @returns {boolean} true if schema node contains only supported keywords
 */
export function validateSchemaKeywords(schemaNode) {
  if (!isObject(schemaNode)) return false;
  for (const key of Object.keys(schemaNode)) {
    if (!supportedKeywords.has(key)) return false;
  }
  if (isObject(schemaNode.properties)) {
    for (const propSchema of Object.values(schemaNode.properties)) {
      if (!validateSchemaKeywords(propSchema)) return false;
    }
  }
  return true;
}

/**
 * Validates an arbitrary data instance against a closed-keyword JSON Schema node.
 * Evaluates type, const, enum, required, properties, additionalProperties, minLength.
 * @param {any} instance - Data payload to validate
 * @param {object} schemaNode - Closed-keyword JSON Schema object
 * @returns {boolean} true if instance satisfies schemaNode, false otherwise
 */
export function validateJsonSchema(instance, schemaNode) {
  if (!isObject(schemaNode)) return false;
  if (!validateSchemaKeywords(schemaNode)) return false;

  // 1. type evaluation
  if (schemaNode.type) {
    const types = Array.isArray(schemaNode.type) ? schemaNode.type : [schemaNode.type];
    const satisfiesType = types.some((t) => {
      if (t === "null") return instance === null;
      if (t === "object") return isObject(instance);
      if (t === "string") return typeof instance === "string";
      if (t === "boolean") return typeof instance === "boolean";
      if (t === "integer") return Number.isInteger(instance);
      if (t === "number") return typeof instance === "number";
      if (t === "array") return Array.isArray(instance);
      return false;
    });
    if (!satisfiesType) return false;
  }

  // 2. const evaluation
  if (Object.hasOwn(schemaNode, "const")) {
    if (instance !== schemaNode.const) return false;
  }

  // 3. enum evaluation
  if (Array.isArray(schemaNode.enum)) {
    if (!schemaNode.enum.includes(instance)) return false;
  }

  // 4. minLength evaluation
  if (typeof schemaNode.minLength === "number" && typeof instance === "string") {
    if (instance.length < schemaNode.minLength) return false;
  }

  // 5. required properties evaluation
  if (Array.isArray(schemaNode.required) && isObject(instance)) {
    for (const reqKey of schemaNode.required) {
      if (!Object.hasOwn(instance, reqKey)) return false;
    }
  }

  // 6. additionalProperties evaluation
  if (schemaNode.additionalProperties === false && isObject(instance)) {
    const allowedProps = new Set(schemaNode.properties ? Object.keys(schemaNode.properties) : []);
    for (const key of Object.keys(instance)) {
      if (!allowedProps.has(key)) return false;
    }
  }

  // 7. properties recursive evaluation against schema properties
  if (isObject(schemaNode.properties) && isObject(instance)) {
    for (const [propName, propSchema] of Object.entries(schemaNode.properties)) {
      if (Object.hasOwn(instance, propName)) {
        if (!validateJsonSchema(instance[propName], propSchema)) return false;
      }
    }
  }

  return true;
}
