# P1-007 Kill-Switch Controls V1 Design

## Purpose and authority

P1-007 will implement one repository-local, deterministic safety boundary for
Phase 1. It is a deny-only Tier 0 control. It is not an authorization engine,
approval service, workflow engine, mutable control plane, executor, dispatcher,
deployment system, rollback service, notification service, or production
integration.

The V1 authorities will be:

- `services/orchestrator/src/kill-switch/evaluator.mjs` — the runtime-safe
  module containing the private committed authority and the sole public
  `evaluateKillSwitch(requestContext)` entry point; and
- `tests/orchestrator/validate-kill-switch-controls-v1.mjs` — the deterministic
  validator for the committed module and its finite behavior.

The exact validator command will be:

```text
node tests/orchestrator/validate-kill-switch-controls-v1.mjs
```

No caller-supplied schema, contract, authority, dependency object, environment
value, file path, or network response is authoritative. The module must not
import authority from `tests/**`, `scripts/**`, a mutable JSON module, or a
repository verification script.

## Private committed authority

`evaluator.mjs` contains one private literal authority with exactly these V1
values. The literal is recursively frozen before use and is not exported.

| Field | Exact V1 value |
| --- | --- |
| `schemaVersion` | `"1.0.0"` |
| `authorityId` | `"sut-aios-kill-switch-controls"` |
| `mode` | `"observe-only"` |
| `productionWritePermission` | `false` |
| `controls` | The exact ordered controls below |

The exact ordered controls are:

1. `global-autonomous-actions`, scope `global`, target action
   `autonomous_action`, engaged `true`, reason
   `KILL_SWITCH_GLOBAL_AUTONOMY_ENGAGED`;
2. `playbook-content-schema-repair-shadow`, scope `playbook`, target action
   `playbook_dispatch`, target ID `content-schema-repair-shadow`, engaged
   `true`, reason `KILL_SWITCH_PLAYBOOK_ENGAGED`; and
3. `executor-codex-content-executor`, scope `executor`, target action
   `executor_dispatch`, target ID `codex-content-executor`, engaged `true`,
   reason `KILL_SWITCH_EXECUTOR_ENGAGED`;
4. `codex-dispatch`, scope `dispatch`, target action `codex_dispatch`, engaged
   `true`, reason `KILL_SWITCH_CODEX_DISPATCH_PAUSED`;
5. `pending-actions`, scope `workflow`, target action `pending_action`, engaged
   `true`, reason `KILL_SWITCH_PENDING_ACTION_REJECTED`; and
6. `outbound-notifications`, scope `notification`, target action
   `outbound_notification`, engaged `true`, reason
   `KILL_SWITCH_OUTBOUND_NOTIFICATIONS_PAUSED`.

These are static safety defaults, not an administrative state store. V1 has no
mutation API, activation endpoint, override, expiry, credential, remote source,
or persistence mechanism. A later task may define authenticated mutable control
state only after separate architecture, policy, audit, concurrency, recovery,
and specialist review. It must not silently reinterpret this V1 authority.

## Public request contract

The public interface is conceptually and actually:

```js
evaluateKillSwitch(requestContext)
```

It accepts exactly one ordinary object. The closed request has:

| Field | Rule |
| --- | --- |
| `targetAction` | Required string: `autonomous_action`, `playbook_dispatch`, `executor_dispatch`, `codex_dispatch`, `pending_action`, `outbound_notification`, or `observe` |
| `playbookId` | Optional string matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`; required only for `playbook_dispatch` |
| `executorId` | Optional string matching `^[a-z0-9]+(?:-[a-z0-9]+)*$`; required only for `executor_dispatch` |

No other property is accepted. `playbookId` and `executorId` must be absent
unless required by the selected action. The function ignores no extra argument:
supplying a second authority, schema, dependency object, or options object must
not change the result. JavaScript values of every kind, including `null`, arrays,
proxies that throw, getters that throw, cyclic objects, boxed values, symbols,
bigints, and non-string identifiers, must be handled without an exception
escaping the public function.

## Deny-only decision contract

Every call returns a newly allocated, deeply frozen, closed object with exactly:

```json
{
  "schemaVersion": "1.0.0",
  "decision": "deny",
  "reasonCode": "KILL_SWITCH_NO_MATCH_FAIL_CLOSED",
  "controlId": null
}
```

`decision` is always `deny`. V1 never returns `allow`, `permit`, `approved`,
`continue`, or an equivalent. A well-formed no-match result remains a deny and
cannot be treated as authorization. A caller must still pass all separate
policy, approval, workflow, executor, and verification gates; this module cannot
satisfy any of them.

The reason and control precedence is exact:

1. `KILL_SWITCH_INTERNAL_AUTHORITY_INVALID`, `controlId: null`, when the private
   authority fails its internal finite self-check;
2. `KILL_SWITCH_INVALID_REQUEST`, `controlId: null`, for malformed, unexpected,
   or unreadable input;
3. `KILL_SWITCH_GLOBAL_AUTONOMY_ENGAGED`, control
   `global-autonomous-actions`, for `autonomous_action`;
4. `KILL_SWITCH_PLAYBOOK_ENGAGED`, control
   `playbook-content-schema-repair-shadow`, for `playbook_dispatch` targeting
   `content-schema-repair-shadow`;
5. `KILL_SWITCH_EXECUTOR_ENGAGED`, control
   `executor-codex-content-executor`, for `executor_dispatch` targeting
   `codex-content-executor`;
6. `KILL_SWITCH_CODEX_DISPATCH_PAUSED`, control `codex-dispatch`, for
   `codex_dispatch`;
7. `KILL_SWITCH_PENDING_ACTION_REJECTED`, control `pending-actions`, for
   `pending_action`;
8. `KILL_SWITCH_OUTBOUND_NOTIFICATIONS_PAUSED`, control
   `outbound-notifications`, for `outbound_notification`; and
9. `KILL_SWITCH_NO_MATCH_FAIL_CLOSED`, `controlId: null`, for every other valid
   request, including `observe` and well-formed unmatched target IDs.

This ordering is deterministic. A control match changes only the reason and
control identifier; it never changes the deny decision.

## Internal validation and failure behavior

The module must validate its private authority against independent hard-coded
finite invariants before evaluating a request. It must not consider recursive
freezing alone to be validation. Any missing, reordered, altered, additional,
unfrozen, or unexpected authority value produces
`KILL_SWITCH_INTERNAL_AUTHORITY_INVALID` and no exception.

The public function must wrap authority validation, property access, request
validation, matching, and decision construction in a fail-closed boundary. If
any internal operation unexpectedly fails, it returns the internal-authority
deny decision. Importing the committed module and calling the public function
must not access the filesystem, network, process environment, clock, randomness,
database, credential store, or external service.

## Deterministic validator

`tests/orchestrator/validate-kill-switch-controls-v1.mjs` must use Node built-ins
and repository-local imports only. It must:

1. import the canonical module by a path resolved from the validator location;
2. confirm that the normal module interface exposes
   `evaluateKillSwitch(requestContext)` and exposes no authority or mutation API;
3. confirm every returned object is closed, deeply frozen, newly allocated,
   schema version `1.0.0`, and always `decision: "deny"`;
4. verify the exact global, playbook, executor, Codex-dispatch, pending-action,
   outbound-notification, and no-match reasons and control identifiers;
5. verify the documented reason precedence;
6. attempt caller-supplied replacement authorities, schemas, dependency
   objects, extra arguments, and mutation of prior decisions, proving none can
   produce an allow or redirect later evaluation;
7. exercise focused malformed values, throwing proxies/getters, cyclic objects,
   extra/missing properties, wrong action/identifier types, invalid identifier
   formats, and forbidden conditional fields, proving no call throws and every
   result remains a valid deterministic deny;
8. inspect the committed module text only for bounded dependency-direction and
   authority-export checks, rejecting imports from `tests/**`, `scripts/**`,
   network modules, or mutable JSON authority; and
9. exit `0` only when the canonical module and every positive, mutation, and
   malformed case pass.

The validator must not mutate repository files, execute a control target, read
secrets, contact an external system, or claim production readiness.

## CI and verifier-admission dependency

P1-007 must add an explicit non-deploying CI step that runs the exact Node
validator in addition to `npm run verify:fast`. CI visibility does not itself
admit the command to the independent task verifier.

Before P1-007 independent machine verification, a separate approved governance
packet must admit only this byte-for-byte command:

```text
node tests/orchestrator/validate-kill-switch-controls-v1.mjs
```

Admission must preserve `shell: false`, the repository Node executable, and one
fixed repository-relative argument. Its self-tests must accept only the exact
literal and reject whitespace changes, alternate or sibling paths, extra
arguments, shell operators, redirects, chaining, substitutions, and traversal.
Generic `node tests/orchestrator/**` or arbitrary command execution remains
forbidden. P1-007 must not enter independent machine verification or
`verified` until that separate admission is merged and independently verified.

## P1-007 implementation boundary

P1-007 is limited to the evaluator module, its deterministic validator, this
design, one explicit CI step, its own task state, and its evidence. It does not
implement a server, queue, scheduler, worker, mutable switch store, Staff OS
view, notification, GitHub revocation, deployment stop, rollback initiation,
workflow cancellation, authorization grant, approval, audit backend, database,
SQL, migration, RLS, credential, network access, guest data, booking, payment,
inventory, pricing, or production behavior.

## Handoff and rollback

Implementation review must inspect the full diff and run the exact V1 validator,
`npm run verify:fast`, and `git diff --check`. An independent Sol reviewer must
verify the authority isolation, deny-only semantics, malformed-input boundary,
changed paths, and retained evidence before lifecycle verification.

Rollback reverts only the evaluator, validator, design documentation, CI step,
P1-007 task-state changes, and P1-007 evidence. It preserves P1-004 through
P1-006 authorities and evidence, canonical architecture sources, the immutable
compatibility snapshot, and all external systems.
