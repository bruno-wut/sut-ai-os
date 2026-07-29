# First Vertical Slice — Content Schema Repair

The first full execution slice is `SUT-AIOS-P6-004`. It proves the operating loop with a narrow, reversible, non-production content repair:

```text
schema failure → normalized event → policy check → playbook selection
→ durable queue and workflow → provider-neutral gateway
→ co-located supervised worker → Codex repository ExecutorAdapter
→ independent verification
→ preview evidence → recorded outcome
```

## Required foundations

- P0-001: deterministic technical baseline.
- P1-004: explicit repository, command, data, and autonomy policies.
- P1-006: versioned content-schema-repair playbook in shadow mode.
- P1-007: executor/playbook/global kill switches independent of AI.
- P2-005 through P2-007: trust-zone/port, minimisation/retention, and
  resource-budget authorities.
- P3-004: provider-neutral persistence composition.
- P4-003: isolated executor execution, structured result, branch and PR flow.
- P5-002: independent QA, preview, and durable audit evidence capture.

Their transitive dependencies include the normalized event contract,
control-plane schema, audit records, policy evaluator, structured intelligence
and proposal contracts, durable queue/workflow, provider-neutral gateway,
Pi-to-Codex subscription adapter, co-located supervised Mac Mini worker, Codex
repository ExecutorAdapter, GitHub App, and provider-neutral executor dispatch.

## Slice boundaries

The trigger uses a sanitized fixture or approved non-production content-schema failure. The executor may change only allowlisted content and test paths. It may not edit payments, inventory, RLS, migrations, credentials, authorization policy, the finalized platform snapshot, or production state.

## Acceptance

- The same event/deduplication key cannot start duplicate repairs.
- Policy mechanically rejects paths and commands outside the packet.
- Kill switches stop dispatch before repository mutation.
- The provider gateway and worker fail closed for every non-available provider
  state; the task is paused or requeued with evidence and no production action.
- Codex produces a bounded diff and structured implementation result from an
  isolated workspace with external concurrency and timeout controls.
- Independent QA validates schema, content checks, build/preview where available, changed paths, and secret boundaries.
- Failed verification prevents merge eligibility and records revision or rollback evidence.
- The slice uses aggregate/sanitized evidence only, bounded workloads, and
  distinct booking versus Staff/AI capacity and failure boundaries.
- Success remains Tier 0/shadow evidence; it does not automatically promote autonomy or deploy production.

The slice is complete only when implementation, deterministic checks, independent review, and recorded evidence all pass.
