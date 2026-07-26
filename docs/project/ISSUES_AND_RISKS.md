# Issues, Blockers, and Risks Register

This is the durable repository-wide register for issues, blockers, risks, failed checks, and unresolved warnings. Add a dated entry before task handoff; do not rely on chat-only reporting.

## Entry format

```md
### YYYY-MM-DD — Short title

- **Task ID:** `optional-task-id`
- **Status:** Open | Monitoring | Blocked | Accepted risk | Resolved
- **Severity:** Critical | High | Medium | Low
- **Affected scope:** paths, service, workflow, or environment
- **Evidence:** command output, report link, or reproducible observation
- **Next action / owner:** concrete follow-up and responsible role
```

## Open entries

### 2026-07-26 — Compatibility baseline dependency audit findings

- **Task ID:** `workspace-bootstrap`
- **Status:** Open
- **Severity:** High
- **Affected scope:** `reference/finalized-platform/` root Next.js application and `website/astro-site/`
- **Evidence:** `npm ci` reported 7 high-severity findings for the root application; the Astro storefront reported 1 low- and 6 high-severity findings. See [compatibility build validation](../verification/COMPATIBILITY_BASELINE_BUILD_2026-07-26.md).
- **Next action / owner:** Run a history-aware dependency/security review under a separately approved task. Do not update the immutable baseline in place.

### 2026-07-26 — Existing lint baseline is red

- **Task ID:** `workspace-bootstrap`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** finalized-platform compatibility baseline
- **Evidence:** Historical audit records 6 ESLint errors and 1 warning in guest layout, application layout, cookie banner, and cookie-consent code. See [workspace audit](WORKSPACE_AUDIT.md).
- **Next action / owner:** Create a scoped, independently verified compatibility or upstream-maintenance task before treating lint as a required autonomous gate.

### 2026-07-26 — Build warnings require design review

- **Task ID:** `workspace-bootstrap`
- **Status:** Monitoring
- **Severity:** Medium
- **Affected scope:** Next.js IBE/Staff and Astro storefront compatibility baseline
- **Evidence:** Root build reports middleware deprecation, Edge Runtime Node API use, and missing no-secret validation settings. Astro build reports the missing news-content directory and static rendering use of request headers. See [compatibility build validation](../verification/COMPATIBILITY_BASELINE_BUILD_2026-07-26.md).
- **Next action / owner:** Review under separate, scoped tasks; do not alter the immutable reference snapshot.

### 2026-07-26 — Shell automation prerequisites unavailable

- **Task ID:** `workspace-bootstrap`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** Codex-led repository execution and PR governance
- **Evidence:** Historical audit found GitHub CLI unavailable and the shell-invoked Codex CLI inaccessible on this workstation. See [workspace audit](WORKSPACE_AUDIT.md).
- **Next action / owner:** Obtain approved GitHub CLI/GitHub App and a working, scoped Codex execution environment before enabling automated PR or executor workflows.

### 2026-07-26 — Disposable validation output remains outside the repository

- **Task ID:** `workspace-bootstrap`
- **Status:** Open
- **Severity:** Low
- **Affected scope:** local system temporary directory only
- **Evidence:** The isolated compatibility validation copy remains at `C:\Users\Bruno Browny\AppData\Local\Temp\sut-ai-os-validation-dbce321-20260726` after the environment safety layer declined recursive cleanup. It contains generated dependencies and build output only.
- **Next action / owner:** Remove the validated temporary directory through an approved local cleanup action; no repository files are affected.

### 2026-07-26 — Agent schema contracts are identifiers only

- **Task ID:** `SUT-AIOS-GOV-001`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** `agents/**` logical input/output schema URNs and future agent runtime activation
- **Evidence:** All 15 definitions declare stable input/output schema URNs, but `schemas/` does not yet contain their machine-readable JSON or Zod implementations.
- **Next action / owner:** Engineering Planner and QA should define and independently validate shared envelope/result contracts before any agent runtime or dispatcher is provisioned.

### 2026-07-26 — Agent registry awaits independent specialist review

- **Task ID:** `SUT-AIOS-GOV-001`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** Agent registry production readiness and any future runtime activation
- **Evidence:** Deterministic structural and permission-boundary checks can be completed locally, but no separate reviewer has yet approved the definitions, routing, handoffs, or permission matrix.
- **Next action / owner:** Assign an independent assurance/security reviewer; record the review in `evidence/tasks/SUT-AIOS-GOV-001/verification.md` before treating the registry as verified or provisioning tools/credentials.

### 2026-07-26 — Installed Codex CLI alias is not shell-executable

- **Task ID:** `SUT-AIOS-GOV-002`
- **Status:** Blocked
- **Severity:** High
- **Affected scope:** Live Sol/Terra/Luna wrapper execution and installed CLI/catalog validation
- **Evidence:** `Get-Command codex` resolves the installed Windows app alias, but `codex --version` and `codex --help` both fail before output with `Access is denied`. See `evidence/tasks/SUT-AIOS-GOV-002/verification.md`.
- **Next action / owner:** Workspace owner should repair/install an accessible Codex CLI or app execution alias, then run the documented live validation sequence before enabling wrappers beyond dry-run.

### 2026-07-26 — Local Qwen runtime is unavailable

- **Task ID:** `SUT-AIOS-GOV-002`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** `qwen-local` offline preprocessing route
- **Evidence:** Neither Ollama nor the LM Studio CLI is installed/detected. The wrapper and isolation policy are structurally validated only.
- **Next action / owner:** Select an approved local provider and Qwen model, verify local-only/no-egress operation, then add a Qwen-specific task packet and independent privacy/security test.

### 2026-07-26 — Model-routing wrappers await independent review

- **Task ID:** `SUT-AIOS-GOV-002`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** Unattended Codex workspace-write execution
- **Evidence:** Deterministic syntax, dry-run, route, rejection, context, trace, and secret-pattern tests pass, but no separate reviewer has approved the subprocess, environment, permission, and context-boundary design.
- **Next action / owner:** Assign independent assurance/security review and record it in `evidence/tasks/SUT-AIOS-GOV-002/verification.md` before unattended workspace-write use.

### 2026-07-26 â€” Task-packet control system awaits independent assurance review

- **Task ID:** `SUT-AIOS-GOV-003`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** `tasks/`, `schemas/`, `scripts/task/`, and canonical JSON packet use in `scripts/codex/launch.mjs`
- **Evidence:** JSON parsing, lifecycle self-test, active-packet validation, canonical JSON dry run, and model-routing regression tests pass. See `evidence/tasks/SUT-AIOS-GOV-003/verification.md`.
- **Next action / owner:** QA and Verification Agent should independently inspect state transitions, execution-readiness checks, terminal immutability, schema/tool parity, and launcher compatibility before this system becomes completion authority for implementation tasks.

### 2026-07-26 â€” Artifact retention backend is not yet implemented

- **Task ID:** `SUT-AIOS-GOV-003`
- **Status:** Open
- **Severity:** Low
- **Affected scope:** Raw log, screenshot, and trace retention for task evidence
- **Evidence:** The task workflow requires large payloads to be stored under `artifacts/` and referenced from packets, but no retention, access-control, hashing service, or CI uploader exists yet.
- **Next action / owner:** Add a separately reviewed artifact/evidence retention design before high-volume or sensitive operational evidence is collected.

### 2026-07-26 â€” Worktree removal automation awaits independent review

- **Task ID:** `SUT-AIOS-GOV-004`
- **Status:** Blocked
- **Severity:** Medium
- **Affected scope:** `scripts/worktree/` and task packet worktree metadata
- **Evidence:** The manager is designed to fail closed for dirty, conflicted, unpushed, and unmerged worktrees, but no independent reviewer has exercised it against shared developer worktrees or diverse Git versions.
- **Next action / owner:** QA and Verification Agent should independently review the manager and its disposable Git fixture before removal automation is used outside isolated local tasks.

### 2026-07-26 â€” Application-level verification remains unavailable in the governance workspace

- **Task ID:** `SUT-AIOS-GOV-005`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** Content schema, Astro/storefront, Next.js/IBE, Staff OS, webhook replay, preview smoke, Lighthouse, and migration verification
- **Evidence:** The command inventory found runnable scripts only in `reference/finalized-platform/`, which is immutable. `verify:content`, `verify:storefront`, `verify:ibe`, and `verify:staff-os` therefore return explicit blocked results.
- **Next action / owner:** Create approved implementation-worktree tasks that install dependencies locally and bind each detected application command to a no-side-effect verification profile.

### 2026-07-26 â€” Context summarizer requires independent semantic review

- **Task ID:** `SUT-AIOS-GOV-006`
- **Status:** Open
- **Severity:** Low
- **Affected scope:** `scripts/context/summarize-artifact` and generated summaries under `artifacts/reports/`
- **Evidence:** The summarizer preserves exact error/failure lines and labels Qwen/local preprocessing as unverified, but it does not establish semantic truth about an artifact.
- **Next action / owner:** QA and Verification Agent must review summaries before they influence decisions, code, public content, or completion evidence.

### 2026-07-26 â€” No approved local Qwen runtime or model is installed

- **Task ID:** `SUT-AIOS-GOV-007`
- **Status:** Blocked
- **Severity:** High
- **Affected scope:** `scripts/local-ai/`, Qwen preprocessing, and Qwen/Luna/Terra benchmark execution
- **Evidence:** Windows audit found no Ollama, LM Studio CLI, llama.cpp, vLLM, llamafile, or Qwen model file. No model ID was guessed and no download was attempted. See `docs/model-routing/QWEN_SETUP.md`.
- **Next action / owner:** Workspace owner must select one approved runtime and one exact hardware-appropriate Qwen model/quantization, then perform a local-only privacy and deterministic-validation review before enabling execution.

### 2026-07-26 — GitHub identity and authority are unconfirmed

- **Task ID:** `SUT-AIOS-GOV-008`
- **Status:** Open / awaiting separately approved governance configuration
- **Severity:** High
- **Affected scope:** Remote, branch protection, rulesets, CODEOWNERS activation, staging and production environments
- **Evidence:** GitHub CLI `2.96.0` is authenticated as `bruno-wut` with admin permission on `bruno-wut/sut-ai-os`. `origin` now points to the target and `chore/codex-workspace-bootstrap` is pushed. The remote still has no protection rulesets or environments.
- **Next action / owner:** Workspace owner must separately approve any default-branch decision, branch protection, ruleset, environment, or pull-request action.

### 2026-07-26 — Independent review pending for GitHub governance

- **Task ID:** `SUT-AIOS-GOV-008`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** `.github/`, `scripts/github/`, CI policy enforcement
- **Evidence:** Local validation is implemented; an independent QA agent has not yet reviewed the final diff and evidence.
- **Next action / owner:** QA and Verification Agent must run the governance checks and record a machine-readable result before any pull request is considered verified.

### 2026-07-26 — Model telemetry starts without historical provider usage

- **Task ID:** `SUT-AIOS-GOV-009`
- **Status:** Open
- **Severity:** Low
- **Affected scope:** `artifacts/reports/model-runs/` and model-routing evaluation
- **Evidence:** Existing Codex/local wrappers intentionally do not retain token counts, prompts, or outputs. Initial aggregate reports are therefore empty until new sanitized run records are supplied.
- **Next action / owner:** Engineering and QA should record comparable, independently verified runs for each evaluation class before treating routing metrics as directional.

### 2026-07-26 — Documented task move command is not exposed through npm

- **Task ID:** `SUT-AIOS-GOV-009`
- **Status:** Open
- **Severity:** Low
- **Affected scope:** Task packet lifecycle ergonomics
- **Evidence:** `npm run task:move` is documented but absent from `package.json`; `node scripts/task/move` remains available and was used for this packet.
- **Next action / owner:** Add and independently verify the missing package command in a separate governance task.

### 2026-07-26 — Telemetry verification initially blocked by a non-allowlisted command form

- **Task ID:** `SUT-AIOS-GOV-009`
- **Status:** Resolved; failed evidence retained
- **Severity:** Low
- **Affected scope:** Task-packet required-test compatibility with the independent verifier
- **Evidence:** `verification-20260726124741943.json` recorded a blocked result because `verify:task` deliberately permits only safe direct script commands and the packet used an npm indirection for task validation.
- **Next action / owner:** Packet now uses `node scripts/task/validate --all`; QA must rerun independent verification before task completion.
