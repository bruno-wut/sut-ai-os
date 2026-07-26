# Current State

## Workspace

- Repository: independent AI OS workspace, currently on `chore/codex-workspace-bootstrap`.
- Active code: none yet. The repository contains governance, permanent memory, and a read-only compatibility baseline.
- Compatibility baseline: `reference/finalized-platform/`, exported from finalized-platform commit `dbce321f61144b50a94bd11a068fa5897b0f2293`.
- Boundary: never edit, install into, build in, or generate into the baseline. The upstream finalized platform remains separate.

## What exists

- Canonical architecture and agent-design sources.
- Canonical logical definitions, routing, handoffs, permissions, and status registry for 12 core and 3 optional agents. These are governance artifacts, not provisioned runtimes.
- Workflow directories for agents, prompts, tasks, evidence, artifacts, scripts, schemas, policies, and playbooks.
- Repository boundaries, issue/risk register, validation record, and permanent-memory documents.

## What does not exist yet

- Active AI OS services, implemented agent input/output schemas, policy engine, workflow engine, scoped executor, GitHub App integration, CI, deployment gate, or production integration.
- Approved task-packet templates and machine-readable contracts.

## Compatibility baseline validation

Root Next.js and Astro builds passed in an isolated disposable copy. Warnings, dependency audit findings, and pre-existing lint debt are recorded in [COMPATIBILITY_BASELINE_BUILD_2026-07-26.md](../verification/COMPATIBILITY_BASELINE_BUILD_2026-07-26.md) and [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md).

## Immediate constraint

This is a workspace setup phase. Build the control foundation before attempting application integration, autonomous execution, remote access, or deployment.
