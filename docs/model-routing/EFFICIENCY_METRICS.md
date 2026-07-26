# Efficiency Metrics

Model telemetry measures **verified work per token**, never raw model output. A run record conforms to `schemas/model-run.schema.json`; aggregate reports conform to `schemas/task-efficiency.schema.json`.

## Safe record boundary

Record only run/task/agent/model identifiers, timing, aggregate token usage when available, repository paths, command names, check names, and outcome flags. Never store prompts, model responses, credentials, guest information, payment data, raw logs, or environment values. The recorder rejects common secret-like values and writes immutable JSON records under `artifacts/reports/model-runs/`.

## Metrics

| Metric | Definition |
| --- | --- |
| Verified tasks completed | Distinct tasks with `completed` and independent verification `pass`. |
| First-pass verification rate | Verified runs without rework ÷ verified runs. |
| Revision rate | Runs requiring rework ÷ all runs. |
| Escalation rate | Runs requiring escalation ÷ all runs. |
| Rollback rate | Rolled-back runs ÷ all runs. |
| Tokens per verified task | Aggregate input, output, and cached tokens ÷ distinct verified tasks. |
| Tokens spent on rework | Aggregate tokens for records flagged `reworkRequired`. |
| Luna→Terra / Terra→Sol | Explicit escalation records by source and destination model. |
| Qwen output acceptance rate | Accepted Qwen outputs ÷ Qwen outputs with a recorded acceptance decision. |
| Defects after merge | Records with `defectFoundAfterMerge: true`. |

Missing token fields are represented by `null` and contribute zero to token aggregates; this must be interpreted as incomplete provider telemetry, not zero cost.

## Commands

```text
npm run model-run:record -- --input artifacts/reports/model-runs/input.json
npm run model-run:report -- --output artifacts/reports/model-runs/report.json
npm run model-run:compare -- --input artifacts/reports/model-runs/cohort.json
npm run model-run:recommend-routing -- --output artifacts/reports/model-runs/routing-advice.json
```

`recommend-routing` is advisory only. It never edits `MODEL_ROUTING_POLICY.md`, task packets, agent definitions, or configuration. Human review and independent verification remain required for any routing change.
