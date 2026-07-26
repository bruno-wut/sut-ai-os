# Current State

## Workspace

- Repository: independent AI OS workspace on `main`, with the bootstrap workspace and `SUT-AIOS-P0-001` merged in merge commit `90a18765d986e96ad8f90a30188c5b46ff3fd234`.
- Active code: no AI OS product services yet. The repository contains the governed workspace, permanent memory, completed baseline-gate evidence, and a read-only compatibility baseline.
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

## What does not exist yet

- Active AI OS services, full agent-specific input/output schemas, a shell-executable Codex CLI, an approved local Qwen provider/model, policy engine, workflow engine, scoped executor, GitHub App integration, deployment gate, or production integration. Governance CI exists, but it is not a production deployment gate.

## Compatibility baseline validation

Root Next.js and Astro builds passed in an isolated disposable copy. Warnings, dependency audit findings, and pre-existing lint debt are recorded in [COMPATIBILITY_BASELINE_BUILD_2026-07-26.md](../verification/COMPATIBILITY_BASELINE_BUILD_2026-07-26.md) and [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md).

## Immediate constraint

This remains a workspace setup and control-foundation phase. Build the control foundation before attempting application integration, autonomous execution, remote access, or deployment. Production writes and autonomous operation remain disabled.
