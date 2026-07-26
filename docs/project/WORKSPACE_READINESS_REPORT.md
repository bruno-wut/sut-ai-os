# Workspace Readiness Report

**Review date:** 2026-07-26

**Review task:** `SUT-AIOS-GOV-011`

**Branch:** `chore/codex-workspace-bootstrap`
**Overall classification:** **READY_WITH_WARNINGS**

The governance workspace is ready for the first local, task-packet-controlled Phase 0 task. It is not ready for production writes, autonomous operation, live application verification, local Qwen processing, or ordinary Codex CLI execution until the warnings below are resolved. No product code, deployment configuration, canonical architecture source, or production system was changed during this review.

## Checks passed

- Both canonical architecture files are byte-for-byte identical to their external source copies by SHA-256.
- The finalized compatibility baseline under `reference/finalized-platform/` has no changes after the independent repository's initial commit.
- The repository support structure, permanent-memory documents, source-of-truth rules, agent registry, permission matrix, routing documents, templates, schemas, and governance files are present.
- Root and scoped `AGENTS.md` files are concise (72, 53, 48, and 53 lines) and their inheritance rules do not conflict.
- All JSON documents parse; all 42 task packets pass schema and execution-readiness validation.
- Task packets have acceptance criteria, allowed and forbidden paths, required checks and tests, production writes disabled, and separate owners and reviewers.
- Codex routing validation rejects unknown agents, missing packets, unauthorized downgrades, unsafe Qwen routes, and secret-like context.
- Worktree self-test and doctor checks pass on Windows; worktrees are sibling-scoped and destructive removal defaults are refused.
- Verification, context, telemetry, local-AI, and GitHub governance tools run through cross-platform Node entry points.
- `verify:fast` and `verify:full` pass all workspace-level checks that exist in this independent repository.
- Secret-pattern and prohibited-path scans found no exposed credential, guest data, production write, deployment, or canonical-source modification.
- GitHub identity is confirmed as `bruno-wut`; the account has administrator permission on `bruno-wut/sut-ai-os`.

## Safe defects fixed during review

- Corrected backlog routes that assigned repository-writing implementation tasks to read-only analyst, strategy, briefing, outcome, or QA agents.
- Removed duplicate task scope and agent entries and separated task owners from independent reviewers.
- Made task transitions update the packet path held in `contextBudget.includedPaths`.
- Added the missing `task:move`, `task:block`, and `task:status` package commands.
- Corrected token totals so cached input is recorded separately rather than counted twice.
- Made GitHub CI inspect the committed pull-request diff, read PR metadata from the event payload, tolerate detached checkouts, and apply only a narrow governance-task exception to this named bootstrap branch.
- Added validation failures for duplicate task controls and owner/reviewer identity in executable states.

## Checks failed or blocked

- `codex --version` and `codex --help` return `Access is denied` for the installed Windows executable alias. Wrapper structure is validated, but a real Codex launch is not.
- No approved local Qwen runtime or exact Qwen model is installed; `local-ai:health` fails closed without downloading or guessing a model.
- Application-specific content, storefront, IBE, Staff OS, Playwright, webhook, migration, preview, and performance checks are blocked because application packages exist only in the immutable compatibility baseline.
- No local YAML parser is installed. Workflow and issue-template YAML received structural/manual review; GitHub must parse the pushed workflow before this warning can close.

## Warnings and unresolved risks

- Agent frontmatter references logical schema URNs that do not yet resolve to dedicated machine-readable input/output schemas. Agent definitions must not be activated as autonomous processes.
- Future backlog test command names describe intended subsystem commands. The planner must replace or confirm them against the real package manifest before moving each packet to `ready`.
- GitHub branch protection, required checks, active CODEOWNERS ownership, and staging/production environments are not configured. This review does not authorize those remote changes.
- The remote repository's default branch must be normalized to `main` to support the requested bootstrap pull request; that non-destructive governance change must be recorded in the bootstrap changelog.
- Local Qwen results, when eventually enabled, remain untrusted preprocessing and require deterministic validation and independent review.
- Existing active governance packets `SUT-AIOS-GOV-003` through `SUT-AIOS-GOV-008` remain open and should be reconciled after this bootstrap PR; they do not authorize product or production work.

## Readiness dimensions

| Dimension | Classification | Evidence |
|---|---|---|
| Local environment | READY_WITH_WARNINGS | Node `v24.16.0`, npm `11.13.0`, Git, and GitHub CLI `2.96.0` work; Codex executable alias and YAML parser do not. |
| Codex workflow | READY_WITH_WARNINGS | Routing, packets, context, worktrees, and launch preflight validate; real CLI execution is blocked. |
| Qwen sidecar | NOT_READY | No approved runtime/model; wrappers fail closed. |
| GitHub | READY_WITH_WARNINGS | Remote identity/auth/admin confirmed and local governance validates; protection and environments are absent and remote workflow parsing remains to be observed. |
| Independent verification | READY_WITH_WARNINGS | Workspace verification is operational; application-level suites are blocked until approved subsystem scaffolds exist. |
| Production/autonomy | NOT_READY | Production writes and ordinary deployment remain prohibited; all playbooks begin in Tier 0/shadow mode. |

## First ready task

`SUT-AIOS-P0-001` — document and verify the immutable compatibility baseline. It is the only product-planning packet currently in `ready`; all dependent work remains in backlog.

Exact next command from the repository root:

```powershell
npm run worktree:create -- --task SUT-AIOS-P0-001
```

## Rollback instructions

- To undo only this completed readiness review after it is committed, use `git revert <readiness-commit-sha>` on a new branch. Do not use `git reset --hard`, `git clean`, or forced deletion.
- To undo an earlier bootstrap unit, revert its individual commit in reverse dependency order and run `npm run verify:full` afterward.
- The pull request can be closed without merging. Preserve any remote branch containing unmerged work; delete it only after confirming it is clean, pushed, and no longer needed.
- No product, database, payment, DNS, Cloudflare, deployment, or production rollback is required because none was changed.

## Decision

Proceed with the first local Phase 0 worktree task under task-packet, independent-review, and evidence controls. Do not enable production writes, autonomous agents, Qwen, deployment, or application migration based on this classification.
