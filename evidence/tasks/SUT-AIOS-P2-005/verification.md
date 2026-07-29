# SUT-AIOS-P2-005 implementation evidence

## Outcome

The bounded static implementation is ready for independent Sol review. It
defines one closed Draft 2020-12 authority, one canonical trust-zone policy,
one private-authority deep module, one exact validator, and product
documentation. It creates no adapter, SDK, endpoint, provider selection,
credential, network, database, queue, workflow, rate limiter, quota meter,
deployment, migration, or production behavior.

The module exports only
`validateInfrastructureBoundaryRequest(request)`. It obtains committed schema
and policy authority internally, ignores extra JavaScript arguments, clones and
deeply freezes returned data, mutates no input, never throws for malformed
input, and treats validation success as static conformance only.

## Changed files

- `schemas/infrastructure-port-contract-v1.schema.json`
- `policies/infrastructure-trust-zone-policy-v1.json`
- `packages/infrastructure-contracts/src/infrastructure-port-contract-v1.mjs`
- `tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs`
- `docs/infrastructure-contracts/INFRASTRUCTURE_PORT_CONTRACT_V1.md`
- `docs/project/ISSUES_AND_RISKS.md`
- `evidence/tasks/SUT-AIOS-P2-005/verification.md`
- `tasks/review/SUT-AIOS-P2-005/task.json` after lifecycle handoff

## Contract assurance

- exact ordered guest/public, staff/control, and AI/workload zones retain
  twelve distinct credential/quota/deployment/failure identifiers;
- five directed route classes bind exact zone, port, and operation tuples;
- authenticated HTTPS bounds, recipient checks, replay/idempotency semantics,
  body/timeout bounds, and caller/route limit states are finite;
- thirteen provider-neutral ports expose only the exact V1 operation
  vocabulary and gain no authorization, workflow, or audit authority;
- booking availability cannot depend on Staff/AI availability and shared
  guest/internal boundaries fail closed;
- caller-supplied weakened schemas, policies, adapters, configurations, and
  dependencies cannot redirect runtime authority or relabel a production write
  into allow;
- malformed and hostile JavaScript inputs return valid deterministic frozen
  denial decisions without escaping exceptions;
- the core module imports only committed JSON authorities and Ajv, with no
  provider SDK, infrastructure adapter, network, or verification-script import.

## Deterministic checks

The implementer runs the packet-authorized commands before handoff and records
their exact results here. `verify:task` is reserved for independent QA.

| Command | Result |
| --- | --- |
| `node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs` | Pass; 235 deterministic cases, including exact schema port closure. |
| `node scripts/task/validate --all` | Pass; every canonical packet valid and P2-005 review/execution-ready. |
| `node scripts/github/validate-governance.mjs` | Pass; task/branch matched, changed paths permitted, and no secret match. |
| `npm run verify:fast` | Pass; packet, routing, worktree, and lifecycle checks passed. |
| `git diff --check` | Pass; line-ending conversion notice only, no whitespace error. |

## Assumptions and limitations

- Descriptor facts are normalized future recipient-adapter facts, not trusted
  network claims. Static success is never authentication, authorization,
  approval, capacity reservation, dispatch, or production-write authority.
- Numeric resource budgets and data minimisation/retention are deliberately
  deferred to P2-007 and P2-006 respectively.
- The local worktree uses an ignored junction to an existing repository
  `node_modules` installation so the pinned Ajv runtime dependency can execute;
  no dependency or package manifest was changed.

## Rollback

Revert only the five P2-005 product artifacts, this task evidence/state, and the
P2-005 risk entry. Preserve ADR-0002, GOV-043/GOV-047/GOV-048 history, terminal
P1/P2 evidence, canonical architecture sources, immutable snapshots, and all
external systems.
