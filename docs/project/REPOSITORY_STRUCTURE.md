# AI OS Repository Structure

## Purpose

This repository is the independent operating workspace for the Sri U-Thong Grand Hotel AI OS. It is deliberately separate from the finalized IBE, Astro storefront, and Staff application.

`reference/finalized-platform/` is a compatibility snapshot of commit `dbce321f61144b50a94bd11a068fa5897b0f2293`. It is not an active application workspace and must remain unchanged.

The structure below establishes the repository control plane before application services, integrations, or migrations are introduced. It does not move or duplicate the finalized platform into active `apps/`, `services/`, or `packages/` paths.

## Directory map

| Directory | Purpose | Source of truth / tracking |
| --- | --- | --- |
| `agents/` | Role definitions grouped as command, intelligence, execution, assurance, learning, and optional roles | Tracked governance artifacts |
| `prompts/` | Versioned prompts for agents, task execution, review, and handoffs | Tracked governance artifacts |
| `tasks/` | Durable task packets and state queues: templates, backlog, ready, active, review, blocked, done, archive | Tracked workflow record |
| `evidence/` | Durable task evidence, final verification, incidents, and research findings | Tracked audit record; temporary/raw captures are ignored |
| `artifacts/reports/` | Durable generated reports approved for repository retention | Tracked when final |
| `artifacts/test-results/`, `screenshots/`, `traces/` | Disposable test and visual artifacts | Ignored except `.gitkeep`; publish final conclusions to `evidence/verification/` or `artifacts/reports/` |
| `docs/architecture/` | Derived architecture material; `source/` contains immutable canonical inputs | Derived docs tracked; source documents never edited |
| `docs/decisions/` | Architecture Decision Records | Tracked |
| `docs/handoffs/` | Structured handoff records | Tracked |
| `docs/verification/` | Reusable verification plans and results summaries | Tracked |
| `docs/runbooks/` | Human-operated and emergency procedures | Tracked |
| `docs/agents/` | Agent design, responsibility, and permission documentation | Tracked |
| `docs/model-routing/` | Provider-routing and data-sensitivity decisions | Tracked |
| `scripts/codex/` | Codex executor helpers | Tracked; no credentials |
| `scripts/task/` | Task packet lifecycle helpers | Tracked |
| `scripts/worktree/` | Isolated-worktree helpers | Tracked; local worktree directories are ignored |
| `scripts/verify/` | Deterministic verification helpers | Tracked |
| `scripts/local-ai/` | Local/private model preprocessing helpers | Tracked; generated model output is ignored |
| `scripts/context/` | Context assembly and masking helpers | Tracked |
| `schemas/` | Machine-consumed contracts for events, plans, proposals, approvals, and agent results | Tracked governance artifacts |
| `policies/` | Versioned autonomy, data-classification, command, and path policy | Tracked governance artifacts |
| `playbooks/` | Versioned operational playbooks and their evidence/approval requirements | Tracked governance artifacts |
| `reference/` | Read-only finalized-platform compatibility snapshot | Immutable; never an active write target |

## Source-of-truth rules

- Canonical architecture inputs are `docs/architecture/source/**`. Preserve their content byte-for-byte.
- Repository governance is defined by versioned `AGENTS.md`, `agents/`, `prompts/`, `schemas/`, `policies/`, `playbooks/`, and this document. These guide agents but do not replace runtime authorization.
- Task state, approvals, evidence, verification, incidents, and outcomes must ultimately be stored in the production control plane described by the canonical architecture. Until then, tracked files in `tasks/` and `evidence/` are the repository-local planning record only.
- The finalized platform snapshot is authoritative only for the captured compatibility baseline. It does not supersede production databases, payment providers, Cloudflare, analytics systems, or future AI OS control-plane records.

## Tracked versus generated content

Track durable, reviewable records:

- task packets and handoffs
- policies, schemas, prompts, agent definitions, and playbooks
- ADRs, runbooks, incident summaries, research conclusions, and final verification reports
- final reports in `artifacts/reports/` when they are intentionally retained

Do not track transient or sensitive output:

- local worktrees and Codex caches/state
- `.env` files, credentials, private keys, local model output, and raw unmasked data
- dependency directories, build output, logs, coverage, browser reports, test-result bundles, screenshots, and traces
- temporary or raw evidence captures; record their provenance and final conclusion in a durable evidence file instead

## Codex write boundaries

Every implementation run requires an approved task packet. A packet must include a task ID, objective, risk tier, allowed and forbidden paths, command allowlist, required checks, evidence destination, and rollback expectation.

With a packet, Codex may write only to task-scoped records such as:

- `tasks/active/<task-id>/`
- `evidence/tasks/<task-id>/`
- `evidence/verification/<task-id>/`
- `artifacts/reports/<task-id>/`
- `docs/handoffs/<task-id>.md`
- implementation paths explicitly allowlisted by that packet

Codex must never write to the following without a separately approved governance task packet:

- `agents/**`, `prompts/**`, `schemas/**`, `policies/**`, `playbooks/**`, or shared `scripts/**`
- `tasks/done/**` and `tasks/archive/**`
- `evidence/incidents/**` and durable verification records belonging to another task

Codex must never write to these paths through ordinary task execution:

- `reference/finalized-platform/**`
- `docs/architecture/source/**`
- ignored local state, secrets, credentials, generated artifacts, or local worktrees

No task packet grants authority to deploy, mutate production systems, modify production databases or RLS, change payment configuration, alter DNS, or bypass human approval.

## Initial operating sequence

1. Create machine-readable task, policy, and result schemas.
2. Add command and path allowlists that evaluate packets deterministically.
3. Build task-packet and evidence templates.
4. Add non-deploying CI checks and independent verification procedures.
5. Begin observe-only integration work against documented, read-only interfaces.
