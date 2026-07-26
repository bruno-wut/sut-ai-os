# Acceptance matrix

| Capability | Detected command/source | Current verification behavior | Owner | Activation condition |
| --- | --- | --- | --- | --- |
| Packet/schema/lifecycle checks | root npm scripts and `scripts/task/` | Available through `verify:fast` | QA and Verification | Current governance workspace |
| Changed/prohibited paths | Git plus task packet | Available through `verify:changed` and `verify:task` | QA and Verification | Canonical JSON packet |
| Secret boundaries | Local changed readable files | Available through `verify:security-boundaries` | QA and Verification | Pattern scan; no values emitted |
| Lint/typecheck/unit tests | `reference/finalized-platform/package.json` | Blocked here | Codex Engineering Executor + QA | Approved implementation worktree with installed dependencies |
| Astro build/check | `reference/finalized-platform/website/astro-site/package.json` | Blocked here | Codex SEO and Content Executor + QA | Approved storefront worktree |
| Next.js build | `reference/finalized-platform/package.json` | Blocked here | Codex Engineering Executor + QA | Approved IBE worktree |
| Playwright | `reference/finalized-platform/playwright*.config.ts` | Blocked here | QA and Verification | Approved environment/data and worktree |
| Webhook replay | No standalone safe replay command found | Blocked | Operational Incident Investigator + QA | Scoped fixture/redaction design |
| Preview smoke/performance | Preview/Lighthouse dependencies exist but no safe local wrapper | Blocked | Release and Deployment + QA | Approved preview and no-side-effect smoke plan |
| Migration linting/database tests | `verify:migration-history`, `test:db` in baseline | Blocked here | Sol review + QA | Approved disposable database task |

Blocked means unavailable or unsafe in the current workspace, not a pass.
