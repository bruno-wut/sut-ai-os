# SUT-AIOS-GOV-059 verification evidence

## Scope implemented

- Added one exact required-command admission for `npm run test:signal-ingestion`.
- The admitted command maps directly to `node` with the sole fixed argument `tests/signal-ingestion/validate-signal-ingestion-v1.mjs`; npm and a shell are not invoked.
- Added positive mapping coverage and fail-closed near-miss coverage for whitespace, extra arguments, shell operators, alternate syntax, altered paths, and path separators.
- Documented the bounded admission and retained the original P3-001 blocked verification record as historical evidence.

## Boundaries preserved

- No P3-001 implementation or test file was added, changed, or executed by this governance task.
- No package manifest, dependency lock, CI workflow, Workflow V2 machinery, provider, production behavior, credential, or external service was changed.
- The admission does not enable generic npm, Node.js, shell, package, or test-command execution.

## Executor checks

- `node scripts/verify/verify-cli.mjs --self-test` — passed, 209 checks.
- `node scripts/task/validate --all` — passed; GOV-059 is valid and execution-ready.
- `node scripts/github/validate-governance.mjs` — passed; changed paths are within the packet, forbidden paths are untouched, and no configured secret pattern was detected.
- `git diff --check` — passed; Git reported only the repository's line-ending conversion warnings.
- `npm run verify:fast` — the task, worktree, and lifecycle fixtures passed, but the Codex-routing self-test returned exit 1 while the implementation and newly activated packet were uncommitted. The orchestrator must commit the bounded head and rerun this exact check before independent verification; no passing result is claimed here.

## Independent verification

Pending separate `qa-verification` review and machine evidence under `evidence/verification/SUT-AIOS-GOV-059/`.
