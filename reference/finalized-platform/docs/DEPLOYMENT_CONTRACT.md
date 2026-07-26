# Deployment Contract

This document defines the agreed deployment architecture and implementation rules for Sri U-Thong Grand Hotel.

## Target Architecture

- Astro hotel marketing website deploys on Cloudflare Pages.
- Next.js Hotel Inventory Bridge deploys on Cloudflare Workers using OpenNext.
- Supabase remains hosted on Supabase.
- Stripe remains hosted on Stripe.
- Email delivery remains hosted by the selected provider such as Resend or SendGrid.

## Non-Negotiable Platform Rules

### Cloudflare runtime

- The Next.js Worker deployment must account for Cloudflare `nodejs_compat`.
- The Next.js app must not be treated as a static-only Cloudflare Pages project.
- Assume Astro and Next.js have separate deployment pipelines even if they share one repository.

### Supabase security boundaries

- Never expose `SUPABASE_SERVICE_ROLE_KEY` to browser code.
- Privileged Supabase operations must remain server-side only.
- Create request-scoped auth helpers inside request handlers when request context is needed.
- Do not rely on long-lived global database connection behavior.
- Public anonymous read flows may call Supabase directly from the browser only when protected by correct RLS.

### Quota protection

- Cloudflare Workers free tier has a hard dynamic request cap. Implementation must avoid wasting Worker invocations on brochure or anonymous read traffic where safe alternatives exist.
- Static hotel content should be prerendered or cached aggressively.
- Avoid unnecessary server hops for public availability/search flows when browser-to-Supabase access is safe under RLS.
- Constrain image sizes and responsive variants deliberately.
- Do not generate uncontrolled image transformation variants.

## Flow Placement Rules

### Safe for browser to Supabase direct access

These may be moved client-side when protected by RLS and when no privileged secret is required:

- public room availability reads
- public room type and amenity reads
- public pricing rule reads that are intentionally exposed
- guest-facing anonymous search/filter interactions

### Must remain server-side

These must stay in Next.js server routes / Cloudflare Worker execution only:

- checkout hold creation
- Stripe payment finalization
- pay-at-hotel finalization
- staff-only reservation operations
- notification processing
- cron/operations endpoints
- any service-role RPC
- any action that writes privileged audit or operational records

## Cloudflare Free-Tier Assumptions

Implementation should assume the following constraints matter during early launch:

- dynamic Worker execution budget is limited and must be treated as scarce
- static Pages delivery is suitable for marketing traffic
- image transformation usage must be controlled
- the first likely traffic bottleneck is Cloudflare Worker request volume, not Astro static traffic

## Supabase Free-Tier Assumptions

Implementation should assume:

- database size is limited
- storage is limited
- egress is limited
- free tier is acceptable for early launch, but not for careless repeated dynamic fetch patterns

## Environment Variable Rules

### Public variables

Public browser-safe variables may be exposed only when intentionally needed by browser code.

Examples:

- public Supabase URL
- public Supabase anon key
- public site URL values

### Server-only secrets

These must remain server-side only:

- `SUPABASE_SERVICE_ROLE_KEY`
- `HOTEL_ID` — the Supabase hotel UUID used by server-only webhook audit records
- Stripe secret key
- Stripe webhook secret
- email provider API keys
- cron secrets
- internal webhook secrets

## Manual Dashboard Work Expected

The implementer may prepare code and config, but the project owner is expected to complete dashboard actions such as:

- Cloudflare project creation and domain binding
- Cloudflare compatibility settings such as `nodejs_compat`
- Cloudflare environment variable entry
- Supabase auth redirect URL configuration
- Stripe webhook registration
- email provider domain and API key setup

## Implementation Priorities

1. Make Astro deployment clean on Cloudflare Pages.
2. Make Next.js deployment clean on Cloudflare Workers with OpenNext.
3. Preserve security boundaries for Supabase and Stripe.
4. Reduce dynamic Worker load wherever safe.
5. Keep deployment configuration explicit and documented.
6. Prefer simple, verifiable deployment behavior over clever abstractions.

## Explicit Do-Not Rules

- Do not expose service-role secrets to client code.
- Do not route all guest reads through Next.js by default if direct browser access is safer for Cloudflare quota.
- Do not assume Vercel-specific behavior in deployment code.
- Do not add deployment complexity that has no clear operational benefit.
- Do not treat the free tier as infinite capacity.

## Required Handoff From Implementation

Any deployment-readiness implementation must finish with:

- repo changes made
- scripts/config added or changed
- dashboard actions still required from the owner
- known free-tier risks that remain
- local verification status
- exact deployment order
