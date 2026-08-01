# Task workflow

Every implementation begins with one canonical JSON packet at `tasks/<status>/<task-id>/task.json`. The Markdown templates are human-readable companion views; the JSON packet is the machine-enforced source for lifecycle controls and Codex routing.

## Required packet contract

New tasks use Task Packet V2 validated against [task-packet-v2.schema.json](../../schemas/task-packet-v2.schema.json). Historical packets validate against [task-packet.schema.json](../../schemas/task-packet.schema.json). V2 packets require stage-specific `routingPolicy` (`architectureReview`, `planReview`, `implementation`, `semanticReview`, `mergeRiskReview`, `fallback`) with model route and reasoning effort definitions. A packet records its business and technical objectives, architecture sources, dependencies, evidence, assumptions, acceptance criteria, allowed and forbidden paths, allowed commands, checks, tests, permissions, risk and autonomy tier, ownership, context budget, rollback plan, completion evidence, and append-only state history.

`productionWritePermission` defaults to `false`; `pullRequestRequirement` defaults to `true`. New playbooks start at `tier-0` and `shadow` mode. Packets must explicitly enable `workspaceWrite` before the existing Codex launcher will request workspace-write mode.

## Two-PR Lifecycle & Post-Merge Reconciliation

```text
backlog → ready → active → review → verified (PR #1 merged) → done (automated CI reconciliation)
              ↘ blocked ↗       ↘ revision-required → active
```

Feature development uses a two-stage delivery workflow:
1. **Feature Delivery (PR #1)**: The task moves through `active` -> `review` -> `verified` with independent verification evidence. PR #1 is merged to `main` while in `verified` status.
2. **Post-Merge Reconciliation**: Upon merging PR #1 into `main`, the automated CI reconciliation job (`scripts/task/reconcile-merged-task.mjs`) inspects the merge commit range, confirms the exact `verified` task packet, appends the merge commit SHA / PR reference to `completionEvidence`, transitions the packet to `done`, and commits the final state.

`cancelled` and `archived` are terminal alternatives. Terminal packets are immutable; create a follow-on packet rather than silently rewriting completed work.

## Commands

Use npm on every platform:

```text
npm run task:new -- --task SUT-AIOS-AREA-001 --title "Bounded change"
npm run task:validate -- --task SUT-AIOS-AREA-001
npm run task:start -- --task SUT-AIOS-AREA-001 --reason "Scope and checks approved"
npm run task:review -- --task SUT-AIOS-AREA-001 --reason "Implementation submitted"
npm run task:review -- --task SUT-AIOS-AREA-001 --verified --evidence evidence/tasks/SUT-AIOS-AREA-001/verification.md --reason "Independent review passed"
npm run task:list
```

The direct cross-platform entry points are `scripts/task/new`, `validate`, `move`, `start`, `block`, `review`, `complete`, `list`, and `status`; invoke them with Node when not using npm. Run `node scripts/task/validate --self-test` for a disposable lifecycle fixture. The test creates and removes only its own exact operating-system temporary directory; it does not alter repository records.

## Branches, reviews, and evidence

The implementer cannot be the only completion authority: a separate reviewer records verification before `verified`. Structured reviews output SHA-bound JSON results validated against `review-result-v1.schema.json`.

Place concise durable conclusions in `evidence/tasks/<task-id>/`. Put large raw logs, screenshots, traces, and test payloads in `artifacts/` and reference their path, hash, and summary from evidence; do not paste them into packet context. Update [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md) before handoff whenever a risk, blocker, failed check, or unresolved warning appears.

