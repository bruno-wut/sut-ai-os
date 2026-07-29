# Known Risks

The live register is [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md). This page is a stable orientation summary, not a replacement for dated entries.

- The compatibility baseline has dependency audit findings and pre-existing lint debt.
- Build warnings require design review before adopting or integrating the captured behavior.
- GitHub CLI authentication and repository access are now available; shell-accessible Codex execution remains blocked by the Windows app alias, so live executor workflows remain unavailable.
- The installed Windows Codex app alias currently returns `Access is denied` to shell invocation, and no approved Ollama/LM Studio provider is installed; routing is dry-run validated but cannot execute live.
- Governance CI now runs on pull requests and `main`; no policy engine, artifact store, or protected deployment workflow exists yet. Task and result contracts require independent review before controlling production-adjacent work.
- Domain, payment-provider, MFA, and production-control decisions from the historical platform audit remain unresolved.
- The compatibility baseline can drift after final platform deployment; refreshes must be explicit, verified, and never manually patched.
- ChatGPT subscription authentication may require interactive renewal, may be
  constrained by provider terms, and may not expose stable machine-readable rate
  or capacity signals. The future adapter must map uncertainty to a fail-closed
  provider state.
- A single 24/7 Mac Mini initially co-locates Pi orchestration, durable state,
  the supervised worker, and the Codex CLI adapter, introducing device, sleep,
  reboot, network, storage, and availability risks. Durable queue/workflow state
  must remain outside worker/Codex ephemeral state and survive service,
  worker-process, and device restarts, with supervision, bounded concurrency,
  timeouts, safe requeue, and dead-letter handling.
- Isolated task workspaces need collision prevention, disk limits, retention,
  safe cleanup, and recovery evidence before unattended execution.
- Audit attribution for model, prompt, task, commands, and outcomes can itself
  contain sensitive data. Prompt integrity references and classified retention
  are required; secrets and raw sensitive prompts must not enter ordinary
  repository evidence.
- Guest/public and Staff/AI workloads may later span accounts and hosts. Until
  P2-005 through P5-006 are independently verified, cross-account
  authentication/rate limits, retention, migration portability, resource
  exhaustion isolation, and provider-neutral composition are planning
  constraints only, not live controls.

When any item changes, add or update the dated entry in the live register with evidence and an owner.
