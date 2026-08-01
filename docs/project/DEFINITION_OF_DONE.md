# Definition of Done

Verified work is **implementation plus deterministic checks plus independent review plus recorded evidence**.

A task is complete only when all applicable items below are true:

1. The result satisfies the approved task packet within allowed paths and commands.
2. Required deterministic checks pass, or an approved exception is recorded with impact and owner.
3. An independent reviewer verifies scope, diff, prohibited-path compliance, and evidence via a SHA-bound review result (`schemas/review-result-v1.schema.json`); the implementer is not the sole completion authority.
4. Evidence records commands, results, changed files, limitations, and rollback or recovery notes in the packet’s destination.
5. Automated post-merge CI reconciliation (`scripts/task/reconcile-merged-task.mjs`) updates the verified task to `done` upon PR merge to `main`.
6. Unresolved issues, blockers, risks, and warnings are entered in [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md).
7. Required durable documentation, task state, handoff, and memory updates are complete.
8. No prohibited action, secret exposure, unapproved external mutation, or verification bypass occurred.
9. Where infrastructure is in scope, core/adapter boundaries, authenticated exposure, minimisation/retention, quota/workload controls, and booking isolation satisfy `docs/verification/INFRASTRUCTURE_PORTABILITY_ASSURANCE.md`.

A build, test, review comment, or model assertion alone is not sufficient.
