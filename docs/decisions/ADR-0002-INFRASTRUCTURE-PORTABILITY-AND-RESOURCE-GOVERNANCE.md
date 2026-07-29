# ADR-0002: Infrastructure portability and resource governance

- **Status:** Proposed; becomes the active derived planning decision when `SUT-AIOS-GOV-043` is approved and merged.
- **Date:** 2026-07-29
- **Decision owner:** Sri U-Thong Grand Hotel
- **Derived from:** the immutable canonical architecture sources and ADR-0001.

## Context

The AI OS must remain governable while the guest website, Staff OS, AI OS,
providers, and runtime locations evolve independently. The initial Mac Mini can
co-locate Pi orchestration, durable state, a supervised worker, and the Codex
adapter, but co-location must not collapse authority or infrastructure seams.

## Decision

### Logical zones and integration

Guest/public traffic may remain in its existing Cloudflare account and domain.
Staff OS and AI OS may use a separate Cloudflare account and dedicated domain.
Those are separate public, staff/control, and AI/workload trust zones even when
some components are initially co-located on one Mac Mini. A cross-account
integration is only a narrowly defined HTTPS API: it uses authenticated,
audience-bound, short-lived caller credentials; recipient-side expiry and
audience checks; a timestamp plus one-time nonce with replay rejection; and an
idempotency key for retried accepted requests. The contract also fixes bounded
request/response bodies and timeouts, and applies rate limits per authenticated
caller and route. Missing, expired, mis-audienced, replayed, malformed, or
over-limit calls are rejected without dispatch. It has separate credentials,
quotas, deployment pipelines, and failure budgets. It is never an implicit
shared binding, database, queue, or credential. Booking-path availability and
guest traffic must not depend on AI or staff workload availability.

### Deep modules and hexagonal ports

Domain/application core exposes small stable inbound use cases and depends only
on inward-facing ports. Core code must not import Cloudflare, Supabase, GitHub,
OpenAI, LINE, or local-server SDKs. Adapters own provider SDKs and configuration;
composition selects adapters outside the core. Required outbound ports are
`PersistencePort`, `EventIngestionPort`, `AnalyticsSourcePort`,
`SchedulingQueuePort`, `WorkflowExecutionPort`, `ObjectStoragePort`,
`NotificationPort`, `IntelligenceProvider`, `DeploymentProvider`, and
`AuthenticationPort`. Existing `ProposalGenerator`, `ExecutorAdapter`, and
`VerificationProvider` remain separate boundaries.

This permits separately approved adapters for Supabase Cloud or self-hosted
PostgreSQL/Supabase; Workers or local/VPS services; Cloudflare queues/workflows
or Pi/local durable orchestration; GitHub-hosted or self-hosted runners; and
hosted or approved local AI. Replacing an adapter and configuration must not
rewrite domain logic or transfer authorization, policy, workflow, or audit
authority to a provider.

### Data minimisation and retention

Raw page views, clicks, scrolling, and marketing telemetry remain in Google
Analytics, Search Console, or their source systems. AI OS may retain only
hourly/daily aggregates, essential booking-lifecycle events, anomalies and
incidents, investigations/recommendations, proposals/approvals/executions/
outcomes, and required audit evidence. It must not create a permanent database
row, queue message, workflow, or AI invocation per guest interaction.

Every future persistence or evidence implementation must use configurable
retention for temporary ingestion records, debug logs, AI prompts/outputs,
workflow detail, analytics aggregates, incidents, and audit evidence. The
policy must support scheduled deletion, aggregation, archival, and later
transfer to local storage while preserving append-only audit and failed-attempt
history. Retention does not authorize deletion of protected audit records.

### Resource and workload controls

Deterministic budgets must cover Worker requests/CPU, queue operations,
workflow steps, persistence size/growth/egress, runner minutes, AI invocations
and tokens, and notification volume. Each budget has warnings at 50%, 75%, and
90%; before a hard limit, affected AI/staff work fails closed, pauses or safely
requeues, records a reason, and alerts through an approved path. Missing,
unavailable, stale, inconsistent, or uncertain metering is not treated as a
safe estimate: it fails closed with a deterministic reason. It must not consume
booking-path capacity or cause production action.

Ingestion and orchestration must use bounded batching, deduplication,
idempotency keys, backpressure, rate/concurrency/retry limits, dead-letter
handling, priority queues, and scheduled summaries. Continuous model invocation
for individual interactions is prohibited.

## Consequences

This ADR selects no vendor, account, domain, database, queue, credential,
runtime, or production deployment. P2-005 through P2-007 define static
authorities; P3-004 composes reference persistence adapters; P3-005 composes
fixture-only retention lifecycle controls; P5-005 and P5-006 verify migration
readiness and quota saturation. Independent QA must reject
provider coupling in core, unauthenticated Staff/AI exposure, shared
guest/internal exhaustion boundaries, per-click permanence/AI invocation,
missing retention/budget authority, and unbounded workload behavior.

## Migration strategy and risks

Migration is an adapter-and-configuration change only after a separately
approved data transfer, credential, cutover, rollback, and verification plan.
Dual writes, live replication, provider provisioning, and production traffic
changes are out of scope. The principal residual risks are semantic drift across
adapters, retention conflicts with audit obligations, cross-account credential
misconfiguration, and co-located Mac Mini capacity/failure. P5-005/P5-006 must
produce evidence before any migration or high-volume runtime activation.
