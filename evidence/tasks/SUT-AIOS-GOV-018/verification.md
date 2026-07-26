# GOV-018 implementation verification

- Scope: admit only `node tests/control-plane-schema/validate-control-plane-schema.mjs` to the fail-closed task verifier.
- `node scripts/verify/verify-cli.mjs --self-test`: passed (36 checks).
- `node scripts/task/validate --task SUT-AIOS-GOV-018`: passed.
- `npm run verify:fast`: passed.
- `git diff --check`: passed.

The implementation maps the literal command to `node` with exactly one fixed validator-path argument. Dedicated self-tests reject whitespace, extra arguments, alternate paths, shell operators, and unrelated control-plane-schema test paths. No generic `node tests/...` admission, product-schema artifact, validator, database, migration, deployment, credential, or external-service change is included.
