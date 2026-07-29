# Current State

## Workspace

- Repository: independent AI OS workspace on `main`; Phase 0, `P1-001` through
  `P1-008`, `P2-001`, `P2-002`, and `P2-004` have merged completion records.
- Active code: no deployed AI OS product services. The repository contains the
  governed workspace, permanent memory, Phase 1 static contracts and local
  deterministic policy evaluator, retained verification evidence, and a
  read-only compatibility baseline.
- Compatibility baseline: `reference/finalized-platform/`, exported from finalized-platform commit `dbce321f61144b50a94bd11a068fa5897b0f2293`.
- Boundary: never edit, install into, build in, or generate into the baseline. The upstream finalized platform remains separate.

## What exists

- Canonical architecture and agent-design sources.
- Canonical logical definitions, routing, handoffs, permissions, and status registry for 12 core and 3 optional agents. These are governance artifacts, not provisioned runtimes.
- Fail-closed Sol/Terra/Luna/Qwen-local launch wrappers and npm commands with task/agent validation, minimal context loading, secret preflight, dry-run validation, and ignored local traces.
- Canonical JSON task-packet, evidence, handoff, implementation-result, and verification-result contracts; Markdown review templates; lifecycle tools; and a task workflow guide.
- Workflow directories for agents, prompts, tasks, evidence, artifacts, scripts, schemas, policies, and playbooks.
- Repository boundaries, issue/risk register, validation record, and permanent-memory documents.
- The technical baseline gate is complete at `docs/verification/technical-baseline-gate.json` with independent evidence under `evidence/verification/SUT-AIOS-P0-001/`.
- The task worktree for `SUT-AIOS-P0-001` was clean, merged, and removed after reconciliation.
- The derived provider-neutral Mac Mini/Pi/Codex deployment option is accepted
  active planning in `docs/decisions/ADR-0001-MAC-MINI-PI-CODEX-RUNTIME.md`; it
  adds no deployment or runtime capability.
- ADR-0002 is accepted derived planning: it adds no runtime capability, but
  requires trust-zone/port, minimisation/retention, resource-budget/workload,
  and portability authorities before Phase 3 implementation. No P2-001/R02 or
  P2-002 remediation is required: their accepted finite contracts, runtime
  dependency correction, trusted rejection semantics, and final-head CI evidence
  remain intact and are not changed by this planning task.

## What does not exist yet

- Active AI OS services, full agent-specific input/output schemas, durable
  workflow/queue services, a provider-neutral invocation gateway, Pi-to-Codex
  subscription adapter, supervised Mac Mini worker, Codex repository
  ExecutorAdapter, scoped dispatch, independent verification service, approved
  fallback provider, deployment gate, or production integration. Governance CI
  exists, but it is not a production deployment gate.

## Compatibility baseline validation

Root Next.js and Astro builds passed in an isolated disposable copy. Warnings, dependency audit findings, and pre-existing lint debt are recorded in [COMPATIBILITY_BASELINE_BUILD_2026-07-26.md](../verification/COMPATIBILITY_BASELINE_BUILD_2026-07-26.md) and [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md).

## Immediate constraint

P2-004 is done. GOV-047 is preparing the exact finite P2-005 design and
executable product packet; GOV-048 must separately admit its literal validator
before P2-005 can activate. The remaining GOV-043 static infrastructure
authorities must be verified before Phase 3 runtime work. The future Mac Mini
worker starts at Tier 0/shadow and cannot substitute for policy, approval,
workflow, verification, or audit. Production writes and autonomous operation
remain disabled.
