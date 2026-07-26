# Task context — SUT-AIOS-GOV-006

Generated: 2026-07-26T12:04:03.665Z

## Budget

- Recommended context-pack maximum: 131072 bytes.
- Only task-governance references and exact evidence links are included.
- Canonical architecture is linked only; it is never pasted here.

## Verified facts

- Task: **Build context-management system** (active).
- Owner: codex-engineering-executor; reviewer: qa-verification.
- Business objective: Reduce repeated context transfer while preserving accurate, auditable task decisions and verification boundaries.
- Technical objective: Add bounded context builders, artifact summarization, size checks, handoff templates, and context packs for every active task.
- Allowed paths: scripts/context/**, prompts/handoffs/**, tasks/active/SUT-AIOS-GOV-006/**, tasks/active/*/context/**, docs/project/CONTEXT_MANAGEMENT.md, docs/project/CONTEXT_INDEX.md, docs/project/BOOTSTRAP_CHANGELOG.md, docs/project/ISSUES_AND_RISKS.md, docs/handoffs/**, artifacts/reports/**, evidence/tasks/SUT-AIOS-GOV-006/**, package.json, package-lock.json
- Forbidden paths: docs/architecture/source/**, reference/finalized-platform/**, .codex/**, .env*, **/*secret*
- Required tests: node scripts/context/context-cli.mjs --self-test, npm run context:check

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
- [scripts/AGENTS.md](scripts/AGENTS.md)
- [tasks/active/SUT-AIOS-GOV-006/task.json](tasks/active/SUT-AIOS-GOV-006/task.json)
