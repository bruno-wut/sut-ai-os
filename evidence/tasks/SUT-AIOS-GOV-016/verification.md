# SUT-AIOS-GOV-016 Verification

## Scope

Admitted only `node tests/event-contracts/validate-normalized-system-event-contract.mjs` to the fail-closed `verify:task` parser. The mapping invokes `node` with `shell: false` and one fixed path argument.

## Deterministic checks

- `node scripts/verify/verify-cli.mjs --self-test` — passed (29 checks), including rejection of whitespace, argument, alternate-path, and shell-operator variants.
- `node scripts/task/validate --all` — passed.
- `npm run verify:fast` — passed.
- `git diff --check` — passed.
- `npm run verify:task -- --task SUT-AIOS-GOV-016 --verifier-agent qa-verification --verifier-model gpt-5.6-terra --acceptance-confirmed --base origin/main` — passed.

## Independent verification

Machine-readable result: `evidence/verification/SUT-AIOS-GOV-016/verification-20260726173920161.json`.

## Limitations and rollback

No production, staging, database, external service, credential, payment, or compatibility-baseline action occurred. Revert the parser admission, self-tests, policy text, risk record, task state, and evidence together if this command admission is withdrawn.
