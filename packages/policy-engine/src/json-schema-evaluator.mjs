/**
 * Small, runtime-safe JSON Schema subset used by the Phase 1 policy engine.
 * It deliberately accepts only the keywords used by the committed contracts.
 */
const supportedKeywords = new Set([
  "$schema", "$id", "title", "type", "const", "enum", "required",
  "properties", "additionalProperties", "minLength"
]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function validateSchemaKeywords(schemaNode) {
  if (!isObject(schemaNode)) return false;
  if (Object.keys(schemaNode).some((key) => !supportedKeywords.has(key))) return false;
  return !isObject(schemaNode.properties) || Object.values(schemaNode.properties).every(validateSchemaKeywords);
}

export function validateJsonSchema(instance, schemaNode) {
  if (!isObject(schemaNode) || !validateSchemaKeywords(schemaNode)) return false;

  if (schemaNode.type) {
    const types = Array.isArray(schemaNode.type) ? schemaNode.type : [schemaNode.type];
    const matchesType = types.some((type) => (
      (type === "null" && instance === null) ||
      (type === "object" && isObject(instance)) ||
      (type === "string" && typeof instance === "string") ||
      (type === "boolean" && typeof instance === "boolean") ||
      (type === "integer" && Number.isInteger(instance)) ||
      (type === "number" && typeof instance === "number") ||
      (type === "array" && Array.isArray(instance))
    ));
    if (!matchesType) return false;
  }
  if (Object.hasOwn(schemaNode, "const") && instance !== schemaNode.const) return false;
  if (Array.isArray(schemaNode.enum) && !schemaNode.enum.includes(instance)) return false;
  if (typeof schemaNode.minLength === "number" && typeof instance === "string" && instance.length < schemaNode.minLength) return false;

  if (Array.isArray(schemaNode.required) && isObject(instance) && schemaNode.required.some((key) => !Object.hasOwn(instance, key))) return false;
  if (schemaNode.additionalProperties === false && isObject(instance)) {
    const allowed = new Set(Object.keys(schemaNode.properties ?? {}));
    if (Object.keys(instance).some((key) => !allowed.has(key))) return false;
  }
  if (isObject(schemaNode.properties) && isObject(instance)) {
    return Object.entries(schemaNode.properties).every(([key, propertySchema]) => (
      !Object.hasOwn(instance, key) || validateJsonSchema(instance[key], propertySchema)
    ));
  }
  return true;
}
