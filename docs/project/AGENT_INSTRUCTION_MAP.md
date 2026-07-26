# Agent Instruction Map

## How instruction inheritance works

`AGENTS.md` at the repository root applies everywhere. A nearer `AGENTS.md` adds local guidance for its directory and descendants; it may narrow the root boundary but never widen authority or override the root prohibitions. If instructions conflict, the narrower rule is treated as an additional safety constraint and the conflict is escalated before work continues.

## Current repository map

| Repository area | Applicable instruction | Why | Status |
| --- | --- | --- | --- |
| Repository-wide | [`/AGENTS.md`](../../AGENTS.md) | Product mission, workflow, truth boundaries, approvals, prohibitions, verification, and model routing | Active |
| `agents/**` | Root plus [`agents/AGENTS.md`](../../agents/AGENTS.md) | Role-definition format, authority limits, and review expectations | Active |
| `playbooks/**` | Root plus [`playbooks/AGENTS.md`](../../playbooks/AGENTS.md) | Procedural preconditions, approvals, rollback, and evidence | Active |
| `scripts/**` | Root plus [`scripts/AGENTS.md`](../../scripts/AGENTS.md) | Local helper safety, side-effect boundaries, and deterministic testing | Active |
| `docs/**`, `tasks/**`, `evidence/**`, `artifacts/**`, `prompts/**`, `schemas/**`, `policies/**` | Root only, plus the detailed repository/project documents | No distinct local instruction is needed while these remain governance scaffolds | Root-only |
| `reference/finalized-platform/**` | Root only, with immutable-source rules in the repository/project documents | Must remain a read-only compatibility snapshot | Root-only and immutable |
| `apps/**`, `services/**`, `packages/**`, `supabase/**` | Not present; no scoped file created | Future target structure only; add a scoped file when a real subsystem is approved and its local conventions differ | Not applicable |

## Major-area reading path

- Workspace orientation: root `AGENTS.md` → [`CONTEXT_INDEX.md`](CONTEXT_INDEX.md).
- Agent definitions: root `AGENTS.md` → `agents/AGENTS.md` → selected role file → task packet and evidence.
- Playbooks: root `AGENTS.md` → `playbooks/AGENTS.md` → governing policy/schema → task packet.
- Scripts: root `AGENTS.md` → `scripts/AGENTS.md` → script-local documentation → packet command allowlist.
- Future application or data subsystem: root `AGENTS.md` → approved subsystem `AGENTS.md` (once created) → task packet → required verification.

## Consistency check

The scoped files repeat no root workflow or product charter. They add only local purpose, entry points, commands, conventions, path boundaries, tests, evidence, and escalation triggers. All three preserve the root requirements for approved task packets, isolated worktrees, independent review, recorded evidence, and prohibited production/secret/destructive actions.
