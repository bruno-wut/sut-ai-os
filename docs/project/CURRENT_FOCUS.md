# Current Focus

## Selected next task

`SUT-AIOS-P0-002` — Plan dependency and security remediation.

- Status: `ready`
- Agent: `codex-engineering-executor`
- Model: `gpt-5.6-sol`
- Risk/autonomy: high risk, Tier 0/shadow
- Production-write permission: `false`
- Reviewer: `qa-verification`
- Dependency satisfied: `SUT-AIOS-P0-001` is `done` with independent evidence.

Exact next command from `main`:

```powershell
npm run worktree:create -- --task SUT-AIOS-P0-002
```

`SUT-AIOS-P0-003` is also genuinely unblocked and is `ready`, but it is not the selected next task. No Phase 1+ task is unblocked.

## Guardrails

- Do not modify `reference/finalized-platform/**` or `docs/architecture/source/**`.
- Do not deploy, access production systems, change credentials, or enable autonomous operation.
- Use the task packet, assigned worktree, independent verification, and durable evidence workflow.
