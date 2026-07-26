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
