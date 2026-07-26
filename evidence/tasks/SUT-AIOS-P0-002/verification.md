# SUT-AIOS-P0-002 — Dependency and Security Remediation Planning Evidence

## Scope and boundary

- Worktree: `C:/Users/Bruno Browny/.codex/worktrees/49fa/SUT_AI_OS-worktrees/SUT-AIOS-P0-002`
- Branch: `task/SUT-AIOS-P0-002-plan-dependency-and-security-remediation`
- Risk and autonomy: high risk, Tier 0, plan and evidence only
- Baseline inspected read-only: `reference/finalized-platform/` at source commit `dbce321f61144b50a94bd11a068fa5897b0f2293`
- Production writes, deployments, staging actions, dependency installation, database access, payment actions, booking or inventory changes, migration or RLS changes, and credential access: not performed
- `reference/finalized-platform/**` and `docs/architecture/source/**`: not modified

The canonical task packet's `status` and `stateTransitions` array are authoritative for lifecycle history. This evidence summarizes implementation and check results; it does not attempt to enumerate the final lifecycle or assert the absence of transitions after an executor handoff.

## Implementation record

- Added `docs/platform-stabilization/dependency-security-remediation-plan.json`, the proposed machine-readable remediation plan.
- Added `docs/platform-stabilization/dependency-security-remediation-plan.schema.json`, its JSON Schema contract.
- Added `docs/platform-stabilization/DEPENDENCY_SECURITY_REMEDIATION_PLAN.md`, the human-readable boundary, ordering, gates, risk-acceptance rules, and rollback explanation.
- Added `tests/platform-stabilization/validate-dependency-security-remediation-plan.mjs`, a schema-driven deterministic contract validator. The amended packet now explicitly authorizes its command.

The plan requires future approved upstream tasks. It does not treat the immutable compatibility snapshot as an implementation target, does not claim that any advisory is remediated, prohibits blind `npm audit fix --force` use, and keeps release or live-system actions behind separate approval.

## Audit observations

All audit commands used the packet's exact `npm audit --omit=dev` form. Audit registry results are time-sensitive and must be refreshed at implementation time.

| Working directory | Exit | Result |
| --- | ---: | --- |
| Governed AI OS worktree root | 0 | Pass: 0 vulnerabilities |
| Read-only compatibility root | 1 | Expected finding state: 6 high-severity production-dependency vulnerabilities |
| Read-only compatibility Astro storefront | 1 | Expected finding state: 7 production-dependency vulnerabilities (6 high, 1 low) |

The compatibility-root findings cover `brace-expansion`, `next`, `postcss`, and `sharp` dependency paths. The storefront findings cover `astro`, `esbuild`, `fast-uri`, `js-yaml`, `postcss`, `sharp`, and `svgo`. Advisory identifiers, observed versions, affected chains, and future remediation requirements are recorded in the machine-readable plan.

The nonzero compatibility audits are the subject of this planning task, not failed workspace remediation. No fix command was run and no lockfile or manifest under the snapshot changed.

## Allowed command results

- `npm audit --omit=dev` from the governed worktree root: pass, exit 0, 0 vulnerabilities.
- `npm audit --omit=dev` from the read-only compatibility root: exit 1 with 6 high findings; captured as planning evidence.
- `npm audit --omit=dev` from the read-only Astro storefront: exit 1 with 6 high and 1 low finding; captured as planning evidence.
- `npm run verify:fast`: pass. Task packets, routing controls, worktree fixture, and task lifecycle fixture passed.
- First authorized `node tests/platform-stabilization/validate-dependency-security-remediation-plan.mjs` remediation run: fail, exit 1. Its fail-closed vocabulary inspection identified the omitted `boolean` type implementation at `#/$defs/finding/properties/direct/type`; boolean support was then added.
- Final `node tests/platform-stabilization/validate-dependency-security-remediation-plan.mjs`: pass, exit 0. The instance conforms to the schema using the exact supported keyword vocabulary reported by the validator; focused audit-count, result/exit, uniqueness, ordering, and future-command policy assertions also pass.
- `node scripts/verify/changed`: pass, exit 0. Seven changed paths were reported, all within packet `allowedPaths`; `forbidden` and `outside` were empty.
- `node scripts/verify/security-boundaries`: pass, exit 0. No configured secret patterns were detected in changed readable files.
- `git diff --check`: pass.

## QA remediation and remaining limitations

The owner- and planner-authorized packet amendment added the validator, changed-path, and security-boundary commands without changing `requiredTests`, `requiredChecks`, scope, or risk. All three newly authorized commands now pass on the final remediation state.

The validator is driven by `dependency-security-remediation-plan.schema.json`: it resolves the schema's local JSON Pointer references and evaluates every keyword used by this contract. It first inventories the schema vocabulary and fails closed if a future schema revision introduces an unsupported keyword or type. It intentionally does not claim to be a general-purpose JSON Schema implementation or to support vocabulary beyond the schema currently used. Cross-field and policy assertions remain separate because those relationships are not expressed by the schema.

The initial failed validator run is retained above as evidence. No unresolved implementation check is being converted into a pass, but independent verification is still required before any verified or done state. `docs/project/ISSUES_AND_RISKS.md` remains outside this packet's allowed paths, so the executor did not edit the risk register; the planner or independent reviewer must record any durable residual risk there through an authorized workflow.

## Review readiness and unresolved risk

- Status: implementation evidence is prepared for independent review. The canonical task packet governs lifecycle state, and this evidence does not assert the absence of transitions after an executor handoff.
- Independent reviewer: `qa-verification`.
- Reviewer must inspect the schema, plan, Markdown mapping, advisory evidence, changed paths, secret boundaries, and protected-path compliance.
- Reviewer must independently rerun the authorized validator and required checks; the executor's passing runs are implementation evidence, not independent completion authority.
- The compatibility applications retain all observed dependency findings until separate approved upstream remediation tasks implement and verify fixes.
- Audit output can change as registry advisories change; refreshed evidence governs future version selection.

## Rollback

Revert the planning branch and generated planning/test artifacts while preserving this audit and future independent-review evidence. Do not manually reverse the task lifecycle record outside the repository's approved task workflow. Any future dependency remediation must revert its upstream manifest and lockfile atomically and must not mutate this compatibility snapshot.

## Independent QA verification — 2026-07-26

- Verifier agent: `qa-verification`
- Verifier model: `gpt-5.6-sol`
- Result: **blocked**
- Production eligible: `false`

### Independently confirmed

- Changed-path inspection found only the task packet move and new files under `docs/platform-stabilization/**`, `tests/platform-stabilization/**`, and `evidence/tasks/SUT-AIOS-P0-002/**`. These paths are allowed by the packet. No diff was found under `reference/finalized-platform/**` or `docs/architecture/source/**`.
- `npm audit --omit=dev` at the governed worktree root exited `0` with zero vulnerabilities.
- `npm audit --omit=dev` at the read-only compatibility root exited `1` with six high-severity vulnerabilities covering `brace-expansion`, `next`, `postcss`, and `sharp`.
- `npm audit --omit=dev` at the read-only Astro storefront exited `1` with seven vulnerabilities: six high and one low, covering `astro`, `esbuild`, `fast-uri`, `js-yaml`, `postcss`, `sharp`, and `svgo`.
- The audited installed versions recorded in the plan match the two compatibility lockfiles. The plan, schema, and Markdown description consistently keep remediation in future approved upstream worktrees and authorize no deployment or protected-domain action.
- `npm run verify:fast` exited `0`; all four governance fixtures passed.
- `git diff --check` exited `0`.

### Blocking findings

1. The required `platform-stabilization contract validation` was not executed. The only supplied command, `node tests/platform-stabilization/validate-dependency-security-remediation-plan.mjs`, is absent from `allowedCommands`; this reviewer did not bypass the Tier 0 allowlist. Under `docs/verification/VERIFICATION_POLICY.md`, an unavailable required command is `blocked`, not a pass.
2. The required deterministic secret scan was not executed because neither `npm run verify:security-boundaries` nor its direct script form is authorized. Read-only semantic inspection found no apparent secret value in the changed artifacts, but that does not replace the required deterministic scan.
3. The supplied validator is not a full JSON Schema validator. It parses both JSON files and performs selected assertions, but never evaluates the plan against `dependency-security-remediation-plan.schema.json`; therefore unknown properties and other schema-only violations can pass. Even after its command is authorized, its current success output would prove only those selected assertions, not contract conformance.
4. The implementation evidence is stale at lines describing lifecycle state: it says the executor did not transition beyond `active` and that the work was not ready for a task-state transition, while the current packet records an executor transition from `active` to `review`. The audit trail itself is present, but the narrative must be corrected before completion evidence is relied upon.

### Required remediation before re-review

1. Have the engineering planner approve a packet revision that explicitly authorizes the validator command and deterministic changed-path and secret-boundary commands (for example, `node tests/platform-stabilization/validate-dependency-security-remediation-plan.mjs`, `npm run verify:changed`, and `npm run verify:security-boundaries`) and maps them to the required checks/tests. Do not let the implementer self-expand the allowlist.
2. Make the contract validator actually validate the plan against the JSON Schema, then retain the focused semantic assertions for cross-field and policy behavior that JSON Schema does not express.
3. Correct the stale lifecycle statements in this evidence without erasing the original transition history.
4. Rerun every newly authorized required command and independent verification. Any nonzero required check remains fail/blocked as defined by policy; do not transition this task to `done` until all required checks have durable independent evidence.

## Independent QA re-verification — 2026-07-26

- Verifier agent: `qa-verification`
- Verifier model: `gpt-5.6-sol`
- Result: **revision-required**
- Production eligible: `false`

### Independent command results

- `npm audit --omit=dev` at the governed worktree root: pass, exit `0`, zero vulnerabilities.
- `npm audit --omit=dev` at the read-only compatibility root: expected planning finding state, exit `1`, six high-severity vulnerabilities. Package/advisory coverage matches the plan.
- `npm audit --omit=dev` at the read-only Astro storefront: expected planning finding state, exit `1`, six high- and one low-severity vulnerabilities. Package/advisory coverage matches the plan.
- `npm run verify:fast`: pass, exit `0`; packet validation, routing checks, worktree fixture, and lifecycle fixture all passed.
- `node tests/platform-stabilization/validate-dependency-security-remediation-plan.mjs`: pass, exit `0`.
- `node scripts/verify/changed`: pass, exit `0`; seven changed paths, all allowed, with empty `forbidden` and `outside` sets.
- `node scripts/verify/security-boundaries`: pass, exit `0`; no configured secret patterns detected.
- `git diff --check`: pass, exit `0`.

### Schema-validator assessment

The validator now performs schema-driven validation and fails closed when the contract introduces an unsupported keyword, type, reference form, or format. Every keyword currently used by the schema is accounted for:

- Vocabulary/annotations: `$schema`, `$id`, `title`, and `$defs` are admitted during vocabulary inspection; `$defs` is traversed.
- Composition/reference: local JSON Pointer `$ref` values are syntax-checked, resolved, and evaluated; sibling constraints continue to apply.
- Scalar constraints: `type`, `const`, `enum`, `minLength`, `pattern`, `format: date`, and `minimum` are evaluated. All types used by this schema (`array`, `boolean`, `integer`, `object`, and `string`) are supported.
- Object constraints: `properties`, `required`, and both boolean/schema forms of `additionalProperties` are evaluated recursively.
- Array constraints: `items`, `minItems`, `uniqueItems`, and `contains` are evaluated recursively.

The current plan conforms to the schema. Focused assertions separately verify audit-count arithmetic, result/exit consistency, finding-package uniqueness, exact audit-target identities and counts, remediation-wave ordering, and future-command policy. The validator appropriately limits its claim to the exact vocabulary used by this contract rather than claiming general JSON Schema 2020-12 support.

### Scope and semantics

- The final changed-path set remains within `docs/platform-stabilization/**`, `tests/platform-stabilization/**`, `evidence/tasks/SUT-AIOS-P0-002/**`, and `tasks/**/SUT-AIOS-P0-002/**`.
- No path under `reference/finalized-platform/**`, `docs/architecture/source/**`, migrations, payments, inventory, environment files, secret paths, or credential paths changed.
- The plan, schema, and Markdown mapping consistently describe a proposed plan only. They preserve the immutable snapshot, defer dependency edits to separately approved upstream worktrees, prohibit blind force fixes, define deterministic fail/blocked/escalation behavior, retain independent approval, and authorize no deployment or protected-domain action.
- The audit counts, package names, advisory identifiers, and installed-version claims remain consistent with fresh audit output and the compatibility lockfiles.

### Required correction

At this QA snapshot, the evidence lifecycle narrative was inaccurate because it attempted to summarize transitions and asserted that no additional executor transition would occur. The durable correction is to identify the canonical task packet's `status` and `stateTransitions` array as authoritative without enumerating a final lifecycle. No implementation, schema, plan, audit, scope, secret-boundary, or command-check correction was otherwise required.

After that evidence-only correction, independent QA must confirm the corrected narrative and rerun at least changed-path inspection, secret-boundary inspection, and `git diff --check` before recording a pass suitable for lifecycle verification.

## Executor evidence-only revision — 2026-07-26

- Replaced lifecycle summaries with the stable statement that the canonical task packet's `status` and `stateTransitions` array are authoritative and that evidence does not assert the absence of transitions after handoff.
- `node scripts/verify/changed`: pass, exit `0`; seven changed paths were reported, all allowed, with empty `forbidden` and `outside` sets.
- `node scripts/verify/security-boundaries`: pass, exit `0`; no configured secret patterns were detected in changed readable files.
- `git diff --check`: pass, exit `0`, with no output.
- No implementation artifact or task-packet field was changed in this revision. This executor does not claim independent verification.

## Final independent QA review — 2026-07-26

- Verifier agent: `qa-verification`
- Verifier model: `gpt-5.6-sol`
- Result: **revision-required**
- Production eligible: `false`

### Final-state checks

- `node scripts/verify/changed`: pass, exit `0`; seven changed paths, all allowed, with empty `forbidden` and `outside` sets.
- `node scripts/verify/security-boundaries`: pass, exit `0`; no configured secret patterns detected.
- `git diff --check`: pass, exit `0`.

All implementation acceptance, schema-validation, audit, deterministic-failure, scope, protected-path, and secret-boundary findings from the preceding independent re-verification remain satisfied. The evidence-only correction did not change implementation artifacts or packet controls.

### Remaining evidence-integrity defect

At this QA snapshot, the evidence remained internally inconsistent because its lifecycle summary became stale after handoff and asserted that no later executor transition occurred.

The durable correction is to identify the canonical task packet's `status` and `stateTransitions` array as authoritative, avoid enumerating a purported final lifecycle, and make no claim that transitions are absent after an executor handoff. The packet itself preserves all prior review history.

At that QA snapshot, the evidence was insufficient for an independent pass because Definition of Done requires accurate recorded evidence. Independent QA must assess the current wording and checks against the canonical packet.

## Stable lifecycle wording check results — 2026-07-26

- The canonical task packet's `status` and `stateTransitions` array are identified as authoritative; this evidence does not enumerate a final lifecycle or assert the absence of transitions after an executor handoff.
- `node scripts/verify/changed`: pass, exit `0`; seven changed paths were reported, all allowed, with empty `forbidden` and `outside` sets.
- `node scripts/verify/security-boundaries`: pass, exit `0`; no configured secret patterns were detected in changed readable files.
- `git diff --check`: pass, exit `0`, with no output.

## Final independent QA pass — 2026-07-26

- Verifier agent: `qa-verification`
- Verifier model: `gpt-5.6-sol`
- Result: **pass**
- Production eligible: `false`
- Lifecycle evidence reference: `evidence/tasks/SUT-AIOS-P0-002/verification.md`

### Final independent checks

- Lifecycle wording: pass. The evidence identifies `tasks/review/SUT-AIOS-P0-002/task.json` as authoritative for `status` and `stateTransitions`, makes no time-sensitive claim that later transitions are absent, and retains prior blocked and revision-required findings as historical QA snapshots.
- `node scripts/verify/changed`: pass, exit `0`; seven changed paths, all within `allowedPaths`, with empty `forbidden` and `outside` sets.
- `node scripts/verify/security-boundaries`: pass, exit `0`; no configured secret patterns detected in changed readable files.
- `git diff --check`: pass, exit `0`.

### Acceptance conclusion

- Declared-subsystem scope: pass. Only the platform-stabilization plan, schema, validator, task packet path, and task evidence changed; protected application, architecture-source, migration, payment, inventory, environment, secret, and credential paths are untouched.
- Machine-readable contract and deterministic failure behavior: pass. The plan conforms to its schema, the validator implements and fail-closes on the schema's exact keyword vocabulary, and focused policy assertions cover cross-field behavior.
- Required tests and independent verification: pass. The authorized root audit and governance checks passed; fresh compatibility audits match the recorded planning findings; the contract validator, changed-path inspection, secret scan, and diff check passed independently.
- Evidence integrity: pass. Command outcomes, prior failure history, remediation, scope, limitations, rollback, independent verifier identity, and verifier model are durably recorded.

This file is sufficient independent evidence for the authorized lifecycle controller to transition `SUT-AIOS-P0-002` from `review` to `verified`. It does not authorize a transition to `done`, satisfy the separate pull-request requirement by itself, or grant production-write/deployment authority. The verifier performed no lifecycle transition.

## CI machine-verifier remediation attempt — 2026-07-26

- Verifier agent: `qa-verification`
- Verifier model: `gpt-5.6-sol`
- Disposition: **blocked**
- Production eligible: `false`
- First generated result: `evidence/verification/SUT-AIOS-P0-002/verification-20260726152717886.json`
- Confirmatory generated result: `evidence/verification/SUT-AIOS-P0-002/verification-20260726152741451.json`

The owner-approved command was executed exactly twice:

`npm run verify:task -- --task SUT-AIOS-P0-002 --verifier-agent qa-verification --verifier-model gpt-5.6-sol --acceptance-confirmed`

Both runs recorded independent reviewer/model identity, acceptance confirmation, passing changed-path inspection, passing security-boundary inspection, untouched forbidden paths, and `productionEligible: false`. Both nevertheless returned exit `1` with machine status and recommendation `blocked` because the required test `npm audit --omit=dev` is not accepted by `verify:task`'s `safeRequiredCommand` parser. That parser supports safe direct `node scripts/**` commands, `npm run verify:fast`, and `git diff --check`, but has no accepted form for `npm audit --omit=dev`; the caught unsupported-command error is reduced to `npm audit --omit=dev: fail` in the JSON test summary.

An independent direct execution of the packet-authorized `npm audit --omit=dev` command immediately passed with exit `0` and zero vulnerabilities, confirming that the machine-verifier result is blocked by runner/packet command incompatibility rather than an audit finding. `npm run verify:fast` passed inside both machine-verifier runs.

Neither generated JSON result is sufficient pass evidence for CI or a lifecycle transition. A separately approved governance remediation must make `verify:task` safely execute the packet's required audit command, or replace the required test with an equivalent safe command form that the verifier supports. Preserve both blocked JSON files as audit history, then rerun the exact verifier command and require a new result with `status: pass`, `recommendation: verified`, independent identity/model, allowed changed paths, passing required tests, untouched forbidden paths, no secret-boundary issue, and `productionEligible: false`. No implementation or lifecycle change was performed by this verifier.

## Final machine-readable independent verification — 2026-07-26

- Verifier agent: `qa-verification`
- Verifier model: `gpt-5.6-sol`
- Result: **pass**
- Recommendation: `verified`
- Production eligible: `false`
- Machine result: `evidence/verification/SUT-AIOS-P0-002/verification-20260726161346223.json`

After the independently reviewed GOV-012 safe audit launcher was merged into this branch, the exact owner-approved command completed with exit `0`:

`npm run verify:task -- --task SUT-AIOS-P0-002 --verifier-agent qa-verification --verifier-model gpt-5.6-sol --acceptance-confirmed`

The machine result records `status: pass`, independent reviewer/model identity, all acceptance criteria as confirmed, `npm audit --omit=dev: pass`, `npm run verify:fast: pass`, changed-path inspection pass, security-boundary pass, `forbiddenPathsUntouched: true`, no risks, and `productionEligible: false`. The changed paths are only the allowed task-state packet move from `blocked` to `review`.

The merged launcher and verification policy admit only the exact literal `npm audit --omit=dev`, execute fixed arguments without a shell, preserve real audit exit status, fail closed when the deterministic Windows npm CLI is unavailable, and continue to reject extra arguments, shell operators, audit-fix forms, and all other npm commands. The earlier blocked JSON results remain valid historical evidence of the pre-remediation control gap and are superseded for final CI disposition by the passing result above.

This Markdown evidence plus `evidence/verification/SUT-AIOS-P0-002/verification-20260726161346223.json` is sufficient for the authorized lifecycle controller and CI to treat independent verification as passed. It does not grant production eligibility or authorize this verifier to transition lifecycle state.
