# P1-006 Playbook Registry V1 Design

## Purpose and authority

P1-006 will create a finite, repository-only registry contract for versioned playbook metadata. It is a Tier 0 shadow artifact, not a runner, dispatcher, authorization engine, approval service, workflow engine, or production control.

The V1 authorities are:

- `schemas/playbook-registry-v1.schema.json` — the closed structural authority;
- `playbooks/playbook-registry-v1.json` — the single committed registry artifact; and
- `tests/playbooks/validate-playbook-registry-v1.mjs` — the deterministic validator for the committed schema and artifact.

The exact validator command will be:

```text
node tests/playbooks/validate-playbook-registry-v1.mjs
```

No package alias is authoritative. P1-006 must not add a runner, import P1-005 runtime code, execute a registered tool, infer permission, or contact a network, database, production system, or external service.

## Closed V1 artifact

The registry has exactly these top-level fields and no others:

| Field | Exact V1 value or rule |
| --- | --- |
| `schemaVersion` | `"1.0.0"` |
| `registryId` | `"sut-aios-playbook-registry"` |
| `registryMode` | `"shadow"` |
| `productionWritePermission` | `false` |
| `policyReference` | The closed P1-004 reference below |
| `playbooks` | An array containing exactly the one V1 entry below |

`policyReference` contains exactly:

```json
{
  "artifact": "policies/deterministic-authorization-policies-v1.json",
  "schema": "schemas/authorization-policy-contract-v1.schema.json",
  "policyKey": "governance_gated_change",
  "targetAction": "governed_configuration_change",
  "defaultEffect": "deny"
}
```

This reference classifies the playbook under P1-004's static taxonomy and deny default. P1-004 does not provide runtime authorization, and this registry cannot turn that reference into an allow decision. Any future runtime authorization must use the separately governed P1-005 V2 evaluator through its canonical interface.

## Finite V1 playbook entry

`playbooks` contains exactly one closed entry:

| Field | Exact V1 value |
| --- | --- |
| `playbookId` | `"content-schema-repair-shadow"` |
| `version` | `"1.0.0"` |
| `owner` | `"codex-content-executor"` |
| `autonomyTier` | `"tier-0"` |
| `mode` | `"shadow"` |
| `enabled` | `false` |
| `productionWritePermission` | `false` |
| `trigger` | The closed trigger object below |
| `evidenceRequirements` | The exact ordered values below |
| `permittedTools` | `[]` |
| `permittedPaths` | `[]` |
| `requiredChecks` | The exact ordered values below |
| `approvalPolicy` | The closed approval object below |
| `retryPolicy` | The closed retry object below |
| `rollbackPolicy` | The closed rollback object below |
| `historicalSuccessRate` | `null` (not recorded in V1) |
| `historicalRollbackRate` | `null` (not recorded in V1) |

The closed `trigger` object is:

```json
{
  "type": "sanitized_fixture",
  "eventType": "content_schema_validation_failed",
  "source": "repository_fixture_only"
}
```

`evidenceRequirements` is exactly:

```json
[
  "sanitized_failure_fixture",
  "deterministic_validation_result",
  "correlation_id"
]
```

`requiredChecks` is exactly:

```json
[
  "registry_contract_validation",
  "changed_path_inspection",
  "secret_boundary_inspection",
  "independent_verification"
]
```

The closed policy objects are:

```json
{
  "approvalPolicy": {
    "mode": "not_applicable_observe_only",
    "activationAllowed": false
  },
  "retryPolicy": {
    "maxAttempts": 0,
    "strategy": "none"
  },
  "rollbackPolicy": {
    "strategy": "not_applicable_no_mutation",
    "mutationAllowed": false
  }
}
```

Empty `permittedTools` and `permittedPaths` are deliberate V1 safety invariants. The entry records identity, ownership, trigger, evidence, and check metadata without granting execution or repository mutation. Later executable playbook versions require a separate approved product packet, policy evaluation, verifier admission, independent review, and any applicable kill-switch dependency.

The two historical-rate fields are required because the canonical Playbook Registry includes both measures. For this single disabled shadow entry, each value is exactly JSON `null`, meaning “not recorded.” V1 has no runs from which to calculate a rate. The fields do not authorize a calculator, telemetry ingestion, runtime storage, external-data lookup, or inferred numeric default; zero would incorrectly claim a measured rate.

## Schema requirements

`schemas/playbook-registry-v1.schema.json` must be a valid JSON Schema Draft 2020-12 document with:

- an absolute `$id`, `type: "object"`, the six required top-level fields, and `additionalProperties: false`;
- `const` or equivalent closed constraints for every exact scalar and path above;
- exactly one `playbooks` item, described by one closed entry schema;
- exact ordered arrays using fixed lengths plus per-position constants;
- empty `permittedTools` and `permittedPaths` arrays using `maxItems: 0`;
- required `historicalSuccessRate` and `historicalRollbackRate` properties constrained with `const: null` (or an equivalent null-only constraint);
- closed nested objects with all documented properties required; and
- no remote `$ref`, dynamic reference, runtime import, environment lookup, credential field, command string, or executable callback.

The validator must treat the committed schema as structural authority, but it must also independently assert the documented finite V1 values. Merely weakening or replacing the schema in a test must not make a mutated registry valid.

## Deterministic validator and failure behavior

`tests/playbooks/validate-playbook-registry-v1.mjs` must use Node built-ins and repository-local files only. It must:

1. load the canonical schema and registry by paths resolved from the validator location, not the caller's working directory;
2. parse both files without accepting caller-supplied replacement paths, schemas, registry data, environment overrides, or network references;
3. validate the committed artifact against the canonical closed schema;
4. separately verify every finite value and ordered collection documented here;
5. run focused negative cases for missing and extra fields, wrong schema/registry/playbook versions, duplicate or extra playbooks, changed owner, non-Tier-0 or non-shadow mode, enabled state, production-write permission, weakened policy reference, altered trigger or evidence, non-empty tools or paths, removed/reordered checks, approval activation, positive retries, mutation-capable rollback, either historical-rate field being absent, or either historical-rate value being non-null;
6. reject malformed JSON and schema-validation failures with a concise deterministic diagnostic; and
7. exit `0` only when the canonical artifact passes and every negative case fails as expected.

The validator must never execute registry content, generate files, mutate the committed artifact, read secrets, or access production/external systems. Malformed or unexpected input fails closed with a nonzero exit; it is never repaired or skipped.

## CI and verifier admission dependency

P1-006 must explicitly run the exact Node validator in CI in addition to the repository fast checks. CI visibility does not itself admit the command to the independent task verifier.

Before P1-006 independent machine verification, a separate approved governance packet must add only the exact command:

```text
node tests/playbooks/validate-playbook-registry-v1.mjs
```

Admission must preserve `shell: false`, the repository Node executable, and the single fixed repository-relative argument. Its self-tests must accept only the byte-for-byte command and reject whitespace variants, alternate paths, extra arguments, shell operators, redirects, command chaining, substitutions, and path traversal. Generic `node tests/playbooks/**` or arbitrary command execution is forbidden.

The admission packet may be implemented only after the planned validator exists for inspection. P1-006 may not enter independent verification or `verified` until this exact admission is merged and itself independently verified.

## P1-006 implementation boundary

P1-006 is limited to the three V1 authorities, this durable design, one explicit non-deploying CI step for the exact validator, its own task-state record, and its evidence. It excludes package restructuring, runtime services, runners, dispatch, activation, workflow state, kill switches, telemetry, rate calculators, runtime metric storage, external data, production reads or writes, databases, SQL, migrations, RLS, credentials, network access, guest data, booking, payment, inventory, pricing, deployment, retention, and edits to canonical architecture or the immutable compatibility snapshot.

## Handoff and rollback

Implementation review must inspect the full diff, run the exact V1 validator, `npm run verify:fast`, `git diff --check`, and the packet's secret/path boundary checks. A reviewer independent of the implementer must record evidence before lifecycle verification.

Rollback reverts only the P1-006 registry artifact, schema, validator, design documentation, task-state changes, and P1-006 evidence. It does not alter P1-004/P1-005 authorities, historical evidence, canonical architecture, the compatibility snapshot, or any external system.
