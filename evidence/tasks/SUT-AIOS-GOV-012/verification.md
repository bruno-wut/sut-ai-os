# SUT-AIOS-GOV-012 — Safe Production Dependency Audit Verification Evidence

## Scope and authority

- Worktree: `C:/Users/Bruno Browny/Documents/SUT_AI_OS-worktrees/SUT-AIOS-GOV-012`
- Branch: `task/SUT-AIOS-GOV-012-safely-admit-the-exact-production-dependency-aud`
- Risk and autonomy: high risk, Tier 0
- Approved change surface: the verifier parser and self-test, verification policy wording, risk register, GOV-012 task evidence, and GOV-012 lifecycle/evidence paths
- Dependency manifests, lockfiles, applications, production or staging systems, credentials, immutable compatibility files, and architecture sources: not changed or accessed for mutation

The canonical task packet's `status` and `stateTransitions` array are authoritative for lifecycle history. This executor evidence stops at review readiness and is not independent verification.

## P0-002 blocker context

Two independent machine-verifier runs for `SUT-AIOS-P0-002` recorded `blocked` in `verification-20260726152717886.json` and `verification-20260726152741451.json` on branch `task/SUT-AIOS-P0-002-plan-dependency-and-security-remediation`. Both runs passed changed-path and secret-boundary inspection and passed `npm run verify:fast`, but reported the required `npm audit --omit=dev` test as failed because `safeRequiredCommand` rejected it before process execution. A separate direct execution of that exact packet-authorized audit passed with exit `0` and zero vulnerabilities, isolating the blocker to verifier command compatibility rather than an audit finding.

Those blocked JSON results remain historical evidence and must not be treated as a CI pass. GOV-012 does not change P0-002 implementation artifacts or lifecycle state.

## Implementation record

- `safeRequiredCommand` now accepts only the exact literal `npm audit --omit=dev`. On Windows it maps to `process.execPath` with the existing bundled npm CLI JavaScript path as the first argument, followed exactly by `audit`, `--omit=dev`; on other platforms it maps to direct `npm` with the fixed audit arguments.
- The Windows CLI path is derived from the Node executable directory and must exist before launch. A missing path blocks rather than falling back to a shell, `npm.cmd`, PATH lookup, or broader npm grammar.
- The existing `spawnSync` execution path states `shell: false` explicitly. Its actual status still determines the required-test result: exit `0` passes; a nonzero status or execution error fails.
- Unsupported command text still throws from the parser and is recorded by `verify:task` as `blocked`.
- The verifier self-test checks Windows and non-Windows mappings, current-platform path availability, missing-CLI blocking, the exact fixed arguments, and actual child-process success, nonzero, and execution-error behavior. It retains rejection of `npm audit`, `npm audit fix`, an extra audit argument, a shell-operator form, another npm command, and a trailing-whitespace near miss.
- Verification policy now documents the one admitted literal, fixed direct-process mapping, audit exit-status behavior, and continued fail-closed treatment of every other npm form.
- The risk register records the P0-002 blocker and the independent verification required before resolution.

## Executor check record

- `node scripts/verify/verify-cli.mjs --self-test`: pass, exit `0`; nine checks cover the existing path fixture, the exact audit command-to-argument mapping, and six rejected npm forms.
- `npm audit --omit=dev`: pass, exit `0`; the governed worktree root reported zero vulnerabilities. This registry result is time-sensitive and does not describe the immutable compatibility snapshot.
- `node scripts/task/validate --all`: pass, exit `0`; all canonical packets validated, including active GOV-012.
- `npm run verify:fast`: pass, exit `0`; task validation, routing, worktree, and lifecycle fixtures passed.
- `git diff --check`: pass, exit `0`; Git emitted only the workstation's non-blocking LF-to-CRLF normalization notices for three modified tracked files.

The existing `evidence/verification/SUT-AIOS-GOV-012/verification-20260726153811104.json` is a pre-implementation blocked result with no changed paths. It is retained as historical evidence and is not a review pass. This executor did not run `verify:task` or claim independent reviewer authority.

## Windows execution revision

Independent QA's first implementation review produced `evidence/verification/SUT-AIOS-GOV-012/verification-20260726155555816.json`: changed-path and secret-boundary checks passed, as did the parser self-test, packet validation, and fast verification, but the required audit failed because shell-free `spawnSync` could not execute bare `npm` on Windows. The revision selects `npm.cmd` only when `process.platform` is `win32`, retains `npm` elsewhere, makes `shell: false` explicit, and does not broaden the accepted command text or argument vector.

Authorized executor checks for this revision:

- `node scripts/verify/verify-cli.mjs --self-test`: pass, exit `0`; ten checks covered path matching, Windows `npm.cmd`, non-Windows `npm`, the exact fixed arguments, and the six retained rejection forms.
- `npm audit --omit=dev`: pass, exit `0`; zero vulnerabilities at the governed worktree root.
- `node scripts/task/validate --all`: pass, exit `0`; every canonical packet validated without errors or warnings, including active GOV-012.
- `npm run verify:fast`: pass, exit `0`; all four governance checks passed.
- `git diff --check`: pass, exit `0`; only the existing non-blocking LF-to-CRLF workstation notices were emitted for the three modified tracked files.

Independent QA must generate the next `verify:task` result; this executor did not invoke the QA command or assume the `qa-verification` identity.

## Directly executable Windows revision

Independent QA's second review produced `evidence/verification/SUT-AIOS-GOV-012/verification-20260726160006575.json`. Parser, path, secret-boundary, packet, and fast checks passed, but `npm.cmd` also failed as a shell-free child on Windows. The replacement launches the Node executable directly and gives it the bundled npm CLI JavaScript file plus only the two allowed audit arguments. There is no shell or Windows command shim.

Authorized executor checks for this revision:

- `node scripts/verify/verify-cli.mjs --self-test`: pass, exit `0`; fifteen checks covered path matching, Windows Node-plus-bundled-CLI mapping, non-Windows direct npm mapping, the real current-platform CLI-path check, missing-CLI blocking, all six retained npm rejection forms, an actual fixed-argument child success, a child exit `7` failure, and a missing-executable process error.
- `npm audit --omit=dev`: pass, exit `0`; zero vulnerabilities at the governed worktree root.
- `node scripts/task/validate --all`: pass, exit `0`; every canonical packet validated without errors or warnings, including active GOV-012.
- `npm run verify:fast`: pass, exit `0`; all four governance checks passed.
- `git diff --check`: pass, exit `0`; only the existing non-blocking LF-to-CRLF workstation notices were emitted for the three modified tracked files.

Independent QA must produce the next machine-verifier result. This executor did not invoke `verify:task` or assume the `qa-verification` identity.

## Review handoff

Independent `qa-verification` must inspect the mapping and rejection coverage, confirm no shell or generic npm authority was introduced, run the packet-authorized checks, inspect changed and forbidden paths plus secret boundaries, and record a new machine-verifier result. A successful direct root audit is time-sensitive; any nonzero audit exit remains a real failed required test rather than a parser block.

## Rollback

Revert only the exact safe-command parser addition, its self-test assertions, the policy paragraph, this task's risk entry, and GOV-012 evidence. Restore the earlier fail-closed rejection of `npm audit --omit=dev`. Do not alter packages, lockfiles, the immutable baseline, P0-002 historical evidence, or any production system.
