# Current Focus

## Current planning gate

`SUT-AIOS-GOV-044` prepares the finite P2-004 intervention-proposal V1 design
and executable-ready packet only. It creates no proposal schema, runtime
module, validator, generator, provider, workflow, persistence, policy,
approval, executor, deployment, credential, or production behavior.

## Next valid product dependency

`SUT-AIOS-GOV-045` is the next bounded governance dependency after GOV-044; it
admits only the exact shell-free P2-004 validator command. Once GOV-044 and
GOV-045 are done, `SUT-AIOS-P2-004` is the next existing product dependency.
`P2-005`, `P2-006`, and `P2-007` remain static infrastructure authorities that
must be completed before any Phase 3 runtime implementation.

## Guardrails

- Do not modify `reference/finalized-platform/**` or `docs/architecture/source/**`.
- Do not deploy, access production systems, change credentials, or enable
  autonomous operation.
- Keep all provider/worker capabilities Tier 0/shadow.
- Treat every proposal as non-authoritative advice; no proposal may claim
  approval, authorization, execution, verification, or production eligibility.
- Guest/public, Staff/control, and AI/workload boundaries must remain separate.
- Use the active packet, isolated worktree, independent verification, and
  durable evidence workflow.
