// Verification consumers may reuse the runtime-safe schema subset. Runtime code never imports from scripts/verify.
export { validateJsonSchema, validateSchemaKeywords } from "../../packages/policy-engine/src/json-schema-evaluator.mjs";
