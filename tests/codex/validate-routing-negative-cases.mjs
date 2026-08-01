import assert from "node:assert/strict";
import {
  allowedEfforts,
  assertActiveAgent,
  assertAgentRouteEffort,
  assertExecutableTaskState,
  assertNonTerminalTask,
  assertProfileAuthorization,
  assertTaskId,
  comparisonBaseSha,
  packetAccess,
  selectRoute
} from "../../scripts/codex/launch.mjs";

const access = {
  version: "2.0.0",
  route: "terra",
  effort: "high",
  routingPolicy: {
    implementation: { route: "terra", effort: "high" },
    planReview: { route: "luna", effort: "high" },
    semanticReview: { route: "terra", effort: "high" },
    mergeRiskReview: { required: true, route: "sol", effort: "medium" }
  }
};

assert.deepEqual(selectRoute("auto", undefined, access, "terra", "plan-review"), { route: "luna", effort: "high" });
assert.deepEqual(selectRoute("auto", undefined, access, "terra", "merge-risk-review"), { route: "sol", effort: "medium" });
assert.throws(() => selectRoute("luna", undefined, access, "terra", "implementation"), /override/);
assert.throws(() => selectRoute("auto", "low", access, "terra", "implementation"), /override/);
assert.throws(() => selectRoute("auto", undefined, { ...access, routingPolicy: { ...access.routingPolicy, semanticReview: undefined } }, "terra", "semantic-qa"), /missing routingPolicy/);

const agent = { id: "qa-verification", status: "active", allowedRoutes: ["terra"], allowedEfforts: ["high"] };
assert.doesNotThrow(() => assertAgentRouteEffort(agent, "terra", "high", true));
assert.throws(() => assertAgentRouteEffort(agent, "sol", "high", true), /does not permit route/);
assert.throws(() => assertAgentRouteEffort(agent, "terra", "medium", true), /does not permit effort/);
assert.throws(() => assertAgentRouteEffort({ id: "missing-policy", status: "active" }, "terra", "high", true), /must declare/);
assert.throws(() => assertActiveAgent({ id: "staged-agent", status: "staged" }), /not active/);
assert.throws(() => assertNonTerminalTask("SUT-TEST-DONE", "done"), /terminal task/);
assert.doesNotThrow(() => assertExecutableTaskState("SUT-TEST-ACTIVE", "active"));
assert.throws(() => assertExecutableTaskState("SUT-TEST-BACKLOG", "backlog"), /not executable/);
assert.throws(() => assertExecutableTaskState("SUT-TEST-BLOCKED", "blocked"), /not executable/);
for (const invalidId of ["../escape", "C:\\absolute", "a/b", "a\\b", "/absolute/path"]) {
  assert.throws(() => assertTaskId(invalidId), /Task ID/);
}
assert.doesNotThrow(() => assertTaskId("SUT-AIOS-GOV-056-FND"));
const markdownAccess = packetAccess({ format: "markdown", text: "- **Allowed agents:** `codex-engineering-executor`, `qa-verification`\n- **Model route:** `terra`\n- **Workspace write:** `true`", state: "active" });
assert.deepEqual(markdownAccess.allowedAgents, ["codex-engineering-executor", "qa-verification"]);
assert.equal(markdownAccess.route, "terra");
assert.equal(markdownAccess.workspaceWrite, true);
const activeV2 = { format: "json", state: "active", data: { schemaVersion: "2.0.0", owner: "codex-engineering-executor", defaultAgent: "codex-engineering-executor", reviewer: "qa-verification" } };
const reviewV2 = { ...activeV2, state: "review" };
const v2Access = { version: "2.0.0" };
assert.doesNotThrow(() => assertProfileAuthorization("implementation", activeV2, v2Access, "codex-engineering-executor"));
assert.throws(() => assertProfileAuthorization("implementation", activeV2, v2Access, "qa-verification"), /owner/);
assert.doesNotThrow(() => assertProfileAuthorization("semantic-qa", reviewV2, v2Access, "qa-verification"));
assert.throws(() => assertProfileAuthorization("semantic-qa", reviewV2, v2Access, "codex-engineering-executor"), /independent/);
assert.match(comparisonBaseSha(), /^[0-9a-f]{40}$/);
assert.equal(allowedEfforts.sol.has("low"), false, "Sol low is prohibited");
assert.equal(allowedEfforts.terra.has("max"), false, "Terra max is prohibited");

process.stdout.write(JSON.stringify({ status: "passed", checks: 23 }) + "\n");
