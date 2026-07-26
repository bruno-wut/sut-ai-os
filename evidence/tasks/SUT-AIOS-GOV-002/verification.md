# SUT-AIOS-GOV-002 Verification Evidence

- **Date:** 2026-07-26 (ICT)
- **Scope:** Codex model-routing policy, wrappers, and npm command surface
- **Result:** Repository implementation and dry-run validation passed; live Codex/local-model execution remains blocked
- **Independent review:** Pending before unattended workspace-write use

## Installed Codex audit

| Check | Result |
| --- | --- |
| `Get-Command codex` | Located Windows app executable alias under the installed OpenAI Codex package |
| `codex --version` | Failed before output with Windows `Access is denied` |
| `codex --help` | Failed before output with Windows `Access is denied` |
| Installed CLI version/catalog | Not verifiable from this shell |
| Official manual refresh | Passed; current manual documents the syntax used by the wrappers |

Confirmed documented syntax: `codex exec`, `--model`, `--sandbox read-only|workspace-write`, `--ask-for-approval on-request`, `--strict-config`, `--ephemeral`, `--cd`, stdin prompt `-`, and local mode `--oss --local-provider ollama|lmstudio`.

## Configuration safety

- Resolved user configuration: `C:\Users\Bruno Browny\.codex\config.toml`.
- Created byte-identical backup: `C:\Users\Bruno Browny\.codex\backups\config.toml.20260726-182117.bak`.
- SHA-256 comparison passed before and after repository work; the user configuration remains unchanged.
- Parsed the installed TOML successfully without printing values or secrets. Relevant `model` and `model_reasoning_effort` fields are strings; no legacy `profile`/`profiles` configuration was detected.
- No repository file contains API keys, authentication state, or copied Codex configuration.

## Environment and package manager

| Item | Result |
| --- | --- |
| Node.js | `v24.16.0` |
| npm | `11.13.0` |
| Active package files before task | None outside the immutable reference |
| Selected package manager | npm, matching the repository's audited package-manager family |
| Lockfile | npm lockfile v3; no dependencies |
| Ollama | Not installed/detected |
| LM Studio CLI | Not installed/detected |

## Deterministic wrapper checks

| Check | Result |
| --- | --- |
| Node syntax for launcher/validator | Passed |
| PowerShell wrapper parsing | Passed, 0 errors |
| POSIX wrapper syntax via Git `sh.exe -n` | Passed |
| PowerShell Terra dry-run | Passed |
| POSIX Terra dry-run | Passed |
| npm route command help (`agent`, `sol`, `terra`, `luna`, `qwen-local`) | Passed |
| `npm run codex:validate` | Passed |
| Terra packet route and workspace-write dry-run | Passed |
| Automatic packet route | Passed |
| Sol escalation | Passed |
| Luna downgrade below Terra | Rejected as required |
| Unknown agent | Rejected as required |
| Missing task packet | Rejected as required |
| Unauthorized Qwen substitution | Rejected as required |
| Start/finish/model trace | Passed |
| Prompt/environment/secret fields in trace | None detected |
| Secret-pattern context preflight | Passed |

Generated route traces are under ignored `artifacts/traces/` and contain identifiers, context filenames, sandbox, model, timestamps, and result state only.

## Remaining blockers

1. Repair or install a shell-executable Codex CLI, then rerun `codex --version`, `codex --help`, `codex debug models --bundled`, strict-config dry-runs, and one authenticated read-only smoke test.
2. Install and approve Ollama or LM Studio plus a specific local Qwen model before testing the offline route.
3. Obtain independent security/assurance review before unattended workspace-write use.

No real model, deployment, network write, external connector, production service, database, payment system, DNS, secret, or Cloudflare state was accessed or changed.
