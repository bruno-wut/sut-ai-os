# SUT-AIOS-GOV-002 — Safe Codex Model Routing

- **Approval source:** User request dated 2026-07-26
- **Objective:** Create documented, fail-closed model routing and cross-platform Codex launch wrappers without provisioning credentials or production access.
- **Risk tier:** Tier 1 local tooling; reversible repository changes only.
- **Allowed agents:** `codex-engineering-executor`, `qa-verification`
- **Model route:** `terra`
- **Workspace write:** `true`
- **Allowed paths:** `docs/model-routing/**`, `scripts/codex/**`, `package.json`, `package-lock.json`, this task packet, `evidence/tasks/SUT-AIOS-GOV-002/**`, and relevant `docs/project/**` memory/risk/changelog files.
- **Forbidden paths:** `docs/architecture/source/**`, `reference/finalized-platform/**`, application code, user authentication state, secrets, production services, databases, payment systems, DNS, and Cloudflare production state.
- **Command allowlist:** Read-only Codex/manual/config inspection, configuration backup copy with hash verification, Node syntax/tests, wrapper dry-runs, rejection tests, `npm install --package-lock-only --ignore-scripts --no-audit --no-fund`, `npm run codex:validate`, Git diff/status checks, and Markdown/link validation.
- **Required checks:** Exact supported CLI syntax; Terra default; deterministic route/escalation rules; known-agent and task-packet enforcement; minimum context; secret-pattern rejection; timestamps/model audit; cross-platform wrappers; dry-run success; unknown-agent/missing-task/downgrade rejection; no external or production side effects.
- **Evidence destination:** `evidence/tasks/SUT-AIOS-GOV-002/verification.md`.
- **Rollback expectation:** Revert the routing commit and remove generated ignored trace files; the user Codex configuration backup remains available outside the repository.
- **Independent review:** Required before using workspace-write mode for unattended implementation.

No wrapper test may invoke a real model, local provider, external service, deployment, database, or production operation during this task.
