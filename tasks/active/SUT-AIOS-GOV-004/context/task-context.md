# Task context — SUT-AIOS-GOV-004

Generated: 2026-07-26T12:04:03.547Z

## Budget

- Recommended context-pack maximum: 131072 bytes.
- Only task-governance references and exact evidence links are included.
- Canonical architecture is linked only; it is never pasted here.

## Verified facts

- Task: **Build safe cross-platform Git worktree manager** (active).
- Owner: codex-engineering-executor; reviewer: qa-verification.
- Business objective: Make isolated implementation work repeatable without touching the finalized compatibility baseline or user work.
- Technical objective: Add a fail-closed Node Git worktree manager, package commands, and operational guide.
- Allowed paths: scripts/worktree/**, scripts/task/task-cli.mjs, package.json, package-lock.json, tasks/active/SUT-AIOS-GOV-004/**, docs/project/**, evidence/tasks/SUT-AIOS-GOV-004/**
- Forbidden paths: docs/architecture/source/**, reference/finalized-platform/**, .codex/**, .env*, **/*secret*
- Required tests: node scripts/worktree/worktree-cli.mjs --self-test, npm run worktree:doctor

## Canonical references

- Canonical reference (link only; charter not copied): [docs/architecture/source/Agent Architecture.md](docs/architecture/source/Agent Architecture.md)
- Canonical reference (link only; charter not copied): [docs/project/TASK_WORKFLOW.md](docs/project/TASK_WORKFLOW.md)

## Interpretation

This pack contains repository facts and links only. Model interpretation must be labeled in a handoff.

## Unresolved decisions

Review the task packet and risk register before acting; append unresolved decisions to the decisions file.

## Included source references

- [AGENTS.md](AGENTS.md)
- [docs/project/CONTEXT_INDEX.md](docs/project/CONTEXT_INDEX.md)
- [docs/project/ISSUES_AND_RISKS.md](docs/project/ISSUES_AND_RISKS.md)
- [docs/project/CONTEXT_MANAGEMENT.md](docs/project/CONTEXT_MANAGEMENT.md)
- [evidence/tasks/SUT-AIOS-GOV-004/verification.md](evidence/tasks/SUT-AIOS-GOV-004/verification.md)
- [scripts/AGENTS.md](scripts/AGENTS.md)
- [tasks/active/SUT-AIOS-GOV-004/task.json](tasks/active/SUT-AIOS-GOV-004/task.json)
- [docs/project/TASK_WORKFLOW.md](docs/project/TASK_WORKFLOW.md)
