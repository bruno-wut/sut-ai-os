# SUT-AIOS-GOV-033 implementation handoff

## Outcome

The governance validator now resolves task branches against exact task IDs already present in repository packets. It permits one optional uppercase alphanumeric suffix of 1–16 characters, selects the longest exact identity, and requires any following branch description to use a lowercase alphanumeric hyphenated slug.

This binds `task/SUT-AIOS-P1-006-PLAN-define-static-registry` to `SUT-AIOS-P1-006-PLAN`, not to `SUT-AIOS-P1-006`. Unknown, doubled, punctuated, overlength, and additional uppercase suffix forms remain rejected.

## Implementer checks

- `node scripts/github/validate-governance.mjs --self-test` — passed, 13 checks.
- `node scripts/github/validate-governance.mjs` — passed.
- `node scripts/task/validate --all` — passed.
- `npm run verify:fast` — passed.
- `git diff --check` — passed.

Independent semantic review and `verify:task` are intentionally pending. This implementer record is not completion authority.

## Independent QA

Independent QA confirmed that the final diff remains within the packet allowlist and does not touch forbidden paths. The branch parser:

- resolves only task IDs already present in canonical task records;
- preserves unsuffixed task IDs;
- permits exactly one optional uppercase alphanumeric suffix of 1–16 characters;
- selects the longest exact task identity, binding `SUT-AIOS-P1-006-PLAN` rather than `SUT-AIOS-P1-006`; and
- rejects unknown, doubled-delimiter, punctuated, overlength, and additional-uppercase-suffix forms.

The packet-required commands passed, and the single independent machine-verification run passed at `evidence/verification/SUT-AIOS-GOV-033/verification-20260728095821799.json`. The result remains non-production-eligible, as required.
