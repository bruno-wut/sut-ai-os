# SUT-AIOS-P0-001 — Technical Baseline Gate Evidence

## Scope and boundary

- Worktree: `C:/Users/Bruno Browny/Documents/SUT_AI_OS-worktrees/SUT-AIOS-P0-001`
- Branch: `task/SUT-AIOS-P0-001-establish-clean-technical-baseline-gate`
- Baseline inspected read-only: `reference/finalized-platform/`
- Baseline source commit: `dbce321f61144b50a94bd11a068fa5897b0f2293`
- Production writes, deployments, database access, payment actions, Cloudflare actions, and credential access: not performed.

## Implementation record

- Added `docs/verification/technical-baseline-gate.json`, a machine-readable boundary and result contract.
- Added `docs/verification/TECHNICAL_BASELINE_GATE.md`, which documents execution, pass/fail/blocked behavior, and review requirements.
- The assigned worktree had been created from the seed `main` before bootstrap tooling existed. It was clean and had no unique commits, so it was safely fast-forwarded to the governed bootstrap base before task activation. No reset, force operation, or baseline modification occurred.

## Compatibility snapshot observations

- `reference/finalized-platform/package.json` declares npm `10.8.2` and includes application build, test, preview, and deployment commands.
- No application command was run from the immutable snapshot. Prior disposable build evidence remains at `docs/verification/COMPATIBILITY_BASELINE_BUILD_2026-07-26.md`.

## Required command results

- `npm run verify:fast`: pass. Task packets, routing controls, worktree fixture, and task lifecycle fixture passed.
- `npm run verify:full`: pass for every available workspace check. Changed-path inspection and secret-boundary scan passed; no configured secret pattern was detected.
- `git diff --check`: pass.
- `technical-baseline-gate.json` JSON parse: pass.
- Protected-path inspection: pass. No diff exists under `reference/finalized-platform/**` or `docs/architecture/source/**`.

## Blocked capabilities

`verify:full` reported `content`, `storefront`, `ibe`, and `staff-os` as blocked because the only detected application runners belong to the immutable compatibility snapshot. They were not run and do not count as a pass.

## Review remediation

- The packet allowlist was corrected to include its required machine-readable evidence directory: `evidence/verification/SUT-AIOS-P0-001/**`.
- The required full verification test was normalized to `node scripts/verify/full`, the safe direct form accepted by `verify:task`; the equivalent `npm run verify:full` command was also run directly and passed.
- Earlier blocked verifier outputs are preserved as audit history; they are not treated as successful evidence.

## Independent verification result

- Verifier: `engineering-planner`
- Model: `gpt-5.6-terra`
- Result: `pass`
- Evidence: `evidence/verification/SUT-AIOS-P0-001/verification-20260726132605916.json`
- Required tests: `node scripts/verify/full` and `npm run verify:fast` passed.
- Changed-path inspection and secret-boundary inspection passed; forbidden paths were untouched.
- Production eligibility remains `false` because this Tier 0 task has no production-write permission.
