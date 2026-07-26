# Model Escalation Rules

## Core rule

Escalation can increase reasoning capability; it cannot increase permissions. The same task packet, agent identity, path/command allowlists, sandbox, data classification, approvals, and verification remain in force.

## Mandatory Sol route

Route to Sol before a consequential decision involving:

- architecture or cross-system boundaries;
- security, threat modeling, authentication, or authorization;
- Supabase RLS design or review;
- payments, refunds, reconciliation, credentials, or financial state;
- booking holds, inventory, allocation, or concurrency correctness;
- durable workflow correctness, idempotency, retries, cancellation, or rollback;
- difficult root-cause analysis with conflicting evidence;
- autonomy promotion/demotion for a sensitive playbook;
- final review of Tier 2, security-sensitive, or otherwise high-risk work.

Sol does not replace human specialist review for RLS, payments, security, production release, commercial activation, or Tier 3 work.

## Escalation ladder

| Current route | Escalate when | Next route |
| --- | --- | --- |
| Qwen local | Output may influence a fact, decision, task packet, code, public content, or evidence | Luna for bounded verification, otherwise Terra or Sol |
| Luna | Ambiguity grows, implementation judgment is needed, checks fail, or scope stops being repetitive | Terra |
| Luna | Protected domain, conflicting truth, or high-risk final review appears | Sol |
| Terra | Architecture/security/payment/concurrency/RLS/workflow correctness appears, repeated fixes fail, or rollback is unclear | Sol |
| Sol | Policy, authority, or specialist approval is missing | Stop and hand off to the accountable human/control service |

## Downgrade rules

- A task may move from Sol to Terra or Luna only through a new or revised approved task packet that narrows the work and records why the lower route is sufficient.
- A wrapper invocation cannot downgrade below the task packet route or the agent definition's default model.
- Hosted and Qwen-local routes are not interchangeable. Private/offline tasks must not silently fall back to a hosted model.

## Stop instead of escalate

Stop when the task packet is missing or ambiguous, the agent is not active/allowed, context contains a likely secret, data exceeds the agent permission, required evidence is absent, a model ID/provider is unavailable, a command/path is unapproved, or an approval has expired. Record the blocker; never broaden access to make progress.

## Review independence

The implementer cannot satisfy final review by rerunning itself with Sol. High-risk completion requires a separate QA/assurance run and the human or specialist approvals required by policy.
