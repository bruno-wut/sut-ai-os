# Codex Model Routing Policy

## Purpose

Route each approved task to the least costly capable model without weakening permissions, verification, or specialist review. Model selection is not authorization.

## Future provider-neutral runtime boundary

The repository's `sol`, `terra`, and `luna` development routes do not make Codex
the future product workflow engine. The Phase 2–5 runtime will expose
`IntelligenceProvider`, `ProposalGenerator`, `ExecutorAdapter`, and
`VerificationProvider` boundaries.

The first supported runtime path is a 24/7 Mac Mini host running the Pi
orchestration service and durable state → supervised worker → Codex CLI adapter
→ Codex CLI with ChatGPT subscription authentication. These components are
co-located initially but remain logically separate; Pi state survives service,
worker-process, and device restarts and is never Codex ephemeral state. A
distinct Codex repository `ExecutorAdapter` handles only approved repository
preparation. Codex is never the scheduler, durable workflow, policy engine,
authorization authority, or audit source of truth. Separately approved OpenAI
API, local-model, or other adapters may later implement the same contracts.

Runtime adapters must report `available`, `busy`, `rate_limited`,
`capacity_exhausted`, `authentication_required`, `temporarily_unavailable`, or
`disabled`. Every non-`available` state pauses or safely requeues the task,
records the reason, notifies staff where appropriate, and prevents production
action. Fallback routing is disabled unless a provider is explicitly configured,
data-policy eligible, and independently qualified. Model output cannot authorize
its own intervention proposal.

## Supported hosted routes

| Route | Codex model ID | Default role |
| --- | --- | --- |
| `sol` | `gpt-5.6-sol` | Difficult, high-risk, or final specialist reasoning |
| `terra` | `gpt-5.6-terra` | Default implementation and ordinary engineering work |
| `luna` | `gpt-5.6-luna` | Clear, bounded, repetitive discovery/preparation work |

The current Codex CLI documents `codex exec --model <id>`, the three IDs above, `--sandbox`, `--strict-config`, and `codex exec -` for stdin prompts. It also documents `--oss --local-provider ollama|lmstudio` for local models.

The launcher treats the selected sandbox and exact command arguments as the local execution boundary. If the local CLI rejects a documented flag or model, the run fails closed.

## Selection precedence

1. A V1 packet must declare `allowedAgents` and `modelRoute` (legacy Markdown packets use `Allowed agents` and `Model route`); a V2 packet must declare `allowedAgents` and stage-specific `routingPolicy`.
2. The selected agent must exist in `agents/REGISTRY.md`, be `active`, and be listed in the task packet.
3. V1 launches use the packet route. V2 launches use only `routingPolicy.<stage>.route` and `routingPolicy.<stage>.effort`.
4. An explicit wrapper may escalate Luna → Terra → Sol, but may never downgrade below either the packet route or the agent's `default_model`.
5. `qwen-local` is isolated from hosted routes and is allowed only when the packet explicitly selects it.
6. Risk, data classification, policy, tools, paths, commands, approvals, and verification override model convenience.

V2 review results are accepted only from a clean committed head and are bound to the configured `GOVERNED_BASE_SHA`, or the fetched `origin/main` commit when no explicit SHA is configured. Local Qwen launches require explicit `--local-provider` and `--local-model` arguments and receive a minimal environment allowlist.

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
