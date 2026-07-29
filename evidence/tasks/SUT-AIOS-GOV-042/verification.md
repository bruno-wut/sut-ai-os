# SUT-AIOS-GOV-042 implementation evidence

## Outcome

The `Governance / validate` workflow now runs the exact admitted P2-002 command
`node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs` after
dependency installation, governance/task checks, and `npm run verify:fast`.
All prior workflow steps remain intact. No wildcard, matrix, argument forwarding,
shell composition, or generic test runner was added.

## Scope

The implementation changes only the governance workflow, verification policy,
risk register, GOV-042 lifecycle packet, and GOV-042 evidence. It does not alter
P2-002 product code, schemas, tests, dependencies, providers, gateways, proposals,
workflows, authorization, execution, live data, or production systems.

## Deterministic checks

| Command | Result |
| --- | --- |
| `node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs` | Passed 237 deterministic cases. |
| `node scripts/github/validate-governance.mjs` | Passed; five GOV-042 paths detected and no forbidden path or secret match found. |
| `node scripts/task/validate --all` | Passed for every canonical packet. |
| `npm run verify:fast` | Passed all four repository governance fixtures. |
| `git diff --check` | Passed. |

The first pre-realignment check correctly exposed an inherited duplicate P2-002
packet on the stacked base. That product branch was corrected separately and
GOV-042 was then realigned to corrected commit `23a773a`; all checks above are
from the corrected base. GOV-042 did not alter any P2-002 artifact.

Independent Sol QA must inspect the full stacked diff, confirm acceptance and
scope, and run `verify:task` exactly once. Final-head GitHub Actions must then
pass before approval.

## Rollback

Revert only the explicit P2-002 workflow step, GOV-042 policy/risk wording,
lifecycle record, and GOV-042 evidence. Preserve PR #84 product changes and
historical evidence, all other CI validators, completed task records, canonical
architecture sources, and the immutable compatibility snapshot.
