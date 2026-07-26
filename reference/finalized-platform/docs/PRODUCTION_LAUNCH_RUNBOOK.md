# Production Launch Runbook

Last updated: 2026-07-10

This runbook supports a phased launch for Sri U-Thong Grand Hotel. The recommended path is:

1. Launch the Astro storefront first as the public commercial website.
2. Launch the IBE with pay-at-hotel only after storefront and booking QA pass.
3. Enable Stripe Live later, after Stripe verifies the business and live payment checks pass.

## Launch Principles

- Production must not be changed until the owner explicitly approves a production launch.
- Staging remains the final rehearsal environment.
- Do not use local Wrangler deployment for production. Deployments should flow through GitHub and Cloudflare CI/CD.
- Do not point staging at production Supabase, production Cloudflare secrets, or Stripe Live keys.
- Stripe Live stays disabled until Stripe verification is complete and the live payment runbook is executed.
- Production is blocked until Stripe Thailand KYC has approved the hotel business registration, director identity checks, and payout bank account. Confirm the Stripe Dashboard is no longer sandbox-only before any live key is injected.
- Production is blocked until the owner signs off final room names, event capacities, Thai translations, legal copy, and photography. A passing build does not replace content approval.
- If there is any uncertainty, keep public launch limited to the Astro storefront and disable direct paid checkout.

## Current Recommended Strategy

### Phase 1A: Astro Storefront Public Launch

Goal: publish a polished commercial website that Stripe can review and guests can trust.

Launch when these are true:

- Final photography for the first public version is selected.
- Placeholder hero, room, dining, meeting, gallery, and location copy has been replaced or approved as acceptable for launch.
- English and Thai navigation, footer, booking CTAs, and legal links are working.
- Legal pages return HTTP 200 in both English and Thai.
- Booking CTAs intentionally route to the staging-approved booking path or to a controlled "book/pay at hotel" flow.
- The public domain is ready in Cloudflare DNS.

Recommended public posture:

- Website is public.
- Booking CTA is visible.
- Online Stripe payment is not promoted until Stripe Live is approved.

### Phase 1B: IBE Pay-At-Hotel Soft Launch

Goal: accept real direct bookings without online card payment.

Launch when these are true:

- Pay-at-hotel booking flow is verified end to end on staging.
- Staff dashboard can see, manage, and cancel reservations.
- Room allotment is correct for production.
- Email notification behavior is approved.
- The guest confirmation and lookup pages are acceptable in English and Thai.
- The owner confirms operational readiness for staff to handle pay-at-hotel bookings.

Recommended public posture:

- "Pay at hotel" is the only enabled payment method.
- Stripe payment option is hidden or disabled.
- Staff are trained to recognize direct website bookings.

### Phase 2: Stripe Live Payments

Goal: enable online payment after Stripe approves the business.

Launch when these are true:

- Stripe verification is approved.
- Stripe Live publishable key, secret key, and webhook signing secret are configured in the production Cloudflare environment only.
- Stripe webhook endpoint is registered against the production host.
- Live test booking is completed with a small controlled transaction if operationally acceptable.
- Refund, cancellation, reconciliation, and staff ledger behavior are verified.

## Owner Pre-Launch Checklist

- Approve final launch phase: Astro only, or Astro plus IBE pay-at-hotel.
- Confirm production domain and subdomain layout.
- Approve first-launch photography.
- Approve final launch copy for visible placeholders.
- Confirm official LINE URL or approve keeping LINE non-clickable.
- Confirm final room names, rates, occupancy, bedding, amenities, and room sizes.
- Confirm restaurant name, hours, breakfast format, and inclusions.
- Confirm venue capacities, layouts, equipment, and event contacts.
- Confirm staff are ready to receive direct bookings.
- Confirm Stripe Live remains disabled until verification is complete.

## Technical Pre-Launch Checklist

- Staging deploy is green.
- Astro staging host passes mobile and desktop smoke tests.
- IBE staging host passes guest booking smoke tests if Phase 1B is launching.
- Staff staging login works for the approved staff user.
- Legal pages work for `/en/legal/terms`, `/en/legal/privacy`, `/en/legal/cancellation`, `/th/legal/terms`, `/th/legal/privacy`, and `/th/legal/cancellation`.
- Run `npm run verify:storefront:metadata` and `npm run test:e2e:storefront` against the approved staging storefront. Check Thai 320px overflow, booking-drawer focus containment, and news canonical/hreflang/OpenGraph output.
- Run `npm run verify:storefront:freeze` only after owner content sign-off. Any placeholder marker is a launch blocker.
- Confirm Cloudflare rate limiting is active for `POST /api/checkout/hold`. Verify any broader `/api/checkout/*` rule is compatible with legitimate guests, and keep `/api/stripe/webhook` signature verification mandatory even if it has perimeter protection.
- Rehearse the two-room/three-session race, fragmented Tetris allocation, and abandoned-hold recovery. The expiry path is 35 minutes; the operational cleanup worker runs every five minutes, while the daily retention job is scheduled separately at 03:20 Bangkok time.
- Verify a front-desk user receives a version-conflict banner for stale edits and requires a manager/admin approval PIN for near-arrival cancellation. Confirm the server rejects tampered client calls.
- Production environment variables are entered in the correct Cloudflare project and environment.
- Production Supabase project has the required migrations and RLS policies.
- Production staff user and staff profile are created.
- Production room inventory and website allotment are created and reviewed.
- Email sender domain and provider settings are verified.
- Cloudflare custom domain binding is ready.
- Rollback plan has been reviewed.

## Production Release Order

1. Confirm Stripe KYC/Live activation is complete if Stripe payments are part of this launch.
2. Freeze content and collect owner sign-off for names, capacities, translations, legal copy, and media.
3. Confirm the latest staging commit hash and every validation result are approved for release.
4. Confirm the target Supabase project/ref, take or verify a backup, and inspect row counts using `supabase/scripts/production-clean-slate.sql` with dry-run mode.
5. Execute that script only for the exact synthetic-test prefix; verify inventory, staff users, and hotel settings remain intact.
6. Confirm Cloudflare WAF/rate-limit rules and production Supabase configuration/staff access.
7. Merge or promote the approved GitHub branch according to Cloudflare CI/CD, then attach or confirm the production custom domain.
8. Inject `pk_live_`, Stripe secret, and webhook signing secret only in the production Cloudflare environment. Staging remains `pk_test_` only.
9. Run production smoke tests. Set `CHECKOUT_HOLD_LIVE_ENABLED=true` only after those tests, cleanup, key swap, and WAF confirmation all pass.
10. Keep the launch window open for monitoring and rollback readiness.

## Production Smoke Tests

Run these immediately after launch.

### Astro Storefront

- Home page loads on desktop and mobile.
- English and Thai routes load.
- Language switcher works.
- Header, mobile menu, footer, and legal links work.
- Room, dining, meetings/events, gallery, location, contact, and news pages load.
- Booking CTA routes to the intended booking destination.
- No obvious placeholder text is visible on launch-critical pages.
- No horizontal scrolling appears at 320px, 360px, and 390px mobile widths.

### IBE Pay-At-Hotel

Only required if Phase 1B launches.

- `/en/book` and `/th/book` load.
- Date, guest, and room controls work on mobile.
- Room selection copy does not overflow in Thai.
- Checkout page loads in English and Thai.
- Pay-at-hotel option is available.
- Stripe option is hidden or disabled.
- Confirmation page appears after booking.
- Staff dashboard shows the new reservation.
- Guest lookup works with the confirmation reference.

### Staff

- Approved staff user can log in.
- Dashboard loads.
- Reservation queue loads.
- Reservation detail opens.
- Cancellation and status actions are visible only where appropriate.
- Staff views do not expose staging-only labels or test credentials.

## Hold Criteria

Do not launch production if any of these are true:

- Stripe Live is required for the chosen launch phase but Stripe verification is incomplete.
- Legal pages return errors.
- Booking flow cannot create a pay-at-hotel reservation when Phase 1B is included.
- Staff cannot log in.
- Production Supabase points to the wrong project or contains test-only data.
- Production Cloudflare variables are missing or copied from staging incorrectly.
- Mobile Thai checkout or booking pages show horizontal scrolling on real devices.
- The owner has not approved photography and public copy for the chosen launch phase.
- Content-freeze validation still finds placeholder copy, descriptions, or media.
- Cloudflare cannot demonstrate checkout-hold abuse protection or abandoned holds do not return inventory after expiry.

## Post-Launch Monitoring

For the first 24 hours:

- Check Cloudflare build/deployment status.
- Watch Cloudflare Worker errors for the IBE/staff app.
- Watch Supabase logs for failed RPCs, RLS errors, and auth issues.
- Watch email delivery events.
- Manually check direct booking notifications.
- Keep rollback instructions open and ready.

## Launch Decision Log

Use this section during the real launch.

- Approved launch phase:
- Approved commit:
- Approved by:
- Launch started:
- Launch completed:
- Production domain:
- Smoke test result:
- Rollback needed: yes/no
- Notes:
