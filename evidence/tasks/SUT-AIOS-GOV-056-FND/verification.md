# Workflow V2 Foundation verification

- **Task:** `SUT-AIOS-GOV-056-FND`
- **Scope:** Task Packet V2 schema and V1/V2 validation; stage-specific routing authority; agent route and effort enforcement; inactive-agent and terminal-task rejection; structured SHA-bound review-result validation; required authoring and execution documentation.
- **Explicit exclusions:** The hardcoded CI validator list remains authoritative. No reconciliation implementation, validator-registry takeover, GitHub write permission, bot commit, deployment, production behavior, provider fallback, telemetry, or routing optimization is included.

## Deterministic checks

The following checks passed on the implementation tree before this evidence record was written:

```text
node tests/task/validate-task-packet-v2.mjs
node tests/review/validate-review-binding.mjs
node tests/codex/validate-routing-negative-cases.mjs
node scripts/codex/validate-routing.mjs
node scripts/task/validate --all
npm run verify:fast
git diff --check
```

The focused tests cover valid V1 compatibility, valid V2 packets, malformed/unsupported packets, stage routing, CLI override rejection, agent route/effort rejection, inactive agents, terminal tasks, SHA/head identity binding, context binding, and canonical output-hash rejection.

## Independent review

Terra semantic review and Sol architecture/safety review were requested against the exact final tree. The first Terra pass correctly blocked until this evidence path and the administrative-record allowlist were present; those blockers are recorded as resolved by the follow-up review on the final implementation SHA. No task is marked `verified` by this record alone; the task remains subject to the final exact-head review gate.
