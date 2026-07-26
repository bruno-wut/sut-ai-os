# Compatibility Baseline Build Validation

**Date:** 2026-07-26 (ICT)
**Baseline:** `reference/finalized-platform/` from commit `dbce321f61144b50a94bd11a068fa5897b0f2293`
**Method:** Fresh disposable copy outside the repository; the immutable snapshot was not installed into or built in place.

## Commands and result

| Application | Commands | Result |
| --- | --- | --- |
| Next.js IBE and Staff application | `npm ci`, `npm run build` | Passed |
| Astro storefront | `npm ci`, `npm run build` | Passed |

## Recorded baseline warnings

No warning was repaired in this task.

### Next.js build

- Missing secret names were reported in the isolated, no-secret validation environment: `CRON_SECRET`, Resend, Stripe, and Supabase service-role settings. No secret values were supplied or changed.
- Next.js reports that the `middleware` file convention is deprecated in favor of `proxy`.
- The build reports a Node API use in `@supabase/supabase-js` within an Edge Runtime import trace.
- Webpack reports cache serialization performance warnings.

### Astro build

- The configured `src/content/news/` base directory is absent.
- Static prerendering reports repeated use of `Astro.request.headers`; request headers are unavailable on prerendered pages.

### Dependency audit output

- Root compatibility application: npm reported 7 high-severity audit findings after installation.
- Astro storefront: npm reported 1 low- and 6 high-severity audit findings after installation.

### Previously recorded static-analysis debt

The historical workspace audit records 6 ESLint errors and 1 warning in the finalized application. Lint was not rerun or repaired during this structure-only task.

## Boundary confirmation

- No files under `reference/finalized-platform/` were changed.
- No deployment, database, Cloudflare, payment, DNS, or remote action was run.
- Generated dependencies and build output exist only in the disposable validation copy and are not repository artifacts.
