# Test ownership

| Check class | Primary owner | Independent verifier | Escalate when |
| --- | --- | --- | --- |
| Governance scripts, schemas, path controls | Codex Engineering Executor | QA and Verification Agent | shared control logic or evidence integrity changes |
| IBE build, lint, types, unit/integration tests | Codex Engineering Executor | QA and Verification Agent | booking, payment, auth, concurrency, or database impact |
| Storefront/Astro content and build | Codex SEO and Content Executor | QA and Verification Agent | content-schema, public claims, or performance change |
| Migration/RLS/database checks | Engineering Planner | Sol + QA | any SQL, RLS, migration, or production-data concern |
| Playwright, preview smoke, accessibility/performance | QA and Verification Agent | Release and Deployment Agent when staged | shared preview, credentials, guest data, or deployment impact |
| Security boundaries and secret scan | QA and Verification Agent | Sol for findings | secret pattern hit, authorization, payment, or privacy concern |

The implementation owner records what changed; that report is not independent verification. The verifier must be a different agent identity, name the verifier model, preserve evidence, and record unresolved risks.
