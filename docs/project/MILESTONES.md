# Milestones

| Milestone | Exit evidence | Constituent tasks |
| --- | --- | --- |
| M0 — Reproducible baseline | Compatibility contracts and remediation planning independently verified. | P0-001–003 |
| M1 — Trusted control foundation | Events, control schema, audit, policies, playbooks, kill switches, and observe-only views pass deterministic checks. | P1-001–008 |
| M2 — Explainable intelligence and infrastructure authority | Analytics, intelligence/proposal contracts, trust zones/ports, minimisation/retention, and quota contracts are schema-valid and bounded. | P2-001–007 |
| M3 — Durable orchestration | Authenticated aggregate signals, bounded queue/workflow control, provider-neutral persistence composition, and fixture-only retention lifecycle controls pass recovery and negative tests. | P3-001–005 |
| M4 — Provider-neutral bounded execution | Gateway, adapters, supervised worker, repository executor, dispatch, and PR-only flow enforce packet permissions. | P4-001–007 |
| M5 — Independent assurance and portability | Independent verification, evidence, rollback/fallback, migration readiness, and quota/saturation evidence block unsafe work. | P5-001–006 |
| M6 — First vertical slice | Content-schema repair completes detect → authorize → execute → verify in shadow/Tier 0 mode. | P6-004 plus critical-path dependencies |
| M7 — Growth and approvals | SEO uses source aggregates and human approvals remain authenticated. | P6-001–003, P7-001–003 |
| M8 — Evidence-led autonomy | Outcome history supports a reviewed promotion rehearsal; no automatic promotion occurs. | P8-001–003 |

M3 includes `P3-005` fixture-only retention lifecycle composition; it has no
authority to delete, archive, transfer, or provision storage.

Milestone completion never implies production deployment. Production eligibility
requires a separately approved release packet, protected environment, required
checks, explicit authorization, and relevant portability-assurance evidence.
