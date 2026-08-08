# Workflow V2 Foundation verification

- **Task:** `SUT-AIOS-GOV-056-FND`
- **Final implementation head tested:** `635c5076450fe3948f0a57ff686edabf42531459`
- **Canonical base:** `origin/main` at `7226268dece3bfcc191716b243f45711c2eb131c`
- **Scope:** Task Packet V2 schema and V1/V2 validation; stage-specific routing authority; agent route and effort enforcement; inactive-agent and terminal-task rejection; structured SHA-bound review-result validation; required authoring and execution documentation.
- **Explicit exclusions:** The hardcoded CI validator list remains authoritative. No reconciliation implementation, validator-registry takeover, GitHub write permission, bot commit, deployment, production behavior, provider fallback, telemetry, or routing optimization is included.

## Routing adjustment

The approved stage configuration is Chief Orchestrator `luna/high`, Plan Review `sol/high`, Implementation `terra/high`, routine Semantic QA `luna/high`, and Merge Safety `sol/high`. The agent defaults, Foundation packet, deferred V2 packets, and `task:new` template match those pairs. `routingComplexity: high-complexity` is required before a V2 packet can select `luna/max` deep semantic QA or `sol/xhigh` escalation; no fallback or automatic escalation was introduced.

## Deterministic checks

The complete packet-required suite passed on the clean committed implementation head `635c5076450fe3948f0a57ff686edabf42531459`:

```text
node tests/task/validate-task-packet-v2.mjs
node tests/review/validate-review-binding.mjs
node tests/codex/validate-routing-negative-cases.mjs
node tests/codex/v2-review-lifecycle.mjs
node scripts/codex/validate-routing.mjs
node scripts/task/validate --self-test
node scripts/task/validate --all
npm run verify:fast
git diff --check
```

The focused suites passed with 13 Task Packet checks, 7 review-binding checks, 45 routing checks, 33 full V2 review-lifecycle checks, and 4 task self-test checks. They cover valid V1 compatibility, valid and malformed V2 packets, stage routing, CLI override rejection, agent route/effort enforcement, inactive and terminal task rejection, exact SHA/base/context/output binding, immutable app run envelopes, launcher trace binding, task-snapshot binding, evidence-path and missing-evidence rejection, canonical-base rejection, Qwen read-only enforcement, and fail-closed Git SHA lookup.

The repository-wide task validator and `verify:fast` both passed. No validator-registry activation, reconciliation, GitHub write path, fallback, telemetry, deployment, or production behavior was exercised or enabled.

## Independent review

Terra semantic review and Sol architecture/safety review were requested against exact committed trees. The first Terra pass correctly blocked until this evidence path and the administrative-record allowlist were present; those blockers were resolved before this evidence update. The Sol review also drove the task-state, V1 Markdown, task-ID, canonical-base, clean-head, environment, and normal-output safeguards. A later Terra pass identified the non-canonical comparison-base override; `fd94b38f167d252132ef8917649b0cce214e4ecc` pins the base to fetched `origin/main` and adds rejection tests. The subsequent Sol exact-head review identified three safety blockers: the risk-register path was missing from the packet allowlist, Qwen workspace-write was not rejected, and Git SHA resolution could fail open; `2929246378a89a168178b91f00a4f4e4acb7b4b0` resolves all three with deterministic coverage. No task is marked `verified` by this record alone; the task remains subject to the final exact-head review gate.

Subsequent exact-head reviewers found and drove bounded corrections for stage-specific reviewer authorization, durable Codex-app review artifacts, verified-state artifact revalidation, app preparation authorization, dirty-packet rejection, immutable run envelopes, exact reviewed-task snapshots, caller-supplied evidence bypasses, ordinary launcher-trace binding, and durable evidence-reference existence. Those corrections are included in `635c5076450fe3948f0a57ff686edabf42531459`, and the complete suite above was rerun on that clean commit. This record does not mark the task verified; independent Plan, Semantic, and Merge Safety review of the resulting exact review head remains the next gate.
