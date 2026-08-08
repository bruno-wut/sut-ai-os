# Codex Operating Guide

## Product mission

Build a governed, hotel-owned AI Operating System that improves direct commerce, operations, reliability, and growth without surrendering control of guest data, payments, inventory, pricing, or production systems. Read [PRODUCT.md](docs/project/PRODUCT.md) for the durable product definition.

## Required reading order

1. This file.
2. [CONTEXT_INDEX.md](docs/project/CONTEXT_INDEX.md) for the shortest task-specific path.
3. The task packet and linked evidence.
4. The detailed documents selected by the index.
5. Canonical source documents only when the task needs architecture or agent-design authority: `docs/architecture/source/**`.

## Repository map

- `reference/finalized-platform/` — immutable compatibility snapshot; never an implementation target.
- `agents/`, `prompts/`, `schemas/`, `policies/`, `playbooks/` — versioned governance surfaces.
- `tasks/`, `evidence/`, `artifacts/reports/`, `docs/handoffs/` — durable workflow and audit records.
- `scripts/` — shared helpers; no credentials.
- `docs/project/` — permanent project memory; see [REPOSITORY_STRUCTURE.md](docs/project/REPOSITORY_STRUCTURE.md).

## Source-of-truth boundaries

Follow [SOURCE_OF_TRUTH.md](docs/project/SOURCE_OF_TRUTH.md). In short: canonical architecture sources govern architecture intent; Git governs repository artifacts; the compatibility snapshot governs only its captured interfaces; external operational systems govern their own live state; AI output is never authoritative by itself.

## Standard workflow

1. Read the task packet, context index, relevant risk entries, and selected sources.
2. Confirm scope, risk tier, allowed paths, forbidden paths, commands, evidence destination, and rollback expectation.
3. Use an isolated worktree for implementation work.
4. Implement only the approved scope; preserve unrelated work.
5. Run deterministic checks from the packet.
6. Obtain independent review appropriate to risk.
7. Record evidence, outcome, unresolved concerns, and handoff before claiming completion.

## Safe local actions

Read-only repository inspection, documentation work, schema/policy drafting in an approved governance task, local deterministic checks, and disposable local builds are allowed when they do not contact or mutate external systems.

## Actions requiring approval

Any production or staging deployment; external service calls with side effects; database access beyond approved read-only views; changes to shared governance, schemas, policies, playbooks, scripts, or completed records; dependency upgrades; compatibility-baseline refreshes; and any action outside the packet’s allowlist.

## Prohibited actions

- Production database changes without an approved task.
- RLS changes without specialist review.
- Payment credential changes.
- Destructive booking changes.
- Production deployment during ordinary implementation.
- Unrestricted SQL.
- Secret exposure or copying local credentials into tracked files, prompts, evidence, or logs.
- Bypassing required verification or independent review.
- Editing, building in, installing into, or generating files under `reference/finalized-platform/**`.
- Editing `docs/architecture/source/**`.

## Required verification

Verified work is **implementation plus deterministic checks plus independent review plus recorded evidence**. Follow [DEFINITION_OF_DONE.md](docs/project/DEFINITION_OF_DONE.md); a passing build alone is not completion.

## Task-packet requirement and worktree requirement

Every execution requires an approved packet with task ID, objective, risk tier, allowed/forbidden paths, command allowlist, required checks, evidence destination, and rollback expectation. Use an isolated worktree for implementation; do not use the immutable compatibility snapshot as one. See [REPOSITORY_STRUCTURE.md](docs/project/REPOSITORY_STRUCTURE.md).

## Independent-review requirement and documentation update requirement

The implementer must not be the sole completion authority. Record review and verification evidence in the packet’s destinations. Before handoff, update the relevant permanent-memory document when stable knowledge changes and add every issue, blocker, risk, failed check, or unresolved warning to [ISSUES_AND_RISKS.md](docs/project/ISSUES_AND_RISKS.md).

## Autonomy and model routing

Use [AUTONOMY_BOUNDARIES.md](docs/project/AUTONOMY_BOUNDARIES.md) and [ENGINEERING_PRINCIPLES.md](docs/project/ENGINEERING_PRINCIPLES.md). Workflow V2 defaults the Chief Orchestrator to Luna/high, Plan Review and Merge Safety to Sol/high, implementation to Terra/high, and routine Semantic QA to Luna/high. Luna/max semantic QA and Sol/xhigh escalation require an explicitly revised high-complexity packet. Local Qwen is untrusted offline preprocessing whose output requires verification. V2 task packets use stage-specific `routingPolicy` as the sole route/effort authority and structured SHA-bound review results.
