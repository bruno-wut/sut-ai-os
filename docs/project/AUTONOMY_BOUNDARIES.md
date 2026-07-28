# Autonomy Boundaries

## Default posture

Start new playbooks in Tier 0: observe, measure, diagnose, recommend, draft, or prepare a pull request. No production alteration occurs by default.

For the provider-neutral Mac Mini/Pi runtime, the AI may investigate, explain,
rank hypotheses, recommend, draft, and prepare an authorized branch or pull
request. It cannot authorize its own intervention proposal. Codex and any future
provider remain subordinate to deterministic policy, authenticated approval,
durable workflow, bounded executor capabilities, independent verification, and
audit.

Every provider state other than `available` fails closed: pause or safely requeue
the task, record the reason, notify staff where appropriate, and perform no
production-impacting action. A configured fallback does not bypass policy or
increase autonomy.

> AI may investigate broadly, but it may act only narrowly.

| Tier | Meaning | Minimum condition |
| --- | --- | --- |
| 0 | Observe and recommend | Evidence and draft only |
| 1 | Narrow autonomous reversible action | Proven low risk, explicit policy, path/command allowlist, verification, and rollback |
| 2 | Human-gated action | Prepare and verify, then await authenticated, time-limited approval |
| 3 | Prohibited or specialist-only | Do not execute through ordinary AI workflow |

## Always prohibited in ordinary implementation

- Production database changes without an approved task.
- RLS changes without specialist review.
- Payment credential changes.
- Destructive booking changes.
- Production deployment during ordinary implementation.
- Unrestricted SQL or broad production data extraction.
- Secret exposure, credential copying, or unmasked guest-data export.
- Bypassing verification, independent review, approval expiry, or deterministic policy.
- Policy self-modification or privilege escalation by an agent.

## Approval and escalation

Require explicit authenticated approval for Tier 2 work, including commercial changes, pricing, packages, inventory controls, significant booking-flow changes, public claims with uncertain facts, and higher-risk deployment actions.

Escalate to Sol for architecture, security, payment, concurrency, RLS, and difficult risk analysis. Specialist review remains required even when Sol is used.

Terra and Luna may prepare evidence and drafts within their task packets. Local Qwen may preprocess offline only; its output cannot authorize action or substitute for evidence.

Detailed authority: canonical architecture sources and [SOURCE_OF_TRUTH.md](SOURCE_OF_TRUTH.md).
