# SUT-AIOS-GOV-009 Verification Evidence

- Tool self-test: pass (`node scripts/model-run/model-run-cli.mjs --self-test`).
- Syntax check: pass (`node --check scripts/model-run/model-run-cli.mjs`).
- Empty baseline report and advisory recommender: pass; both produce structured JSON and no policy mutation.
- Task validation: pass (`npm run task:validate -- --all`).
- Fast verification: pass (`npm run verify:fast`).
- Independent verification: pass in `evidence/verification/SUT-AIOS-GOV-009/verification-20260726124806416.json`.
- Failed attempt retained: `verification-20260726124741943.json` blocked the unsafe npm indirection, then the task packet was corrected to an approved direct command.
- Side effects: local files only; no deployment, production access, external model call, secret, guest data, prompt, raw log, or policy mutation.
