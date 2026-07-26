# Production Readiness Report - Sri U-Thong Grand Hotel

Last verified: 2026-07-11

## Current Deployment Evidence

- Git `HEAD` is `d48f4c9d7c73b5e64784c173114578c4fdb3bb0e`, but it does **not**
  represent the tested release candidate because the worktree contains
  uncommitted validation changes. Staging deployment is therefore blocked until
  a release commit is created through the approved Git/Cloudflare workflow.
- `staging-preview-7q2x.sriuthonghotels.com` resolves. Both
  `secure.sriuthonghotels.com` and `book.sriuthonggrand.com` returned DNS
  `NXDOMAIN` on 2026-07-10.
- The staging database now lists `staff_manager_approval_pin_gate`.

## Executive Decision

**NOT READY - PRODUCTION BLOCKED.** Local release-candidate checks pass, but
the deployed staging environment and external launch gates do not yet provide
the evidence required for a real-money cutover.

## Latest Staging Status (2026-07-11)

- IBE commit `5a972d0b96e53311c7d7c41ce0257e2c06bb0350` is deployed as Worker
  version `b5beae2f-017b-499a-9ffb-6123daf6f219`; authenticated `/en` and
  `/th` return HTTP 200.
- Storefront commit `6b6320bca327d3cc9a2954e2ebf2b3c330b97422` is deployed to
  [staging Pages](https://codex-staging-readiness-2026.sri-u-thong-storefront-staging.pages.dev).
  All six EN/TH legal pages return HTTP 200 and footer links now use first-party
  localized Astro routes.
- Thai wrapping, line-height, flex/grid shrink boundaries, and responsive media
  constraints were hardened; the Astro build and output validator pass.
- Staging Supabase migrations through `20260710121500_staff_manager_approval_pin_gate`
  now match local history. Leaked-password protection is an accepted Free-tier
  limitation, documented for re-evaluation on plan upgrade.

## Gate Status

| Gate | Status | Evidence | Remaining action | Owner |
| --- | --- | --- | --- | --- |
| Content freeze | BLOCKED | Staging storefront visibly showed placeholder room/media copy. Local freeze validator also detects placeholders. | Approve and publish room facts, final photos, event capacities, EN/TH copy, and owner sign-off. | Hotel owner/content lead |
| Legal links / DNS | FAIL | Staging footer legal links resolve to `secure.sriuthonghotels.com`; browser verification returned DNS resolution failure. | Decide the public legal host, provision DNS/Worker route, deploy the footer configuration, then prove EN/TH policy URLs return 200. | Cloudflare/DNS operator |
| Staging PIN migration | PASS | Staging migration list contains `staff_manager_approval_pin_gate`; query confirms private PIN helper and public invoker boundary. | Deploy the current application build before the staff UI validation is repeated. | Engineering |
| Supabase security advisors | BLOCKED | Advisor reports leaked-password protection disabled and public authenticated SECURITY DEFINER warnings. | Enable leaked-password protection in Dashboard; deploy and apply the grant-hardening migration; review accepted staff-only RPC warnings. | Supabase admin/engineering |
| Stripe Live / KYC | EXTERNAL ACTION REQUIRED | Browser evidence showed Stripe Test/Staging settings only. | Confirm live account, business/director/bank verification, capabilities, payouts, and production webhook. | Hotel finance/Stripe owner |
| Cloudflare WAF/rate limits | EXTERNAL ACTION REQUIRED | Repo documents the target rule, but no deployed WAF export or dashboard evidence was available. | Enable and capture rule evidence for `POST /api/checkout/hold`; validate any webhook rule preserves Stripe delivery. | Cloudflare admin |
| Staging concurrency rehearsal | BLOCKED | Isolated harness exists but requires explicit staging database URL and `ALLOCATION_CONCURRENCY_TEST_ENABLED=true`. | Run only against staging using the approved command below. | Staging operator |
| Abandoned-hold recovery | BLOCKED | Recovery scenario is in the same isolated harness. | Run it on staging and retain output showing one released hold and restored availability. | Staging operator |
| Guest journey hardening | PASS (local) | Lookup supports only reference/email, session ID, or hold token; response is no-store; preview fallback removed; focused tests pass. | Deploy to staging and repeat browser smoke test. | Engineering |
| Staff destructive-action guardrails | PASS (local) | Self-seeded DB test validates clerk block, missing/invalid PIN block, valid PIN approval, audit entry, and version increment. | Repeat on deployed staging after app deployment. | Engineering/front desk lead |
| Thai mobile/accessibility | PASS (local) | Storefront Playwright suite passes Thai 320px overflow and reservation-drawer focus trapping. | Manual font clipping inspection on deployed staging after real Thai content is approved. | QA/content lead |
| Blog/news SEO | PASS (local safe-empty mode) | Test article removed; empty news listing is `noindex`; header/footer/home hide news until real posts exist; metadata validator passes. | Publish only owner-approved posts, then remove safe-empty posture. | Content lead |
| Cleanup script readiness | PASS | `supabase/scripts/production-clean-slate.sql` has transaction, dry run, prefix scoping, counts, and invariant checks. | Never execute until every preceding gate passes and backup is confirmed. | Release manager |
| Final smoke readiness | BLOCKED | Staging is not deployed with the validated source and legal host is unresolved. | Deploy approved build, then run documented smoke suite. | Release manager |

## Files Changed In This Validation Pass

- `wrangler.jsonc`: staging checkout holds are disabled by default.
- `src/app/(staff)/staff/reservations/[id]/stripe-actions.ts`: server-side refund reconciliation uses the service-role client.
- `supabase/migrations/20260710092951_restrict_refund_reconciliation_rpc_grants.sql`: prepares service-role-only Stripe refund reconciliation grants.
- `website/astro-site/src/content/news/test-suphanburi-weekend-guide.md`: removed non-approved test content.
- `website/astro-site/src/components/Header.astro`, `Footer.astro`, `pages/index.astro`, `pages/news/index.astro`, `layouts/BaseLayout.astro`: hide empty news from public navigation/home and noindex the empty listing.
- `docs/SUPABASE_SECURITY_DEFINER_INVENTORY.md`: documents the security-definer review.
- `docs/OWNER_LAUNCH_CONTENT_SIGN_OFF.md`: owner evidence checklist for factual public content.
- `docs/STRIPE_LIVE_EVIDENCE_CHECKLIST.md`: operator-only Stripe KYC/capability evidence checklist.

## Tests Run

```text
npm run typecheck                         PASS
npm run lint                              PASS
npm run test:db                           PASS
npm run verify:storefront:metadata        PASS
npm run test:e2e:storefront               PASS (2 tests)
npm run test -- <lookup/Stripe/guest>     PASS (23 tests)
```

The isolated staging load rehearsal is intentionally not run without both:

```text
ALLOCATION_CONCURRENCY_TEST_ENABLED=true
SUPABASE_DATABASE_URL=<staging-only database URL>
STAGING_SUPABASE_PROJECT_REF=xvvuehwohxybfwpvndas
npm run test:allocation:concurrency
```

## External Actions Required

1. Provision the legal host DNS/Cloudflare route or change the deployed footer
   to the confirmed working IBE host; prove all six EN/TH legal URLs return 200.
2. Obtain owner sign-off for final room names, capacities, translations, legal
   copy, and photography; then make `npm run verify:storefront:freeze` pass.
3. Enable Supabase leaked-password protection and deploy/apply the refund grant
   migration with the server-action update.
4. Complete Stripe Live KYC and capture the active payments/payouts capability
   evidence; keep staging on `pk_test_`.
5. Enable Cloudflare WAF/rate limiting for `POST /api/checkout/hold` and retain
   an export or screenshot of the active rule.
6. Deploy the approved source to staging and run the isolated concurrency and
   abandoned-hold rehearsal.

## Staging Deployment and Evidence Procedure

1. Commit the validated source to a dedicated release commit; record its full
   SHA in the launch decision log. Do not use the current dirty worktree as
   release evidence.
2. Let the connected Cloudflare CI deploy the commit to staging, or run only
   after the commit is checked out:

   ```text
   npm run verify:cloudflare-config
   npm run deploy:cloudflare
   ```

3. Set Cloudflare Pages staging variables to
   `PUBLIC_BOOKING_URL=https://staging-preview-7q2x.sriuthonghotels.com` and
   `PUBLIC_SUT_IBE_URL=https://staging-preview-7q2x.sriuthonghotels.com/book`.
   This keeps staging legal/footer handoffs on the working staging IBE, while
   production uses its separately provisioned public booking hostname.
4. After deployment, record the Worker version/deployment URL and rerun the
   storefront/browser smoke checks. Verify the rendered footer links, all six
   legal pages, `x-robots-tag` on staging, and Stripe Test mode.

## Cloudflare Route Protection Matrix

| Route | Application control | Required Cloudflare evidence |
| --- | --- | --- |
| `POST /api/checkout/hold` | Origin/fetch-metadata checks, idempotency-aware in-memory rate limit, no-store, server-side hold RPC. | Enabled rate-limit rule, five hold creations per IP per hour as initial ceiling, block response captured. |
| `/api/checkout/*` | Request validation, no-store, hold token/server validation, rate-limit headers. | Broader rule only if it does not block legitimate checkout retries. |
| `/api/booking-lookup` | Masked responses, no-store, app-side lookup throttling. | Optional bot/Turnstile evidence if abusive traffic appears; do not disclose lookup existence. |
| `/api/stripe/webhook` | Stripe signature verification is mandatory. | Do not rate-limit Stripe delivery blindly. If a rule exists, capture its Stripe-compatible exception/bypass evidence. |

Cloudflare rules are defense in depth; the application controls above remain the
authoritative security boundary.

## Production Cutover Sequence

Only after every gate is PASS: confirm target project/ref and backup, content
freeze, legal 200s, migration/advisor status, Stripe Live capabilities, WAF
evidence, staging rehearsal, and final smoke tests. Then inspect clean-slate
row counts, run cleanup, verify inventory/staff/settings, inject production-only
live Stripe secrets, smoke test production, and only then set
`CHECKOUT_HOLD_LIVE_ENABLED=true`.

## Residual Risks

## Staging Release Record (2026-07-10)

- Release branch: `codex/staging-readiness-20260710`
- Deployed source SHA: `b35dc2a3944b5fde0735bf7959ff0f03b3237b4f`
- Cloudflare Worker version: `c933fd5a-0c7f-47c5-97dd-e4ea2c5594af`
- Target: `https://staging-preview-7q2x.sriuthonghotels.com`
- Result: **FAILED smoke verification; do not promote.** Authenticated `/en`
  returned HTTP 500. Worker logs identify OpenNext runtime parsing of the
  global `/:path*` security-header route in `next.config.ts` as the blocker.
  This deployment is evidence of the exact source tested, not a staging PASS.

- The staging storefront is currently behind the validated source.
- Legal pages cannot be reached through the configured public host.
- Hotel content has not been owner-approved.
- Stripe KYC and Cloudflare policy evidence are external dependencies.

## Final Recommendation

Keep production blocked. Do not run cleanup, swap production environment
variables, inject live Stripe secrets, or enable live checkout holds.

## Remaining Launch Gates

1. Owner content freeze: approve final room names, capacity facts, EN/TH copy,
   photography, and legal content; make the freeze validator pass.
2. Stripe Live KYC: verify the Thai business, director, payout bank, live
   capabilities, and production webhook configuration.
3. Cloudflare WAF: enable and retain evidence for checkout-hold abuse controls
   without blocking valid Stripe webhooks.
4. Staging operational rehearsals: run concurrency, fragmented allocation,
   abandoned-hold recovery, staff conflict/PIN, and payment-locale checks.
5. Resolve or explicitly accept each remaining Supabase SECURITY DEFINER
   advisor warning and capture the review.
