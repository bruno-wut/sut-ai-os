# Deployment Prep Checklist

Use this as the working prep list before the main thread starts Cloudflare deployment work.

## 1. Cloudflare account and projects

- Create or confirm your Cloudflare account.
- Add the production domain to Cloudflare DNS if production routing will live there.
- Decide final hostnames, for example:
  - `www.yourdomain.com` or apex for Astro website
  - `book.yourdomain.com` or `/book` path strategy for the Next.js app
  - `staff.yourdomain.com` or restricted path/domain for staff surface
- Confirm you want:
  - Astro deployed on Cloudflare Pages
  - Next.js IBE/staff app deployed on Cloudflare Workers with OpenNext

## 2. Cloudflare configuration you will need to do

- In the Next.js Cloudflare project, enable `nodejs_compat`.
- Set an appropriate compatibility date for the Worker runtime.
- Treat `wrangler.jsonc` as the single source of truth for the production Worker configuration. There is no separate email-delivery Worker in the current deployment topology.
- Keep the public hostname frozen while refinement continues. Use the `staging` Wrangler environment and `staging-preview-7q2x.sriuthonghotels.com` for private review only.
- The current production freeze state is dashboard-side and reversible: the `secure.sriuthonghotels.com` custom domain is detached from the Worker, the production cron trigger is removed, and `workers.dev` remains disabled.
- Add environment variables in the correct scope:
  - public/browser-safe vars where needed for client bundling
  - runtime secrets for server execution
- Before Cloudflare packaging checks on Windows, stop any long-running `next dev` process, then run `npm run verify:cloudflare-config`.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to client-side code.
- Optionally enable Cloudflare Images if you want Cloudflare-managed image transforms.
- Optionally enable R2 later if you want asset offload or object storage.
- On the Cloudflare Free plan, reserve the single WAF/rate-limit rule for `POST /api/checkout/hold`, with an initial ceiling of five requests per IP address per hour.
- Protect `/api/booking-lookup` with app-side throttling and generic masked responses; add Cloudflare Turnstile later if lookup attempts show bot traffic.
- Set `STAGING_PREVIEW_USERNAME` and `STAGING_PREVIEW_PASSWORD` only on the `staging` environment, and rely on the root Next.js `middleware.ts` layer to require authentication before any route, asset, or API response is served on the staging hostname.
- Do not point staging at the live Supabase, Stripe, or Resend stack. Use separate staging/test credentials and keep `CHECKOUT_HOLD_LIVE_ENABLED=false` until staging acceptance is complete.

## 3. Supabase setup

- Create or confirm the Supabase project.
- Have these ready:
  - `SUPABASE_URL`
  - publishable/anon key
  - service-role/secret key
- Confirm project region.
- Configure auth site URL and redirect URLs for the Cloudflare-hosted domains.
- Confirm whether staff auth is email/password only or another provider.
- Set `hotel_settings.public_contact_phone` and `hotel_settings.public_contact_address`; the public booking lookup page reads these dynamically per hotel.
- Keep privileged RPCs server-side only:
  - hold creation
  - Stripe finalization
  - pay-at-hotel finalization
  - notification processing
  - cron/ops routes
  - guest booking lookup RPC

## 4. Stripe setup

- Create or confirm Stripe account.
- Prepare:
  - publishable key
  - secret key
  - webhook signing secret
- Register the Cloudflare-hosted webhook endpoint once the deployment URL exists.
- Confirm pay-at-hotel and Stripe both launch on day one.
- Before live cutover, complete Stripe Thailand KYC: hotel business registration, director identification, and payout-bank verification must all be approved and the Dashboard must be out of sandbox-only mode.
- Keep `pk_test_` and all Stripe test secrets exclusively in staging. Add `pk_live_`, live secret, and live webhook signing secret only to production after every launch gate has passed.

## 5. Email / notifications

- Provider: Resend.
- Complete `RESEND_PRODUCTION_RUNBOOK.md`, including sender-domain DNS,
  production secrets, signed webhook registration, Cron Trigger verification,
  suppression testing, and seed-list delivery testing.
- The Resend webhook and notification worker run inside the main OpenNext Cloudflare Worker on `secure.sriuthonghotels.com`; do not create a second Worker for these paths.
- Do not enable the scheduled notification trigger on staging while it points at live infrastructure. Keep staging cron-disabled unless it has isolated queue, email, and database resources.
- When production is ready to reopen, reattach the custom domain and recreate the cron trigger against the already-preserved Worker version instead of forcing an application rollback first.

## 6. App architecture rules for implementation

- Astro site stays mostly static.
- Next.js app uses Cloudflare Workers via OpenNext.
- Public anon availability/search flows can go browser -> Supabase directly when protected by RLS.
- Privileged operations stay server-side.
- Request-scoped auth helpers should be created inside request handlers.
- Avoid request-bound global state.
- Cache or prerender brochure/static hotel content.
- Constrain image sizes/variants deliberately to control transform volume.

## 7. Free-tier risk points to watch

- Cloudflare Workers free cap: `100,000 requests/day` for dynamic execution.
- Cloudflare Images free cap: `5,000 unique transformations/month`.
- Supabase free caps most relevant here:
  - `500 MB` database
  - `1 GB` storage
  - `5 GB` egress
  - `50,000` MAU
  - `500,000` Edge Function invocations
- First likely constraint for your app is Cloudflare dynamic request volume, not Astro traffic.

## 8. Things you should do personally before the main thread proceeds

- Create or confirm Cloudflare account and domain control.
- Create or confirm Supabase project.
- Create or confirm Stripe account.
- Create or confirm email provider account.
- Decide final domain/subdomain layout.
- Be ready to enter dashboard secrets and redirect URLs when Codex tells you exactly where.
# Checkout hold activation gate

The application includes `/api/checkout/hold` and the atomic `create_checkout_hold_with_context` RPC. The route remains non-mutating while `CHECKOUT_HOLD_LIVE_ENABLED=false`. Set it to `true` only after all of the following are complete:

- The Supabase production project matches the local migration history exactly through `20260703062429_privatize_staff_rpc_implementations.sql`.
- Legacy three-digit versions `020`, `021`, and `022` are intentionally absent in both local and production histories; do not invent filler migrations for them.
- The route uses the server-only Supabase service-role client.
- The route passes only `checkoutHoldRequestSchema` output to `create_checkout_hold_with_context`.
- Cloudflare has an IP-based rate-limit rule for `POST /api/checkout/hold`, with an initial ceiling of five hold creations per IP address per hour.
- Confirm the rule is enabled in the production zone and that any protection applied to `/api/stripe/webhook` permits legitimate Stripe retries; webhook signature verification is still required.
- Cloudflare Turnstile or equivalent bot protection is enabled for suspicious checkout traffic.
- Rate-limit responses do not reveal inventory counts or whether an attempted hold would have succeeded.
- Network retries retain the same cart-bound idempotency key, while any cart change creates a new key.
- Tests pass from at least one browser timezone outside Thailand and from the UTC Cloudflare runtime.
- A real abandoned hold has been verified to expire after 35 minutes and return inventory; the five-minute `hotel-bridge-operational-jobs` worker has been verified as the stale-record recovery path.
