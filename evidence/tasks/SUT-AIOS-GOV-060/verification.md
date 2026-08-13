# SUT-AIOS-GOV-060 verification

## Scope

GOV-060 repairs only P3-002 Workflow V1 execution readiness. It registers the exact `test:event-delivery` package script, admits that exact literal through a fixed shell-free verifier mapping, adds exact and near-miss self-tests, and corrects the bounded P3-002 packet. No event-delivery implementation or validator is added or executed.

## Implementation boundaries

- `npm run test:event-delivery` maps exactly to `node tests/event-delivery/validate-event-delivery-v1.mjs`.
- `verify:task` launches `node` with `shell: false` and one fixed path argument; it does not invoke npm or a shell for the admitted command.
- The P3-002 packet remains Workflow V1 with its canonical Terra implementation route and independent Sol verification command.
- Package-lock, event-delivery service/tests/docs, Workflow V2, CI, schemas, providers, production behavior, credentials, and external systems are untouched.

## Executor verification

The executor ran only packet-authorized commands:

- `node scripts/task/validate --task SUT-AIOS-P3-002` — pass; the corrected backlog packet is valid and execution-ready.
- `node scripts/task/validate --task SUT-AIOS-GOV-060` — pass; the active packet is valid and execution-ready.
- `node scripts/verify/verify-cli.mjs --self-test` — pass; 227 checks, including the exact event-delivery mapping and 17 near-miss rejections.
- `node scripts/task/validate --all` — pass.
- `node scripts/github/validate-governance.mjs` — pass; the seven changed paths are within GOV-060's allowlist, forbidden paths are untouched, and no configured secret pattern was detected.
- `git diff --check` — pass.
- `npm run verify:fast` — pre-commit fail only in `node scripts/codex/validate-routing.mjs`: its synthetic Workflow V2 review launch rejects the executor's necessarily dirty, uncommitted worktree with `Review launches require a clean committed working tree`. The other three fast-verification components pass. This command must be rerun on the clean committed head before independent QA.

The future `npm run test:event-delivery` command was deliberately not run because GOV-060 forbids adding the P3-002 validator; P3-002 will supply and execute it in its own governed implementation branch.

Independent `qa-verification` and machine-readable evidence remain required before lifecycle advancement.

## Rollback

Revert only the GOV-060 packet and evidence, exact package script, exact verifier mapping/self-tests, P3-002 packet correction, verification-policy paragraph, and risk entries. Preserve P3-001 history and all prior evidence.
