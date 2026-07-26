# Supabase Live Project Status

Last verified: 2026-07-03 (Asia/Bangkok)

Project: `sri-u-thong-hotel-inventory-bridge`

Project reference: `wdqhkoddroaojbjyahej`

## Completed

- Database is active and healthy in Singapore (`ap-southeast-1`).
- Local `supabase/migrations` and production `supabase_migrations.schema_migrations` are aligned exactly without rewriting applied history.
- The currently tracked production migration history is:
  - `001` through `019`
  - `023_system_health_notification_queue_summary`
  - `20260627170710_server_only_checkout_boundary`
  - `20260627170931_atomic_checkout_context`
  - `20260628181504_stripe_webhook_review_ledger`
  - `20260629074729_initial_web_room_allocation`
  - `20260629090138_guest_room_category_allocation`
  - `20260629161837_grant_server_inventory_catalog_read`
  - `20260703061907_harden_rls_rpc_permissions_and_fk_indexes`
  - `20260703062429_privatize_staff_rpc_implementations`
- Legacy sequence versions `020`, `021`, and `022` remain intentionally unused on both local and production histories. Do not backfill them with synthetic migrations.
- All public tables have RLS enabled.
- `pg_cron`, `pgcrypto`, and `uuid-ossp` are enabled.
- Operational cron runs every five minutes and is completing successfully.
- Daily retention cron is active.
- Payment-event, notification-context, and booking-reference backfills all return zero.
- The configurable retention worker completed successfully with zero errors.
- Checkout hold creation, payment-mode selection, and consent capture are service-role-only.
- `create_checkout_hold_with_context` atomically prepares the complete checkout hold.
- The retention-policy reconciliation migration `019_retention_policy_adjustments` is applied live and tracked.
- The system-health summary migration `023_system_health_notification_queue_summary` is applied live and tracked.
- The July 3 database hardening migrations are applied live and tracked.
- The local Next.js environment uses the project URL and publishable key.
- `CHECKOUT_HOLD_LIVE_ENABLED` is enabled locally for end-to-end validation.

## Owner actions required

1. Rotate the database password and Supabase secret API key because real credentials were previously stored in an example file.
2. Update `.env.local` and the Cloudflare Worker secrets with the rotated secret key. Never place it in a public or example file.
3. In Supabase Auth, create the first hotel staff user.
4. Link that Auth user to the hotel with an active `admin` staff profile.
5. Sign in at `/staff/onboarding`, review the real room types, room numbers, rates, and images, then run the one-time inventory generation.
6. In Supabase Auth URL Configuration, set the Site URL to `https://secure.sriuthonghotels.com` and add `http://localhost:3000/**` as a development redirect.
7. In Cloudflare Free-tier production, keep the single IP rate-limit rule on `POST /api/checkout/hold` before changing `CHECKOUT_HOLD_LIVE_ENABLED` to `true`; protect `/api/booking-lookup` with app-side throttling and masked responses instead of a second Cloudflare rule.
8. Complete the Supabase Auth leaked-password-protection decision separately; migration history is reconciled, but that auth setting is not part of migration tracking.

## Current reconciliation guardrails

- Run `npm run verify:migration-history` before any future deployment push or migration cleanup.
- If this check reports a mismatch, compare local filenames to `supabase_migrations.schema_migrations` first; do not rename or rewrite an already applied migration.
- If a live SQL patch must be preserved, create or keep a matching local migration file and then record the exact version and name remotely.

## Historical note

- This file previously referred to `019_server_only_checkout_boundary` and `020_atomic_checkout_context` as the forward migration boundary. That is no longer the real production history and should not be used for deployment decisions.

## Current empty-state facts

- Auth users: 0
- Staff profiles: 0
- Room types: 0
- Physical rooms: 0
- Reservations: 0
- Hotel setup completed: no

Do not activate live checkout until the first inventory generation has completed and a test booking has passed through both Stripe and pay-at-hotel flows.
