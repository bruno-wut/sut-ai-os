# Task context — SUT-AIOS-GOV-009

Generated: 2026-07-26T12:47:04.617Z

## Budget

- Recommended context-pack maximum: 131072 bytes.
- Only task-governance references and exact evidence links are included.
- Canonical architecture is linked only; it is never pasted here.

## Verified facts

- Task: **Add verified-work efficiency telemetry** (active).
- Owner: codex-engineering-executor; reviewer: qa-verification.
- Business objective: Measure and improve verified engineering output per token without exposing sensitive data or changing routing automatically.
- Technical objective: Add validated model-run records, aggregate efficiency reports, comparison/recommendation commands, and representative routing evaluations.
- Allowed paths: schemas/model-run.schema.json, schemas/task-efficiency.schema.json, artifacts/reports/model-runs/**, docs/model-routing/EFFICIENCY_METRICS.md, docs/model-routing/MODEL_EVALUATION.md, scripts/model-run/**, package.json, tasks/backlog/SUT-AIOS-GOV-009/**, tasks/ready/SUT-AIOS-GOV-009/**, tasks/active/SUT-AIOS-GOV-009/**, evidence/tasks/SUT-AIOS-GOV-009/**, evidence/verification/SUT-AIOS-GOV-009/**, docs/project/ISSUES_AND_RISKS.md, docs/project/BOOTSTRAP_CHANGELOG.md
- Forbidden paths: docs/architecture/source/**, reference/finalized-platform/**, .env*, **/*secret*, supabase/**, policies/**
- Required tests: node scripts/model-run/model-run-cli.mjs --self-test, npm run task:validate -- --all, npm run verify:fast

## Canonical references

- Canonical reference (link only; charter not copied): [docs/architecture/source/Sri U-Thong Grand Hotel AI OS.md](docs/architecture/source/Sri U-Thong Grand Hotel AI OS.md)
- Canonical reference (link only; charter not copied): [docs/architecture/source/Agent Architecture.md](docs/architecture/source/Agent Architecture.md)
- Canonical reference (link only; charter not copied): [docs/model-routing/MODEL_ROUTING_POLICY.md](docs/model-routing/MODEL_ROUTING_POLICY.md)

## Interpretation

This pack contains repository facts and links only. Model interpretation must be labeled in a handoff.

## Unresolved decisions

Review the task packet and risk register before acting; append unresolved decisions to the decisions file.

## Included source references

- [AGENTS.md](AGENTS.md)
- [docs/project/CONTEXT_INDEX.md](docs/project/CONTEXT_INDEX.md)
- [docs/project/ISSUES_AND_RISKS.md](docs/project/ISSUES_AND_RISKS.md)
- [docs/project/CONTEXT_MANAGEMENT.md](docs/project/CONTEXT_MANAGEMENT.md)
- [docs/model-routing/MODEL_ROUTING_POLICY.md](docs/model-routing/MODEL_ROUTING_POLICY.md)
- [docs/architecture/source/Agent Architecture.md](docs/architecture/source/Agent Architecture.md)
