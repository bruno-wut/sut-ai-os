# Agent Handoffs

Handoffs are typed workflow transitions. Agents cannot invent recipients, share ambient context, or pass credentials. The workflow service validates the sender, recipient, schemas, policy state, and data classification.

## Required envelope

Every handoff contains:

- `handoff_id`, `workflow_id`, `run_id`, `correlation_id`, and timestamps
- sender/recipient agent IDs and versions
- input/output schema URNs and payload hash
- objective, current state, environment, risk class, and data classification
- evidence references and authoritative-source references
- allowed/forbidden paths and commands where execution is proposed
- confidence, limitations, unresolved risks, and stop/escalation reason
- policy/approval references when applicable
- required next checks, evidence destination, and expiry/idempotency key

Payloads contain references to durable evidence rather than copied secrets, raw PII, or oversized logs.

## Allowed transitions

| From | To | Required condition |
| --- | --- | --- |
| `chief-orchestrator` | Intelligence specialist | Registry-active recipient, bounded question, masked evidence |
| Data/SEO/incident specialist | `chief-orchestrator` | Schema-valid finding with evidence, confidence, and limitations |
| `seo-strategist` | `content-brand` | Content agent active, approved facts, clear editorial brief |
| Specialist or Chief | `engineering-planner` | Verified diagnosis/brief and implementation objective |
| `engineering-planner` | Deterministic policy engine | Complete task envelope; never directly to executor |
| Deterministic policy engine | Matching Codex executor | Approved immutable envelope and scoped runtime identity |
| Codex executor | `qa-verification` | Result schema, diff/revision, commands/checks, evidence |
| `qa-verification` | Originating executor | Revision-required status with exact failed criteria |
| `qa-verification` | `release-deployment` | Independent pass, release in scope, release agent active |
| `release-deployment` | `outcome-learning` | Deployment/rollback result and measurement plan |
| Any completed/blocked workflow | `executive-briefing` | Verified management-safe summary and delivery authorization |
| `outcome-learning` | Chief and governance review | Outcome classification and evidence; autonomy change remains a proposal |
| Optional agent | Chief/policy/approval route | Agent active and optional workflow explicitly enabled |

## Rejected handoffs

Reject a handoff when the recipient is staged/inactive, schemas or hashes fail, scope expands, data exceeds recipient permission, policy/approval is missing or expired, sender and reviewer are not independent, evidence is unmasked, or Tier 3 execution is requested.

## Failure behavior

Record the rejection, preserve the original payload hash, return a structured reason to the workflow, and route security/payment/concurrency/RLS or repeated failures to Sol plus the responsible human specialist. Never silently retry with broader permissions.
