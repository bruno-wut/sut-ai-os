# Implementation Backlog

All product packets begin Tier 0/shadow with `productionWritePermission: false`.
The immutable finalized-platform snapshot is never an implementation target.

## Current state

- `P0-001` through `P0-003`, `P1-001` through `P1-008`, `P2-001`, and
  `P2-002` are done with retained evidence.
- `P2-004` is the next existing product-contract dependency; `P2-003` remains
  a later observe-only consumer.
- The packets below were added by GOV-043 before Phase 3 implementation. They
  do not retroactively alter completed acceptance criteria or evidence.

## Phase 2 — intelligence and infrastructure authorities

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P2-004` | Explicit intervention-proposal contract. | P2-002, P1-004 |
| `P2-003` | Observe-only executive briefing. | P2-001, P2-002, P2-004, P1-008 |
| `P2-005` | Static trust-zone and provider-neutral port contracts. | P1-003, P1-005, P2-002 |
| `P2-006` | Static data-minimisation, aggregation, and retention contracts. | P1-003, P2-001, P2-005 |
| `P2-007` | Static deterministic resource-budget and quota contracts. | P1-003, P1-005, P2-005 |

## Phase 3 — durable orchestration and persistence

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P3-001` | Authenticated, rate-limited signal ingestion with aggregate-only rules. | P1-001, P1-003, P1-005, P2-005, P2-006, P2-007 |
| `P3-002` | Durable scheduling, queue consumption, bounded retry/requeue, DLQ, batching, dedupe, idempotency, backpressure, priorities. | P3-001, P2-006, P2-007 |
| `P3-003` | Durable provider/approval workflow state machine. | P3-002, P1-006, P1-007, P2-004, P2-007 |
| `P3-004` | Provider-neutral persistence composition and reference adapters. | P1-003, P2-005, P2-006, P2-007 |
| `P3-005` | Fixture-only retention lifecycle composition: scheduled delete, aggregate, archive, and transfer eligibility instructions; no lifecycle action. | P2-006, P2-007, P3-004 |

## Phase 4 — provider-neutral bounded execution

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P4-001` | Private GitHub App authentication. | GOV-008, P1-005, P1-007 |
| `P4-004` | Provider-neutral intelligence invocation gateway. | P2-002, P2-004, P2-005, P2-006, P2-007, P3-003, P1-005, P1-007 |
| `P4-005` | Pi-to-Codex CLI adapter and subscription state mapping. | P4-004 |
| `P4-006` | Supervised Mac Mini worker with isolated workspaces and bounded capacity. | P3-002, P3-003, P3-004, P2-007, P4-005, P1-007 |
| `P4-007` | Codex repository ExecutorAdapter. | P4-005, P4-006 |
| `P4-002` | Policy-gated provider-neutral executor dispatch. | P3-003, P4-001, P4-004, P4-006, P4-007, GOV-003, GOV-004 |
| `P4-003` | Isolated executor result and PR flow. | P4-002, P4-001, P4-006, GOV-005 |

## Phase 5 — independent assurance and portability

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P5-001` | Provider-neutral independent VerificationProvider. | P4-003, P4-004, P2-005 |
| `P5-002` | Preview/audit evidence with retention-aware references. | P5-001, P1-003, P2-006, P4-006 |
| `P5-003` | Rollback eligibility gate. | P5-002, P1-007 |
| `P5-004` | Qualification of API, local, or other fallback providers. | P4-004, P4-005, P5-001, P5-002 |
| `P5-005` | Local/self-hosted migration readiness verification. | P3-004, P3-005, P3-002, P4-006, P5-002, P5-004 |
| `P5-006` | Quota/saturation and booking-isolation verification. | P2-007, P3-002, P3-003, P4-006, P5-001 |

## Phases 6–8

Existing SEO, approval, and autonomy packets remain backlog. Any ingestion must
use source-system aggregates and scheduled summaries; later work inherits the
trust-zone, retention, budget, workload, and portability gates above.

Only packets whose dependencies are verified or done with durable evidence may
leave backlog. New runtime validator commands require separately admitted,
shell-free verification before activation.
