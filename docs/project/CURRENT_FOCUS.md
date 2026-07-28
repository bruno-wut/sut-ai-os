# Current Focus

## Selected next product task

`SUT-AIOS-P1-006` — Define the versioned playbook registry.

- Status: `backlog`
- Current boundary: bounded static registry only; no runtime, scheduler, queue,
  provider, executor, telemetry, network, credential, or production work.
- Dependency status: `SUT-AIOS-P1-004` is done.
- Preparation status: the bounded design is under human review in draft PR #50;
  exact validator admission remains a separate prerequisite.

Do not activate or implement `P1-006` until its design and verifier-admission
dependencies are merged and the canonical packet is genuinely ready.

## Approved parallel roadmap work

`SUT-AIOS-GOV-032` records the future provider-neutral Mac Mini/Pi/Codex
deployment option. It changes only a derived ADR, permanent roadmap memory, and
future backlog packets. It does not redefine or implement `P1-006`.

The first planned runtime is co-located on the 24/7 Mac Mini: Pi orchestration
and durable state → supervised worker → Codex CLI adapter → Codex CLI with
ChatGPT subscription authentication. Pi, worker, and adapter remain logically
separate, and durable state survives service, worker-process, and device
restarts. A distinct future `P4-007` packet owns the bounded Codex repository
`ExecutorAdapter`; Codex has no scheduling, workflow, policy, authorization, or
audit authority.

## Guardrails

- Do not modify `reference/finalized-platform/**` or
  `docs/architecture/source/**`.
- Do not deploy, access production systems, change credentials, or enable
  autonomous operation.
- Keep new provider and worker capabilities Tier 0/shadow.
- Use the active packet, isolated worktree, independent verification, and
  durable evidence workflow.
