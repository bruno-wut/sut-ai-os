# SUT-AIOS-P2-002 implementation evidence

## Scope

Implemented exactly two closed Draft 2020-12 schemas, one runtime-safe
provider-neutral semantic contract module with two exports, one deterministic
validator, and contract documentation. No provider, model, gateway, adapter,
workflow, proposal, policy, executor, infrastructure, or production behavior
was introduced.

## Implementation observations

- Committed schemas are loaded and compiled privately; caller-supplied schemas,
  dependencies, prompts, authority claims, and executable fields are rejected.
- Structural validation is separated from deterministic semantic enforcement
  for ordering, classifications, references, ranks, confidence, and state/reason
  consistency.
- Prepared deterministic analytics remains a provenance-labelled summary of a
  canonical P2-001/R02 result; this module does not import calculator internals.
- Both public functions guard hostile JavaScript values, clone accepted data,
  deeply freeze decisions, never mutate inputs, and fail closed.

## Local checks

Executor checks on 2026-07-28:

- `node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs`
  passed 93 deterministic cases.
- `node scripts/task/validate --all` passed every packet.
- `npm run verify:fast` passed all four fast-governance checks.
- `git diff --check` passed.
- Changed-path inspection remained within the packet allowlist. A focused scan
  found no credential value or secret material; contract prose rejects those
  fields by design.

## Independent Sol QA

Independent Sol QA reviewed commit `7510a88` against `origin/main` and confirmed
the two closed schemas, four mutually exclusive result variants, exact two-export
deep-module surface, private committed authority, semantic cross-references,
human-control constants, and absence of provider or infrastructure behavior.
The exact validator passed all 93 cases; packet validation, `verify:fast`, and
`git diff --check` also passed.

The single `verify:task` cycle passed and wrote
`evidence/verification/SUT-AIOS-P2-002/verification-20260728164345860.json`.
Because the implementation was committed before QA and the packet has no
`worktree.primaryBranch`, that record's default `HEAD` comparison reports an
empty `changedPaths` array. QA therefore supplemented it without rewriting the
machine record: `verify:changed --base origin/main` inspected all nine delivery
and evidence paths with no forbidden or outside path, and
`verify:security-boundaries --base origin/main` found no configured secret
pattern. Initial attempts to invoke those two wrappers through
`verify-cli.mjs` directly failed with `Unexpected argument`; the documented npm
wrapper forms then passed. This was a command-entry diagnostic only and did not
alter the product or verification result.

The implementation acceptance review passed, but QA records
`revision-required` because the task's required machine evidence did not bind
the committed delivery diff. Preserve the first machine record and supplemental
checks, return the packet to active, and run a fresh independent cycle with an
explicit `origin/main` base. Production eligibility remains false.

## Rollback

Revert only P2-002's two schemas, contract module, validator, documentation,
task transition, and P2-002 evidence. Preserve P2-001/R02 authorities,
historical evidence, canonical architecture sources, and external systems.

## Fresh Sol QA after worktree metadata correction

Fresh independent Sol QA re-reviewed commit `7510a88` against `origin/main`.
The functional acceptance review remained passing: the exact validator passed
93 cases, all task packets validated, `verify:fast` passed, and
`git diff --check` passed. The product implementation and its deep-module,
hexagonal, fail-closed, and human-control boundaries remain accepted.

The one fresh `verify:task` cycle used explicit `--base origin/main` and wrote
`evidence/verification/SUT-AIOS-P2-002/verification-20260728164848515.json`.
Its `changedPaths` is nonempty and correctly identifies the complete delivery
diff, including the preserved earlier failed machine record. It nevertheless
failed changed-path inspection because the packet allowlist omits
`evidence/verification/SUT-AIOS-P2-002/**`; the preserved earlier record is
therefore classified as outside scope even though it is mandatory historical
verification evidence. Forbidden paths remained untouched and the secret scan
passed. Preserve both failed machine records, return the packet to active, add
only the task-specific verification-evidence directory to the packet allowlist,
and perform a new independent QA cycle. Production eligibility remains false.

## Final Sol QA after evidence-allowlist correction

Fresh independent Sol QA reviewed the complete `origin/main` diff and preserved
both earlier machine records. The exact validator passed its existing 93 cases,
all task packets validated, `verify:fast` passed outside the restricted sandbox,
and `git diff --check origin/main` passed. The first PowerShell `npm` invocation
was blocked by the workstation execution policy, and the first sandboxed
`npm.cmd` fast run could not complete its routing fixture; the approved
out-of-sandbox `npm.cmd` retry passed all four fast checks.

Acceptance remains `revision_required` for two bounded contract-assurance
defects. First, `resultSemanticsAreValid()` accepts any unique precedence-ordered
`rejected.reasonCodes`, including combinations containing
`MALFORMED_PROVIDER_RESULT` or `INTERNAL_AUTHORITY_UNAVAILABLE`; the GOV-040
design requires either code to be exclusive. Second, the validator does not yet
exercise every finite enum and boundary required by the design. Missing focused
coverage includes all intervention selections, low/high confidence bands, text
and collection boundary edges, identifier/digest edges, and the exclusive
rejection-code rule.

No `verify:task` run was made in this QA cycle because semantic acceptance could
not truthfully be confirmed. Correct only the rejected-reason semantic rule and
the finite boundary regressions, retain all historical evidence, then return the
unchanged architecture for a fresh independent Sol QA cycle. Production
eligibility remains false.

## Executor revision after final Sol QA

The bounded revision makes `MALFORMED_PROVIDER_RESULT` and
`INTERNAL_AUTHORITY_UNAVAILABLE` exclusive whenever a caller presents a
`rejected` result. Either fatal code remains valid alone; any multi-code result
containing either one now becomes the deterministic singleton
`MALFORMED_PROVIDER_RESULT` rejection.

The exact validator now exercises every finite request and result enum, all four
result variants, both fatal-code combinations, all confidence bands, and the
documented accepted and rejected edges for request/task/general identifiers,
SHA-256 digests, bounded text, scores, and request/result collections. This
adds contract assurance only; schemas, provider-neutral architecture, public
exports, and product scope are unchanged. Historical QA and machine evidence
remain intact.

Executor checks on 2026-07-29:

- `node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs`
  passed 236 deterministic cases.
- `node scripts/task/validate --all` passed every packet.
- `npm run verify:fast` passed all four fast-governance checks.
- `git diff --check` passed; line-ending notices were informational only.

The executor did not run `verify:task`. Fresh independent Sol QA remains the
sole authority for the final machine-verification cycle and transition to
`verified`.

## Final independent Sol QA

Fresh independent Sol QA inspected the complete nonempty `origin/main` diff,
the two prior failed machine records, the bounded semantic revision, expanded
validator, task packet, risk register, and implementation evidence. Both prior
findings are resolved: fatal rejected-result codes cannot be combined, and the
236-case validator covers every finite enum/result variant plus the documented
text, identifier, digest, numeric, and collection boundaries. No provider,
runtime, infrastructure, authorization, or production behavior was added.

The exact validator passed 236 cases, all task packets validated,
`npm run verify:fast` passed, and `git diff --check origin/main` passed. The
single completed machine-verification cycle used explicit `--base origin/main`
and passed changed-path and security-boundary checks, writing
`evidence/verification/SUT-AIOS-P2-002/verification-20260729111249806.json`.
An initial sandboxed invocation could not write an evidence file and terminated
with `EPERM`; it produced no machine record. The approved out-of-sandbox retry
is the sole completed cycle and authoritative final result.

Independent recommendation: `verified`. Production eligibility remains false.

## Executor remediation after external review

External review correctly identified two product-contract defects and one
separate CI-governance prerequisite. This bounded revision resolves the product
defects without editing `.github/**` or rewriting any historical evidence.

- Ajv 8.17.1 is promoted from `devDependencies` to the pinned runtime
  `dependencies` graph in both package authorities. The exact validator builds
  a disposable isolated installation containing only lockfile packages retained
  when development dependencies are omitted, loads the contract module from
  that installation, and validates a canonical request.
- Once a request passes trusted validation, every caller- or provider-supplied
  `rejected` result—including each request-level reason code—now becomes exactly
  `MALFORMED_PROVIDER_RESULT`. Only `validateIntelligenceRequest` constructs
  request-rejection decisions, while invalid requests still take precedence
  before provider output is inspected.
- The risk register no longer claims the root Ajv dependency is development-only
  after P2-002, while preserving the factual boundary that the pure P2-001
  calculator runtime does not import it.

Executor checks on 2026-07-29:

- `node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs`
  passed 237 deterministic cases, including the isolated production-only
  dependency installation and every rejected-result provenance regression.
- `npm ls --omit=dev ajv` retained pinned `ajv@8.17.1` in the production graph.
- `node scripts/task/validate --all` passed every packet.
- `npm run verify:fast` passed all four fast-governance checks.
- `git diff --check` passed; line-ending notices were informational only.

The executor did not run `verify:task`. The third external finding—the missing
P2-002 validator invocation in GitHub Actions—requires a separate governance
packet because `.github/**` remains forbidden here. Fresh independent Sol QA
must run after that governance prerequisite lands. Production eligibility
remains false.
