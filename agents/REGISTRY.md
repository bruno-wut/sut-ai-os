# Sri U-Thong AI Agent Registry

This is the canonical logical registry derived from `docs/architecture/source/Agent Architecture.md`. An entry defines responsibilities and permissions; it does not provision a runtime, credential, tool, or autonomous process.

## Canonical team

| ID | Name | Category | Status | Default / fallback | Definition |
| --- | --- | --- | --- | --- | --- |
| `chief-orchestrator` | Chief Orchestrator Agent | Command | Active | Terra / Sol | [Definition](command/chief-orchestrator.md) |
| `data-anomaly-analyst` | Data and Anomaly Analyst Agent | Intelligence | Active | Luna / Terra | [Definition](intelligence/data-anomaly-analyst.md) |
| `operational-incident-investigator` | Operational Incident Investigator Agent | Intelligence | Active | Terra / Sol | [Definition](intelligence/operational-incident-investigator.md) |
| `seo-strategist` | SEO Strategist Agent | Intelligence | Active | Luna / Terra | [Definition](intelligence/seo-strategist.md) |
| `content-brand` | Content and Brand Agent | Intelligence | Staged | Terra / Sol | [Definition](intelligence/content-brand.md) |
| `engineering-planner` | Engineering Planner Agent | Intelligence | Active | Terra / Sol | [Definition](intelligence/engineering-planner.md) |
| `codex-engineering-executor` | Codex Engineering Executor | Execution | Active | Terra / Sol | [Definition](execution/codex-engineering-executor.md) |
| `codex-content-executor` | Codex SEO and Content Executor | Execution | Active | Terra / Sol | [Definition](execution/codex-content-executor.md) |
| `qa-verification` | QA and Verification Agent | Assurance | Active | Terra / Sol | [Definition](assurance/qa-verification.md) |
| `release-deployment` | Release and Deployment Agent | Assurance | Staged | Sol / Terra | [Definition](assurance/release-deployment.md) |
| `outcome-learning` | Outcome and Learning Agent | Learning | Active | Luna / Terra | [Definition](learning/outcome-learning.md) |
| `executive-briefing` | Executive Briefing and Notification Agent | Learning | Active | Terra / Luna | [Definition](learning/executive-briefing.md) |

## Optional phase-two team

| ID | Name | Status | Default / fallback | Definition |
| --- | --- | --- | --- | --- |
| `revenue-proposal` | Revenue Proposal Agent | Inactive | Sol / Terra | [Definition](optional/revenue-proposal.md) |
| `b2b-growth` | B2B Growth Agent | Inactive | Luna / Terra | [Definition](optional/b2b-growth.md) |
| `aeo-research` | AEO Research Agent | Inactive | Luna / Terra | [Definition](optional/aeo-research.md) |

## Registry rules

- IDs, names, categories, versions, and status values are stable governance fields. Rename or status changes require an approved governance task and independent review.
- `active` means eligible for a future governed workflow, not continuously running or provisioned.
- `staged` means fully defined but ineligible for dispatch until its policy, tools, schemas, tests, and approval workflow are ready.
- `inactive` means optional and unavailable for dispatch.
- Frontmatter schema values are stable logical URNs. Machine-readable JSON/Zod implementations must be added and versioned before runtime activation.
- Runtimes must enforce [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md), [ROUTING.md](ROUTING.md), and [HANDOFFS.md](HANDOFFS.md) outside the model prompt.
