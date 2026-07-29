# ADR-0001: Provider-neutral Mac Mini, Pi, and Codex runtime

- **Status:** Accepted active derived planning decision; it creates no deployment or runtime capability. ADR-0002 adds the governing trust-zone, portability, minimisation, and resource constraints.
- **Date:** 2026-07-28
- **Decision owner:** Sri U-Thong Grand Hotel
- **Derived from:** `docs/architecture/source/Sri U-Thong Grand Hotel AI OS.md` and `docs/architecture/source/Agent Architecture.md`

## Context

The canonical architecture separates deterministic measurement, AI intelligence,
authorization, durable workflow, bounded execution, independent verification,
and audit. It also requires provider independence and states that AI output is
not authoritative.

Sri U-Thong Grand Hotel intends to operate a continuously available Mac Mini as
the first AI runtime host. In the initial deployment, the Pi orchestration
service, its durable queue/workflow state, the supervised worker, and the Codex
CLI adapter run locally on that same host while remaining separate logical
components. Pi owns durable scheduling and dispatches bounded intelligence or
execution work to the worker. The first supported provider path is:

```text
24/7 Mac Mini host
  -> Pi orchestration service and durable queue/workflow state
  -> supervised worker
  -> Codex CLI adapter
  -> Codex CLI with ChatGPT subscription authentication
```

This is a deployment choice, not a change to the immutable architecture sources.
It does not select a Cloudflare account, public domain, persistence provider, or
production deployment. Guest/public traffic and future Staff/AI workloads retain
separate trust, quota, credential, deployment, and failure boundaries under
ADR-0002.

## Decision

The runtime will use four provider-neutral boundaries:

- `IntelligenceProvider` accepts a schema-valid intelligence request and returns
  a schema-valid analysis response or a provider-state result.
- `ProposalGenerator` converts grounded analysis into a schema-valid intervention
  proposal. It has no authorization authority.
- `ExecutorAdapter` executes only a separately approved, bounded task through the
  appropriate implementation. Codex is one replaceable repository executor;
  deterministic adapters handle GitHub, Cloudflare, CMS, notifications, and
  approved service APIs when model reasoning is unnecessary.
- `VerificationProvider` independently evaluates the result and produces
  evidence. It must be operationally and logically separate from the executor
  being verified.

The first implementation will be the local Pi-to-Codex CLI adapter on the Mac
Mini using ChatGPT subscription authentication. A distinct Codex repository
`ExecutorAdapter` performs approved repository analysis and change preparation;
the provider adapter itself does not become an executor authority. The same
boundaries must later permit
separately approved OpenAI API, local-model, or other-provider adapters without
changing workflow, policy, authorization, or audit authority.

Codex is a replaceable provider and worker. It is not:

- the workflow engine;
- the scheduler or durable queue;
- the policy engine;
- the authorization or approval authority;
- the audit source of truth.

## Governed operating flow

```text
scheduled check or normalized event
  -> deterministic analysis
  -> durable workflow and queue
  -> IntelligenceProvider
  -> structured analysis
  -> ProposalGenerator
  -> deterministic policy, risk, and approval evaluation
  -> approved ExecutorAdapter
  -> independent VerificationProvider
  -> durable audit evidence and outcome
```

The intelligence response must be able to explain likely causes, rank
hypotheses, select an intervention, estimate confidence, and cite prepared
evidence. The intervention proposal must contain:

- diagnosis;
- evidence references;
- confidence;
- recommended action;
- alternatives;
- affected systems;
- requested capabilities;
- risk classification;
- approval requirement;
- verification plan;
- rollback plan;
- expected outcome.

The model may investigate, explain, recommend, draft, prepare changes, and open
an authorized branch or pull request. It may never approve or authorize its own
proposal.

## Provider states and fail-closed behavior

Every adapter must return exactly one of these provider availability states:

| State | Required orchestration behavior |
| --- | --- |
| `available` | Dispatch only within policy, workspace, concurrency, and timeout limits. |
| `busy` | Do not start another provider job; pause or safely requeue it. |
| `rate_limited` | Record the provider signal and safely requeue after the configured delay. |
| `capacity_exhausted` | Pause or requeue, record the limit, and notify staff when appropriate. |
| `authentication_required` | Stop dispatch, record the authentication fault without credentials, and notify an authorized maintainer. |
| `temporarily_unavailable` | Pause or safely requeue with bounded retry behavior. |
| `disabled` | Do not dispatch; retain the task and reason for operator action. |

All non-`available` states fail closed. They cannot bypass policy, authorize a
task, trigger production changes, or silently discard work. A fallback provider
may be selected only when it is explicitly configured, independently qualified,
permitted for the task's data and capabilities, and evaluated through the same
policy and audit controls. No fallback is enabled by this decision.

## Co-located Mac Mini runtime boundary

The Pi logical service, not the worker or Codex, owns durable scheduling, queue
state, retry state, dead-letter handling, cancellation, and recovery. Initially
all of these components are co-located on the Mac Mini. Pi's queue and workflow
records use durable storage and recovery so they survive Pi-service,
worker-process, and device restarts; they are never Codex process or workspace
state. The worker must:

- consume only bounded task envelopes;
- create one isolated workspace per task;
- enforce concurrency limits and task timeouts outside the model;
- supervise the worker process and recover safely after reboot;
- preserve durable task state outside ephemeral processes;
- clean workspaces only after evidence and recovery requirements are satisfied;
- return structured results and provider states;
- avoid production execution during Tier 0/shadow operation.

Subscription authentication health is a worker capability signal, never a
repository credential. Tokens and session material must not enter task packets,
prompts, logs, evidence, or Git.

## Audit and privacy

The audit trail must correlate the task, provider, model, provider state,
sanitized prompt or classified prompt artifact reference, prompt/playbook
version or integrity reference, requested capabilities, commands, changed
artifacts, policy and approval decisions, verification, and outcome. Raw prompts
or outputs containing sensitive data must not be copied into ordinary repository
evidence; classified storage and retention rules must be defined before such
data is collected.

## Initial safety posture

All new provider, proposal, worker, and executor playbooks begin at Tier 0/shadow
mode. Production-impacting actions remain approval-gated until the existing
autonomy-promotion process explicitly permits a narrower tier. The governing
principle remains:

> AI may investigate broadly, but it may act only narrowly.

## Consequences

- Phase 2 separates structured intelligence from intervention proposals.
- Phase 3 gains explicit scheduling, requeue, dead-letter, provider-wait,
  timeout, cancellation, and recovery states.
- Phase 4 separates the provider-neutral gateway, Codex subscription adapter,
  co-located Mac Mini worker, Codex repository ExecutorAdapter, and executor
  dispatch.
- Phase 5 makes verification provider-neutral, expands audit attribution, and
  qualifies future fallback providers.
- The Mac Mini is the initial co-located runtime host and potential single point
  of failure. Logical ownership remains separated, and durable state is not
  delegated to Codex.

## Non-goals

This decision does not implement a provider, worker, scheduler, queue, executor,
authentication flow, fallback, deployment, or production integration. It does
not authorize production writes, store credentials, alter the canonical
architecture sources, or redefine completed task acceptance criteria.

## Assumptions and unresolved questions

- “Pi” means the logical orchestration platform. It initially runs locally on
  the 24/7 Mac Mini host; it does not imply separate Raspberry Pi hardware.
- ChatGPT subscription authentication and usage signals may not expose stable
  machine-readable health or capacity semantics; the adapter must map observed
  conditions conservatively and fail closed.
- Subscription terms, unattended-session persistence, reauthentication, device
  sleep, reboot, network loss, workspace cleanup, concurrency, audit privacy, and
  Mac Mini single-point-of-failure behavior require bounded design and
  verification in their future packets.
