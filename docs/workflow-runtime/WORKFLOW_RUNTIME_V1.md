# Workflow runtime V1

`createWorkflowRuntime(ports)` is the bounded Phase 3 workflow application core.
It returns four async use cases: `start(request)`, `advance(workflowId)`,
`cancel(workflowId, reasonCode)`, and `recover(workflowId)`. A start request
contains identity, trigger reference, deadline, and recovery bound only; it
cannot declare that approval is unnecessary. Every use case
returns a closed, deterministic, non-authoritative decision and never throws.

This is a Tier-0/shadow module. Every decision fixes
`productionWritePermission: false` and `authoritative: false`. It does not grant
policy, approval, execution, verification, deployment, database, queue, network,
credential, booking, payment, inventory, or pricing authority.

## Hexagonal boundary

The core imports no provider or infrastructure SDK. Composition supplies these
outbound ports:

| Port | Captured operations | Authority boundary |
| --- | --- | --- |
| `clock` | `now()` | Supplies authoritative epoch time. Callers cannot inject time into a use case. |
| `storage` | `load(id)`, `save(record, expectedRevision)` | Owns durable records and atomic compare-and-save. |
| `quota` | `read(context)` | Supplies AI-workload quota and booking-isolation facts. |
| `provider` | `status(context)`, `analyze(input)`, `propose(input)` | Supplies availability and reference-only intelligence/proposal results. |
| `policy` | `evaluate(input)` | Sole deterministic policy-decision port. |
| `approval` | `read(input)` | Sole approval-decision port. |
| `executor` | `execute(input)` | Receives only a shadow envelope after policy/approval gates. |
| `verification` | `verify(input)`, `observeOutcome(input)` | Supplies independent verification and outcome results. |

The factory validates and captures the exact callables once. Replacing caller
properties afterward does not redefine the trusted composition. Port calls and
outputs are guarded; thrown errors, missing functions, malformed results,
storage conflicts, and unavailable authority fail closed.
Validation snapshots accepted input and adapter-result fields inside exception
boundaries. Hostile proxy traps or property accessors therefore produce
deterministic fail-closed decisions instead of escaping a public use case.

`storage.save` is an optimistic concurrency boundary. It must atomically save
only when the existing revision equals `expectedRevision`, returning exactly
`{ saved, revision, previousRevision }`. A new record uses `null` as its expected
revision. A conflict cannot advance the workflow or invoke the next capability.
Durability, transactions, and physical storage remain adapter responsibilities.

## Finite lifecycle

The ordinary path is:

```text
detected
  -> analysis_pending -> analysis_running
  -> proposal_pending -> proposal_running
  -> policy_pending
  -> awaiting_approval (when required)
  -> ready_to_execute -> executing
  -> verification_pending -> verification_running
  -> outcome_pending -> outcome_monitoring
  -> completed
```

The finite wait states are `provider_wait` and `quota_wait`. Terminal states are
`completed`, `rejected`, `failed`, `cancelled`, `expired`, and `inconclusive`.
Persisted running states prove that an interruption occurred before an adapter
result was durably recorded. Only `recover()` may move those states back to
their immediately preceding pending boundary, within the workflow's bounded
`maxRecoveries` value. The workflow ID is also the shadow executor idempotency
key. A production adapter still requires separately governed, independently
verified idempotent execution semantics.

The trusted clock expires any non-terminal workflow at its committed deadline.
`cancel()` durably stops any non-terminal workflow. Terminal workflows do not
advance or recover.

Workflow history is append-only and bounded to 64 entries with
`revision === history.length - 1`. A one-entry wait or state transition may
append and persist a valid 64th entry from 63. Analysis, proposal, execution,
verification, and outcome stages each require two entries: a running state and
its result state. Those stages reserve both entries before their first save or
capability call, so they may begin at 62 but fail closed at 63. At either
boundary the reason is `WORKFLOW_HISTORY_LIMIT_REACHED`; the runtime does not
save, invoke the stage capability, compact, delete, or rewrite history. A
64-entry record remains valid and loadable, while a record with 65 or more
entries remains invalid. This Tier-0 contract deliberately pauses instead of
silently discarding audit history or stranding an unrecoverable running state.

## Provider and quota behavior

The provider state vocabulary is exactly:

| Provider state | Workflow action |
| --- | --- |
| `available` | Continue only after the quota gate. |
| `busy` | Enter `provider_wait` and request safe requeue. |
| `rate_limited` | Enter `provider_wait` and request safe requeue. |
| `capacity_exhausted` | Enter `provider_wait` and pause. |
| `authentication_required` | Enter `provider_wait` and pause. |
| `temporarily_unavailable` | Enter `provider_wait` and request safe requeue. |
| `disabled` | Enter `provider_wait` and pause. |

Unknown or malformed provider state pauses with `PROVIDER_STATE_INVALID`.
Non-available provider states never call analysis, proposal, policy, approval,
or execution as a side effect. A later `advance()` may resume the exact pending
stage only after quota and provider authorities both report an allowed state.

Quota checks occur before every provider invocation and immediately before the
executor. Only `below_warning`, `warning_50`, and `warning_75` in the
`ai_workload` zone with `bookingIsolated: true` can continue. `warning_90`, hard
limits, unknown/malformed/unavailable metering, and any booking-capacity overlap
enter `quota_wait` and pause before provider or executor invocation. This core
does not reserve, meter, throttle, requeue, notify, or consume booking capacity;
those effects require separately governed adapters.

## Authority isolation

Provider outputs contain only `analysisRef` or `proposalRef`. Extra fields are
rejected, so a provider cannot inject policy or approval state. Policy and
approval each have their own closed result vocabulary and port. The executor is
reachable only after policy `allow`, plus approval `approved` when the policy
authority requires approval. Only the closed policy result supplies
`approvalRequired`; neither the caller nor AI provider may disable that gate.
The executor receives `mode: "shadow"` and
`productionWritePermission: false`. Verification is a separate port and its
result is required before outcome monitoring and completion.

All references are bounded identifiers, not raw evidence, prompts, guest data,
credentials, or provider output. The module creates no database, queue, provider
adapter, work item, audit record, network request, or production effect.

## Rollback and limitations

Rollback is removal/reversion of the Workflow V1 module, validator, and this
documentation. Durable adapter data is not created by this task. The reference
core assumes its future storage adapter implements atomic compare-and-save and
its future executor implements the supplied idempotency key. Live adapter
qualification, queue scheduling, notifications, audit persistence, provider
fallback, production execution, and deployment are explicitly deferred.
