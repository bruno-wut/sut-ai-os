# SUT-AIOS-GOV-051 implementation handoff

## Outcome

The verifier admits only the exact planned P2-006 command
`node tests/data-governance/validate-data-minimisation-retention-contract-v1.mjs`.
It maps that literal to `node` with exactly one fixed repository-relative
forward-slash argument; the existing process runner uses `shell: false`.

The focused self-test accepts that one literal and rejects 17 near misses:
leading, doubled, and trailing whitespace; an extra argument; `&&`, `||`, and
`;` chaining; output redirection; dollar-parenthesis and backtick substitution;
alternate and sibling validators; a `./` path; `..` traversal; POSIX and Windows
absolute paths; and Windows path separators. No generic
`tests/data-governance/**` grammar or arbitrary argument execution was added.

GOV-051 does not create or run the future P2-006 validator, schema, canonical
policy, contract module, data classification, minimisation or aggregation
behavior, retention action, deletion, archival, transfer, storage, queue,
workflow, AI invocation, external call, authorization, or production behavior.

## Implementer checks

- `node scripts/verify/verify-cli.mjs --self-test` - passed, 173 checks.
- `node scripts/task/validate --all` - passed.
- `node scripts/github/validate-governance.mjs` - passed.
- `npm run verify:fast` - passed.
- `git diff --check` - passed.

The implementer will not run machine verification and is not completion
authority. Separate independent Sol QA must inspect the exact mapping and
near-miss set, rerun packet-authorized checks, run `verify:task` exactly once,
record machine evidence, and decide the verified transition.

## Rollback

Revert only the exact P2-006 mapping, its focused self-tests, verifier-policy
and risk updates, GOV-051 lifecycle record, and GOV-051 evidence. Preserve the
GOV-050 design and evidence, P2-006 backlog packet, completed records, product
paths, canonical architecture sources, immutable compatibility snapshot, and
external systems.
