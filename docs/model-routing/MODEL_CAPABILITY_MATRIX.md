# Model Capability Matrix

| Route | Model/runtime | Best-fit work | Default sandbox | Repository write | Required verification |
| --- | --- | --- | --- | --- | --- |
| Sol | `gpt-5.6-sol` | Architecture, protected-domain analysis, difficult diagnosis, autonomy review, final high-risk review | Read-only | Only through separately approved executor task; never because Sol was selected | Deterministic checks, independent assurance, specialist/human review where required |
| Terra | `gpt-5.6-terra` | Everyday implementation, services, debugging, tests, dashboards, refactoring, planning, ordinary review | Read-only | Only active execution agents with packet `Workspace write: true` and explicit wrapper flag | Packet checks plus independent QA and recorded evidence |
| Luna | `gpt-5.6-luna` | Discovery, mapping, docs, bounded preparation, fixtures, classification, scaffolding, repetitive low-risk edits | Read-only | Disabled by default; any future write requires a narrowly revised packet and QA | Source checks, deterministic format/tests, Terra/Sol review when output drives implementation |
| Qwen local | User-specified installed Qwen model through Codex `--oss` | Offline preprocessing, summarization, reduction, comparison, PII detection, brainstorming, private classification | Read-only | Prohibited | Treat output as untrusted; independently reproduce/verify before use |

## Capability boundaries

- Models do not calculate authoritative metrics, enforce policy, authenticate approval, manage workflow state, write audit truth, broker credentials, or operate kill switches.
- A larger model does not receive broader tools or data.
- Local Qwen is not a fallback for hosted-model failure, and hosted models are not fallbacks for a Qwen-only private task.
- Model availability must be confirmed by the actual Codex catalog/account before first live use. Current local catalog validation is blocked because the installed Windows executable alias is not runnable from this shell.
- `default_model` and `fallback_model` in agent frontmatter are routing hints constrained by this policy and the task packet; they are not permissions.

## Cost and token discipline

Use the shortest context pack that preserves instructions, agent bounds, task scope, and routing rules. Prefer Luna for repeatable preparation, Terra for ordinary delivery, and Sol only when the task's ambiguity or risk justifies it. Reuse durable evidence references instead of embedding raw logs or unrelated repository files.
