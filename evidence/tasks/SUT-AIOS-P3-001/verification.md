# SUT-AIOS-P3-001 executor verification

- Task: `SUT-AIOS-P3-001`
- Workflow: canonical Workflow V1
- Implementer: `codex-engineering-executor`
- Model route: `sol` / `gpt-5.6-sol`
- Autonomy: Tier 0 / shadow
- Production write permission: false

## Implemented boundary

The bounded implementation exports only
`createSignalNormalizer(trustedContext)` and a returned `normalize(request)`
operation. HMAC-SHA256 verification is performed internally with Node standard
crypto over deterministic canonical JSON. The request cannot supply a verifier,
policy, schema, contract, dependency, adapter, key, credential, or other
authority.

Only hourly/daily analytics aggregates from the two fixed aggregate sources
and essential lifecycle events from the fixed booking lifecycle gateway can
normalize. Raw clickstream, embedded raw interactions, AI/workflow/control-plane
input, unknown sources, invalid signatures, replay/idempotency failures,
unknown/exceeded limits, and unavailable/stale/blocked budget facts fail closed.

Accepted and rejected results are frozen plain data, record zero side effects,
and grant no persistence, permanent-work-item, AI-invocation, or production
write authority. No network, provider, credential, database, queue, workflow,
AI, or deployment operation was performed.

## Executor checks

The executor ran only commands authorized by the active task packet:

- `npm run test:signal-ingestion`: pass; 1,034 assertions.
- `git diff --check`: pass.
- `npm run verify:fast`: fail in the pre-existing
  `node scripts/codex/validate-routing.mjs` subcheck; its task validation,
  worktree self-test, and task self-test subchecks pass. The bounded P3-001
  packet does not authorize executing or modifying the routing validator
  directly, so the implementer did not bypass or repair that governance
  failure.

The routing-harness failure must be diagnosed at orchestrator/governance scope
and `npm run verify:fast` must pass before verification. Independent
`qa-verification` remains required and is the only role permitted to create the
base-bound machine verification record under
`evidence/verification/SUT-AIOS-P3-001/`.

## Residual boundaries

- The transport adapter must establish live trust facts and supply real key
  material through a separately governed secret boundary.
- This core does not persist nonce or idempotency facts and does not reserve
  rate or budget capacity.
- Aggregate correctness and truthfulness are external-source responsibilities;
  P3-001 validates only the signed, minimized, finite contract.
- Successful normalization does not authorize storage, queueing, workflows, AI,
  notifications, booking mutation, or production action.

Rollback: revert the P3-001 branch changes while preserving this and later
verification evidence.
