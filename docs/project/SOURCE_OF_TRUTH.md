# Source of Truth

| Subject | Authoritative source | Repository rule |
| --- | --- | --- |
| Product and agent architecture | `docs/architecture/source/**` | Immutable canonical input; derive, do not edit |
| Repository rules and permanent memory | `AGENTS.md` and `docs/project/**` | Versioned Git artifacts |
| Code, prompts, schemas, policies, playbooks, tests | Git | Changes require approved scope and review |
| Captured finalized-platform interface | `reference/finalized-platform/` | Read-only snapshot of one commit, not live truth |
| Bookings, holds, inventory, staff identity, approvals | Supabase production control plane | Never inferred from a snapshot or model response |
| Payments and refunds | Payment providers | Provider records govern financial state |
| Deployments and edge runtime state | Cloudflare | Cloudflare records govern active versions and health |
| Search and traffic measures | Search Console and analytics | Use measured source data with reporting limits |
| AI outputs | None | Hypotheses, drafts, plans, or classifications only; always verify |

When sources disagree, preserve the disagreement as evidence, use the appropriate authoritative system, and escalate rather than allowing an agent to decide by convenience.
