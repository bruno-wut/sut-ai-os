# Task context — SUT-AIOS-GOV-011

Generated: 2026-07-26T13:08:22.797Z

## Budget

- Recommended context-pack maximum: 131072 bytes.
- Only task-governance references and exact evidence links are included.
- Canonical architecture is linked only; it is never pasted here.

## Verified facts

- Task: **Independent workspace readiness review** (active).
- Owner: qa-verification; reviewer: engineering-planner.
- Business objective: Determine whether the Codex workspace is safe and ready for the first implementation task.
- Technical objective: Audit all workspace governance, tooling, schemas, instructions, routing, GitHub, telemetry, and backlog surfaces; fix only safe workspace defects; publish an evidence-backed readiness report.
- Allowed paths: AGENTS.md, agents/**, prompts/**, tasks/**, evidence/tasks/SUT-AIOS-GOV-011/**, evidence/verification/SUT-AIOS-GOV-011/**, artifacts/reports/**, docs/project/**, docs/verification/**, docs/model-routing/**, scripts/**, schemas/**, policies/**, playbooks/**, .github/**, .gitignore, package.json, package-lock.json
- Forbidden paths: reference/finalized-platform/**, docs/architecture/source/**, apps/**, services/**, packages/**, supabase/**, .env*, **/*secret*
- Required tests: node scripts/task/validate --all, node scripts/codex/validate-routing.mjs, node scripts/worktree/worktree-cli.mjs --self-test, node scripts/model-run/model-run-cli.mjs --self-test, npm run verify:fast, git diff --check

## Canonical references

- Canonical reference (link only; charter not copied): [docs/architecture/source/Sri U-Thong Grand Hotel AI OS.md](docs/architecture/source/Sri U-Thong Grand Hotel AI OS.md)
- Canonical reference (link only; charter not copied): [docs/architecture/source/Agent Architecture.md](docs/architecture/source/Agent Architecture.md)
- Canonical reference (link only; charter not copied): [docs/project/DEFINITION_OF_DONE.md](docs/project/DEFINITION_OF_DONE.md)

## Interpretation

This pack contains repository facts and links only. Model interpretation must be labeled in a handoff.

## Unresolved decisions

Review the task packet and risk register before acting; append unresolved decisions to the decisions file.

## Included source references

- [AGENTS.md](AGENTS.md)
- [docs/project/CONTEXT_INDEX.md](docs/project/CONTEXT_INDEX.md)
- [docs/project/ISSUES_AND_RISKS.md](docs/project/ISSUES_AND_RISKS.md)
- [docs/project/CONTEXT_MANAGEMENT.md](docs/project/CONTEXT_MANAGEMENT.md)
- [evidence/tasks/SUT-AIOS-GOV-011/verification.md](evidence/tasks/SUT-AIOS-GOV-011/verification.md)
- [docs/project/DEFINITION_OF_DONE.md](docs/project/DEFINITION_OF_DONE.md)
- [tasks/active/SUT-AIOS-GOV-011/task.json](tasks/active/SUT-AIOS-GOV-011/task.json)
