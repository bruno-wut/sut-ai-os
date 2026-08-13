# SUT-AIOS-P3-004 implementation evidence

## Scope implemented

- Added one provider-neutral `PersistencePort` deep module with a single
  `execute(request)` public operation.
- Added two deterministic process-local reference adapters selected outside the
  core through a closed configuration.
- Enforced committed P2-006 category/retention classification and P2-007
  capacity classification before every adapter call.
- Added deterministic negative coverage for raw/per-interaction data, unknown
  or saturated capacity, booking-boundary overlap, caller authority injection,
  unsupported composition, hostile adapters, malformed inputs, and import
  direction.
- Bound each append history to its initial category, artifact class, and
  retention action; collisions fail closed without changing protected or
  ordinary records. Added aggregate-action write/read and protected-delete
  preservation regressions for both adapters.
- Added pre-mutation identity and protected-audit guards to both delete paths.
  A valid ordinary `scheduled_delete` request that reuses a protected audit
  `recordId` now returns `RECORD_IDENTITY_CONFLICT`, and the protected identity
  and latest revision remain unchanged.
- Delete identity compares the persisted category and artifact class, while
  append retains the stricter category/artifact/retention tuple. This permits a
  valid ordinary `scheduled_delete` transition without weakening the protected
  record guard.
- Added bounded architecture and rollback documentation.

## Changed paths

- `packages/persistence-port/src/persistence-port-v1.mjs`
- `services/persistence-composition/persistence-composition-v1.mjs`
- `tests/persistence-composition/validate-persistence-composition-v1.mjs`
- `docs/persistence-composition/PERSISTENCE_COMPOSITION_V1.md`
- `evidence/tasks/SUT-AIOS-P3-004/verification.md`
- `tasks/active/SUT-AIOS-P3-004/task.json` (pre-existing lifecycle activation)

## Command results

| Command | Result | Notes |
| --- | --- | --- |
| `npm run test:persistence-composition` | PASS | Exact GOV-062-admitted validator passed 721 cases after the bounded delete-semantics correction. |
| `npm run verify:fast` | FAIL on uncommitted delete-semantics tree | Task validation, worktree self-test, and task self-test passed; `scripts/codex/validate-routing.mjs` requires a clean committed review tree. The orchestrator must commit the bounded remediation and rerun this exact command before fresh independent QA. |
| `git diff --check` | PASS | No whitespace errors; Git emitted only line-ending conversion notices for the modified working-copy files. |

## Safety and authority

No database, SQL, migration, provider SDK, provider account, network service,
credential, environment access, guest payload, queue, workflow, AI invocation,
notification, production write, booking, payment, inventory, or pricing action
was added or accessed. Successful decisions are fixture-only, non-authoritative,
and explicitly deny production writes and external side effects. Rejected
requests invoke no adapter.

The P2-006 classification remains metadata-only and does not authorize
persistence or lifecycle action. The P2-007 decision remains non-authoritative;
P3-004 uses only its fail-closed capacity outcome as a prerequisite for local
fixture execution. `delete_expired` proves an interface seam only; P3-005 must
separately govern retention due-state and lifecycle composition.

## Limitations and residual risk

- The adapters are process-local fixtures, not durable storage or production
  implementations.
- Capacity observations are prepared trusted facts evaluated by the committed
  P2-007 authority; live metering and authentication are not implemented.
- No retention duration, due-state calculation, scheduler, archival, transfer,
  or legal-compliance decision exists.
- A future provider adapter requires a separate approved packet, production
  configuration, credentials, concurrency/transaction design, data-transfer
  plan, rollback, and independent verification.

## Rollback

Revert only the P3-004 implementation, validator, documentation, task evidence,
and lifecycle record. The reference adapters create no external state.
