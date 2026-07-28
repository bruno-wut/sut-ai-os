# SUT-AIOS-P1-007-PLAN Planning Evidence

## Outcome

Engineering planning produced one bounded Kill-Switch Controls V1 design and
refined the existing P1-007 backlog packet into an executable static-contract
scope. P1-007 remains in `backlog`. This planning task does not implement the
evaluator, validator, CI step, verifier admission, mutable control state, runtime
service, external integration, or production behavior.

## Finite contract review

The design fixes:

- one runtime-safe module at
  `services/orchestrator/src/kill-switch/evaluator.mjs`;
- one normal public entry point, `evaluateKillSwitch(requestContext)`;
- one private, recursively frozen, committed authority that ordinary callers
  cannot replace or mutate;
- exactly six ordered engaged controls: global autonomous actions, the
  `content-schema-repair-shadow` playbook, its `codex-content-executor`, Codex
  dispatch, pending actions, and outbound notifications;
- exact closed request and decision shapes;
- an invariant `decision: "deny"` for valid, malformed, matched, and unmatched
  requests;
- deterministic reason precedence for internal-authority failure, malformed
  input, global, playbook, executor, and no-match fail-closed outcomes;
- no-throw handling for proxies, throwing getters, cyclic data, boxed values,
  non-string identifiers, extra fields, and other malformed JavaScript values;
- focused authority-replacement, schema/dependency injection, extra-argument,
  prior-decision mutation, exact-reason, and malformed-input regressions; and
- one exact future command:
  `node tests/orchestrator/validate-kill-switch-controls-v1.mjs`.

The no-match result is deliberately a deny, not an authorization signal. The
design grants no caller authority and cannot satisfy policy, approval, workflow,
executor, audit, or verification gates.

## P1-007 packet review

The amended backlog packet:

- narrows product implementation to the exact evaluator, validator, design,
  explicit non-deploying CI step, task-state, and evidence paths;
- replaces the nonexistent `npm run test:kill-switch` command with the exact
  future Node validator command;
- states the exact controls, reasons, precedence, authority isolation, malformed
  input behavior, and focused regression requirements;
- keeps P1-007 in `backlog`, Tier 0/shadow mode, with
  `productionWritePermission: false`;
- retains P1-005 and P1-006 as delivered dependencies; and
- explicitly requires a separate exact-command verifier-admission governance
  task before product independent machine verification.

The packet forbids changes to runtime frameworks, scripts, schemas, policies,
playbooks, packages, product applications, databases, SQL, migrations,
credentials, protected sources, and the immutable compatibility snapshot.

## Changed paths

- `docs/orchestrator/P1-007_KILL_SWITCH_CONTROLS_V1_DESIGN.md`
- `tasks/backlog/SUT-AIOS-P1-007/task.json`
- `tasks/active/SUT-AIOS-P1-007-PLAN/task.json` (to move through governed
  lifecycle tooling at QA handoff)
- `evidence/tasks/SUT-AIOS-P1-007-PLAN/verification.md`

No evaluator, validator, test, script, schema, policy, playbook, CI workflow,
package, service runtime, application, database, external system, canonical
architecture source, compatibility snapshot, or historical evidence was
modified.

## Deterministic checks

| Command | Result |
| --- | --- |
| `node scripts/task/validate --all` | Pass; P1-007 is valid in backlog and P1-007-PLAN is valid in active. |
| `npm run verify:fast` | Pass; task validation, routing validation, worktree self-test, and lifecycle self-test passed. |
| `git diff --check` | Pass; only the repository's line-ending warning was emitted. |
| Changed-path allowlist inspection | Pass; every changed path is inside the active planning packet allowlist. |

The future P1-007 validator and product `verify:task` were not run because this
planning packet does not create the future evaluator, validator, CI step, or
verifier admission. Independent QA must inspect the final planning diff and run
the planning task's separately authorized machine verification.

## Limitations and handoff

- This is implementer evidence, not independent completion authority.
- The implementer does not declare this planning task verified or done.
- P1-007 must remain unactivated until this plan is independently verified and
  its governed delivery is complete.
- The exact product validator command still requires a separate verifier-
  admission packet before P1-007 independent machine verification.
- No separate-identity GitHub approval is claimed; it remains deferred under the
  current single-maintainer model.

## Independent QA review

Independent Sol QA reviewed the complete planning diff against the critical
fail-closed control boundary. The design and amended product packet fix exactly
six ordered engaged controls and their identifiers, actions, target IDs, reason
codes, and precedence: global autonomy, the bounded shadow playbook, its bounded
Codex executor, Codex dispatch, pending actions, and outbound notifications.
Every matched, unmatched, malformed, unreadable, or internally invalid case
remains a newly allocated frozen V1 deny decision; no public input, extra
argument, caller schema, authority, dependency, path, environment value, or
prior-decision mutation can grant authority or produce an allow outcome.

The public boundary explicitly requires no-throw handling for throwing proxies
and getters, cyclic and malformed values, and closed request fields. The private
committed authority is not exported, is independently finite-self-checked, and
cannot import authority from tests, verification scripts, mutable JSON,
environment state, filesystems, networks, clocks, randomness, credentials, or
external services. The static V1 plan adds no evaluator, validator, CI change,
verifier admission, mutable switch state, service, executor, external behavior,
or production capability.

Changed-path inspection is limited to the design, amended P1-007 backlog packet,
planning packet lifecycle record, planning evidence, and the forthcoming
machine-verification record. Packet validation, `npm run verify:fast`, and
`git diff --check` passed before the single governed machine-verification run.
No critical or high defect remains in this bounded planning contract.

## Independent machine verification — stale-base failure retained

The single governed machine-verification run for this QA cycle failed
changed-path inspection and is retained at
`evidence/verification/SUT-AIOS-P1-007-PLAN/verification-20260728104650134.json`.
The verifier compared the task against stale local `main` at `f6c93e4` while
`origin/main` and the task base are `1fa70d7`. It therefore attributed
already-merged GOV-032, GOV-033, GOV-034, P1-006 planning, P1-006 implementation,
and lifecycle-reconciliation files to this planning task. Security-boundary
inspection and all three required tests passed.

This failed evidence is not a semantic defect in the accepted P1-007 plan and is
not a passing verification result. No rerun was performed in this QA cycle. The
local primary-branch reference must be safely fast-forwarded to `origin/main`,
then the unchanged plan may be resubmitted for one fresh independent QA cycle.

## Independent QA review — recovered-base cycle

Fresh independent Sol QA confirmed that `HEAD`, local `main`, and `origin/main`
all resolve to `1fa70d7`. The accepted design and bounded P1-007 packet are
unchanged, and the failed stale-base record above remains retained without
alteration.

The reviewer rechecked the finite deny-only authority, closed request and
decision contracts, exact control identifiers and reason precedence,
malformed-input no-throw boundary, authority-isolation regressions, exact future
validator command, verifier-admission dependency, and the absence of runtime or
external behavior. The changed paths remain limited to the planning design,
P1-007 backlog packet, planning lifecycle record, planning evidence, and machine
verification records. No critical or high defect remains in this bounded plan.

The preflight commands `node scripts/task/validate --all`,
`npm run verify:fast`, and `git diff --check` passed. Exactly one fresh governed
machine-verification run then passed changed-path inspection, security-boundary
inspection, all required tests, and all acceptance criteria. Its evidence is
retained at
`evidence/verification/SUT-AIOS-P1-007-PLAN/verification-20260728104910792.json`.
The result is `verified` and remains `productionEligible: false`.

## Rollback

Revert only the design document, P1-007 backlog-packet amendment, P1-007-PLAN
lifecycle change, and this planning evidence. Preserve completed task records,
historical evidence, canonical architecture, the immutable compatibility
snapshot, and all product/runtime and external systems.
