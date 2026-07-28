import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const modulePath = path.join(repositoryRoot, "services/orchestrator/src/kill-switch/evaluator.mjs");
const canonicalModule = await import(pathToFileURL(modulePath).href);

const decisionKeys = ["schemaVersion", "decision", "reasonCode", "controlId"];
let testsRun = 0;

function expect(condition, message) {
  assert.ok(condition, message);
}

function validateDecision(result, label) {
  expect(result !== null && typeof result === "object" && !Array.isArray(result), `${label}: result must be an object`);
  expect(Object.keys(result).length === decisionKeys.length && decisionKeys.every((key, index) => Object.keys(result)[index] === key), `${label}: result must be closed and ordered`);
  expect(result.schemaVersion === "1.0.0", `${label}: wrong schemaVersion`);
  expect(result.decision === "deny", `${label}: result must deny`);
  expect(typeof result.reasonCode === "string" && /^KILL_SWITCH_[A-Z0-9_]+$/.test(result.reasonCode), `${label}: invalid reasonCode`);
  expect(result.controlId === null || (typeof result.controlId === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(result.controlId)), `${label}: invalid controlId`);
  expect(Object.isFrozen(result), `${label}: result must be frozen`);
  testsRun += 1;
  return result;
}

function evaluateWithoutThrow(input, label, ...extraArguments) {
  let result;
  assert.doesNotThrow(() => {
    result = canonicalModule.evaluateKillSwitch(input, ...extraArguments);
  }, `${label}: public evaluation must not throw`);
  return validateDecision(result, label);
}

function expectDecision(input, reasonCode, controlId, label) {
  const result = evaluateWithoutThrow(input, label);
  assert.deepEqual(result, { schemaVersion: "1.0.0", decision: "deny", reasonCode, controlId }, `${label}: wrong deterministic decision`);
  return result;
}

try {
  assert.deepEqual(Object.keys(canonicalModule), ["evaluateKillSwitch"], "module must expose only evaluateKillSwitch");
  expect(canonicalModule.evaluateKillSwitch.length === 1, "public entry point must declare exactly one parameter");

  expectDecision({ targetAction: "autonomous_action" }, "KILL_SWITCH_GLOBAL_AUTONOMY_ENGAGED", "global-autonomous-actions", "global control");
  expectDecision({ targetAction: "playbook_dispatch", playbookId: "content-schema-repair-shadow" }, "KILL_SWITCH_PLAYBOOK_ENGAGED", "playbook-content-schema-repair-shadow", "playbook control");
  expectDecision({ playbookId: "content-schema-repair-shadow", targetAction: "playbook_dispatch" }, "KILL_SWITCH_PLAYBOOK_ENGAGED", "playbook-content-schema-repair-shadow", "playbook control with reversed property order");
  expectDecision({ targetAction: "executor_dispatch", executorId: "codex-content-executor" }, "KILL_SWITCH_EXECUTOR_ENGAGED", "executor-codex-content-executor", "executor control");
  expectDecision({ targetAction: "codex_dispatch" }, "KILL_SWITCH_CODEX_DISPATCH_PAUSED", "codex-dispatch", "Codex dispatch control");
  expectDecision({ targetAction: "pending_action" }, "KILL_SWITCH_PENDING_ACTION_REJECTED", "pending-actions", "pending action control");
  expectDecision({ targetAction: "outbound_notification" }, "KILL_SWITCH_OUTBOUND_NOTIFICATIONS_PAUSED", "outbound-notifications", "outbound notification control");
  expectDecision({ targetAction: "observe" }, "KILL_SWITCH_NO_MATCH_FAIL_CLOSED", null, "observe no-match");
  expectDecision({ targetAction: "playbook_dispatch", playbookId: "other-playbook" }, "KILL_SWITCH_NO_MATCH_FAIL_CLOSED", null, "unmatched playbook");
  expectDecision({ targetAction: "executor_dispatch", executorId: "other-executor" }, "KILL_SWITCH_NO_MATCH_FAIL_CLOSED", null, "unmatched executor");

  const first = expectDecision({ targetAction: "codex_dispatch" }, "KILL_SWITCH_CODEX_DISPATCH_PAUSED", "codex-dispatch", "first allocation");
  const second = expectDecision({ targetAction: "codex_dispatch" }, "KILL_SWITCH_CODEX_DISPATCH_PAUSED", "codex-dispatch", "second allocation");
  expect(first !== second, "every call must return a new allocation");
  assert.throws(() => { first.reasonCode = "ALLOW"; }, TypeError, "prior decisions must resist mutation");
  expectDecision({ targetAction: "codex_dispatch" }, "KILL_SWITCH_CODEX_DISPATCH_PAUSED", "codex-dispatch", "post-mutation evaluation");

  const replacementAuthority = { controls: [], productionWritePermission: true, decision: "allow" };
  const replacementSchema = { additionalProperties: true };
  const replacementDependencies = { authority: replacementAuthority, schema: replacementSchema };
  const baseline = expectDecision({ targetAction: "observe" }, "KILL_SWITCH_NO_MATCH_FAIL_CLOSED", null, "replacement baseline");
  const withExtraArguments = evaluateWithoutThrow(
    { targetAction: "observe" },
    "caller replacement arguments",
    replacementAuthority,
    replacementSchema,
    replacementDependencies
  );
  assert.deepEqual(withExtraArguments, baseline, "extra authority/schema/dependency arguments must not redirect evaluation");
  expectDecision({ targetAction: "observe", authority: replacementAuthority }, "KILL_SWITCH_INVALID_REQUEST", null, "authority request property");
  expectDecision({ targetAction: "observe", schema: replacementSchema }, "KILL_SWITCH_INVALID_REQUEST", null, "schema request property");
  expectDecision({ targetAction: "observe", dependencies: replacementDependencies }, "KILL_SWITCH_INVALID_REQUEST", null, "dependency request property");

  const throwingGetter = {};
  Object.defineProperty(throwingGetter, "targetAction", { enumerable: true, get() { throw new Error("getter trap"); } });
  const throwingOwnKeys = new Proxy({}, { ownKeys() { throw new Error("ownKeys trap"); } });
  const throwingPrototype = new Proxy({}, { getPrototypeOf() { throw new Error("prototype trap"); } });
  const cyclic = { targetAction: "observe" };
  cyclic.self = cyclic;
  const nullPrototype = Object.assign(Object.create(null), { targetAction: "observe" });
  const symbolProperty = { targetAction: "observe", [Symbol("extra")]: true };
  const nonEnumerableProperty = { targetAction: "observe" };
  Object.defineProperty(nonEnumerableProperty, "extra", { value: true });

  const malformedCases = [
    ["undefined", undefined],
    ["null", null],
    ["boolean", false],
    ["number", 1],
    ["bigint", 1n],
    ["symbol", Symbol("request")],
    ["string", "observe"],
    ["function", () => {}],
    ["array", []],
    ["boxed string", new String("observe")],
    ["date", new Date(0)],
    ["missing action", {}],
    ["unknown action", { targetAction: "production_write" }],
    ["non-string action", { targetAction: 1 }],
    ["extra property", { targetAction: "observe", extra: true }],
    ["symbol property", symbolProperty],
    ["non-enumerable property", nonEnumerableProperty],
    ["cyclic extra property", cyclic],
    ["throwing getter", throwingGetter],
    ["throwing ownKeys proxy", throwingOwnKeys],
    ["throwing prototype proxy", throwingPrototype],
    ["playbook missing ID", { targetAction: "playbook_dispatch" }],
    ["playbook wrong ID type", { targetAction: "playbook_dispatch", playbookId: 7 }],
    ["playbook invalid ID", { targetAction: "playbook_dispatch", playbookId: "Content Repair" }],
    ["playbook forbidden executor ID", { targetAction: "playbook_dispatch", playbookId: "content-schema-repair-shadow", executorId: "codex-content-executor" }],
    ["executor missing ID", { targetAction: "executor_dispatch" }],
    ["executor wrong ID type", { targetAction: "executor_dispatch", executorId: [] }],
    ["executor invalid ID", { targetAction: "executor_dispatch", executorId: "codex/content" }],
    ["executor forbidden playbook ID", { targetAction: "executor_dispatch", executorId: "codex-content-executor", playbookId: "content-schema-repair-shadow" }],
    ["conditional ID on observe", { targetAction: "observe", playbookId: "content-schema-repair-shadow" }]
  ];

  for (const [label, value] of malformedCases) {
    const result = expectDecision(value, "KILL_SWITCH_INVALID_REQUEST", null, `malformed ${label}`);
    const repeated = expectDecision(value, "KILL_SWITCH_INVALID_REQUEST", null, `repeated malformed ${label}`);
    assert.deepEqual(repeated, result, `${label}: malformed deny must be deterministic`);
    expect(repeated !== result, `${label}: repeated malformed deny must be newly allocated`);
  }

  expectDecision(nullPrototype, "KILL_SWITCH_NO_MATCH_FAIL_CLOSED", null, "null-prototype ordinary record");

  const source = await readFile(modulePath, "utf8");
  expect(!/^\s*import\s/m.test(source), "runtime module must not import repository or external authority");
  expect(!/\b(?:fetch|XMLHttpRequest|WebSocket)\s*\(/.test(source), "runtime module must not use network clients");
  expect(!/\bprocess\s*\./.test(source), "runtime module must not use process environment or runtime state");
  expect(!/\b(?:Date\.now|Math\.random|setTimeout|setInterval)\s*\(/.test(source), "runtime module must not use clock, randomness, or timers");
  expect(!/\.json["']/.test(source), "runtime module must not import mutable JSON authority");
  expect(!/\bexport\s+(?:const|let|var|class)\b/.test(source), "runtime module must not export authority or mutation state");

  const authorityLiteral = 'mode: "observe-only"';
  const authorityOffset = source.indexOf(authorityLiteral);
  expect(authorityOffset >= 0, "bounded authority fault test requires the committed mode literal");
  const invalidSource = `${source.slice(0, authorityOffset)}mode: "invalid"${source.slice(authorityOffset + authorityLiteral.length)}`;
  const invalidModule = await import(`data:text/javascript;base64,${Buffer.from(invalidSource).toString("base64")}`);
  const invalidAuthorityDecision = validateDecision(invalidModule.evaluateKillSwitch({ targetAction: "autonomous_action" }), "invalid authority precedence");
  assert.deepEqual(invalidAuthorityDecision, {
    schemaVersion: "1.0.0",
    decision: "deny",
    reasonCode: "KILL_SWITCH_INTERNAL_AUTHORITY_INVALID",
    controlId: null
  }, "invalid authority must take precedence over control matching");
  const invalidAuthorityMalformedDecision = validateDecision(invalidModule.evaluateKillSwitch(null), "invalid authority over malformed request");
  assert.deepEqual(invalidAuthorityMalformedDecision, invalidAuthorityDecision, "internal authority failure must precede malformed-request handling");

  process.stdout.write(`${JSON.stringify({
    name: "kill-switch-controls-v1",
    passed: true,
    testsRun,
    details: "Private frozen authority, deny-only decisions, exact precedence, caller isolation, malformed-input safety, and dependency direction passed"
  })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ name: "kill-switch-controls-v1", passed: false, details: error.message })}\n`);
  process.exitCode = 1;
}
