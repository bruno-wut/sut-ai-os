# P1-008 Observe-Only Staff OS Control Views V1 Design

## Purpose and authority

P1-008 creates one finite, repository-local description of Staff OS control
views. V1 is Tier 0 and observe-only. It is not a Staff OS application, UI
runtime, API, server, database, query layer, data store, workflow, scheduler,
queue, authorization engine, approval service, executor, audit writer, or
production integration.

The V1 authorities are:

- `schemas/staff-os-control-views-v1.schema.json` — the closed structural
  authority;
- `apps/staff-os/staff-os-control-views-v1.json` — the single committed static
  view-set artifact; and
- `tests/staff-os/validate-observe-only-control-views-v1.mjs` — the
  deterministic validator for the committed schema, artifact, and fixed
  P1-007 observe decision.

The exact validator command is:

```text
node tests/staff-os/validate-observe-only-control-views-v1.mjs
```

The artifact describes contract metadata only. It does not connect to, query,
or display live records. Its source references identify completed static Phase
1 authorities; they are neither caller-selectable nor executable configuration.

## Closed V1 artifact

The artifact has exactly these top-level fields and no others:

| Field | Exact V1 value or rule |
| --- | --- |
| `schemaVersion` | `"1.0.0"` |
| `viewSetId` | `"sut-aios-staff-os-control-views"` |
| `mode` | `"observe-only"` |
| `productionWritePermission` | `false` |
| `views` | Exact ordered array of the three closed views below |

Every view has exactly `viewId`, `title`, `source`, `displayFields`,
`permittedActions`, and `noLiveDataState`. `permittedActions` is exactly
`["observe"]` and `noLiveDataState` is exactly `"static_contract_only"`.
There is no action endpoint, query, command, credential, callback, approval,
authorization decision, write control, or mutable configuration field.

### 1. Workflow control-plane view

```json
{
  "viewId": "workflow-control-plane",
  "title": "Workflow control-plane",
  "source": {
    "authorityPath": "packages/control-plane-schema/control-plane-schema-v1.json",
    "authorityType": "static_control_plane_contract",
    "entity": "workflow_runs"
  },
  "displayFields": ["id", "correlationId", "status", "triggerEventId"],
  "permittedActions": ["observe"],
  "noLiveDataState": "static_contract_only"
}
```

This is a fixed reference to P1-002's static `workflow_runs` contract fields.
It does not query workflow runs or report their status.

### 2. Append-only audit record view

```json
{
  "viewId": "append-only-audit-record",
  "title": "Append-only audit record",
  "source": {
    "authorityPath": "packages/audit-sdk/append-only-audit-contract-v1.json",
    "authorityType": "static_append_only_audit_contract",
    "entity": "record"
  },
  "displayFields": ["id", "correlationId", "recordedAt", "actorType", "actionType", "outcome"],
  "permittedActions": ["observe"],
  "noLiveDataState": "static_contract_only"
}
```

This is a fixed reference to P1-003's static audit-record fields. It does not
read, write, hash, retain, delete, or verify an audit record.

### 3. Deny-only kill-switch decision view

```json
{
  "viewId": "deny-only-kill-switch-decision",
  "title": "Deny-only kill-switch decision",
  "source": {
    "authorityPath": "services/orchestrator/src/kill-switch/evaluator.mjs",
    "authorityType": "deny_only_kill_switch_evaluator",
    "publicInterface": "evaluateKillSwitch",
    "fixedRequest": { "targetAction": "observe" },
    "expectedDecision": {
      "schemaVersion": "1.0.0",
      "decision": "deny",
      "reasonCode": "KILL_SWITCH_NO_MATCH_FAIL_CLOSED",
      "controlId": null
    }
  },
  "displayFields": ["schemaVersion", "decision", "reasonCode", "controlId"],
  "permittedActions": ["observe"],
  "noLiveDataState": "static_contract_only"
}
```

The fixed request and expected decision document P1-007's existing static
deny-only behavior. The P1-008 artifact cannot supply a replacement authority,
change kill-switch controls, authorize a request, or issue an execution action.
The validator may call the imported P1-007 public evaluator with this one fixed
request only to confirm the committed decision; it must not call any external
service or make the artifact executable.

## Schema and validator requirements

`schemas/staff-os-control-views-v1.schema.json` must be a Draft 2020-12 JSON
Schema with an absolute `$id`, closed top-level and nested objects, all
documented properties required, fixed scalar values, and exactly three views.
It must use closed alternatives for the three source shapes and fixed ordered
arrays for the views and display fields. It must contain no remote `$ref`,
dynamic reference, environment lookup, credential, endpoint, query, command,
or executable callback.

The validator uses Node built-ins and repository-local imports only. It must:

1. load the canonical schema and artifact by paths resolved from the validator,
   never from caller-supplied paths or environment values;
2. validate the committed artifact against the canonical closed schema and
   independently assert every finite value documented here;
3. read the completed P1-002 and P1-003 static artifacts only to confirm the
   referenced fields and entities exist, without treating them as live data;
4. import only P1-007's public `evaluateKillSwitch` interface and verify the
   fixed `observe` request returns the exact closed deny decision above;
5. reject focused mutations: missing or extra top-level fields or views; altered
   identity, mode, or production-write value; wrong source authority/path/type;
   changed entity, evaluator interface, fixed request, expected decision,
   display-field order, action list, or no-live-data state; and any endpoint,
   query, command, credential, callback, approval, authorization, execution,
   write, or live-data claim; and
6. fail nonzero with a concise deterministic diagnostic for malformed JSON or
   any failed canonical or mutation case.

The validator must not write files, fetch records, execute a control target,
read secrets, contact a network, access a database, or claim production
readiness.

## CI and verifier admission dependency

P1-008 must add one explicit non-deploying CI step for the exact Node command
in addition to `npm run verify:fast`. CI visibility does not admit the command
to the independent task verifier.

After the validator exists, a separate approved governance packet must admit
only the exact literal:

```text
node tests/staff-os/validate-observe-only-control-views-v1.mjs
```

That follow-on task must preserve `shell: false`, use the repository Node
executable with one fixed repository-relative argument, accept only the exact
literal, and reject whitespace variants, alternate or sibling paths, extra
arguments, shell operators, redirects, chaining, substitutions, and traversal.
It must not introduce generic `node tests/staff-os/**` or arbitrary command
execution. P1-008 cannot enter independent machine verification or `verified`
until that admission is merged and independently verified.

## Implementation boundary and rollback

P1-008 is limited to the three V1 authorities, this design document, one
explicit CI step, its task-state record, and its evidence. It excludes runtime
application work, UI rendering, API or server code, live control-plane or audit
data, database, SQL, migration, RLS, queue, scheduler, workflow, policy
evaluator, authorization, approval, executor, notification, deployment,
credential, network access, guest data, booking, payment, inventory, pricing,
retention, canonical architecture changes, and the immutable compatibility
snapshot.

Rollback reverts only those P1-008 paths. It preserves the P1-002, P1-003, and
P1-007 authorities and historical evidence, all completed records, canonical
architecture sources, the compatibility snapshot, and external systems.
