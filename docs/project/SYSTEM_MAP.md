# System Map

```text
Hotel-facing systems and approved external signals
  → normalized events and deterministic metrics
  → provider-neutral AI intelligence (bounded analysis and planning)
  → structured intervention proposal
  → deterministic policy and human approval
  → provider-neutral executor adapter or blocked action
  → independent verification provider
  → audit, outcome measurement, and staff/executive visibility
```

The first planned runtime option is:

```text
24/7 Mac Mini host
  → Pi orchestration service + durable queue/workflow state
  → supervised worker
  → Codex CLI adapter
  → Codex CLI + ChatGPT subscription authentication
```

The components are co-located initially, not collapsed. Pi's durable state must
survive Pi-service, worker-process, and device restarts. Worker processes,
isolated workspaces, and Codex output are never the durable state authority.

`IntelligenceProvider`, `ProposalGenerator`, `ExecutorAdapter`, and
`VerificationProvider` are replaceable interfaces. A distinct Codex repository
`ExecutorAdapter` uses the supervised worker for bounded repository preparation.
Codex is not the scheduler, workflow engine, policy engine, authorization
authority, or audit source of truth. Future approved adapters may use the OpenAI
API, local models, or other providers.

Current repository mapping:

| Layer | Current location or status |
| --- | --- |
| Finalized IBE, Astro storefront, Staff UI | Read-only compatibility snapshot in `reference/finalized-platform/` |
| AI OS implementation | Not yet created |
| Derived Mac Mini/Pi/Codex deployment decision | `docs/decisions/ADR-0001-MAC-MINI-PI-CODEX-RUNTIME.md` |
| Agent definitions and prompts | `agents/`, `prompts/` |
| Task and evidence records | `tasks/`, `evidence/`, `artifacts/reports/` |
| Governance contracts | `schemas/`, `policies/`, `playbooks/` |
| Permanent memory | `docs/project/` |

Key rule: agents advise or perform bounded tasks; deterministic metrics, policy,
approvals, workflows, scheduling, queue state, credential handling, audit
logging, and kill switches must remain software-controlled services. AI may
investigate broadly, but it may act only narrowly.

Details: [PRODUCT.md](PRODUCT.md), [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md), and the canonical architecture sources.
