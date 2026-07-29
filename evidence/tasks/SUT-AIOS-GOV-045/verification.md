# SUT-AIOS-GOV-045 implementation handoff

## Outcome

The verifier now admits only the exact planned P2-004 command
`node tests/intervention-proposals/validate-intervention-proposal-contract-v1.mjs`.
It maps the literal to `node` with exactly one fixed repository-relative
forward-slash path argument; the existing process runner uses `shell: false`.

The self-test accepts that one literal and rejects 17 focused near misses:
leading, doubled, or trailing whitespace; an extra argument; `&&`, `||`, and
`;` chains; output redirection; dollar-parenthesis and backtick substitution;
alternate and sibling validators; a `./` path; `..` traversal; POSIX and
Windows-style absolute paths; and Windows path separators. No generic
`tests/intervention-proposals/**` grammar or arbitrary argument execution was
added.

This governance task does not create or run the future P2-004 product
validator, schema, contract module, proposal generation, provider integration,
policy, approval, workflow, executor, persistence, live-data access, or
production behavior.

## Implementer checks

- `node scripts/verify/verify-cli.mjs --self-test` — passed, 137 checks.
- `node scripts/task/validate --all` — passed.
- `node scripts/github/validate-governance.mjs` — passed.
- `npm run verify:fast` — passed.
- `git diff --check` — passed.

The implementer will not run machine verification and is not completion
authority. Separate independent Sol QA must inspect the exact mapping and
near-miss set, rerun packet-authorized checks, run `verify:task` exactly once,
record machine evidence, and decide the verified transition.

## Rollback

Revert only the exact P2-004 mapping, its focused self-tests, verifier-policy
and risk updates, GOV-045 lifecycle record, and GOV-045 evidence. Preserve the
GOV-044 design and evidence, P2-004 backlog packet, completed records, product
paths, canonical architecture sources, immutable compatibility snapshot, and
external systems.
