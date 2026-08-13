# Task workflow

Every implementation begins with one canonical JSON packet at `tasks/<status>/<task-id>/task.json`. The Markdown templates are human-readable companion views; the JSON packet is the machine-enforced source for lifecycle controls and Codex routing.

## Required packet contract

V1 packets remain valid against [task-packet.schema.json](../../schemas/task-packet.schema.json). New work should use the closed [task-packet-v2.schema.json](../../schemas/task-packet-v2.schema.json). V2 replaces top-level route/effort authority with stage-specific `routingPolicy`; the packet records objectives, evidence, allowlists, checks, permissions, risk, ownership, context budget, rollback plan, and append-only state history.

V2 routing has no implicit fallback. `implementation`, `planReview`, `semanticReview`, and `mergeRiskReview` each declare the authorized `agent`, route, and reasoning effort for that stage. `routingComplexity` is required: use `routine` for normal work; `high-complexity` is required before a packet may choose `luna/max` deep semantic QA or `sol/xhigh` escalation. The packet validator rejects incompatible Sol/low and Terra/max pairs; the launcher rejects route or effort command-line overrides, inactive agents, terminal tasks, and agent declarations that do not permit the selected route or effort.

Only `active` implementation tasks and `review` review tasks are executable. A review must use a clean committed head and binds its base to fetched `origin/main`; `GOVERNED_BASE_SHA` is accepted only when it exactly matches that canonical ref, and `GOVERNED_BASE_REF` may only name `origin/main`. The mutable local `main` branch is not authoritative. Local Qwen execution requires an explicit provider and installed model and receives only the launcher environment allowlist.

`productionWritePermission` defaults to `false`; `pullRequestRequirement` defaults to `true`. New playbooks start at `tier-0` and `shadow` mode. Packets must explicitly enable `workspaceWrite` before the existing Codex launcher will request workspace-write mode.

## Lifecycle

```text
backlog → ready → active → review → verified → done
              ↘ blocked ↗       ↘ revision-required → active
```

`cancelled` and `archived` are terminal alternatives. The task tool records every permitted transition with from/to state, timestamp, actor, and reason. `done`, `cancelled`, and `archived` packets are immutable through the tool; create a follow-on packet rather than silently rewriting completed work.

Only a `ready` packet with non-empty allowed paths, forbidden paths, allowed commands, acceptance criteria, required checks, and required tests can move to `active`. `verified` requires an evidence reference and `done` requires a further completion-evidence reference. For V2, `verified` additionally requires every configured review-stage artifact for the committed review head to be present, schema-valid, launcher-bound to the task/head/stage/agent/model/effort, and passing. This enforces the repository definition of verified work: implementation plus deterministic checks plus independent review plus recorded evidence.

V2 verification uses three ordered commits because a Git commit cannot contain evidence that names its own SHA:

1. **Source head:** move the task to `review`, commit that lifecycle record, run all deterministic checks, and obtain every configured review against this immutable commit.
2. **Evidence head:** create `evidence/verification/<task-id>/verification-<source-head>.json`, retain the passing review artifacts and their bound traces, then commit only that exact same-task review and verification evidence. Do not change the task packet or implementation in this commit.
3. **Lifecycle head:** from the clean evidence head, move the task to `verified` using the final configured review artifact as `--evidence`, the immutable source SHA as `--review-head`, and the fetched canonical `origin/main` SHA as `--review-base`; then commit only the task lifecycle move.

The validator requires `source head -> evidence head -> lifecycle head` ancestry, requires the evidence head to add exactly the source-head verification record plus configured review artifacts and traces, rejects historical evidence rewrites or unrelated paths, and admits only the append-only task transition after the evidence head. The `reviewVerification` record therefore has distinct `headSha` and `evidenceHeadSha` values. If merge-risk review is required, its source-head artifact is the final configured review artifact; otherwise use the semantic-review artifact.

## Commands

Use npm on every platform:

```text
npm run task:new -- --task SUT-AIOS-AREA-001 --title "Bounded change"
npm run task:validate -- --task SUT-AIOS-AREA-001
npm run task:start -- --task SUT-AIOS-AREA-001 --reason "Scope and checks approved"
npm run task:review -- --task SUT-AIOS-AREA-001 --reason "Implementation submitted"
npm run task:review -- --task SUT-AIOS-AREA-001 --verified --evidence evidence/reviews/SUT-AIOS-AREA-001/<final-review-stage>-<source-head>.json --review-head <source-head> --review-base <origin-main-sha> --reason "Independent review and committed evidence passed"
npm run task:complete -- --task SUT-AIOS-AREA-001 --evidence evidence/tasks/SUT-AIOS-AREA-001/verification.md --reason "Evidence recorded"
npm run task:list
```

Run the V2 `--verified` command only after committing the evidence-only head and confirming a clean worktree. Replace `<final-review-stage>` with `mergeRiskReview` when required by the packet, otherwise `semanticReview`. Replace `<source-head>` with the immutable reviewed commit SHA and `<origin-main-sha>` with the fetched canonical `origin/main` SHA. The later `task:complete` evidence must be one of the packet-declared completion destinations.

The direct cross-platform entry points are `scripts/task/new`, `validate`, `move`, `start`, `block`, `review`, `complete`, `list`, and `status`; invoke them with Node when not using npm. Run `node scripts/task/validate --self-test` for a disposable lifecycle fixture. The test creates and removes only its own exact operating-system temporary directory; it does not alter repository records.

## Branches, reviews, and evidence

One packet normally maps to one branch and one pull request. The packet must say when an exception is approved. The implementer cannot be the only completion authority: a separate reviewer records verification before `verified`. Review results use `schemas/review-result-v1.schema.json`; a launcher or Codex-app orchestration run creates their identity envelope, validates the assessment, computes the canonical output hash, and persists one result per stage at `evidence/reviews/<task-id>/<stage>-<head-sha>.json`. Subsequent review stages may proceed only while the sole uncommitted changes are those same-task review artifacts, preserving one immutable reviewed source head. Each result binds the task, comparison base, reviewed head, reviewer, model, effort, context manifest, app/launcher run trace, and canonical output hash. This is deterministic review provenance, not cryptographic authentication.

Place concise durable conclusions in `evidence/tasks/<task-id>/`. Put large raw logs, screenshots, traces, and test payloads in `artifacts/` and reference their path, hash, and summary from evidence; do not paste them into packet context. Update [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md) before handoff whenever a risk, blocker, failed check, or unresolved warning appears.
