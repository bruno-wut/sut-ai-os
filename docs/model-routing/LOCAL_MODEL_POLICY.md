# Local Model Policy

## Status

Qwen local is an untrusted offline preprocessing route. No supported local provider executable (`ollama` or LM Studio CLI) was detected during this bootstrap, so live local-model execution is blocked. The wrapper is configuration-ready but fails closed until an approved provider and installed model ID are supplied.

## Approved uses

- repository summarization and context reduction;
- log reduction using already-approved, locally stored inputs;
- schema and diff comparison;
- PII detection assistance;
- fixture brainstorming;
- private, low-risk classification;
- repetitive preprocessing whose result can be deterministically checked.

## Invocation

The canonical JSON task packet must declare `modelRoute: qwen-local` (legacy Markdown packets use `Model route: qwen-local`). Invoke with non-secret values:

```powershell
npm run codex:qwen-local -- --agent <active-agent-id> --task <task-id> --local-provider ollama --local-model <installed-qwen-id>
```

Alternatively set `SUT_QWEN_PROVIDER` and `SUT_QWEN_MODEL`. These variables identify a provider/model and must never contain credentials. The wrapper uses the documented Codex form `codex exec --oss --local-provider <ollama|lmstudio> --model <local-id> -`, ignores user configuration, disables app connectors and web search, and passes only a minimal non-secret environment to the child process.

## Isolation requirements

- Prove the provider and model operate locally before processing private data.
- Disable web search, external MCP/app connectors, telemetry containing prompts, and network egress for the preprocessing environment.
- Use read-only repository access and task-scoped input references.
- Do not load `.env`, auth files, credentials, payment secrets, raw unrestricted guest exports, or files outside the packet.
- Do not persist prompts or raw model output in Git; generated output belongs in ignored local-model or trace storage.
- Redact or aggregate guest/staff data wherever possible even when processing locally.

## Trust boundary

Qwen output is never source-of-truth evidence, policy, approval, a production instruction, or an executable task packet. It may propose a summary/classification, but a deterministic check, hosted-model review, or accountable human must verify every result before it influences code, public content, incident response, commercial decisions, or audit records.

## Prohibited actions

Qwen local may not write repository code/content, run shell/SQL commands, access production services, deploy, change bookings/inventory/prices, handle payment credentials, alter RLS/policy, send notifications, approve work, or perform final QA.

## Escalation

Stop if local-only operation cannot be proven, the model/provider is unavailable, context contains secrets, requested output is consequential, PII scope is unclear, or deterministic verification is unavailable. Route verified low-risk preparation to Luna/Terra, and protected-domain or difficult conclusions to Sol plus specialist review.
