# SUT-AIOS-GOV-058 verification

## Scope

This bounded Workflow V1 governance correction registers the exact P3-001 signal-ingestion test script, authorizes `package.json` and the fixed independent verification command in the P3-001 packet, and records the readiness issue. It does not implement P3-001 or modify Workflow V2 machinery.

## Deterministic commands

- `node scripts/task/validate --task SUT-AIOS-P3-001` — passed; packet is valid and reports `executionReady: true`.
- `node scripts/task/validate --task SUT-AIOS-GOV-058` — passed; packet is valid and reports `executionReady: true`.
- `node scripts/github/validate-governance.mjs` — passed; changed paths are allowlisted, forbidden-path findings are empty, and secret matches are empty.
- `npm run verify:fast` — blocked at `node scripts/codex/validate-routing.mjs`; all other fast-verification components passed. The current main routing self-test launches a V2 review profile that requires a clean committed worktree, while this executor handoff is intentionally uncommitted. The orchestrator must rerun this exact command after committing the bounded GOV-058 diff.
- `git diff --check` — passed; Git emitted only expected LF-to-CRLF working-copy notices.

## Boundary checks

- Changed paths must remain within the GOV-058 allowlist.
- No signal-ingestion implementation, tests, package lock, scripts, schemas, Workflow V2 review/routing machinery, production system, credential, or external service is changed.
- Independent `qa-verification` remains required before lifecycle advancement.

## Limitations

This correction makes the declared P3-001 commands addressable but does not establish that P3-001 implementation exists or passes. The signal-ingestion validator is expected to be authored later by the P3-001 executor within that task's authorized paths. Final GOV-058 verification remains blocked until `npm run verify:fast` is rerun from the committed clean correction head and independent QA records its result.

## Rollback

Revert only the GOV-058 packet and evidence, this risk entry, the exact package script, and the bounded P3-001 packet additions. Preserve completed task history and all external systems.
