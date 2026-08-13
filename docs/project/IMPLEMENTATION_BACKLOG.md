# Implementation Backlog

This is the exhaustive canonical product-task inventory for Phases 0–8. All product packets begin Tier 0/shadow with `productionWritePermission: false`; the immutable finalized-platform snapshot is never an implementation target. “Retained” means an existing task whose objective remains governed by the revised architecture; “new” means a GOV-043 addition. Completed rows retain their original acceptance criteria and evidence.

## Current state

- `P0-001`–`P0-003`, `P1-001`–`P1-008`, `P2-001`, `P2-002`, `P2-004`, `P2-005`, and `P2-006` are `done` with retained evidence.
- `P1-005-R01` and `P2-001-R02` are completed bounded remediations; they do not replace their terminal parent histories.
- `P2-003` remains retained backlog work. GOV-053 defines P2-007's finite V1
  contract and GOV-054 separately admits its exact validator before activation.
  `P2-007`, `P3-004`–`P3-005`, and `P5-005`–`P5-006` remain new GOV-043 backlog work.

## Phase 0 — Existing platform stabilization

| Task | Status / outcome | Depends on |
| --- | --- | --- |
| `P0-001` | Done — clean deterministic technical baseline gate. | — |
| `P0-002` | Done — dependency and security remediation plan. | P0-001 |
| `P0-003` | Done — finalized-platform compatibility contracts. | P0-001 |

## Phase 1 — Trusted control foundation

| Task | Status / outcome | Depends on |
| --- | --- | --- |
| `P1-001` | Done — normalized system-event contract. | P0-003 |
| `P1-002` | Done — static control-plane schema contract. | P1-001 |
| `P1-003` | Done — static append-only audit contract. | P1-002 |
| `P1-004` | Done — static V1 authorization-policy contract. | P1-001, P1-003 |
| `P1-005` | Done — deterministic V2 runtime policy evaluator. | P1-004, GOV-024, GOV-025 |
| `P1-005-R01` | Done — bounded authority-isolation remediation record. | P1-004, P1-005, GOV-031 |
| `P1-006` | Done — static playbook registry V1 contract. | P1-004 |
| `P1-006-PLAN` | Done — bounded static playbook-registry design record. | P1-004, P1-005 |
| `P1-007` | Done — static deny-only kill-switch controls V1. | P1-005, P1-006 |
| `P1-007-PLAN` | Done — bounded static kill-switch design record. | P1-005, P1-006 |
| `P1-008` | Done — observe-only Staff OS control views. | P1-002, P1-003, P1-007, GOV-036, GOV-037 |

## Phase 2 — Intelligence and infrastructure authorities

| Task | Status / outcome | Depends on |
| --- | --- | --- |
| `P2-001` | Done — deterministic analytics calculators. | P1-001, P1-003, GOV-038 |
| `P2-001-R02` | Done — schema assurance and semantic-ordering remediation record. | P2-001 |
| `P2-002` | Done — provider-neutral structured intelligence contracts. | P2-001, P2-001-R02, P1-004, GOV-040, GOV-042 |
| `P2-004` | Done — static non-authoritative intervention-proposal V1 schema and semantic validator. | P2-002, GOV-044, GOV-045 |
| `P2-003` | Retained — observe-only executive briefing. | P2-001, P2-002, P2-004, P1-008, P2-006, P2-007 |
| `P2-005` | Done — static trust-zone and provider-neutral port contracts. | P1-003, P1-005, P2-002, GOV-047, GOV-048 |
| `P2-006` | Done — static data-minimisation, aggregation, and non-authoritative retention classification contract. | P1-003, P2-001, P2-005, GOV-050, GOV-051 |
| `P2-007` | New, GOV-053-designed — static deterministic resource-budget, metering-state, workload-ceiling, and booking-isolation classification contract. | P1-003, P1-005, P2-005, GOV-053, GOV-054 |

## Phase 3 — Durable orchestration and persistence

| Task | Status / outcome | Depends on |
| --- | --- | --- |
| `P3-001` | Retained, revised — authenticated rate-limited aggregate-only signal ingestion. | P1-001, P1-003, P1-005, P2-005, P2-006, P2-007 |
| `P3-002` | Done — durable scheduling, queue consumption, bounded retry/requeue, DLQ, batching, dedupe, idempotency, backpressure, and priorities; terminal implementation history is preserved. | P3-001, P2-006, P2-007 |
| `P3-002-R01` | New remediation prerequisite — enforce unique work identity, trusted-clock scheduling, immutable port snapshots, and dispatch idempotency-key propagation in the bounded event-delivery core. | P3-002 |
| `P3-003` | Retained, revised — durable provider/approval workflow state machine; activation waits for P3-002-R01 and its independent evidence. | P3-002, P3-002-R01, P1-006, P1-007, P2-004, P2-007 |
| `P3-004` | New — provider-neutral persistence composition and reference adapters. | P1-003, P2-005, P2-006, P2-007 |
| `P3-005` | New — fixture-only retention lifecycle composition. | P2-006, P2-007, P3-004 |

## Phase 4 — Provider-neutral bounded execution

| Task | Status / outcome | Depends on |
| --- | --- | --- |
| `P4-001` | Retained — private GitHub App authentication. | GOV-008, P1-005, P1-007 |
| `P4-004` | Retained, revised — provider-neutral intelligence invocation gateway. | P2-002, P2-004, P2-005, P2-006, P2-007, P3-003, P1-005, P1-007 |
| `P4-005` | Retained — Pi-to-Codex CLI adapter and subscription-state mapping. | P4-004 |
| `P4-006` | Retained, revised — supervised Mac Mini worker with isolated workspaces and bounded capacity. | P3-002, P3-003, P3-004, P2-007, P4-005, P1-007 |
| `P4-007` | Retained — Codex repository `ExecutorAdapter`. | P4-005, P4-006 |
| `P4-002` | Retained — policy-gated provider-neutral executor dispatch. | P3-003, P4-001, P4-004, P4-006, P4-007, GOV-003, GOV-004 |
| `P4-003` | Retained — isolated executor result and PR flow. | P4-002, P4-001, P4-006, GOV-005 |

## Phase 5 — Independent assurance and portability

| Task | Status / outcome | Depends on |
| --- | --- | --- |
| `P5-001` | Retained, revised — provider-neutral independent `VerificationProvider`. | P4-003, P4-004, P2-005 |
| `P5-002` | Retained, revised — preview/audit evidence with retention-aware references. | P5-001, P1-003, P2-006, P4-006 |
| `P5-003` | Retained — rollback eligibility gate. | P5-002, P1-007 |
| `P5-004` | Retained — qualification of API, local, or other fallback providers. | P4-004, P4-005, P5-001, P5-002 |
| `P5-005` | New — local/self-hosted migration-readiness verification. | P3-004, P3-005, P3-002, P4-006, P5-002, P5-004 |
| `P5-006` | New — quota/saturation and booking-isolation verification. | P2-007, P3-002, P3-003, P4-006, P5-001 |

## Phase 6 — SEO growth automation

| Task | Status / outcome | Depends on |
| --- | --- | --- |
| `P6-001` | Retained, revised — Google Search Console ingestion using source-system aggregates. | P3-002, P2-006, P2-007 |
| `P6-002` | Retained — SEO opportunity scoring and content inventory. | P6-001, P2-001 |
| `P6-003` | Retained — observe-only SEO command center. | P6-002, P1-008 |
| `P6-004` | Retained — content-schema-repair vertical slice. | P0-001, P1-004, P1-006, P1-007, P4-003, P5-002 |

## Phase 7 — Human-gated commercial intelligence

| Task | Status / outcome | Depends on |
| --- | --- | --- |
| `P7-001` | Retained — authenticated approval service. | P1-003, P1-005, P3-003 |
| `P7-002` | Retained — secure Staff OS approval workflow. | P7-001, P1-008 |
| `P7-003` | Retained — shadow revenue-proposal workflow. | P7-002, P2-002 |

## Phase 8 — Proven autonomous operations

| Task | Status / outcome | Depends on |
| --- | --- | --- |
| `P8-001` | Retained — outcome measurement register. | P2-001, P3-003, P6-004 |
| `P8-002` | Retained — evidence-based autonomy-promotion gate. | P8-001, P1-005, P5-003 |
| `P8-003` | Retained — content-repair autonomy-promotion rehearsal. | P8-002, P6-004 |

Only packets whose dependencies are verified or done with durable evidence may leave backlog. New runtime validator commands require separately admitted, shell-free verification before activation. No provider state or fallback may substitute for policy or human approval.
