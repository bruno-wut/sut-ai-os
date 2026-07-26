# Technical Baseline Gate

## Purpose

This gate records the reproducible, no-side-effect verification boundary for the immutable compatibility snapshot at `reference/finalized-platform/`. It is a control for future AI OS work, not an application implementation target.

The machine-readable contract is [technical-baseline-gate.json](technical-baseline-gate.json). Its source commit is `dbce321f61144b50a94bd11a068fa5897b0f2293`; the prior disposable build record is [COMPATIBILITY_BASELINE_BUILD_2026-07-26.md](COMPATIBILITY_BASELINE_BUILD_2026-07-26.md).

## Required invariants

- `reference/finalized-platform/**` remains unchanged.
- No installation, build, generated output, deployment, credential access, database access, payment action, DNS/Cloudflare action, or live-system request runs in that directory.
- Workspace checks must distinguish `pass`, `fail`, and `blocked`; a blocked application capability is not a passing result.
- Production eligibility remains false for this gate.

## Deterministic execution

Run only from the task worktree:

```powershell
npm run verify:fast
npm run verify:full
git diff --check
```

`verify:fast` validates the available governance controls. `verify:full` repeats those checks and reports application capabilities that cannot safely run in this independent governance repository. `git diff --check` rejects whitespace defects.

## Result rules

| Condition | Result |
| --- | --- |
| Every required available check passes and protected paths are untouched | pass |
| A required check fails, a protected path changes, or a secret pattern is detected | fail |
| An application-level check has no approved safe runner in this worktree | blocked for that capability; do not treat it as pass |

The recorded 2026-07-26 compatibility validation found known warnings (missing local secrets, framework deprecation/runtime notices, storefront content/prerender warnings, and dependency audit findings). This task preserves those observations without repairing application code or dependencies.

## Evidence and review

The implementer records the result in `evidence/tasks/SUT-AIOS-P0-001/verification.md`. A distinct reviewer must run `verify:task`, record model and agent identity, and write machine-readable evidence under `evidence/verification/SUT-AIOS-P0-001/` before this task can move to `verified` or `done`.
