# Implementation Backlog

This backlog translates the canonical architecture and the provider-neutral Mac
Mini/Pi derived decision into 39 small, dependency-aware packets. All product
tasks begin at Tier 0/shadow mode with `productionWritePermission: false`. The
immutable finalized-platform snapshot is never an implementation target.

## Phase 0 — Existing platform stabilization

| Task | Outcome | Depends on |
| --- | --- | --- |
| `SUT-AIOS-P0-001` | Establish a clean, deterministic technical baseline gate. | — |
| `SUT-AIOS-P0-002` | Produce an approved dependency/security remediation plan. | P0-001 |
| `SUT-AIOS-P0-003` | Capture compatibility contracts for the finalized platform. | P0-001 |

## Current packet state

- `SUT-AIOS-P0-001`: `done` with independent verification evidence.
- `SUT-AIOS-P0-002`: `done` with merged delivery and completion records.
- `SUT-AIOS-P0-003`: `done` with merged delivery and completion records.
- `SUT-AIOS-P1-001` through `SUT-AIOS-P1-005`: `done` with merged
  delivery, completion records, and retained verification evidence.
- `SUT-AIOS-P1-006`: `backlog`; its bounded static-registry design and exact
  future validator admission are not yet merged.
- `SUT-AIOS-GOV-032`: active roadmap-only governance work; it does not
  implement or redefine `P1-006`.
- All remaining product packets remain in `backlog` until their dependencies and
  executable verification contracts are satisfied.

## Phase 1 — Trusted control foundation

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P1-001` | Normalized system-event contract. | P0-003 |
| `P1-002` | Control-plane schema design. | P1-001 |
| `P1-003` | Append-only audit contracts. | P1-002 |
| `P1-004` | Deterministic authorization policies. | P1-001, P1-003 |
| `P1-005` | Deterministic policy evaluator. | P1-004 |
| `P1-006` | Versioned playbook registry. | P1-004 |
| `P1-007` | Independent kill-switch controls. | P1-005, P1-006 |
| `P1-008` | Observe-only Staff OS control views. | P1-002, P1-003, P1-007 |

## Phase 2 — Intelligence and executive reporting

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P2-001` | Deterministic analytics calculators. | P1-001, P1-003 |
| `P2-002` | Provider-neutral structured intelligence request/response contracts. | P2-001, P1-004 |
| `P2-004` | Explicit intervention-proposal contract with evidence, capability, risk, approval, verification, rollback, and outcome fields. | P2-002, P1-004 |
| `P2-003` | Observe-only executive briefing using structured intelligence and proposals. | P2-001, P2-002, P2-004, P1-008 |

## Phase 3 — Durable event and workflow layer

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P3-001` | Signed signal-normalization endpoint. | P1-001, P1-003, P1-005 |
| `P3-002` | Durable scheduling, queue consumption, retry/requeue, and dead-letter delivery. | P3-001 |
| `P3-003` | Durable workflow state machine with proposal, provider-wait, timeout, cancellation, and recovery states. | P3-002, P1-006, P1-007, P2-004 |

## Phase 4 — Provider-neutral intelligence and execution platform

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P4-001` | Private GitHub App authentication. | GOV-008, P1-005, P1-007 |
| `P4-004` | Provider-neutral intelligence invocation gateway. | P2-002, P2-004, P3-003, P1-005, P1-007 |
| `P4-005` | Pi-to-Codex CLI adapter with ChatGPT subscription health and fail-closed provider-state mapping. | P4-004 |
| `P4-006` | Supervised Mac Mini worker co-located with Pi durable orchestration, with isolated workspaces, concurrency limits, timeouts, restart recovery, and safe cleanup. | P3-002, P3-003, P4-005, P1-007 |
| `P4-007` | Codex repository `ExecutorAdapter` for bounded analysis, code/content changes, tests, branch/PR preparation, and repair preparation. | P4-005, P4-006 |
| `P4-002` | Policy-gated, provider-neutral `ExecutorAdapter` dispatch. | P3-003, P4-001, P4-004, P4-006, P4-007, GOV-003, GOV-004 |
| `P4-003` | Isolated executor result and PR flow. | P4-002, P4-001, P4-006, GOV-005 |

## Phase 5 — Independent verification

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P5-001` | Provider-neutral independent `VerificationProvider`. | P4-003, P4-004 |
| `P5-002` | Preview and audit evidence for provider, model, sanitized/classified prompt reference, prompt integrity, task, commands, states, and outcomes. | P5-001, P1-003, P4-006 |
| `P5-003` | Rollback eligibility gate. | P5-002, P1-007 |
| `P5-004` | Qualification of future API, local-model, or other fallback providers. | P4-004, P4-005, P5-001, P5-002 |

## Phase 6 — SEO growth automation

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P6-001` | Google Search Console ingestion. | P3-002 |
| `P6-002` | SEO opportunity scoring and content inventory. | P6-001, P2-001 |
| `P6-003` | Observe-only SEO command center. | P6-002, P1-008 |
| `P6-004` | Content-schema-repair vertical slice. | P0-001, P1-004, P1-006, P1-007, P4-003, P5-002 |

## Phase 7 — Human-gated commercial intelligence

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P7-001` | Authenticated approval service. | P1-003, P1-005, P3-003 |
| `P7-002` | Secure Staff OS approval workflow. | P7-001, P1-008 |
| `P7-003` | Shadow revenue-proposal workflow. | P7-002, P2-002 |

## Phase 8 — Proven autonomous operations

| Task | Outcome | Depends on |
| --- | --- | --- |
| `P8-001` | Outcome measurement register. | P2-001, P3-003, P6-004 |
| `P8-002` | Evidence-based autonomy promotion gate. | P8-001, P1-005, P5-003 |
| `P8-003` | Content-repair autonomy-promotion rehearsal. | P8-002, P6-004 |

Only tasks whose packet dependencies are verified or done may leave backlog.
Future provider tasks also require exact executable verification contracts before
activation. No provider state or fallback can substitute for policy or approval.
