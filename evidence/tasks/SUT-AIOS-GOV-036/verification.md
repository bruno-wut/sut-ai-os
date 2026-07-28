# SUT-AIOS-GOV-036 Planning Evidence

## Outcome

Planning defined one bounded, executable P1-008 Staff OS Control Views V1
contract and refined the existing P1-008 backlog packet. P1-008 remains in
`backlog`. No Staff OS UI, schema, artifact, validator, CI step, verifier
admission, runtime service, or production capability was implemented.

## Finite contract review

The design fixes:

- one closed structural authority:
  `schemas/staff-os-control-views-v1.schema.json`;
- one committed static artifact:
  `apps/staff-os/staff-os-control-views-v1.json`;
- one exact validator command:
  `node tests/staff-os/validate-observe-only-control-views-v1.mjs`;
- one Tier 0 `observe-only` view set with
  `productionWritePermission: false`;
- exactly three contract-reference views: `workflow-control-plane`,
  `append-only-audit-record`, and `deny-only-kill-switch-decision`;
- fixed P1-002 workflow, P1-003 audit, and P1-007 deny-only references and
  display fields; and
- fail-closed canonical and focused mutation validation with no live-data,
  query, command, credential, authorization, approval, execution, or write
  field.

The fixed P1-007 reference is the sole public
`evaluateKillSwitch({ targetAction: "observe" })` request and its already
committed no-match deny decision. It documents a safety boundary only; it does
not expose a caller-configurable evaluator, authorize work, or execute a
control.

## P1-008 packet review

The amended backlog packet:

- narrows future work to one schema, one static artifact, one validator, one
  design document, one explicit non-deploying CI step, task state, and evidence;
- replaces the nonexistent `npm run test:staff-os` with the exact future Node
  validator command;
- adds `SUT-AIOS-GOV-036` as a planning dependency while preserving completed
  P1-002, P1-003, and P1-007 dependencies;
- forbids runtime application work, live data, database, external access,
  authorization, approvals, execution, production writes, credentials, SQL,
  migrations, and protected sources; and
- retains `backlog`, Tier 0, and `productionWritePermission: false`.

## Verifier-admission prerequisite

The planned validator is not admitted by the independent machine verifier.
After the validator exists, a separate governance task must inspect and admit
only its byte-for-byte command with `shell: false`, one fixed
repository-relative argument, and near-miss rejection coverage. P1-008 cannot
enter independent machine verification or `verified` before that separate task
is merged and independently verified. This planning task did not modify
`scripts/verify/**` or create the follow-on packet.

## Changed paths

- `docs/staff-os/P1-008_OBSERVE_ONLY_CONTROL_VIEWS_V1_DESIGN.md`
- `tasks/backlog/SUT-AIOS-P1-008/task.json`
- `tasks/verified/SUT-AIOS-GOV-036/task.json` (final planning-task lifecycle
  record after independent QA)
- `docs/project/ISSUES_AND_RISKS.md`
- `evidence/tasks/SUT-AIOS-GOV-036/verification.md`

No historical evidence, completed record, schema, application artifact, test,
CI workflow, verifier, runtime service, canonical architecture source,
compatibility snapshot, database, or external system was modified.

## Deterministic checks

| Command | Result |
| --- | --- |
| `node scripts/task/validate --task SUT-AIOS-GOV-036` | Pass before lifecycle activation. |
| `node scripts/task/validate --task SUT-AIOS-P1-008` | Pass after packet refinement. |
| `node scripts/task/validate --all` | Pass; GOV-036 is valid in `active` and P1-008 remains valid in `backlog`. |
| `npm run verify:fast` | Pass; task validation, routing validation, worktree self-test, and lifecycle self-test passed. |
| `git diff --check` | Pass; no whitespace errors (Git emitted only line-ending warnings). |

The future P1-008 validator and `verify:task` were not run because this task
does not create either the validator or its verifier admission. The planner is
not the completion authority; independent Sol QA must inspect the final diff,
run the packet-authorized machine verification once, and retain that result.

## Independent Sol QA

Independent QA confirmed that the final planning diff:

- defines exactly one schema, one static artifact, one validator, and exactly
  three metadata-only views without implementing any of those future paths;
- binds the views to the completed P1-002, P1-003, and P1-007 authorities,
  including only the fixed P1-007 `observe` request and deterministic deny;
- introduces no live data, sensitive data, authorization, approval, execution,
  UI/runtime behavior, verifier change, or production capability;
- retains P1-008 in `backlog` and includes GOV-036 plus the three completed
  product dependencies; and
- correctly sequences a separate exact-command admission after the validator
  exists and before P1-008 machine verification, without prematurely changing
  the verifier.

QA reran `node scripts/task/validate --all`, `npm run verify:fast`, and
`git diff --check`; all passed. The independently generated machine-verification
record and final lifecycle transition are retained under the packet's declared
evidence destinations.

## Rollback

Revert only the P1-008 design, P1-008 packet amendment, GOV-036 lifecycle
record, risk entry, and GOV-036 evidence. Preserve P1-002, P1-003, and P1-007
authorities and historical evidence, completed records, canonical architecture
sources, the compatibility snapshot, and all external systems.
