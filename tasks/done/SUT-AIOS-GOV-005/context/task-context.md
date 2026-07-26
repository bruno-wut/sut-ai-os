# Task context — SUT-AIOS-GOV-005

Generated: 2026-07-26T12:04:03.606Z

## Budget

- Recommended context-pack maximum: 131072 bytes.
- Only task-governance references and exact evidence links are included.
- Canonical architecture is linked only; it is never pasted here.

## Verified facts

- Task: **Build independent verification framework** (active).
- Owner: codex-engineering-executor; reviewer: qa-verification.
- Business objective: Establish repeatable independent verification before implementation work begins.
- Technical objective: Add bounded verification commands, task result evidence, policy, acceptance matrix, and ownership rules.
- Allowed paths: scripts/verify/**, docs/verification/**, schemas/verification-result.schema.json, tasks/templates/VERIFICATION_RESULT.template.json, tasks/active/SUT-AIOS-GOV-005/**, evidence/tasks/SUT-AIOS-GOV-005/**, evidence/verification/**, package.json, package-lock.json, docs/project/**
- Forbidden paths: docs/architecture/source/**, reference/finalized-platform/**, .codex/**, .env*, **/*secret*
- Required tests: node scripts/verify/verify-cli.mjs --self-test, npm run verify:fast

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
- [evidence/tasks/SUT-AIOS-GOV-005/verification.md](evidence/tasks/SUT-AIOS-GOV-005/verification.md)
- [scripts/AGENTS.md](scripts/AGENTS.md)
- [tasks/active/SUT-AIOS-GOV-005/task.json](tasks/active/SUT-AIOS-GOV-005/task.json)
- [docs/verification/VERIFICATION_POLICY.md](docs/verification/VERIFICATION_POLICY.md)
