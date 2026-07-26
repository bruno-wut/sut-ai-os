# Control-Plane Schema Contract

## Purpose and boundary

This is the Phase 1 static design contract for P1-002. It turns the canonical requirement for connected control-plane records into one finite repository artifact and one offline validator. It is not a database migration, database connection, ORM model, RLS policy, API, queue, workflow engine, authorization decision, or production control-plane service.

P1-002 may create only the committed static schema artifact and its deterministic validator. It must not execute SQL, access Supabase or another database, create tables, read credentials, install packages, or contact a network service.

## Version 1 artifact

P1-002 must create `packages/control-plane-schema/control-plane-schema-v1.json`. It is a closed JSON design document with `schemaVersion` exactly `1.0.0` and a closed `entities` object. It describes these connected control-plane entities only:

| Entity | Required static fields | Required relationship boundary |
| --- | --- | --- |
| `system_events` | `id`, `correlationId`, `type`, `occurredAt` | Source records for later workflow and audit work. |
| `workflow_runs` | `id`, `correlationId`, `status`, `triggerEventId` | `triggerEventId` references `system_events.id`. |
| `workflow_steps` | `id`, `workflowRunId`, `sequence`, `status` | `workflowRunId` references `workflow_runs.id`. |
| `action_proposals` | `id`, `workflowRunId`, `status`, `riskLevel` | `workflowRunId` references `workflow_runs.id`. |
| `approval_requests` | `id`, `proposalId`, `status` | `proposalId` references `action_proposals.id`. |
| `agent_runs` | `id`, `workflowRunId`, `agentId`, `status` | `workflowRunId` references `workflow_runs.id`. |
| `tool_executions` | `id`, `agentRunId`, `toolName`, `status` | `agentRunId` references `agent_runs.id`. |
| `verification_results` | `id`, `workflowRunId`, `status`, `verifiedAt` | `workflowRunId` references `workflow_runs.id`. |

Each entity definition must be a closed object and declare `fields` as a closed object of non-empty field-name to non-empty primitive-type mappings. Each relationship declaration must be a closed object containing exactly `field`, `referencesEntity`, and `referencesField`; the referenced entity must be one of the entities above and `referencesField` must be `id`.

The contract deliberately excludes `audit_entries` (P1-003), policy definitions/evaluation, playbook definitions, incidents, notifications, deployments, metric snapshots, personal-data fields, staff identity, credentials, retention behavior, RLS, indexes, SQL types, transaction semantics, concurrency, and authorization. Their inclusion requires a separately approved task.

## Deterministic validator

P1-002 must create `tests/control-plane-schema/validate-control-plane-schema.mjs`. The only contract command is:

```text
node tests/control-plane-schema/validate-control-plane-schema.mjs
```

The validator must use Node built-ins only, load the committed JSON artifact, make no writes, and make no network, database, queue, package-install, or environment-secret access. It must assert this finite set of cases:

1. The committed version-1 artifact with exactly the eight entities above succeeds.
2. A missing top-level required field, an unexpected top-level field, or an unsupported schema version fails.
3. A missing required entity, an unexpected entity, or an entity with an unexpected required-field definition fails.
4. A missing required entity field, empty primitive type, malformed relationship object, or relationship to an absent entity fails.
5. A relationship that does not reference the target entity's `id` fails.
6. Any forbidden entity or design field that claims migration, RLS, credential, personal-data, retention, policy, audit, or live-service behavior fails.

It exits `0` only when every case has the expected result and exits non-zero with a concise diagnostic otherwise. It must not generate a migration or any other artifact.

## Handoff and rollback

The P1-002 reviewer must inspect the final diff against its packet, run the exact validator command and `npm run verify:fast`, then record independent evidence. The machine verifier must separately and safely admit this exact test-path command before P1-002 can claim machine verification. Revert P1-002's static schema, validator, task-state record, and evidence together if the contract needs withdrawal; do not alter database, audit, policy, or canonical architecture sources.
