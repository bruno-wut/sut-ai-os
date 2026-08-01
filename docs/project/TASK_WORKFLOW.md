# Task workflow

Every implementation begins with one canonical JSON packet at `tasks/<status>/<task-id>/task.json`. The Markdown templates are human-readable companion views; the JSON packet is the machine-enforced source for lifecycle controls and Codex routing.

## Required packet contract

V1 packets remain valid against [task-packet.schema.json](../../schemas/task-packet.schema.json). New work should use the closed [task-packet-v2.schema.json](../../schemas/task-packet-v2.schema.json). V2 replaces top-level route/effort authority with stage-specific `routingPolicy`; the packet records objectives, evidence, allowlists, checks, permissions, risk, ownership, context budget, rollback plan, and append-only state history.

V2 routing has no implicit fallback. `implementation`, `planReview`, `semanticReview`, and `mergeRiskReview` each declare the route and reasoning effort for that stage. The launcher rejects route or effort command-line overrides, inactive agents, terminal tasks, and agent declarations that do not permit the selected route or effort.

Only `active` implementation tasks and `review` review tasks are executable. A review must use a clean committed head and binds its base to fetched `origin/main`; `GOVERNED_BASE_SHA` is accepted only when it exactly matches that canonical ref, and `GOVERNED_BASE_REF` may only name `origin/main`. The mutable local `main` branch is not authoritative. Local Qwen execution requires an explicit provider and installed model and receives only the launcher environment allowlist.

`productionWritePermission` defaults to `false`; `pullRequestRequirement` defaults to `true`. New playbooks start at `tier-0` and `shadow` mode. Packets must explicitly enable `workspaceWrite` before the existing Codex launcher will request workspace-write mode.

## Lifecycle

```text
backlog → ready → active → review → verified → done
              ↘ blocked ↗       ↘ revision-required → active
```

`cancelled` and `archived` are terminal alternatives. The task tool records every permitted transition with from/to state, timestamp, actor, and reason. `done`, `cancelled`, and `archived` packets are immutable through the tool; create a follow-on packet rather than silently rewriting completed work.

Only a `ready` packet with non-empty allowed paths, forbidden paths, allowed commands, acceptance criteria, required checks, and required tests can move to `active`. `verified` requires an evidence reference and `done` requires a further completion-evidence reference. This enforces the repository definition of verified work: implementation plus deterministic checks plus independent review plus recorded evidence.

## Commands

Use npm on every platform:

```text
npm run task:new -- --task SUT-AIOS-AREA-001 --title "Bounded change"
npm run task:validate -- --task SUT-AIOS-AREA-001
npm run task:start -- --task SUT-AIOS-AREA-001 --reason "Scope and checks approved"
npm run task:review -- --task SUT-AIOS-AREA-001 --reason "Implementation submitted"
npm run task:review -- --task SUT-AIOS-AREA-001 --verified --evidence evidence/tasks/SUT-AIOS-AREA-001/verification.md --reason "Independent review passed"
npm run task:complete -- --task SUT-AIOS-AREA-001 --evidence evidence/tasks/SUT-AIOS-AREA-001/verification.md --reason "Evidence recorded"
npm run task:list
```

The direct cross-platform entry points are `scripts/task/new`, `validate`, `move`, `start`, `block`, `review`, `complete`, `list`, and `status`; invoke them with Node when not using npm. Run `node scripts/task/validate --self-test` for a disposable lifecycle fixture. The test creates and removes only its own exact operating-system temporary directory; it does not alter repository records.

## Branches, reviews, and evidence

One packet normally maps to one branch and one pull request. The packet must say when an exception is approved. The implementer cannot be the only completion authority: a separate reviewer records verification before `verified`. Review results use `schemas/review-result-v1.schema.json` and bind the task, comparison base, reviewed head, reviewer, model, effort, context manifest, and canonical output hash.

Place concise durable conclusions in `evidence/tasks/<task-id>/`. Put large raw logs, screenshots, traces, and test payloads in `artifacts/` and reference their path, hash, and summary from evidence; do not paste them into packet context. Update [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md) before handoff whenever a risk, blocker, failed check, or unresolved warning appears.
