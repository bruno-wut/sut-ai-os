# GOV-043 implementation handoff

## Scope performed

Created derived ADR-0002 and corrected only derived/permanent planning records.
Added bounded backlog packets P2-005/006/007, P3-004, and P5-005/006; revised
affected future packet dependencies; added portability QA rejection gates. No
runtime, provider, account, credential, database, queue, deployment, production
operation, canonical architecture source, or terminal record was touched.

## Required deterministic checks

- `node scripts/task/validate --all` — passed before review handoff.
- `node scripts/github/validate-governance.mjs` — passed before review handoff.
- `npm run verify:fast` — passed before review handoff.
- `git diff --check` — passed before review handoff (line-ending warnings only).

## Handoff

Independent Sol QA must inspect ADR accuracy, bounded scope, task packet
completeness, acyclic dependencies, factual Phase 1–2 state, and the explicit
rejection gates in `docs/verification/INFRASTRUCTURE_PORTABILITY_ASSURANCE.md`.
No claim of infrastructure implementation or provider selection is permitted.

## Revision after independent Sol QA

The five review findings were corrected without changing runtime scope or
terminal history:

- Cross-account planning now requires authenticated audience-bound short-lived
  HTTPS credentials, timestamp/nonce replay rejection, idempotency, bounded
  request/response bodies and timeouts, and per-authenticated-caller/per-route
  limits.
- `P3-005` is now a bounded Phase 3 fixture/reference-only retention lifecycle
  composition task. It may calculate scheduled delete, aggregate, archive, and
  future transfer eligibility, but cannot delete, archive, transfer, provision,
  or write local storage.
- `P2-007` and `P5-006` explicitly fail closed for missing, unavailable, stale,
  inconsistent, or uncertain metering, not merely unknown configuration.
- ADR-0001 is correctly marked accepted active derived planning following
  GOV-032; it still authorizes no deployment.
- Current-state and risk records explicitly conclude that no P2-001/R02 or
  P2-002 remediation is required, because this forward-looking ADR introduces
  no defect in their accepted bounded contracts or final-head assurance.

Re-run the packet checks and independent Sol review on this revised head. No
runtime, provider configuration, external account, database, deletion,
transfer, credential, or production action occurred.

## Revision after external architecture review

- Every GOV-043-created or revised future packet now explicitly allows its own
  `evidence/verification/<task-id>/**` machine-verification directory alongside
  task evidence; terminal packets remain untouched.
- `IMPLEMENTATION_BACKLOG.md` again lists the complete Phase 0–8 product-task
  inventory with status, retained/new designation, outcome, and canonical
  dependencies. The ADR-0002 architecture decisions are unchanged.

Re-run packet validation, governance validation, fast verification, diff checks,
and independent Sol review before returning this draft PR for approval.

## Fresh independent Sol review of external-review remediation

- The exact task-specific `evidence/verification/<task-id>/**` allowlist is
  present in all 16 GOV-043-created or revised future packets, with no broad
  machine-evidence exception.
- The restored backlog lists all 48 canonical Phase 0–8 product and remediation
  task IDs exactly once, including status/outcome and retained/new designation.
- Revision remains required because five dependency cells omit canonical packet
  dependencies: `P1-005` omits `GOV-024`/`GOV-025`; `P1-005-R01` omits
  `P1-004`/`GOV-031`; `P1-008` omits `GOV-036`/`GOV-037`; `P2-001` omits
  `GOV-038`; and `P2-002` omits `P2-001-R02`/`GOV-040`/`GOV-042`.

No `verify:task` cycle was run because the exhaustive canonical inventory did
not yet expose the exact dependency chain. ADR-0002 remains unchanged.

## Final independent Sol review after inventory correction

- The exhaustive backlog now maps all 50 canonical Phase 0–8 product,
  planning, and remediation packets to exactly one row. No packet is missing,
  duplicated, or represented by an extra row.
- Every backlog dependency cell exactly equals its canonical packet dependency
  list, including `P1-006-PLAN` and `P1-007-PLAN`.
- All 16 GOV-043-created or revised future packets allow only their exact
  task-specific `evidence/verification/<task-id>/**` machine-evidence path in
  addition to task evidence.
- The external-review remediation changes only the exhaustive backlog,
  task-specific evidence allowlists, GOV-043 evidence, and GOV-043 lifecycle
  state. ADR-0002 and architecture policy are unchanged.
- The complete GOV-043 scope still satisfies the trust-zone, provider-neutral
  port, minimisation/retention, deterministic budget, bounded workload,
  portability, booking-isolation, and fail-closed QA acceptance criteria. No
  infrastructure or production capability was introduced.

The packet-validation, governance-validation, fast-verification, and diff
checks passed on this final review state. One fresh `verify:task` cycle against
`origin/main` is required before the task returns to `verified`.

## Failed final machine-verification cycle

The fresh `verify:task` cycle produced
`evidence/verification/SUT-AIOS-GOV-043/verification-20260729133453203.json`
with `status: fail`. All required tests passed, but changed-path inspection
correctly rejected the deletion of the task's earlier
`tasks/verified/SUT-AIOS-GOV-043/task.json`: the packet's broad
`tasks/verified/**` prohibition overrides its own task-specific lifecycle path
allowance during revision. No acceptance or architecture defect was found.

An executor must remove that redundant broad prohibition while retaining the
task-specific allowlist (which already excludes every unrelated terminal
packet), then return the packet through review for a fresh independent cycle.
