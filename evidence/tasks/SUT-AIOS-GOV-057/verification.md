# SUT-AIOS-GOV-057 Verification

## Scope

Bounded Workflow V2 review-runner repair only. P3-001 and all production, deployment, provider, package, schema, and fallback behavior are excluded.

## Implementation evidence

The implementation, evidence, and lifecycle records are committed before review.
Every command below is rerun on that clean committed review head immediately
before the SHA-bound review stages. The review artifacts are the authoritative
head binding; this evidence intentionally avoids embedding its own commit SHA,
which would create an impossible self-reference.

- `node tests/codex/validate-review-runner.mjs` — passed (65 checks).
- `node tests/codex/v2-review-lifecycle.mjs` — passed (54 checks).
- `node tests/review/validate-review-binding.mjs` — passed (7 checks).
- `node scripts/codex/validate-routing.mjs` — passed, including V2 route override and downgrade rejection.
- `node scripts/task/validate --all` — passed.
- `node scripts/github/validate-governance.mjs` — passed: branch match, forbidden-path scan, secret scan, schema, policy, and agent checks.
- `npm run verify:fast` — passed.
- `git diff --check` — passed.

The final repair closes the exact prior merge-risk findings: Windows cancellation
observes fixed-argument tree-termination success, spawn error, nonzero status,
timeout, and missing child-close outcomes and fails closed without persistence;
POSIX reviews use an isolated process group; duplicate JSON members are rejected;
merge-risk context compares exact immutable commits and maps every changed path
to its corresponding patch; and generated material is included by hash in the
governed context manifest.

## Scope and limitations

Changed paths are limited to the GOV-057 packet/evidence, local launcher, deterministic test, routing documentation, and risk register. No fallback, package/dependency, schema, production, provider, or P3-001 change was made.

Before this implementation was committed, clean-head-only lifecycle and routing fixtures correctly rejected the dirty review worktree. They were rerun successfully on the committed head above. Fresh independent V2 review artifacts remain pending.

## Independent review history

- Plan review on `fde14753edd530bee23e2fd3d98887f5b7fcd090` passed: `evidence/reviews/SUT-AIOS-GOV-057/planReview-fde14753edd530bee23e2fd3d98887f5b7fcd090.json`.
- Semantic review on the same head required revision because CLI and Codex-app review traces retained full task-packet contents. The finding is preserved at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-fde14753edd530bee23e2fd3d98887f5b7fcd090.json`.
- The follow-up removes that payload while retaining the context manifest and canonical review-scope hash. Fresh independent reviews will bind the resulting committed head.
- The fresh plan review on `408f99d8f2284da062f92a3bd28d9c5ef01c82c6` passed. Its semantic review required one further revision because specialised rejection paths did not consistently emit a single terminal `failed` progress event; the artifact is retained at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-408f99d8f2284da062f92a3bd28d9c5ef01c82c6.json`.
- The plan review on `4f02235afdecdf2cfeb2e6df40ed40a39e495629` required revision because this write-capable repair packet has `workspaceWrite: false`, making the designated Terra implementation route non-executable. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/planReview-4f02235afdecdf2cfeb2e6df40ed40a39e495629.json`. No packet authority was expanded.
- On 2026-08-09, the user explicitly approved the smallest packet amendment: `workspaceWrite: true` for the existing Terra implementation stage and existing GOV-057 allowlist only. No production, provider, deployment, fallback, path, command, route, effort, or P3-001 authority changed.
- Merge-risk review on `c403c1674d01450a072ed3bda556d95d21f5d361` required final-head evidence, platform-safe cancellation, and deterministic merge-risk-context coverage. The finding is preserved at `evidence/reviews/SUT-AIOS-GOV-057/mergeRiskReview-c403c1674d01450a072ed3bda556d95d21f5d361.json`; the final repair addresses each item without widening scope.
- Merge-risk review on `bfbb594db44b99cb5f8fab7fc28f34ee50afa4d1` required observable bounded `taskkill` outcomes, non-self-referential review-head evidence, and explicit changed-path-to-patch completeness. The finding is preserved at `evidence/reviews/SUT-AIOS-GOV-057/mergeRiskReview-bfbb594db44b99cb5f8fab7fc28f34ee50afa4d1.json`; the final repair addresses each item and the duplicate-key risk without widening scope.
- Semantic review on `81b1791aecb55419206eac763d887b13772b34e7` required Windows terminal ordering to await both the `taskkill` outcome and root-child close. The finding is preserved at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-81b1791aecb55419206eac763d887b13772b34e7.json`; deterministic coverage now proves a late tree-termination failure cannot emit `cancelled` or persist a review.

## Rollback

Revert the GOV-057 commit/PR. A cancelled review emits its terminal state and persists no review result.
