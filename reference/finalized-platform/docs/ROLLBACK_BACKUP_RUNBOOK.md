# Rollback and Backup Runbook

Last updated: 2026-07-09

This runbook explains how to prepare recovery points before launch and how to respond if production launch has a problem.

## Guiding Rules

- Do not improvise with production secrets during an incident.
- Prefer reversible switches first: hide booking CTAs, disable payment methods, detach a route, or roll back a deployment.
- Do not run destructive database commands during rollback.
- Do not overwrite production Supabase with staging data.
- Keep Stripe Live disabled unless it has been explicitly launched and tested.

## Backup Targets Before Launch

Capture or confirm these before production launch.

### Git

- Approved launch commit hash.
- Previous known-good production commit hash.
- Branch name used for release.
- Cloudflare deployment ID for the launch.
- Cloudflare deployment ID for the previous known-good version.

### Cloudflare

- Astro Pages project name.
- Next.js IBE/staff project or Worker name.
- Production custom domains.
- Production environment variable names, without exposing secret values.
- Compatibility date and `nodejs_compat` setting.
- Cron trigger state.
- Basic Auth or access-protection state, if any.
- DNS records before launch.

### Supabase

- Production project ref.
- Migration history state.
- Staff users and staff profiles.
- Room types.
- Room inventory.
- Daily website allotment.
- Hotel settings.
- RLS policies and key privileged RPCs.

### Stripe

- Stripe mode: Test or Live.
- Live payment enabled: yes/no.
- Webhook endpoint URL.
- Webhook event list.
- Payment methods enabled.
- Refund workflow readiness.

### Email

- Provider account.
- Sender domain.
- DNS verification state.
- API key presence in production environment.
- Webhook URL, if used.
- Test recipient or seed list.

## Quick Backup Commands

Use read-only commands unless a production change has been explicitly approved.

```powershell
git status --short
git rev-parse HEAD
git log --oneline -5
```

For Supabase production, use the dashboard or approved Supabase CLI commands only after confirming the target project ref. Never assume the active CLI project is production.

## Rollback Decision Tree

### Astro Storefront Has a Visual or Content Problem

Recommended response:

1. If the issue is minor, fix forward in Git and let Cloudflare redeploy.
2. If the issue is launch-blocking, roll back the Astro Pages deployment to the previous known-good deployment in Cloudflare.
3. If the issue affects booking trust, temporarily hide or de-emphasize booking CTAs.

Use this when:

- Images are broken.
- Layout is badly broken on mobile.
- Legal or contact links are wrong.
- Placeholder content appears in a launch-critical section.

### IBE Booking Has a Guest-Flow Problem

Recommended response:

1. Disable or hide the storefront booking CTA if needed.
2. Keep the Astro storefront live if it is healthy.
3. Roll back the IBE/staff deployment to the previous known-good deployment.
4. Verify existing reservations in Supabase before attempting any database-level action.

Use this when:

- `/book` or `/checkout` fails.
- Guests cannot complete pay-at-hotel booking.
- Thai checkout layout breaks on real mobile devices.
- Confirmation or lookup fails.

### Staff Dashboard Has an Operations Problem

Recommended response:

1. Keep public booking paused if staff cannot process reservations safely.
2. Roll back the IBE/staff deployment.
3. Use Supabase dashboard read-only checks to confirm whether guest reservations were created.
4. Record affected reservation references for manual follow-up.

Use this when:

- Staff cannot log in.
- Staff reservation queue fails.
- Cancellation or status actions error.
- Dashboard is too slow or unstable for real operations.

### Stripe Live Has a Payment Problem

Recommended response:

1. Disable Stripe payment option.
2. Keep pay-at-hotel available if it is healthy.
3. Do not delete Stripe records.
4. Check Stripe Dashboard for payment, refund, and webhook status.
5. Roll back payment-specific code only if disabling Stripe is not enough.

Use this when:

- Stripe Checkout fails.
- Webhook finalization fails.
- Payment succeeds but reservation does not finalize.
- Refund reconciliation does not match staff expectations.

## Fast Public Fallbacks

These are the safest public-facing fallback options:

- Storefront-only mode: keep Astro live and remove direct IBE booking links.
- Pay-at-hotel-only mode: keep IBE live but disable Stripe.
- Contact-to-book mode: route CTAs to phone, email, Facebook, or LINE once official LINE is available.
- Temporary maintenance note: use only if guests would otherwise enter a broken booking flow.

## Recovery Checks After Rollback

After any rollback:

- Confirm the public website loads.
- Confirm booking CTA destination is intentional.
- Confirm staff can access the current operational surface.
- Confirm no new broken reservations were created during the incident.
- Confirm Cloudflare deployment history shows the intended active version.
- Confirm Supabase data was not reverted or overwritten.
- Record what happened in the project notes or backlog.

## Incident Notes Template

- Date/time:
- Production surface affected:
- Symptoms:
- Guest impact:
- Staff impact:
- Active deployment before rollback:
- Rolled back to:
- Database changes made: yes/no
- Stripe Live affected: yes/no
- Current status:
- Follow-up fix:
