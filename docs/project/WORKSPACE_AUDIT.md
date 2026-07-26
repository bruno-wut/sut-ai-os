# Workspace Audit

> Historical compatibility-baseline audit: this document records the finalized platform repository before it was separated from AI OS development. The independent AI OS repository and read-only baseline decision are documented in `REPOSITORY_SEPARATION.md`.

**Audit timestamp:** 2026-07-26 17:17 ICT (UTC+07:00)  
**Repository root:** `C:\Users\Bruno Browny\Documents\sriuthongstaging_cloned`  
**Bootstrap branch:** `chore/codex-workspace-bootstrap`  
**Base commit:** `dbce321f61144b50a94bd11a068fa5897b0f2293`  
**Canonical sources:** `docs/architecture/source/Sri U-Thong Grand Hotel AI OS.md` and `docs/architecture/source/Agent Architecture.md`

## Safety outcome

- The populated clone above is the correct implementation repository. `C:\Users\Bruno Browny\Documents\SUT_AI_OS` is a separate empty Git repository with an unborn `master` branch and was left untouched.
- Before branch creation, `main` was exactly aligned with `origin/main` (`+0/-0`).
- The only visible pre-existing work was the untracked root file `SUT Logo.png`. It remains untracked and unchanged.
- No reset, clean, deletion, stash, dependency installation, migration, database command, preview, deployment, production API call, DNS change, or secret mutation was performed.
- The two architecture documents were read completely before implementation decisions and copied byte-for-byte. Their SHA-256 hashes are recorded in `BOOTSTRAP_CHANGELOG.md`.

## Repository state

| Item | Detected state |
| --- | --- |
| Current branch | `chore/codex-workspace-bootstrap`, created from local `main` |
| Base/upstream before branching | `main` tracking `origin/main`, no ahead/behind commits |
| Base commit | `dbce321` — `style(mobile): position Accept/Reject as full-width buttons & Customise as subtle centered text link` |
| Remote | `origin` → `https://github.com/bruno-wut/sriuthongstaging.git` |
| Worktrees | One worktree only: this repository |
| Pre-existing uncommitted work | Untracked `SUT Logo.png`; preserved without modification |
| Bootstrap changes | Four requested documentation files plus their new parent directories |
| Staging/commit/push | Nothing staged, committed, or pushed by this bootstrap |

Recent history is active and primarily covers cookie-consent UI, mobile styling, brand-theme work, and related QA documentation. The eight commits inspected span `441ae83` through `dbce321` on 2026-07-23.

## Environment and tooling

| Component | Detected state | Audit note |
| --- | --- | --- |
| OS | Windows NT `10.0.26200.0` | Windows development workspace |
| Shell | Windows PowerShell `5.1.26100.8894` | Repository commands were run from PowerShell |
| Git | `2.55.0.windows.2` | Working normally |
| Node.js | `v24.16.0` | Satisfies repository engine `>=20.9.0` |
| Package manager | npm; repository declares `npm@10.8.2` | Installed npm is `11.13.0`; version drift should be resolved for reproducibility |
| Lockfiles | Root and `website/astro-site/package-lock.json`, both lockfile v3 | Two npm package boundaries |
| Codex | Desktop package `26.721.4979.0` | `codex --version` fails with Windows access denied from this shell; CLI is not currently usable here |
| GitHub CLI | Missing | Remote authentication, branch protection, checks, and PR automation could not be audited through `gh` |
| Wrangler | Project-local `4.107.0` | Present in root dependencies; no global command detected |
| Supabase CLI | Project-local `2.109.1` | Present in root dependencies; no global command detected |
| Dependency tree | `npm ls --depth=0 --omit=optional` succeeds | Installed root dependencies are internally resolvable |

## Detected stack

### Applications

- Root application: Next.js `16.2.9`, React `19.2.7`, TypeScript `5.9.3`, App Router, and a combined guest booking/staff operations application.
- Storefront: Astro declared as `^5.14.0` and resolved locally to `5.18.2` in `website/astro-site`, with Partytown and a separate npm lockfile.
- Edge runtime: OpenNext for Cloudflare `1.20.1` with Wrangler `4.107.0`.

### Data, payments, and communication

- Supabase JS/SSR clients, PostgreSQL migrations, local Supabase configuration, and SQL verification suites.
- Local Supabase configuration targets PostgreSQL major version 17. A linked-project metadata directory exists under ignored `supabase/.temp/`; its contents were not used or changed.
- Stripe `22.2.2` is implemented for checkout and webhooks.
- Opn appears in legal wording but no Opn runtime dependency or API implementation was detected.
- Resend `6.14.0` is implemented for transactional email and webhook handling.
- No LINE Messaging implementation was detected outside documentation.

### UI and validation

- Radix UI primitives, class-variance-authority, Tailwind merge utilities, Lucide, React Hook-style application patterns, and Zod `4.4.3`.
- ESLint `9.39.x`, TypeScript, Vitest, Testing Library, Playwright, axe-core, and Lighthouse are installed.

### Cloudflare configuration

- A single OpenNext Worker is configured with production/default, staging, and audit-preview environments.
- Configured capabilities include custom-domain routes, Worker service bindings, Cloudflare Images, R2 buckets, observability, and a staging five-minute cron trigger.
- Required secret names are declared, but secret values are not stored in the Wrangler configuration.
- No Cloudflare Queues or Cloudflare Workflows bindings were detected, despite both being central to the canonical target architecture.
- Deployment scripts for staging and production already exist. They were not invoked.

## Existing application architecture

The repository currently uses a two-application layout rather than the canonical target monorepo layout:

```text
repository root
├── src/                    Next.js booking engine and staff operations UI
├── website/astro-site/    Astro commercial storefront
├── supabase/               migrations, local configuration, and SQL tests
├── tests/                  Playwright IBE and storefront suites
├── scripts/                verification and database test helpers
└── docs/                   operational, legal, launch, and product documentation
```

The Next.js application currently includes guest booking, checkout, confirmation, lookup, legal pages, staff dashboard, reservations, inventory, room-type management, onboarding, and system health. API routes cover booking lookup, checkout holds, pay-at-hotel checkout, health, notification processing, Resend webhooks, and Stripe checkout/webhooks.

The canonical AI control plane is not yet present in executable code. Searches found no orchestrator service, Agents SDK runtime, `system_events`, `workflow_runs`, `approval_requests`, Cloudflare Queues, or Cloudflare Workflows implementation. No `AGENTS.md`, `apps/`, `services/`, `packages/`, `playbooks/`, `policies/`, `schemas/`, `CODEOWNERS`, or `.github` workflow structure exists.

## Existing commands

Root npm commands:

| Category | Commands |
| --- | --- |
| Local app | `npm run dev`, `npm run start` |
| Build/Cloudflare | `npm run build`, `npm run build:cloudflare`, `npm run preview:cloudflare` |
| Deployment-sensitive | `npm run deploy:cloudflare`, `npm run deploy:cloudflare:production` |
| Static verification | `npm run lint`, `npm run typecheck`, `npm run verify:cloudflare-config` |
| Unit tests | `npm test`, `npm run test:watch`, `npm run test:coverage` |
| Browser tests | `npm run test:e2e`, `npm run test:e2e:8a`, `npm run test:e2e:storefront`, `npm run test:e2e:storefront:8a` |
| Database/inventory | `npm run test:db`, `npm run test:db:baseline-010`, `npm run test:allocation:concurrency`, `npm run verify:migration-history` |
| Storefront/assets | `npm run verify:images`, `npm run verify:images:remote`, `npm run verify:storefront:metadata`, `npm run verify:storefront:freeze` |

Nested Astro commands are `npm run dev`, `npm run build`, `npm run preview`, and `npm run check` with `--prefix website/astro-site` when invoked from the root.

Commands containing deployment, remote image validation, database operations, or remote browser targets require explicit task envelopes and environment checks before future agents may run them.

## Test coverage and baseline verification

| Layer | Inventory | Bootstrap result |
| --- | --- | --- |
| Vitest | 28 test files | 28 passed; 117 tests passed in 6.10 seconds |
| TypeScript | Root `tsc --noEmit` | Passed |
| ESLint | Root `eslint . --max-warnings=0` | Failed: 6 errors and 1 warning |
| Playwright IBE | 6 spec files; Chromium, mobile Chromium, Firefox, WebKit | Not run; may start services or use configured remote targets and may mutate test data/artifacts |
| Playwright storefront | 2 spec files; same four browser projects | Not run |
| Supabase SQL | 15 SQL test files | Not run; database lifecycle was out of scope for a non-destructive bootstrap |
| Coverage tooling | V8 coverage command and reports configured | No current line/branch/function percentage was generated; no coverage thresholds are configured |
| Builds | Next.js, OpenNext, and Astro build commands exist | Not run to avoid replacing pre-existing generated `.next`, `.open-next`, and storefront output |

Current lint failures are in:

- `src/app/(guest)/layout.tsx`: explicit `any`.
- `src/app/layout.tsx`: unused caught variable warning.
- `src/components/shared/CookieBanner.tsx`: synchronous state update in an effect and explicit `any`.
- `src/lib/cookie-consent.ts`: explicit `any` usages.

These failures predate the bootstrap branch and should be treated as baseline debt, not as regressions introduced here.

## CI and repository governance

- No `.github` directory or GitHub Actions workflow is present.
- No repository-local `CODEOWNERS` or agent instruction file is present.
- Required remote branch protections and deployment environment protections could not be verified because GitHub CLI is unavailable. Their absence is not asserted, only unverified.
- The repository therefore has no locally visible required-check pipeline enforcing lint, typecheck, tests, builds, path restrictions, or architecture-policy checks.

## Environment files

| File | Git state | Notes |
| --- | --- | --- |
| `.env.example` | Tracked | 26-key development template |
| `.env.local` | Untracked and ignored | 16 populated local settings/credentials; values were not copied, reported, or changed |
| `.env.staging.example` | Tracked | 26-key staging template |
| `.env.staging.local.md` | Tracked | Byte-for-byte identical to `.env.staging.example`; misleading local-looking name is a maintenance risk |
| `.env.supabase.production.example` | Tracked | 15-key production template |

`wrangler.jsonc` includes public configuration and a Supabase publishable key, plus operational resource names and domains. The service-role, payment, webhook, email, and preview credentials are declared only by name. A future security task should still run history-aware secret scanning before automation is trusted.

## Current risks

1. **Red lint baseline:** autonomous pull-request verification cannot use lint as a required green gate until existing failures are resolved or explicitly baselined.
2. **No visible CI enforcement:** tests and deployment safety depend on manual discipline; there are no repository workflows or local CODEOWNERS rules.
3. **Powerful local deployment scripts:** both staging and production deployment commands are directly available from npm. Future agents need deny-by-default command policy and explicit production prohibition.
4. **Tooling prerequisites:** `gh` is missing and the Codex CLI executable is inaccessible from the shell, blocking automated PR creation and Codex CLI/MCP execution.
5. **Package-manager drift:** declared npm `10.8.2` differs from installed npm `11.13.0`, weakening lockfile reproducibility.
6. **Ambiguous environment filename:** tracked `.env.staging.local.md` is currently only a template duplicate, but its name can encourage secrets to be added to a tracked file.
7. **Untracked asset ownership:** `SUT Logo.png` predates bootstrap and needs an owner decision before any agent incorporates, renames, or removes it.
8. **Generated state is present:** `.next`, `.open-next`, `.wrangler`, `playwright-report`, and `test-results` exist locally and may be stale; they are ignored and were not refreshed or deleted.
9. **Local MFA posture:** local Supabase TOTP and phone MFA are disabled. Production MFA status was not queried and remains unverified against the canonical requirement.
10. **Architecture gap:** the deterministic policy engine, task envelopes, scoped executors, durable workflows, approvals, audit/outcome model, and kill switches described by the canonical documents do not yet exist.
11. **Domain inconsistency:** canonical documents, application configuration, and legal copy use multiple storefront and booking domains; this must be resolved before canonical URLs, cookies, redirects, or SEO work is automated.

## Missing prerequisites for a Codex-led multi-agent workflow

- A working shell-accessible Codex CLI (and later a reviewed Codex MCP execution mode).
- GitHub CLI installation/authentication or an approved GitHub App integration.
- Repository `AGENTS.md` defining task envelopes, path scope, command allowlists, verification requirements, stop conditions, and structured handoff format.
- CI workflows for lint, typecheck, unit tests, controlled builds, content/schema checks, and selected browser tests.
- Branch protection, required checks, CODEOWNERS, protected deployment environments, and staging/production credential separation verified in GitHub/Cloudflare.
- Machine-readable policy, event, workflow, proposal, approval, and agent-result schemas.
- Deterministic policy enforcement outside prompts, with separate identities and scoped credentials per executor.
- A documented decision on whether and how to migrate the current two-app layout toward the canonical monorepo structure.
- Baseline secret scanning, dependency/security review, and confirmation that no credentials exist in Git history.
- Verified integration plans for Cloudflare Queues/Workflows, Google Search Console/analytics, LINE, and any Opn payment support.
- Production-confirmed MFA/RLS posture and a staging-safe test-data strategy.

## Conflicts with the canonical architecture documents

| Canonical expectation | Existing repository | Required decision |
| --- | --- | --- |
| Storefront `sriuthonghotels.com`; IBE `book.sriuthonghotels.com` | Astro canonical site is `sriuthonggrand.com`; Worker/app uses `secure.sriuthonghotels.com`; legal copy also references `book.sriuthonggrand.com` | Establish authoritative storefront/IBE domains before URL or SEO automation |
| `apps/storefront`, `apps/ibe`, `apps/staff-os` plus `services/` and `packages/` | Root Next.js app combines IBE and staff UI; Astro is under `website/astro-site` | Create an ADR and staged migration plan; do not reorganize ad hoc |
| GitHub Actions, protected branches, required checks, GitHub App | No local CI, CODEOWNERS, or GitHub App configuration detected | Bootstrap governance before autonomous repository execution |
| Cloudflare Queues and Workflows as durable orchestration | Current Wrangler configuration has Worker/R2/Images/cron but no Queues or Workflows | Design the control plane in observe-only mode first |
| Staff OS orchestrator, SEO, approval, incident, audit, and outcome routes | Current staff UI covers hotel operations and system health, not AI orchestration | Add as incremental Staff OS capabilities after schemas and policy boundaries exist |
| AI control-plane tables and structured agent records | No canonical control-plane entity names detected in code or migrations | Design migrations, RLS, retention, and audit policy; production migrations remain prohibited |
| Separate intelligence agents and scoped Codex executors | No Agents SDK/model-router/task-envelope runtime detected | Establish contracts and least-privilege tool boundaries before agent implementation |
| Stripe and Opn payment services | Stripe is implemented; Opn is mentioned in legal copy only | Confirm whether Opn is planned, external, or intentionally deferred |
| MFA required for management | Local Supabase configuration has MFA disabled | Verify production independently and plan management MFA rollout |

## Recommended sequencing

The next change should be repository governance, not application reorganization: define `AGENTS.md`, machine-readable task/result contracts, deny-by-default path and command policies, and a non-deploying CI baseline. Resolve the red lint baseline and domain source-of-truth decision in parallel planning before enabling any autonomous executor.
