# Codex Model Routing Policy

## Purpose

Route each approved task to the least costly capable model without weakening permissions, verification, or specialist review. Model selection is not authorization.

## Supported hosted routes

| Route | Codex model ID | Default role |
| --- | --- | --- |
| `sol` | `gpt-5.6-sol` | Difficult, high-risk, or final specialist reasoning |
| `terra` | `gpt-5.6-terra` | Default implementation and ordinary engineering work |
| `luna` | `gpt-5.6-luna` | Clear, bounded, repetitive discovery/preparation work |

The current official Codex manual documents `codex exec --model <id>`, the three IDs above, `--sandbox`, `--ask-for-approval`, `--strict-config`, and `codex exec -` for stdin prompts. It also documents `--oss --local-provider ollama|lmstudio` for local models.

The installed Windows app exposes a Codex executable alias, but this shell receives `Access is denied` for both `codex --version` and `codex --help`. Therefore this repository uses equivalent CLI-flag wrappers and does not modify or depend on unvalidated global profile files. If the local CLI rejects a documented flag or model, the run fails closed.

## Selection precedence

1. The eligible canonical JSON task packet must declare `allowedAgents` and `modelRoute` (legacy Markdown packets use `Allowed agents` and `Model route`).
2. The selected agent must exist in `agents/REGISTRY.md`, be `active`, and be listed in the task packet.
3. `codex:agent` uses the task packet route. When no explicit routing policy applies during planning, Terra is the policy default.
4. An explicit wrapper may escalate Luna → Terra → Sol, but may never downgrade below either the packet route or the agent's `default_model`.
5. `qwen-local` is isolated from hosted routes and is allowed only when the packet explicitly selects it.
6. Risk, data classification, policy, tools, paths, commands, approvals, and verification override model convenience.

## Route policy

### Sol

Use for architecture, security, authentication, authorization, Supabase RLS review, payments, booking concurrency, workflow correctness, difficult root-cause analysis, autonomy promotion, and final high-risk review.

### Terra — default

Use for default implementation, feature development, ordinary debugging, service implementation, tests, dashboards, refactoring, ordinary code review, and task planning.

### Luna

Use for repository discovery, file mapping, documentation, bounded research preparation, fixture generation, log classification, test scaffolding, repetitive low-risk changes, and context-pack preparation.

### Qwen local

Use only for offline preprocessing, repository summarization, log reduction, schema comparison, PII detection, diff summarization, fixture brainstorming, and private classification. Its output is untrusted and requires hosted-model or human verification.

## Wrapper contract

The cross-platform implementation is `scripts/codex/launch.mjs`, with PowerShell and POSIX entry points in `scripts/codex/`.

Examples:

```powershell
npm run codex:agent -- --agent codex-engineering-executor --task TASK-ID --workspace-write
npm run codex:sol -- --agent qa-verification --task TASK-ID
npm run codex:luna -- --agent data-anomaly-analyst --task TASK-ID
```

Every launch:

- rejects unknown, staged, inactive, or packet-disallowed agents;
- rejects missing, blocked, done, archived, or ambiguous task packets;
- rejects model downgrades and unauthorized Qwen substitution;
- loads only root/scoped instructions, the exact agent definition, exact task packet, and routing/escalation policy;
- scans loaded context for common secret patterns and applies a 512 KiB limit;
- defaults to read-only; workspace write requires an execution agent, packet opt-in, and `--workspace-write`;
- passes the context via stdin so it is not exposed in the command line;
- records only model/route, agent/task IDs, context filenames, sandbox, timestamps, and exit state in ignored local traces;
- never logs prompts, task contents, environment values, credentials, or model output.

## Package commands

This independent repository now uses its documented npm package-manager family for routing commands:

- `npm run codex:agent -- --agent <id> --task <id>`
- `npm run codex:sol -- --agent <id> --task <id>`
- `npm run codex:terra -- --agent <id> --task <id>`
- `npm run codex:luna -- --agent <id> --task <id>`
- `npm run codex:qwen-local -- --agent <id> --task <id> --local-provider <provider> --local-model <id>`
- `npm run codex:validate`

No command supplies API keys. Codex reuses its own secure authentication; secrets must never be placed in a task packet, repository config, wrapper argument, trace, or package script.
