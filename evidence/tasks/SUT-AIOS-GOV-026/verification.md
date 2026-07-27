# GOV-026 verification record

- Objective: Admit exact P1-005 policy-engine validator safely.
- Updated `scripts/verify/verify-cli.mjs` (`safeRequiredCommand` + `selfTest`) mapping `node tests/policy-engine/validate-deterministic-policy-evaluator.mjs` byte-for-byte with single fixed argument and `shell: false`.
- Self-test verifies rejection of invalid command variants (57 checks passed).
- Updated `docs/verification/VERIFICATION_POLICY.md` documenting admission.
- `node scripts/verify/verify-cli.mjs --self-test`: passed (57 checks).
- `npm run verify:fast`: passed.
- `npm run verify:task -- --task SUT-AIOS-GOV-026`: passed.
- `git diff --check`: passed.
