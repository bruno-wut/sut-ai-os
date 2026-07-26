# GOV-020 implementation verification

- Scope: admit only `node tests/audit/validate-append-only-audit-contract.mjs` to the fail-closed task verifier.
- `node scripts/verify/verify-cli.mjs --self-test`: passed (43 checks).
- `node scripts/task/validate --task SUT-AIOS-GOV-020`: passed.
- `npm run verify:fast`: passed.
- `git diff --check`: passed.

The implementation maps the literal command to `node` with exactly one fixed validator-path argument. Dedicated self-tests reject whitespace, extra arguments, alternate paths, shell operators, and unrelated audit test paths. No generic `node tests/...` admission, audit contract artifact, database, migration, network, credential, or production change is included.
