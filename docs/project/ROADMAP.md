# Roadmap

## 0. Workspace and governance foundation — complete

The governed workspace, permanent memory, task/evidence workflow, immutable compatibility boundary, risk register, non-deploying validation practice, GitHub workflow, and technical baseline gate are established on `main`. Production writes and autonomous operation remain disabled.

## 0A. Existing platform stabilization — complete

The baseline gate, dependency/security remediation plan, and compatibility
contracts are done. The finalized-platform snapshot remains immutable.

## 1. Trusted control foundation — current

Define event, task, analysis, proposal, approval, and result schemas; create deterministic path/command/data policies; establish audit conventions, correlation IDs, task packets, and observe-only defaults.

`SUT-AIOS-P1-001` through `SUT-AIOS-P1-005` are done. `SUT-AIOS-P1-006`
remains the next product task and is still backlog while its bounded
static-registry design and exact validator admission are reviewed. The Mac
Mini/Pi roadmap does not alter its scope or acceptance criteria.

## First-class provider-neutral runtime option

Future Phase 2–5 work must support the derived deployment decision in
`docs/decisions/ADR-0001-MAC-MINI-PI-CODEX-RUNTIME.md`:

```text
scheduled checks or normalized events
  → deterministic analysis
  → 24/7 Mac Mini host running Pi durable scheduling and queue
  → supervised worker and Codex CLI adapter
  → Codex CLI with ChatGPT subscription authentication
  → structured intelligence and intervention proposal
  → deterministic policy, risk, and approval controls
  → bounded executor
  → independent verification
  → audit evidence and outcome
```

Pi, its durable state, the worker, and the adapter are initially co-located on
the Mac Mini but remain logically separate. Durable queue/workflow state survives
Pi-service, worker-process, and device restarts and is never Codex ephemeral
state. The interfaces are `IntelligenceProvider`, `ProposalGenerator`,
`ExecutorAdapter`, and `VerificationProvider`. Codex is replaceable and is never
the workflow engine, scheduler, policy engine, authorization authority, or audit
source of truth. OpenAI API, local-model, and other approved adapters remain
future options.

## 2. Intelligence and reporting

Add prepared metrics, read-only data interfaces, a provider-neutral structured
intelligence contract, an explicit intervention-proposal contract, initial
insight/report workflows, and Staff OS integration designs. Intelligence must
explain likely causes, rank hypotheses, select an intervention, estimate
confidence, and return schema-valid output. A proposal records evidence,
capabilities, risk, approval, verification, rollback, and expected outcome, but
cannot authorize itself. No autonomous production changes.

## 3. Durable orchestration

Introduce event ingestion, durable scheduling, queue consumption, retries,
requeue, dead-letter handling, provider waits, approval waits, timeouts,
cancellation, recovery, and outcome tracking after the control foundation is
verified. Provider states `available`, `busy`, `rate_limited`,
`capacity_exhausted`, `authentication_required`, `temporarily_unavailable`, and
`disabled` must fail closed and preserve the reason.

## 4. Provider-neutral bounded execution

Add the provider-neutral invocation gateway, the first Pi-to-Codex CLI
subscription adapter, the supervised Mac Mini worker, a distinct Codex
repository `ExecutorAdapter`, provider-neutral executor dispatch, isolated task
workspaces, concurrency limits, task timeouts, structured results, and
pull-request-only delivery. The Codex repository adapter is limited to analysis,
bounded code/content changes, tests, branch/pull-request preparation, and repair
preparation. Specialized deterministic adapters
handle GitHub, Cloudflare, CMS, notifications, and approved service APIs when AI
reasoning is unnecessary. Start in Tier 0/shadow with low-risk, reversible
playbooks.

## 5. Independent assurance and portability

Add provider-neutral independent verification, preview and evidence capture,
audit attribution for model, sanitized prompt or classified prompt artifact
reference, prompt/playbook integrity reference, task, commands, provider states,
and outcomes, rollback eligibility, and qualification of future API/local/other
fallback providers. A fallback is disabled unless separately configured,
policy-compatible, and independently qualified.

## 6. SEO growth automation

Deliver prepared Search Console evidence, deterministic opportunity scoring,
observe-only views, and the first content-repair vertical slice through the same
provider-neutral intelligence, proposal, executor, verification, and audit
boundaries. Codex may prepare bounded repository changes and pull requests; it
cannot publish or deploy during Tier 0/shadow operation.

## 7. Human-gated commercial intelligence

Use structured intelligence and proposals for commercial recommendations. The AI
never authorizes its own proposal. Authenticated human approval and deterministic
policy remain mandatory, and specialized deterministic executors handle approved
service operations where model reasoning is unnecessary.

## 8. Proven autonomous operations

Promote only playbooks with verified safety, low rollback rates, reliable
evidence, and measurable benefit. Provider replacement or fallback qualification
does not promote autonomy. Higher-risk commercial, payment, inventory, guest
data, and production actions remain human-gated or prohibited.

The phase order is intentional; do not skip governance to build autonomous features first.
