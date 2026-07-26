# SUT-AIOS-GOV-001 — Canonical Agent Registry

- **Approval source:** User request dated 2026-07-26
- **Objective:** Derive the complete logical agent registry from the canonical Agent Architecture document.
- **Risk tier:** Tier 0 governance definition; no runtime activation or external side effects.
- **Allowed paths:** `agents/**`, this task packet, `evidence/tasks/SUT-AIOS-GOV-001/**`, `docs/project/CURRENT_STATE.md`, `docs/project/CONTEXT_INDEX.md`, `docs/project/BOOTSTRAP_CHANGELOG.md`, and `docs/project/ISSUES_AND_RISKS.md`.
- **Forbidden paths:** `docs/architecture/source/**`, `reference/finalized-platform/**`, application code, environment files, secrets, production services, databases, payment systems, DNS, and Cloudflare production state.
- **Command allowlist:** Read-only PowerShell inspection, `rg`, `git status`, `git diff`, `git diff --check`, `git hash-object`, and deterministic Markdown/frontmatter validation.
- **Required checks:** 15 unique IDs; required YAML keys; required definition sections; canonical active/staged/inactive states; valid internal links; no forbidden-path changes; no authority conflicts.
- **Evidence destination:** `evidence/tasks/SUT-AIOS-GOV-001/verification.md`.
- **Rollback expectation:** Revert the registry commit; no runtime or external state exists to roll back.
- **Independent review:** Required before the registry is treated as production-ready or used to provision runtimes.

This is a workspace-governance task on the designated bootstrap branch. It defines logical agents only and grants no executable authority.
