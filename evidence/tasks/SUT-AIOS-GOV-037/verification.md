# SUT-AIOS-GOV-037 implementation handoff

## Outcome

The verifier now admits only the exact planned P1-008 command
`node tests/staff-os/validate-observe-only-control-views-v1.mjs`. It maps the
literal to `node` with exactly one fixed repository-relative path argument; the
existing process runner uses `shell: false`.

The self-test accepts that one literal and rejects 15 focused near misses:
leading, doubled, or trailing whitespace; extra arguments; `&&`, `||`, and `;`
chains; output redirection; dollar-parenthesis and backtick substitution;
alternate and sibling validators; a `./` path; `..` traversal; and Windows
backslash separators. No generic `tests/staff-os/**` grammar or arbitrary
argument execution was added.

This governance task does not create or run the future P1-008 validator,
schema, static artifact, UI, runtime, or production behavior.

## Implementer checks

- `node scripts/verify/verify-cli.mjs --self-test` — passed, 87 checks.
- `node scripts/task/validate --all` — passed.
- `npm run verify:fast` — passed.
- `git diff --check` — passed.

The implementer did not run machine verification and is not completion
authority.

## Independent QA verification

Independent Sol QA confirmed the exact literal mapping, one fixed Node
argument, the existing `shell: false` runner, all 15 focused near-miss
rejections, and the absence of generic Staff OS command routing or product
implementation. The reviewer reran every packet-authorized check successfully.

`verify:task` ran exactly once with acceptance confirmed and passed. Machine
evidence is recorded at
`evidence/verification/SUT-AIOS-GOV-037/verification-20260728115053566.json`.
It confirms all changed paths are allowed, forbidden paths are untouched,
security-boundary inspection passed, and `productionEligible` remains false.
