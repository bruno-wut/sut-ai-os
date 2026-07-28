# SUT-AIOS-GOV-035 implementation handoff

## Outcome

The verifier now admits only the exact planned P1-007 command `node tests/orchestrator/validate-kill-switch-controls-v1.mjs`. It maps the command to `node` with exactly one fixed path argument; the existing process runner uses `shell: false`.

Whitespace variants, extra arguments, alternate and sibling paths, and shell-operator forms remain rejected. No generic `tests/` command grammar was added, and this governance task does not create or run the future product validator.

## Implementer checks

- `node scripts/verify/verify-cli.mjs --self-test` — passed, 71 checks.
- `node scripts/task/validate --all` — passed.
- `npm run verify:fast` — passed.
- `git diff --check` — passed.

Independent semantic review and `verify:task` remain pending. This implementer record is not completion authority.

## Independent QA verification

Independent Sol QA inspected the final diff against `origin/main` at `91a56ef`
and confirmed that the implementation adds one byte-for-byte command mapping
only. The fixed mapping launches `node` with exactly one validator-path argument
through the existing `shell: false` runner. The self-test covers the admitted
literal and rejects trailing whitespace, an extra argument, a shell operator,
an alternate validator, a `./` path variation, and a semicolon command chain.
No generic or pattern-based `tests/` admission was introduced.

QA reran the packet-authorized deterministic checks:

- `node scripts/verify/verify-cli.mjs --self-test` — passed, 71 checks.
- `node scripts/task/validate --all` — passed.
- `npm run verify:fast` — passed.
- `git diff --check` — passed.
- `npm run verify:task -- --task SUT-AIOS-GOV-035 --verifier-agent qa-verification --verifier-model gpt-5.6-sol --acceptance-confirmed` — passed once.

Machine evidence:
`evidence/verification/SUT-AIOS-GOV-035/verification-20260728111144993.json`.

The future P1-007 product validator remains intentionally absent and was not
executed. This task grants no production eligibility or generic command
execution.
