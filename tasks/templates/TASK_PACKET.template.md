# Task packet — `SUT-AIOS-AREA-001`

The canonical, machine-enforced record is `task.json` in the same task directory. This Markdown view is for human review; do not let it drift from the JSON packet.

## Identity and ownership

- **Task ID:** `SUT-AIOS-AREA-001`
- **Title:** Replace with title
- **Status:** `backlog`
- **Phase / workstream:** `discovery` / `replace-me`
- **Workflow ID / playbook ID:** `replace-me` / `replace-me`
- **Owner / reviewer:** `unassigned` / `unassigned`
- **Created / updated:** ISO-8601 timestamps

## Objective and context

- **Business objective:** Replace with outcome.
- **Technical objective:** Replace with bounded change.
- **Architecture references:** paths or canonical document sections.
- **Dependencies / assumptions:** explicit references and assumptions.
- **Context budget:** maximum bytes and included paths; large logs are artifact references only.

## Boundaries and approvals

- **Allowed paths:** explicit paths only.
- **Forbidden paths:** explicit protected paths.
- **Allowed commands:** deterministic commands only.
- **Production-write permission:** `false` by default.
- **Pull-request requirement:** `true` by default.
- **Risk / autonomy tier:** `low` / `tier-0`.
- **Default agent / allowed agents:** executor plus explicit allowlist.
- **Model route / default / fallback:** `terra` / `gpt-5.6-terra` / `gpt-5.6-sol`.
- **Sol escalation triggers:** explicit security, architecture, RLS, payment, or lifecycle concerns.
- **Rollback expectations:** safe reversal plan.

## Completion contract

- **Acceptance criteria:** non-empty, observable criteria.
- **Required checks / tests:** deterministic checks and commands.
- **Evidence / completion evidence:** durable references; raw logs belong under `artifacts/`.
- **Output schema:** `schemas/agent-result.schema.json`.
- **State transitions:** append-only history with `from`, `to`, time, actor, and reason.
