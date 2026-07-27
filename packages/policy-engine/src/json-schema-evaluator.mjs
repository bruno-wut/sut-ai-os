/**
 * Pure, deterministic JSON Schema Draft 2020-12 evaluator module.
 * Shared across policy contract validators and policy engine evaluators.
 */

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

/**
 * Validates an arbitrary data instance against a Draft 2020-12 JSON Schema node.
 * Evaluates type, const, enum, required, properties, additionalProperties, minLength.
 * @param {any} instance - Data payload to validate
 * @param {object} schemaNode - Draft 2020-12 JSON Schema object
 * @returns {boolean} true if instance satisfies schemaNode, false otherwise
 */
export function validateJsonSchema(instance, schemaNode) {
  if (!isObject(schemaNode)) return false;

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
