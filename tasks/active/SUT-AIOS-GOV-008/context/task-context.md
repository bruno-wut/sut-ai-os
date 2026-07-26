# Task context — SUT-AIOS-GOV-008

Generated: 2026-07-26T12:22:53.524Z

## Budget

- Recommended context-pack maximum: 131072 bytes.
- Only task-governance references and exact evidence links are included.
- Canonical architecture is linked only; it is never pasted here.

## Verified facts

- Task: **Prepare GitHub governance for Codex workflow** (active).
- Owner: codex-engineering-executor; reviewer: qa-verification.
- Business objective: Make Codex changes reviewable and auditable before connecting this independent repository to GitHub.
- Technical objective: Add local PR/issue governance, CODEOWNERS, validation scripts, CI workflows, and documented non-destructive remote protection commands.
- Allowed paths: .github/**, scripts/github/**, schemas/**, policies/**, agents/**, docs/project/GITHUB_GOVERNANCE.md, docs/project/BOOTSTRAP_CHANGELOG.md, docs/project/ISSUES_AND_RISKS.md, evidence/tasks/SUT-AIOS-GOV-008/**, evidence/verification/SUT-AIOS-GOV-008/**, tasks/active/SUT-AIOS-GOV-008/**, package.json, package-lock.json
- Forbidden paths: docs/architecture/source/**, reference/finalized-platform/**, .codex/**, .env*, **/*secret*, supabase/**
- Required tests: node scripts/github/validate-governance.mjs --self-test, node scripts/github/validate-governance.mjs, node scripts/task/validate --all, npm run verify:fast

## Canonical references

- Canonical reference (link only; charter not copied): [docs/architecture/source/Agent Architecture.md](docs/architecture/source/Agent Architecture.md)
- Canonical reference (link only; charter not copied): [docs/project/DEFINITION_OF_DONE.md](docs/project/DEFINITION_OF_DONE.md)
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
- [tasks/active/SUT-AIOS-GOV-008/task.json](tasks/active/SUT-AIOS-GOV-008/task.json)
- [docs/project/TASK_WORKFLOW.md](docs/project/TASK_WORKFLOW.md)
- [docs/project/DEFINITION_OF_DONE.md](docs/project/DEFINITION_OF_DONE.md)
