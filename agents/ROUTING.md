# Agent Routing

Routing selects a bounded role and model; it never grants permission. The deterministic workflow and policy services must reject inactive/staged agents, unavailable tools, invalid schemas, out-of-tier requests, and expired approvals.

## Model route & effort tiers

| Agent | Default Route & Effort | Escalation Route & Effort | Prohibited Effort Tiers |
| --- | --- | --- | --- |
| `chief-orchestrator` | Luna High | Luna Max (stacked tasks); Terra High (ambiguous); Sol High (conflicts) | None |
| `engineering-planner` | Luna High / Luna Max | Terra High (new boundaries); Sol High/XHigh (security/RLS) | None |
| `codex-engineering-executor` | Luna High (static); Terra High (runtime code) | Sol Medium (difficult diagnosis; non-routine) | None |
| `qa-verification` | Luna High (mechanical); Terra High (semantic QA) | Sol High/XHigh (architecture assessment) | None |

## Canonical Model Effort Policy
- **Luna**: `low` | `medium` | `high` | `xhigh` | `max`
- **Terra**: `low` | `medium` | `high` | `xhigh` (*`max` prohibited by policy*)
- **Sol**: `medium` | `high` | `xhigh` (*`low` & `max` prohibited by policy*)

## Workflow routes

| Trigger | Route | Deterministic gates |
| --- | --- | --- |
| Normalized operational anomaly | `chief-orchestrator` → `data-anomaly-analyst` → `operational-incident-investigator` → `engineering-planner` | Data masking, minimum sample, policy evaluation |
| Search/content opportunity | `chief-orchestrator` → `data-anomaly-analyst` and/or `seo-strategist` → `content-brand` when ready → `engineering-planner` | Evidence window, fact source, cannibalization check, staged-agent gate |
| Approved code task | `engineering-planner` → policy engine → `codex-engineering-executor` → `qa-verification` | Task envelope V2, worktree, path/command allowlist, required checks |
| Approved SEO/content task | `engineering-planner` → policy engine → `codex-content-executor` → `qa-verification` | Reviewed brief, fact references, content/build checks |
| Verified release candidate | `qa-verification` → `release-deployment` when activated → `outcome-learning` | Protected environment, authenticated approval, artifact hash, smoke/rollback checks |
| Completed or monitored action | `outcome-learning` → `executive-briefing` | Deterministic outcome metrics, source citations, redaction/delivery authorization |

## Routing constraints

- A model does not choose its own role, tools, or successor.
- The Chief Orchestrator may request a route but deterministic registry/policy code authorizes it.
- Stage-specific `routingPolicy` in Task Packet V2 (`schemas/task-packet-v2.schema.json`) is the single routing authority.
- Executors receive only one immutable, approved task envelope and cannot call other executors.
- QA must be an independent run, emit a SHA-bound review result (`schemas/review-result-v1.schema.json`), and cannot repair the work it judges.
- Notification, approval, deployment, audit, metrics, and policy controls remain deterministic services, not agents.
- Tier 3 requests are blocked or sent to a specialist-led process; they are not routed to ordinary executors.
