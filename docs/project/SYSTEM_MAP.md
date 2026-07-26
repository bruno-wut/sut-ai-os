# System Map

```text
Hotel-facing systems and approved external signals
  → normalized events and deterministic metrics
  → AI intelligence (bounded analysis and planning)
  → deterministic policy and human approval
  → constrained executor or blocked action
  → independent verification
  → audit, outcome measurement, and staff/executive visibility
```

Current repository mapping:

| Layer | Current location or status |
| --- | --- |
| Finalized IBE, Astro storefront, Staff UI | Read-only compatibility snapshot in `reference/finalized-platform/` |
| AI OS implementation | Not yet created |
| Agent definitions and prompts | `agents/`, `prompts/` |
| Task and evidence records | `tasks/`, `evidence/`, `artifacts/reports/` |
| Governance contracts | `schemas/`, `policies/`, `playbooks/` |
| Permanent memory | `docs/project/` |

Key rule: agents advise or perform bounded tasks; deterministic metrics, policy, approvals, workflows, credential handling, audit logging, and kill switches must remain software-controlled services.

Details: [PRODUCT.md](PRODUCT.md), [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md), and the canonical architecture sources.
