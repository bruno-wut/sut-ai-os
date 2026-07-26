# Known Risks

The live register is [ISSUES_AND_RISKS.md](ISSUES_AND_RISKS.md). This page is a stable orientation summary, not a replacement for dated entries.

- The compatibility baseline has dependency audit findings and pre-existing lint debt.
- Build warnings require design review before adopting or integrating the captured behavior.
- GitHub CLI and shell-accessible Codex execution were previously unavailable, blocking automated PR/executor workflows.
- The installed Windows Codex app alias currently returns `Access is denied` to shell invocation, and no approved Ollama/LM Studio provider is installed; routing is dry-run validated but cannot execute live.
- No active CI, policy engine, machine-readable contracts, or protected deployment workflow exists yet.
- Domain, payment-provider, MFA, and production-control decisions from the historical platform audit remain unresolved.
- The compatibility baseline can drift after final platform deployment; refreshes must be explicit, verified, and never manually patched.

When any item changes, add or update the dated entry in the live register with evidence and an owner.
