# Roadmap

## 0. Workspace and governance foundation — complete

The governed workspace, task/evidence lifecycle, immutable compatibility
boundary, and non-deploying validation practice are established. Production
writes and autonomous operation remain disabled.

## 1. Trusted control foundation — complete

`SUT-AIOS-P1-001` through `SUT-AIOS-P1-008` are done. They provide the event,
control, audit, authorization, policy evaluation, playbook, kill-switch, and
observe-only control-view foundations.

## 2. Intelligence, reporting, and infrastructure authorities — current

`P2-001` deterministic analytics and `P2-002` provider-neutral intelligence
contracts are done. `P2-004` defines intervention proposals, then `P2-003`
consumes them for an observe-only executive briefing. Before Phase 3 runtime
implementation, the following static authorities must be completed:

- `P2-005` trust zones and provider-neutral port contracts;
- `P2-006` data minimisation, aggregation, and retention contracts; and
- `P2-007` deterministic resource-budget and quota contracts.

They implement the derived planning constraints in ADR-0002: guest/public and
Staff/AI workloads are logically and operationally separate; raw clickstream
telemetry stays in source analytics; budgets and workload controls fail closed;
and domain logic depends on stable ports rather than provider SDKs.

## 3. Durable orchestration and persistence composition

Add signed/controlled ingestion, durable queue/workflow behavior, a
provider-neutral persistence composition with reference adapters, and a
fixture-only retention lifecycle composition that can calculate scheduled
delete, aggregate, archive, or transfer eligibility without performing any of
them. Work is
batched, deduplicated, idempotent, bounded, and requeue/dead-letter capable;
there is never one permanent AI OS record, queue message, workflow, or model
call per guest interaction. Cloudflare queues/workflows and Pi/local durable
orchestration remain replaceable adapters.

## 4. Provider-neutral bounded execution

Implement the invocation gateway, Pi-to-Codex adapter, co-located supervised
Mac Mini worker, Codex repository executor adapter, dispatch, and PR-only
execution. Initial deployment may co-locate Pi, durable state, worker, and
adapter on the Mac Mini, but they remain distinct logical components. Codex is
not scheduler, workflow, policy, approval, or audit authority.

## 5. Independent assurance, portability, and saturation evidence

Add independent verification, preview/audit evidence, rollback gates, fallback
qualification, migration-readiness verification, and quota/saturation
verification. Hosted/self-hosted PostgreSQL/Supabase, Workers/local/VPS,
Cloudflare/Pi queues and workflows, GitHub/self-hosted runners, and hosted/local
AI may change through adapters/configuration after approval; core domain logic
does not change. No fallback enables itself.

## 6–8. Growth, human-gated commercial intelligence, proven autonomy

SEO ingestion and growth work uses source-system aggregates, scheduled
summaries, and the same controls. Commercial recommendations remain
human-approved. Autonomy promotion stays evidence-led; provider replacement
does not promote autonomy. AI may investigate broadly but may act only narrowly.

The phase order is intentional. No task may skip its dependencies, independent
review, deterministic verification, or a separate production authorization.
