# Agent Routing

Routing selects a bounded role and model; it never grants permission. The deterministic workflow and policy services must reject inactive/staged agents, unavailable tools, invalid schemas, out-of-tier requests, and expired approvals.

## Model route

| Work class | Default | Escalation/fallback |
| --- | --- | --- |
| Ordinary planning, implementation, editorial work, verification, and briefing | Terra | Sol for difficult or protected-domain work |
| Bounded metric/search discovery, research, classification, and outcome preparation | Luna | Terra when implementation-grade reasoning is required |
| Architecture, security, payment, concurrency, RLS, production release, financial proposals, and difficult escalation | Sol | Human specialist remains mandatory where policy requires |
| Offline preprocessing | Local Qwen | Untrusted output; independently verify before any agent consumes it |

Model route is constrained by each definition's `default_model` and `fallback_model`. A fallback may not widen tools, data, paths, commands, risk tier, or approval authority.

## Task Packet V2 authority

V1 packets continue to use their legacy `modelRoute` and wrapper compatibility rules. V2 packets must declare stage-specific `routingPolicy` in `schemas/task-packet-v2.schema.json`; that field is the sole source of route and reasoning-effort values for each launch stage. The launcher rejects CLI route/effort overrides for V2, inactive agents, terminal tasks, agent route violations, and agent effort violations. No provider fallback is implied by this foundation.

The current V2 stage defaults are Chief Orchestrator `luna/high`, Plan Review `sol/high`, Implementation `terra/high`, routine Semantic QA `luna/high`, and Merge Safety `sol/high`. `luna/max` semantic QA and `sol/xhigh` escalation require `routingComplexity: high-complexity` in the V2 packet; they are not automatic upgrades.

## Workflow routes

| Trigger | Route | Deterministic gates |
| --- | --- | --- |
| Normalized operational anomaly | `chief-orchestrator` → `data-anomaly-analyst` → `operational-incident-investigator` → `engineering-planner` | Data masking, minimum sample, policy evaluation |
| Search/content opportunity | `chief-orchestrator` → `data-anomaly-analyst` and/or `seo-strategist` → `content-brand` when ready → `engineering-planner` | Evidence window, fact source, cannibalization check, staged-agent gate |
| Approved code task | `engineering-planner` → policy engine → `codex-engineering-executor` → `qa-verification` | Task envelope, worktree, path/command allowlist, required checks |
| Approved SEO/content task | `engineering-planner` → policy engine → `codex-content-executor` → `qa-verification` | Reviewed brief, fact references, content/build checks |
| Verified release candidate | `qa-verification` → `release-deployment` when activated → `outcome-learning` | Protected environment, authenticated approval, artifact hash, smoke/rollback checks |
| Completed or monitored action | `outcome-learning` → `executive-briefing` | Deterministic outcome metrics, source citations, redaction/delivery authorization |
| Commercial rate/package opportunity | `revenue-proposal` when activated → policy/approval service | Tier 2 proposal only; no agent activation of price/inventory |
| B2B opportunity | `b2b-growth` when activated → SEO/content or authenticated commercial approval | Privacy/identity guard, verified claims, human approval |
| AEO research | `aeo-research` when activated → `seo-strategist` / `content-brand` | Public-source provenance, sample limitations, no ranking claim |

## Routing constraints

- A model does not choose its own role, tools, or successor.
- The Chief Orchestrator may request a route but deterministic registry/policy code authorizes it.
- Executors receive only one immutable, approved task envelope and cannot call other executors.
- Structured review results must bind task ID, base SHA, head SHA, reviewer, model, effort, context manifest hash, and canonical output hash.
- QA must be an independent run and cannot repair the work it judges.
- Notification, approval, deployment, audit, metrics, and policy controls remain deterministic services, not agents.
- Tier 3 requests are blocked or sent to a specialist-led process; they are not routed to ordinary executors.
