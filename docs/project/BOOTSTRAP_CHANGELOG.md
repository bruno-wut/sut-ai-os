# Bootstrap Changelog

This file records every workspace-level change made during the Codex workspace bootstrap on 2026-07-26 (ICT).

## Branch change

- Created and switched from `main` to `chore/codex-workspace-bootstrap` at commit `dbce321f61144b50a94bd11a068fa5897b0f2293`.
- The requested branch name was available; no timestamped fallback was needed.
- The pre-existing untracked `SUT Logo.png` remained in place and was not modified, staged, renamed, or deleted.

## Directories created

- `docs/architecture/source/`
- `docs/project/`

## Files created

| File | Purpose | Integrity |
| --- | --- | --- |
| `docs/architecture/source/Sri U-Thong Grand Hotel AI OS.md` | Canonical product and platform architecture source | Byte-for-byte copy; SHA-256 `F3C0F4C493C45BC2E0D412D9D63DDD6E1866DAE29BA75F26CD4DA41DBF8845A6` |
| `docs/architecture/source/Agent Architecture.md` | Canonical agent architecture source | Byte-for-byte copy; SHA-256 `3FF1F651C35E86CD89FE258D410976170C8D27679B4EB1E28A74EFC60DCB3D94` |
| `docs/project/WORKSPACE_AUDIT.md` | Repository, stack, commands, test, CI, environment, risk, prerequisite, and architecture-gap audit | Authored during bootstrap |
| `docs/project/BOOTSTRAP_CHANGELOG.md` | Durable record of bootstrap workspace changes | Authored during bootstrap |

Source locations for the canonical copies:

- `C:\Users\Bruno Browny\Documents\AI OS SUT\docs\architecture\Sri U-Thong Grand Hotel AI OS.md`
- `C:\Users\Bruno Browny\Documents\AI OS SUT\docs\architecture\Agent Architecture.md`

## Verification performed

- Confirmed `main` matched `origin/main` before branch creation.
- Confirmed only one worktree existed.
- Confirmed the canonical-copy destination paths did not exist before copying.
- Verified each copied architecture document against its source with SHA-256.
- Ran `npm ls --depth=0 --omit=optional` at the root and for `website/astro-site`; installed dependencies resolved successfully.
- Ran `npm run typecheck`; passed.
- Ran `npm test`; 28 files and 117 tests passed.
- Ran `npm run lint`; baseline failed with 6 errors and 1 warning. No lint fixes were made in this bootstrap.
- Rechecked Git status after verification; tests created no visible tracked or untracked output.

## Explicitly unchanged

- No application source, test, migration, package manifest, lockfile, environment file, Cloudflare configuration, Supabase configuration, or existing documentation was edited.
- No dependency was installed, removed, or updated.
- No files were staged, committed, pushed, reset, cleaned, overwritten, or deleted.
- No build, E2E suite, database test, migration, remote verification, preview, deployment, production query, secret operation, DNS operation, payment operation, or Cloudflare production action was run.
- The separate empty repository at `C:\Users\Bruno Browny\Documents\SUT_AI_OS` was not changed.

## Independent repository separation

After the original audit, the project direction was clarified: the finalized IBE, Astro storefront, and Staff application must remain untouched, and the AI OS must be developed as an independent add-on.

The following separation changes were made:

- Used the previously empty `C:\Users\Bruno Browny\Documents\SUT_AI_OS` Git repository as the independent AI OS workspace.
- Exported the 406 files tracked by finalized-platform commit `dbce321f61144b50a94bd11a068fa5897b0f2293` into `reference/finalized-platform/` without Git metadata, ignored secrets, dependencies, build output, local Cloudflare state, or test artifacts.
- Added root repository boundaries and byte-preservation rules in `AGENTS.md`, `.gitignore`, `.gitattributes`, and `README.md`.
- Added `reference/README.md` and `docs/project/REPOSITORY_SEPARATION.md` for provenance and maintenance rules.
- Relocated the four original bootstrap documents into this repository. The two canonical architecture source files remain byte-for-byte unchanged.
- Returned the finalized platform workspace to `main`; its pre-existing untracked `SUT Logo.png` remains untouched.
- Did not configure or push a remote for the AI OS repository.
- Reused the finalized repository's existing `Developer <dev@sriuthonghotels.com>` identity as repository-local Git author configuration; no global Git configuration was changed.

## Codex operating workflow support structure

- Created and switched to `chore/codex-workspace-bootstrap` in the independent AI OS repository.
- Added the tracked support taxonomy for agent definitions, prompts, task states, durable evidence, report artifacts, decisions, handoffs, verification, runbooks, agent and model-routing documentation, task/worktree/verification scripts, schemas, policies, and playbooks.
- Added `docs/project/REPOSITORY_STRUCTURE.md` to define directory purpose, source-of-truth boundaries, tracked versus generated content, and Codex write restrictions.
- Strengthened `AGENTS.md` with task-packet and governance-surface rules.
- Updated `.gitignore` to exclude local worktrees, Codex transient state, local-model output, logs, raw or temporary evidence, and disposable test artifacts while retaining durable packets, policies, schemas, audit records, reports, and verification summaries.
- Validated the copied Next.js and Astro applications in a disposable copy outside the immutable baseline. Both `npm ci` and build commands passed; warnings and dependency-audit findings are recorded in `docs/verification/COMPATIBILITY_BASELINE_BUILD_2026-07-26.md`.
- Added `docs/project/ISSUES_AND_RISKS.md` and made durable issue/blocker/risk recording mandatory before future task handoffs.
- Added the concise permanent-memory system: product, current state, system map, roadmap, glossary, known risks, source-of-truth boundaries, context index, definition of done, engineering principles, and autonomy boundaries. Root `AGENTS.md` now links to this detail rather than duplicating the architecture charter.

## Scoped agent instruction map

- Added `agents/AGENTS.md`, `playbooks/AGENTS.md`, and `scripts/AGENTS.md` only for existing directories with distinct local safety and evidence conventions.
- Added `docs/project/AGENT_INSTRUCTION_MAP.md` to document inheritance, major-area applicability, future subsystem boundaries, and the consistency check.
- Did not create scoped instructions for absent `apps/`, `services/`, `packages/`, or `supabase/` paths.

## Canonical logical agent registry

- Added one bounded Markdown definition for each of the 12 canonical and 3 optional agents described by the canonical agent architecture.
- Added registry, routing, handoff, permission-matrix, and active-team documents under `agents/`.
- Marked the recommended first operating team active at the logical registry level, Content and Brand plus Release and Deployment staged, and all optional agents inactive.
- Added task packet `SUT-AIOS-GOV-001`; no runtime, credential, external connector, autonomous process, deployment, or production permission was created.
- Updated permanent memory and recorded the missing machine-readable schemas and independent-review requirement in the live risk register.

## Safe Codex model routing

- Backed up the existing user Codex configuration byte-for-byte outside the repository and left the original unchanged; no configuration values or secrets were copied into Git.
- Added Sol, Terra, Luna, automatic agent, and Qwen-local launch routes using documented Codex CLI flags rather than unvalidated global profile files.
- Added task/agent allowlisting, active-status enforcement, downgrade rejection, minimum context assembly, secret-pattern preflight, read-only default, explicit workspace-write gate, sanitized timestamps/model traces, and Qwen environment isolation.
- Added model-routing, escalation, capability, and local-model policy documents plus npm commands and a dependency-free npm lockfile.
- Recorded the inaccessible installed Codex executable alias, absent local provider, and pending independent wrapper review as pre-activation blockers.

## File-based task-packet system

- Added canonical JSON task, evidence, agent-result, verification-result, and handoff schemas, with companion Markdown templates for review and evidence.
- Added cross-platform Node lifecycle commands for new, validation, transition, start, block, review, completion, list, and status; the lifecycle records transitions and refuses execution when scope, acceptance criteria, checks, or tests are missing.
- Added npm task commands and `docs/project/TASK_WORKFLOW.md`, including one-packet/one-branch/one-PR guidance, terminal-packet immutability, independent verification, and artifact-reference rules.
- Updated the Codex launcher to safely consume canonical JSON packets while retaining legacy Markdown packet compatibility.
- Added active bootstrap task `SUT-AIOS-GOV-003`; no external access, production permission, deployment, or application-baseline change was made.

## Safe Git worktree management

- Added a cross-platform Node worktree manager with packet-aware create, list, status, fail-closed remove, dry-run prune, and doctor commands.
- Added package commands, primary-branch detection, sibling worktree placement, task-packet worktree metadata, and a concise workflow guide.
- Added active bootstrap task `SUT-AIOS-GOV-004`; no remote was configured, no worktree was created outside the manager's disposable fixture, and no existing branch or finalized baseline was altered.

## Independent verification framework

- Added cross-platform Node verification commands for fast, changed-path, task, full, content, storefront, IBE, Staff OS, and security-boundary verification.
- Added independent-verifier/model recording, required-test execution, protected-path and secret scanning, machine-readable result evidence, and a false-by-default production-eligibility result.
- Added verification policy, acceptance matrix, and test-ownership documents. Checks that exist only in the immutable compatibility baseline now report blocked rather than executing there.
- Added active bootstrap task `SUT-AIOS-GOV-005` and preserved both failed framework-discovery results and the subsequent passing result as durable evidence.

## Context management

- Added bounded task/review context builders, handoff generation, artifact summarization, and context-size checks under `scripts/context/`.
- Added implementer-to-reviewer, reviewer-to-remediator, and fresh-session resume templates.
- Added practical packet/context/evidence/handoff/raw-excerpt limits and generated the six required context files for every active task.
- Added active bootstrap task `SUT-AIOS-GOV-006`; no canonical architecture source was copied into a context pack.
- Removed the now-unneeded placeholder files from populated context/handoff directories and added path/secret guards to summarization and size checking.

## Controlled local Qwen sidecar

- Audited hardware, storage, local runtimes, and common model paths without downloading or deleting anything; no supported runtime or exact Qwen model ID was found.
- Added fail-closed local-ai wrappers with structured JSON, explicit prompt/model fields, input/time limits, PII masking, read-only defaults, no production/database access, and unverified output labels.
- Added Qwen setup, allowed-task, and benchmark documentation. The benchmark records blocked Qwen/Luna/Terra comparisons rather than inventing correctness results.
- Added active bootstrap task `SUT-AIOS-GOV-007`; no local model installation or external side effect was performed.

## GitHub governance

- Audited GitHub integration: no remote is configured and the GitHub CLI is unavailable or unauthenticated; no remote mutation was attempted.
- Added a required-field pull-request template, bounded task issue form, inactive-until-confirmed CODEOWNERS mapping, and local `Governance / validate` workflow.
- Added deterministic local governance validation for task packets, branch/PR metadata, verification evidence, changed/forbidden paths, schemas, policies, agent definitions, and secret patterns.
- Added `npm run github:validate` and documented exact, unexecuted branch-protection, ruleset, and staging/production environment API entry points.
- No branch protection, remote, environment, deployment, secret, database, DNS, payment, or production state was changed.
- Rechecked the installed GitHub connector: it returned zero accessible repositories, accounts, and installations. Remote identity and authority remain unresolved.
- Retried with GitHub CLI `2.96.0`: authenticated as `bruno-wut`; read-only discovery found two application repositories only. No remote was added and no repository settings were changed.
- Confirmed target `bruno-wut/sut-ai-os` with administrator permission. Read-only inspection found an empty repository with no branch, workflows, environments, rulesets, or protection. No remote was added and no push or remote mutation was performed.
- Per explicit authorization, added local `origin` for `https://github.com/bruno-wut/sut-ai-os.git` and pushed `chore/codex-workspace-bootstrap` (commit `06115d9`). No pull request, branch protection, ruleset, environment, deployment, or production change was performed.

## Verified-work efficiency telemetry

- Added schemas, cross-platform model-run commands, aggregate reporting, and advisory-only routing recommendations.
- Added privacy boundaries that prohibit prompts, model output, credentials, guest data, and raw logs from durable telemetry records.
- Added a representative routing evaluation suite. No automatic policy, task-packet, or agent-routing change is enabled.

## Phased implementation backlog

- Added 33 canonical product-planning packets across Phases 0–8, each with explicit dependencies, paths, checks, tests, risk/autonomy, agent/model routing, Sol escalation, rollback, and production writes disabled.
- Added implementation backlog, dependency graph, milestone, and first vertical-slice documents.
- Moved only `SUT-AIOS-P0-001` to `ready`; all dependent product tasks remain in backlog.
- No application code, production service, database, deployment, policy, or canonical architecture source was changed.

## Independent workspace readiness review

- Added `SUT-AIOS-GOV-011` and the evidence-backed `WORKSPACE_READINESS_REPORT.md` with an overall `READY_WITH_WARNINGS` classification.
- Revalidated canonical-source hashes, instruction hierarchy, JSON, packet readiness, routing, worktrees, verification, context limits, GitHub governance, telemetry, secrets, and protected paths.
- Corrected backlog agent permissions, duplicate task controls, independent-review assignments, task context paths, GitHub pull-request diff detection, package task aliases, and cached-token accounting.
- Confirmed GitHub CLI authentication as `bruno-wut`, administrator access to `bruno-wut/sut-ai-os`, and the configured `origin` identity.
- Planned remote changes required for the requested pull request: publish the existing seed `main`, set it as the default branch, push the verified bootstrap branch, and open a draft pull request. No merge, protection, environment, deployment, or production mutation is authorized.
- No application code, canonical source, finalized compatibility baseline, secret, database, payment, DNS, Cloudflare, deployment, or production state was changed.

## Post-merge reconciliation for SUT-AIOS-P0-001

- Confirmed `main` contains the merged bootstrap workspace, commits `ce6403e` and `40ccda4`, and merge commit `90a1876`.
- Confirmed the sole canonical task packet on `main` is `tasks/done/SUT-AIOS-P0-001/task.json`; no active, review, or ready copy remains.
- Preserved all baseline-gate evidence, including the independent passing result and earlier blocked results, under `evidence/verification/SUT-AIOS-P0-001/`.
- Confirmed the assigned task worktree was clean, merged, and safely removed; no task branch worktree remains registered.
- Moved only `SUT-AIOS-P0-002` and `SUT-AIOS-P0-003` to `ready`, because their sole dependency P0-001 is done. Selected `SUT-AIOS-P0-002` as the single next task; no Phase 1+ task was unblocked.
- Updated permanent memory to reflect `main` as current, the completed baseline gate, current focus, and continued production/autonomy prohibitions.
