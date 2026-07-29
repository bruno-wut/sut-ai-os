# SUT-AIOS-GOV-048 implementation handoff

## Outcome

The verifier admits only the exact planned P2-005 command
`node tests/infrastructure-contracts/validate-infrastructure-port-contract-v1.mjs`.
It maps that literal to `node` with exactly one fixed repository-relative
forward-slash argument; the existing process runner uses `shell: false`.

The focused self-test accepts that one literal and rejects 17 near misses:
leading, doubled, and trailing whitespace; an extra argument; `&&`, `||`, and
`;` chaining; output redirection; dollar-parenthesis and backtick substitution;
alternate and sibling validators; a `./` path; `..` traversal; POSIX and
Windows absolute paths; and Windows path separators. No generic
`tests/infrastructure-contracts/**` grammar or arbitrary argument execution was
added.

GOV-048 does not create or run the future P2-005 validator, schema, canonical
policy, contract module, provider adapter, authentication, network, persistence,
queue, workflow, deployment, external call, authorization, or production
behavior.

## Implementer checks

- `node scripts/verify/verify-cli.mjs --self-test` - passed, 155 checks.
- `node scripts/task/validate --all` - passed.
- `node scripts/github/validate-governance.mjs` - passed.
- `npm run verify:fast` - passed.
- `git diff --check` - passed.

The implementer will not run machine verification and is not completion
authority. Separate independent Sol QA must inspect the exact mapping and
near-miss set, rerun packet-authorized checks, run `verify:task` exactly once,
record machine evidence, and decide the verified transition.

One initial lifecycle invocation used `task-cli.mjs review` instead of the
command wrapper `scripts/task/review` and was rejected before changing state.
The corrected wrapper invocation completed the intended `active -> review`
transition; this operator error did not affect implementation or test results.

## Rollback

Revert only the exact P2-005 mapping, its focused self-tests, verifier-policy
and risk updates, GOV-048 lifecycle record, and GOV-048 evidence. Preserve the
GOV-047 design and evidence, P2-005 backlog packet, completed records, product
paths, canonical architecture sources, immutable compatibility snapshot, and
external systems.
