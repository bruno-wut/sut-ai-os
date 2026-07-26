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
