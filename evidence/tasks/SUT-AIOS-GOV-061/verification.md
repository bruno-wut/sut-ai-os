# SUT-AIOS-GOV-061 implementation evidence

## Scope

This governance correction makes the existing P3-003 Workflow V1 packet executable without implementing workflow behavior. It registers one exact package script, adds the package manifest and fixed independent verification command to the P3-003 packet, admits only that exact test literal in the shell-free verifier, and documents the bounded authority.

## Implemented controls

- `package.json` maps `test:workflow` exactly to `node tests/workflow-runtime/validate-workflow-runtime-v1.mjs`.
- P3-003 remains a Workflow V1 packet routed to `gpt-5.6-sol` with only `codex-engineering-executor` and `qa-verification`; it now allows and includes `package.json` and authorizes the fixed base-bound independent verification command.
- `safeRequiredCommand` maps only `npm run test:workflow` to `node` with one fixed validator-path argument; child execution remains `shell: false`.
- Self-tests reject whitespace, extra-argument, shell-operator, alternate-syntax, alternate-path, and path-separator near misses.
- Verification policy and the risk register state that this change creates no generic command runner and neither adds nor executes the future P3-003 implementation or validator.

## Executor verification

- `node scripts/verify/verify-cli.mjs --self-test` — passed, 245 checks.
- `node scripts/task/validate --task SUT-AIOS-P3-003` — passed; corrected backlog packet is valid and execution-ready.
- `node scripts/task/validate --task SUT-AIOS-GOV-061` — passed; active governance packet is valid and execution-ready.
- `node scripts/task/validate --all` — passed.
- `node scripts/github/validate-governance.mjs` — passed; task identity, allowlist, forbidden paths, secret scan, schemas, policies, and agent definitions passed.
- `git diff --check` — passed.
- `npm run verify:fast` — reached the repository's clean-head-sensitive Codex-routing check and failed only that check while the authorized GOV-061 implementation remained uncommitted; task validation, worktree self-test, and lifecycle self-test passed. The orchestrator must commit the bounded head and rerun this exact command before independent QA.

Independent verification must be recorded separately under `evidence/verification/SUT-AIOS-GOV-061/` after the clean committed head exists.

## Boundaries

No workflow implementation, workflow test, package-lock, CI workflow, Workflow V2 machinery, schema, provider, production behavior, credential, or external system was changed or accessed.
