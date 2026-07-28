# Dependency Graph

The critical path to the first complete execution slice remains rooted in the
Phase 1 controls, but Phase 2–5 now separates intelligence, proposals,
orchestration, provider invocation, worker execution, and independent
verification:

```mermaid
flowchart LR
  P0["P0-003 Compatibility contracts"] --> E["P1-001 Event contract"]
  E --> S["P1-002 Control-plane schema"] --> A["P1-003 Audit records"]
  A --> P["P1-004 Policies"] --> PE["P1-005 Policy engine"]
  P --> R["P1-006 Playbook registry"]
  PE --> K["P1-007 Kill switches"]
  R --> K

  E --> AN["P2-001 Deterministic analytics"]
  A --> AN
  AN --> IC["P2-002 Intelligence contracts"]
  P --> IC
  IC --> PR["P2-004 Intervention proposal"]
  P --> PR

  E --> SI["P3-001 Signal ingestion"]
  A --> SI
  PE --> SI
  SI --> Q["P3-002 Schedule / queue / requeue / DLQ"]
  Q --> W["P3-003 Durable workflow"]
  R --> W
  K --> W
  PR --> W

  IC --> G["P4-004 IntelligenceProvider gateway"]
  PR --> G
  W --> G
  PE --> G
  K --> G
  G --> C["P4-005 Pi-to-Codex adapter"]
  C --> M["P4-006 Mac Mini worker"]
  Q --> M
  W --> M
  K --> M
  C --> RE["P4-007 Codex repository ExecutorAdapter"]
  M --> RE

  W --> D["P4-002 ExecutorAdapter dispatch"]
  G --> D
  M --> D
  RE --> D
  D --> X["P4-003 Executor / PR flow"]
  M --> X

  X --> V["P5-001 VerificationProvider"]
  G --> V
  V --> EV["P5-002 Preview and audit evidence"]
  A --> EV
  M --> EV
  EV --> RB["P5-003 Rollback gate"]
  K --> RB
  G --> FB["P5-004 Fallback qualification"]
  C --> FB
  V --> FB
  EV --> FB

  P --> CSR["P6-004 Content-schema repair"]
  R --> CSR
  K --> CSR
  X --> CSR
  EV --> CSR
```

## Recalculated Phase 2–5 dependencies

| Task | Direct dependencies |
| --- | --- |
| `P2-002` | `P2-001`, `P1-004` |
| `P2-004` | `P2-002`, `P1-004` |
| `P2-003` | `P2-001`, `P2-002`, `P2-004`, `P1-008` |
| `P3-002` | `P3-001` |
| `P3-003` | `P3-002`, `P1-006`, `P1-007`, `P2-004` |
| `P4-004` | `P2-002`, `P2-004`, `P3-003`, `P1-005`, `P1-007` |
| `P4-005` | `P4-004` |
| `P4-006` | `P3-002`, `P3-003`, `P4-005`, `P1-007` |
| `P4-007` | `P4-005`, `P4-006` |
| `P4-002` | `P3-003`, `P4-001`, `P4-004`, `P4-006`, `P4-007`, `GOV-003`, `GOV-004` |
| `P4-003` | `P4-002`, `P4-001`, `P4-006`, `GOV-005` |
| `P5-001` | `P4-003`, `P4-004` |
| `P5-002` | `P5-001`, `P1-003`, `P4-006` |
| `P5-003` | `P5-002`, `P1-007` |
| `P5-004` | `P4-004`, `P4-005`, `P5-001`, `P5-002` |

## Dependency rules

- A dependency is satisfied only when its packet is `verified` or `done` with
  durable evidence.
- Schema and policy dependencies precede runtime implementation.
- Audit, deterministic policy, and kill-switch controls precede provider or
  executor activation.
- Structured intelligence precedes intervention proposals; proposals precede
  durable provider invocation.
- The Pi workflow and queue logically own scheduling, waits, retries,
  dead-lettering, cancellation, and recovery. Initially they run locally on the
  same Mac Mini host as the worker, but their durable state survives Pi-service,
  worker-process, and device restarts and is never Codex ephemeral state.
- The provider-neutral gateway precedes the Codex subscription adapter; the
  adapter precedes the supervised Mac Mini worker and the distinct Codex
  repository ExecutorAdapter.
- Provider-neutral execution precedes independent verification; verification
  precedes the first vertical slice.
- Fallback qualification does not enable a fallback. Configuration, data-policy
  eligibility, and independent approval remain separate requirements.
- Phase labels describe product sequencing, but branches may proceed in parallel
  only when their packet dependencies are satisfied.
- Payment, authentication, authorization, RLS, workflow correctness,
  concurrency, rollback, and autonomy work always retain Sol escalation.

The recalculated Phase 2–5 graph is acyclic. `P6-004` receives the new gateway,
adapter, worker, repository ExecutorAdapter, and independent-verification
controls transitively through `P4-003` and `P5-002`; its existing direct
dependencies do not need to be
rewritten by this governance task.
