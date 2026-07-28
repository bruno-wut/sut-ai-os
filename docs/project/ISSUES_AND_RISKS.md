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

### 2026-07-28 — P1-005 shared JSON authority mutation bypass

- **Task ID:** `SUT-AIOS-P1-005-R01`
- **Status:** Open
- **Severity:** Critical
- **Affected scope:** `packages/policy-engine/src/evaluator.mjs`, the V1 validator isolation boundary, and focused evaluator regressions on unmerged PR #48.
- **Evidence:** Independent QA reproduced an in-process authorization bypass against commit `e605162`: mutation of shared JSON-module policy and schema objects could relabel the read-only allow rule as a production-write action. QA also confirmed that the V1 validator transitively imported runtime/verification logic and that dependency-injection assertions rejected object identity without exercising weakened dependency values. The bounded remediation now parses the four V2 authorities into private deeply frozen state, makes the V1 validator self-contained, and adds direct exploit-path regressions; independent final-head verification is still required.
- **Next action / owner:** Independent Sol QA must inspect the final diff, rerun the packet checks including machine verification, and close this entry only if PR #48's final head is green and the bypass remains denied.

### 2026-07-28 — P1-005 policy evaluator engine hardening and assurance reconciliation

- **Task ID:** `SUT-AIOS-P1-005`, `SUT-AIOS-GOV-027`
- **Status:** Resolved
- **Severity:** High — Governance, assurance integrity, and security semantics
- **Affected scope:** `packages/policy-engine/src/evaluator.mjs`, `packages/policy-engine/src/json-schema-evaluator.mjs`, `schemas/evaluation-context.schema.json`, `schemas/evaluation-decision.schema.json`, `policies/deterministic-authorization-policies-v2.json`, `tests/policy-engine/validate-deterministic-policy-evaluator.mjs`, and `.github/workflows/validate-governance.yml`.
- **Evidence:** Delivered via GOV-027 in PR #42 with 100% green GitHub Actions CI (`Governance / validate` pass in 7s):
  1. Extracted shared Draft 2020-12 schema evaluator at `packages/policy-engine/src/json-schema-evaluator.mjs`.
  2. Created closed context and decision schemas (`schemas/evaluation-context.schema.json` and `schemas/evaluation-decision.schema.json`).
  3. Created `policies/deterministic-authorization-policies-v2.json` with explicit policy bounds.
  4. Closed policy-mutation relabeling exploit and enforced principal/resource authorization bounds in `evaluator.mjs`.
  5. Expanded test suite to 56 systematic mutation tests.
  6. Added explicit CI workflow step running `node tests/policy-engine/validate-deterministic-policy-evaluator.mjs`.
  7. Recorded superseding reconciliation evidence at `evidence/tasks/SUT-AIOS-P1-005/reconciliation.md`.
  8. PR #42 merged to `origin/main` at commit `715b142`.
- **Next action / owner:** Retain verification evidence `evidence/verification/SUT-AIOS-GOV-027/verification-20260727170641293.json`.



### 2026-07-27 — P1-004 policy verification trust chain and contract schema remediation

- **Task ID:** `SUT-AIOS-P1-004`, `SUT-AIOS-GOV-023`, `SUT-AIOS-GOV-030`
- **Status:** Resolved
- **Severity:** High — Governance, assurance integrity, and contract isolation
- **Affected scope:** `policies/deterministic-authorization-policies-v1.json`, `tests/policy-definitions/validate-authorization-policies-v1.mjs`, `schemas/authorization-policy-contract-v1.schema.json`, `docs/policy-definitions/DETERMINISTIC_AUTHORIZATION_POLICIES.md`.


- **Evidence:** Remediation delivered via GOV-023 in PR #36 with 100% green GitHub Actions CI (`Governance / validate` pass):
  1. Formal JSON schema authority created at `schemas/authorization-policy-contract.schema.json`.
  2. Taxonomy & title clarified to `Static Authorization Policy Taxonomy and Defaults Contract`.
  3. Non-discretionary safety boundaries and contextual requirements defined for `platform_read_only`.
  4. Validator upgraded to execute 108 exhaustive negative and mutation tests.
  5. PR #36 merged to `origin/main` at commit `c995dd7` after green CI pass (`Governance / validate` pass in 8s).
- **Next action / owner:** Retain verification evidence `evidence/verification/SUT-AIOS-GOV-023/verification-20260727155856029.json`.



### 2026-07-27 - P1-002 machine-verifier command admission is resolved

- **Task ID:** `SUT-AIOS-GOV-018`
- **Status:** Resolved
- **Severity:** Medium
- **Affected scope:** `scripts/verify/verify-cli.mjs` safe required-command parser and P1-002 machine verification
- **Evidence:** GOV-017 defines P1-002's exact validator command as `node tests/control-plane-schema/validate-control-plane-schema.mjs`. GOV-018 delivered its separate byte-for-byte mapping with fixed Node arguments, `shell: false`, dedicated rejection coverage, and passing independent machine verification at `evidence/verification/SUT-AIOS-GOV-018/verification-20260726184458346.json`.
- **Next action / owner:** Retain the evidence. Any future test-path admission requires a separately approved governance task; do not weaken the generic test-path parser.

### 2026-07-27 - P1-003 machine-verifier command admission is not yet authorized

- **Task ID:** `SUT-AIOS-GOV-019`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** `scripts/verify/verify-cli.mjs` safe required-command parser and P1-003 machine verification
- **Evidence:** GOV-019 defines P1-003's exact future validator command as `node tests/audit/validate-append-only-audit-contract.mjs`; the current verifier admits only separately reviewed literal test paths and has no audit-contract mapping.
- **Next action / owner:** After GOV-019 is independently reviewed and delivered, create a separate reviewed governance task that admits only this byte-for-byte command with fixed Node arguments, `shell: false`, and rejection coverage. Do not weaken the generic test-path parser.

### 2026-07-27 - Terminal task completion accepts a nonexistent supplemental evidence path

- **Task ID:** `SUT-AIOS-GOV-016`
- **Status:** Open
- **Severity:** Medium
- **Affected scope:** `scripts/task/complete` terminal-record evidence validation
- **Evidence:** GOV-016's terminal `completionEvidence` includes `evidence/verification/SUT-AIOS-GOV-016/verification-20260726174004908.json`, which does not exist. Valid passing machine verification remains at `evidence/verification/SUT-AIOS-GOV-016/verification-20260726173952633.json`, and the valid durable task record is `evidence/tasks/SUT-AIOS-GOV-016/verification.md`.
- **Next action / owner:** Create a separate, independently reviewed lifecycle-tool remediation that validates every supplied completion-evidence path before allowing a terminal transition. Do not manually alter the immutable GOV-016 record.

### 2026-07-27 - P1-001 validator admission remains exact and fail-closed

- **Task ID:** `SUT-AIOS-GOV-016`
- **Status:** Monitoring
- **Severity:** High
- **Affected scope:** `scripts/verify/verify-cli.mjs` safe required-command parser and P1-001 machine verification
- **Evidence:** GOV-016 admits only the byte-for-byte literal `node tests/event-contracts/validate-normalized-system-event-contract.mjs`, maps it to `node` with one fixed argument and `shell: false`, and self-tests reject whitespace, argument, alternate-path, and shell-operator variants.
- **Next action / owner:** QA Verification must independently verify GOV-016 before P1-001 implementation begins. Any further test-path admission requires a separate approved governance task.

### 2026-07-27 - Normalized event payload semantics remain intentionally deferred

- **Task ID:** `SUT-AIOS-GOV-015`
- **Status:** Monitoring
- **Severity:** Low
- **Affected scope:** `docs/event-contracts/NORMALIZED_SYSTEM_EVENT_CONTRACT.md` and future event consumers
- **Evidence:** Version 1 requires a closed envelope but permits an object-valued `payload` with open internal fields. This preserves a stable common boundary while avoiding invented domain schemas before control-plane and audit tasks are approved.
- **Next action / owner:** Downstream domain-contract tasks must define and independently verify payload semantics before relying on payload fields for authorization, retention, routing, delivery, or personal-data handling.

### 2026-07-26 — Machine verifier admits only flag-only Node task commands

- **Task ID:** `SUT-AIOS-GOV-013`
- **Status:** Monitoring
- **Severity:** Low
- **Affected scope:** `scripts/verify/verify-cli.mjs` safe required-command parser and task-packet test declarations
- **Evidence:** The parser fail-closed on `node scripts/task/validate --task <id>` because it permits only `--flag` arguments. `node scripts/task/validate --all` is safely admitted and validates the same packets for GOV-013.
- **Next action / owner:** Use the all-packet form for machine verification unless a separately approved verifier-parser task expands the safe grammar with full rejection coverage.

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

### 2026-07-26 — Future subsystem test commands require refinement at task start

- **Task ID:** `SUT-AIOS-GOV-010`
- **Status:** Monitoring
- **Severity:** Low
- **Affected scope:** Phase 1–8 backlog packets
- **Evidence:** Packets name intended subsystem tests such as `test:event-contracts` and `test:workflow`; those package commands do not exist until their subsystem scaffold is approved and created.
- **Next action / owner:** Engineering Planner must confirm each command against the real package manifest before moving that packet to `ready`; unavailable or invented commands block execution.

### 2026-07-26 — P0-003 contract-validator verification admission is exact only

- **Task ID:** `SUT-AIOS-GOV-014`
- **Status:** Resolved pending independent verification
- **Severity:** High
- **Affected scope:** `verify:task` required-command parser for P0-003 compatibility verification
- **Evidence:** P0-003's deterministic command is `node tests/compatibility/validate-finalized-platform-contracts.mjs`. GOV-014 maps only that byte-for-byte literal to `node` with one fixed argument and `shell: false`. Self-tests reject whitespace and argument variants, alternate paths, and shell-operator forms; generic `node tests/...` execution remains unsupported.
- **Next action / owner:** QA Verification must run the packet-authorized independent machine verification and retain its result before GOV-014 is marked verified. Any further test-path admission requires a separate approved governance task.

### 2026-07-26 — Workspace readiness review limitations

- **Task ID:** `SUT-AIOS-GOV-011`
- **Status:** Open / monitored
- **Severity:** High until runtime prerequisites exist
- **Affected scope:** Live Codex execution, Qwen preprocessing, application verification, and protected GitHub operation
- **Evidence:** `WORKSPACE_READINESS_REPORT.md` records an inaccessible Codex executable alias, no approved local Qwen runtime/model, application suites available only in the immutable baseline, unresolved agent schema URNs, and absent remote protection/environments.
- **Next action / owner:** Workspace owner and Engineering Planner must resolve each prerequisite through separate approved task packets. None may be inferred as production authorization.

### 2026-07-26 — Backlog permissions and governance enforcement defects

- **Task ID:** `SUT-AIOS-GOV-011`
- **Status:** Resolved and independently verified
- **Severity:** High
- **Affected scope:** Product backlog routing, independent review, task transitions, CI diff enforcement, and telemetry totals
- **Evidence:** The readiness review corrected non-executor implementation routes, duplicate controls, owner/reviewer identity, stale packet context paths, pull-request diff discovery, detached-checkout branch discovery, and cached-token double counting.
- **Next action / owner:** Retain `evidence/verification/SUT-AIOS-GOV-011/verification-20260726130854628.json` with this task and monitor the pushed GitHub workflow separately.

### 2026-07-26 — Production dependency audit command admitted safely across platforms

- **Task ID:** `SUT-AIOS-P0-002`, remediated by `SUT-AIOS-GOV-012`
- **Status:** Resolved
- **Severity:** High
- **Affected scope:** `verify:task` safe required-command parsing and CI evidence for production-dependency audits
- **Evidence:** Two independent P0-002 verifier runs, `verification-20260726152717886.json` and `verification-20260726152741451.json` on branch `task/SUT-AIOS-P0-002-plan-dependency-and-security-remediation`, recorded `blocked` even though a direct packet-authorized `npm audit --omit=dev` passed with exit `0`. The parser rejected the required command before execution. GOV-012's first bare-`npm` Windows mapping failed in `verification-20260726155555816.json`; its `npm.cmd` revision also failed shell-free execution in `verification-20260726160006575.json`, while direct packet-authorized audits passed. The final bounded revision uses `process.execPath` to execute the existing bundled npm CLI JavaScript path on Windows, checks that path before launch, retains `shell: false`, and fixes the remaining arguments to `audit`, `--omit=dev`. Deterministic self-tests cover platform mappings, missing-CLI blocking, unchanged rejection forms, and actual child success, nonzero, and execution-error outcomes. Independent verification in `evidence/verification/SUT-AIOS-GOV-012/verification-20260726160516462.json` passed the real audit, self-test, packet validation, fast governance, changed-path, and secret-boundary checks.
- **Next action / owner:** Retain the historical blocked/failed evidence and the final independent pass. Any future expansion beyond the exact literal `npm audit --omit=dev` requires a separate approved governance task and independent review.
