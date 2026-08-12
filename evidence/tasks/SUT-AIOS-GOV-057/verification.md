# SUT-AIOS-GOV-057 Verification

## Scope

Bounded Workflow V2 review-runner repair only. P3-001 and all production, deployment, provider, package, unrelated schema, and fallback behavior are excluded. The sole schema change admits task-bound durable launcher traces under the existing review evidence namespace.

## Implementation evidence

The implementation, evidence, and lifecycle records are committed before review.
Every command below is rerun on that clean committed review head immediately
before the SHA-bound review stages. The review artifacts are the authoritative
head binding; this evidence intentionally avoids embedding its own commit SHA,
which would create an impossible self-reference.

- `node tests/codex/validate-review-runner.mjs` — passed (112 checks).
- `node tests/codex/v2-review-lifecycle.mjs` — passed (94 checks).
- `node tests/review/validate-review-binding.mjs` — passed (9 checks).
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

The final evidence-sequence repair also uses `--no-renames` consistently for
changed-path inventory and per-path patches, requires an uncommitted
`verification-<head-sha>.json` record before any real review launch, and refuses
merge-risk review until passing plan and semantic artifacts bind that same base
and head. Those three inputs are included in the governed context manifest.

CLI execution and Codex-app persistence now share that same evidence-sequence
gate. Prerequisites are revalidated against packet-authorized reviewer, model,
effort, output hash, context binding, trace binding, and successful completion;
negative fixtures reject missing evidence, missing or failed traces, and forged
reviewer, model, or effort fields before merge-risk persistence.

POSIX cancellation escalates the isolated process group only while its original
child remains live; child close cancels pending escalation. Launcher-bound context files are rehashed against
the governed repository, and the shared evidence-sequence gate runs again at
the persistence boundary so verification or prerequisite drift fails closed.

Codex-app persistence now applies the same final boundary to current HEAD,
canonical base, every ordinary context file, and repository-contained paths
before writing either its run envelope or review result.

The CLI uses that same final revision, complete-context, and evidence gate in
the block immediately preceding its trace and review-result persistence.

Review preflight failures also pass through structured progress and exactly one
failed terminal trace event, and a `pass` assessment carrying blocking findings
is rejected before launcher binding or persistence.

Launcher review traces now persist under
`evidence/reviews/<task-id>/traces/*.jsonl`, which is packet-authorized and
committable. Validation binds that path to the task, run, reviewer, route, and
successful terminal event, so a clean CI clone no longer depends on ignored
local `artifacts/traces/**` state.

The lifecycle now distinguishes the immutable reviewed source head from its
later evidence-only commit. Verification proves source-to-evidence ancestry,
permits only same-task review and verification evidence in that commit, and
permits only the task lifecycle record afterward. This removes the impossible
requirement for a Git commit to contain a file named after its own SHA while
still rejecting every unreviewed implementation change.

Merge-risk context keeps every canonical changed path. Implementation and
governance patches remain inline; historical machine-generated files under
`evidence/reviews/**` and `evidence/verification/**` are represented by exact
patch SHA-256 plus byte length so durable review history cannot recursively
exhaust the 512 KiB ceiling. The current exact verification and same-head
prerequisite reviews and traces remain separate full governed context files.

Launcher validation now requires exactly one terminal `success` event with
`exitCode: 0`, after the sole `review-bound` event and at the end of the trace.
Review results are prepared in ignored local storage, the terminal trace is
sealed, and the result is atomically published; a crash before publication
leaves no immutable result. Captured stdout is bounded and review stderr is
byte-counted but never accumulated.

## Scope and limitations

Changed paths are limited to the GOV-057 packet/evidence, local launcher, the exact review-result trace-path schema/validator, deterministic tests, routing documentation, and risk register. No fallback, package/dependency, unrelated schema, production, provider, or P3-001 change was made.

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
- Semantic review on `51e0519f1384cacac617d35335046270386e81a0` required the cancellation controller itself to retain explicit root-child close confirmation. The finding is preserved at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-51e0519f1384cacac617d35335046270386e81a0.json`; the controller now requires and tests both confirmations before `cancelled`.
- After that correction passed plan and semantic review on `baed0a9d72cb71417d8bddde00da8ce792c8fe8c`, the complete exact merge context measured 272331 bytes because durable same-task review history is itself part of the branch diff. The user-authorized packet amendment raises only this task's cap from 262144 to 327680 bytes, below the repository-wide 524288-byte ceiling; it changes no included path, route, effort, permission, command, or product scope.
- After the shared gate added the required exact-head record and two prerequisite traces, merge preflight on `8a14b5813f7bac562de6426c566275ddf59f69a3` measured 346512 bytes. The task-local cap is therefore 393216 bytes, still below the repository ceiling, with no included-path, route, effort, permission, command, or product-scope change.
- After both adapters converged on the complete final persistence gate, preflight on `b7e6daac52e571a33a4e43aa7b143642f9e2da9f` measured 405024 bytes. The final task-local cap is 458752 bytes, still below the repository ceiling, with the same unchanged authority and product scope.
- Merge-risk review on `6aa21bed251f32ef570b3096085c8d9c3331f28d` identified the exact-head evidence self-reference, ambiguous terminal acceptance, unbounded child output, and crash window. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/mergeRiskReview-6aa21bed251f32ef570b3096085c8d9c3331f28d.json`; the source-head/evidence-head model and deterministic negatives above address it without a separate reconciliation PR.
- Plan review on `8b1926f4da17a9f50b7ff7a8f15c0ed359166fcd` identified that `routingPolicy.implementation` had drifted to Sol/high despite the recorded user approval being Terra/high workspace-write. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/planReview-8b1926f4da17a9f50b7ff7a8f15c0ed359166fcd.json`; the packet restores Terra/high while retaining Sol/high for independent plan and merge-risk assurance.
- Semantic QA on `682946b2644f4cb937f2a6b11be67a784bc705f3` identified separate direct Codex-app run-envelope and review-result writes. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-682946b2644f4cb937f2a6b11be67a784bc705f3.json`; both adapters now stage validated files, atomically publish each final path, and deterministically recover an exact partial publication by rerunning the same immutable run.
- Semantic QA on `06bc75e1d60f9158ce17a9b5c7faf7fa69e8f008` identified canonical-base resolution outside the successful-close exception boundary. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-06bc75e1d60f9158ce17a9b5c7faf7fa69e8f008.json`; current head/base resolution now passes through one fail-closed helper that records exactly one failed terminal event before any persistence.
- Semantic QA on `e80f1606c33a383ee4233f87193b6539f73b45d4` identified POSIX escalation after the original child had exited. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-e80f1606c33a383ee4233f87193b6539f73b45d4.json`; child close now cancels the escalation timer and no process-group signal is sent after the root child is no longer live.
- Semantic QA on `c89ef28ed10d33723baf7072bfaefe545c2cfa2c` identified that Codex-app persistence trusted prepared reviewer/model/effort metadata. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-c89ef28ed10d33723baf7072bfaefe545c2cfa2c.json`; final publication now re-derives launcher-owned identity, route, effort, base, head, context, and task scope from the current packet and canonical revisions, with forged-field negatives proving no file is published.
- Semantic QA on `f80dac2c3e48f0ef4222c8e61c843c69acfe7f2b` identified a final-time-of-check gap for current HEAD and complete context reconstruction. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-f80dac2c3e48f0ef4222c8e61c843c69acfe7f2b.json`; publication now re-reads HEAD and rebuilds the full current profile immediately before staging, with stale-HEAD and omitted-context negatives proving no evidence is written.
- Semantic QA on `92a761d1337328790c54ad9be946f217d448c373` identified that pass-with-blockers was procedural rather than declarative in the shared schema. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-92a761d1337328790c54ad9be946f217d448c373.json`; the schema now requires zero blocking findings for `pass`, and Codex-app zero-publication negatives enforce the same invariant.
- Merge-risk review on `acbfe16fe7aa10668156de86f94a78daa4d30182` identified that post-evidence lifecycle commits were path-restricted but not content-restricted. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/mergeRiskReview-acbfe16fe7aa10668156de86f94a78daa4d30182.json`; lifecycle validation now preserves prior transitions and evidence references exactly and admits only deterministic append-only review-to-verified and optional verified-to-done deltas.
- Semantic QA on `5f565c710a11e038c0da4bb2c31b5e1171e19a27` identified that CLI and Codex-app final publication checks still diverged. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-5f565c710a11e038c0da4bb2c31b5e1171e19a27.json`; both adapters now rebuild complete context, re-read HEAD/base, rehash governed files, recheck worktree cleanliness, and rerun evidence sequencing at the final boundary. Direct result persistence also requires one ordered successful bound launcher trace.
- Merge-risk review on `90b676798e24a87bcc4796d7ebd44dadbf1d11cf` identified that the evidence commit did not require the exact-head verification record, historical evidence changes were too broadly admitted, completion evidence was not exactly transition-bound, and traversal-shaped launcher trace paths lacked an early shared rejection. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/mergeRiskReview-90b676798e24a87bcc4796d7ebd44dadbf1d11cf.json`; the evidence chain now admits exactly the newly required verification, review, and trace files, rejects historical/unrelated evidence changes, binds verification to the final review artifact and completion to a packet-declared destination, proves each reference exists at the committed head, and rejects traversal before filesystem access.
- Semantic QA on `0626545b5d743015e52f74105b8c109f856b33db` alleged that the successful-close revision-binding call passed the wrong shape. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-0626545b5d743015e52f74105b8c109f856b33db.json`; the source and the two successfully persisted live reviews contradict that allegation because the call passes `{ headSha, baseSha }` as the helper requires. A focused positive regression now executes that exact binding object and proves a schema-valid, trace-bound semantic result persists afterward.
- Plan and semantic review passed on `58f3b5951b549656d056bb7601f17ee386bbf379`, but merge-risk preflight safely stopped before model execution when accumulated lifecycle history made the context 477043 bytes against the existing 458752-byte task cap. The cap is unchanged. The current task packet remains present in full as governed context, while its duplicate base-to-head patch is now represented by exact byte count and SHA-256 just like historical machine evidence; deterministic coverage proves the digest remains bound and the duplicated body is absent.
- Semantic QA on `4215e5f1eb07b30254500c22303a14f9d0bc5c37` identified unhandled child stdin/stdout/stderr error boundaries. The finding is retained at `evidence/reviews/SUT-AIOS-GOV-057/semanticReview-4215e5f1eb07b30254500c22303a14f9d0bc5c37.json`; synchronous stdin failure and emitted errors from all three streams now converge on one idempotent failed-terminal path, trigger bounded cancellation, and cannot proceed to review parsing or result persistence. Deterministic tests cover first-error authority, duplicate stream errors, and exactly one failed finish event.

## Rollback

Revert the GOV-057 commit/PR. A cancelled review emits its terminal state and persists no review result.
