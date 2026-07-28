# SUT-AIOS-GOV-041 implementation handoff

## Outcome

The verifier now admits only the exact planned P2-002 command
`node tests/ai-analysis/validate-intelligence-provider-contracts-v1.mjs`. It
maps the literal to `node` with exactly one fixed repository-relative path
argument; the existing process runner uses `shell: false`.

The self-test accepts that one literal and rejects 15 focused near misses:
leading, doubled, or trailing whitespace; extra arguments; `&&`, `||`, and `;`
chains; output redirection; dollar-parenthesis and backtick substitution;
alternate and sibling validators; a `./` path; `..` traversal; and Windows
backslash separators. No generic `tests/ai-analysis/**` grammar or arbitrary
argument execution was added.

This governance task does not create or run the future P2-002 validator,
schemas, contract module, provider integration, proposal, workflow, executor,
live data adapter, runtime, or production behavior.

## Implementer checks

- `node scripts/verify/verify-cli.mjs --self-test` — passed, 119 checks.
- `node scripts/task/validate --all` — passed.
- `npm run verify:fast` — passed.
- `git diff --check` — passed.

The implementer will not run machine verification and is not completion
authority. Separate independent Sol QA must inspect the exact mapping and
near-miss set, rerun packet-authorized checks, run `verify:task` exactly once,
record machine evidence, and decide the verified transition.

## Rollback

Revert only the exact P2-002 mapping, its self-tests, verifier-policy and risk
updates, GOV-041 lifecycle record, and GOV-041 evidence. Preserve the P2-002
design and packet, completed records, product paths, canonical architecture
sources, immutable compatibility snapshot, and external systems.
