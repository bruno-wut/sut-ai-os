# Supabase Production Phase 1

Run this phase before connecting live web runtimes to Supabase.

## 1. Apply the current tracked production history

Apply the migrations sequentially through the current tracked history:

- `014_reservation_audit_retention.sql`
- `015_room_type_image_urls.sql`
- `016_legal_consent_and_retention_controls.sql`
- `017_guest_booking_lookup.sql`
- `018_privacy_lookup_hardening.sql`
- `019_retention_policy_adjustments.sql`
- `023_system_health_notification_queue_summary.sql`
- `20260627170710_server_only_checkout_boundary.sql`
- `20260627170931_atomic_checkout_context.sql`
- `20260628181504_stripe_webhook_review_ledger.sql`
- `20260629074729_initial_web_room_allocation.sql`
- `20260629090138_guest_room_category_allocation.sql`
- `20260629161837_grant_server_inventory_catalog_read.sql`
- `20260703061907_harden_rls_rpc_permissions_and_fk_indexes.sql`
- `20260703062429_privatize_staff_rpc_implementations.sql`

Migration `015` ensures `public.room_types.image_url` exists and only accepts:

- local `/images/...` paths
- Cloudflare Images `https://imagedelivery.net/...` delivery URLs

Migration `016` adds PDPA consent capture, policy version fields, configurable legal retention durations, and required consent checks before Stripe or pay-at-hotel reservation finalization.

Migration `017` adds cryptographic guest lookup references and a masked server-side lookup RPC for the accountless booking-status portal.

Migration `018` validates the booking-reference format constraint, adds tenant-specific public contact fields, makes booking lookup hotel details dynamic per `hotel_id`, and adds PII scrubbing for old reservations, consent records, converted holds, and old notification events.

Migration `019` adjusts the configurable retention defaults and constraints to the currently approved production values.

Migration `023` adds the notification queue and system-health summary surfaces used by operations monitoring.

Migration `20260627170710` removes direct anonymous/authenticated access to checkout mutation functions and grants them only to `service_role`.

Migration `20260627170931` adds `create_checkout_hold_with_context`, the atomic server-only RPC used by Next.js to create a hold, select payment mode, and capture required consent in one transaction.

Migration `20260703061907` hardens RLS and RPC permissions, moves privileged helper logic behind safer wrappers, and covers previously unindexed foreign keys.

Migration `20260703062429` privatizes the staff RPC implementations so the public schema exposes only `SECURITY INVOKER` wrappers while the privileged implementations live in the private schema.

Legacy sequence versions `020`, `021`, and `022` are intentionally absent in both local and production histories. Do not invent filler migrations to close the numbering gap.

## 2. Verify the retention patch

Do not replace `run_hotel_retention_jobs()` with a simplified `RETURNS void` function. The application migration keeps the function returning `jsonb` so cron checks and tests can inspect what was pruned.

After applying migrations, run:

```sql
select public.run_hotel_retention_jobs();
```

The returned JSON should include these keys:

```json
{
  "reservation_sync_events_deleted": 0,
  "reservation_payment_events_deleted": 0,
  "reservation_edit_events_deleted": 0,
  "notification_events_deleted": 0,
  "reservation_pii_scrubbed": 0,
  "consent_pii_scrubbed": 0,
  "checkout_hold_pii_scrubbed": 0,
  "orphaned_consent_records_deleted": 0,
  "abandoned_holds_deleted": 0
}
```

The production migration prunes reservation audit rows and completed notification rows according to each hotel's `hotel_settings.audit_retention_months` value. Consent, booking PII, and abandoned-hold retention are controlled by `consent_retention_months`, `booking_pii_retention_months`, and `abandoned_hold_retention_days`.

## 3. Run bounded backfills

If upgrading from active pilot data, run these in the Supabase SQL Editor until each one returns `0`:

```sql
select public.backfill_reservation_payment_events_batch(500);
select public.backfill_notification_payment_context_batch(500);
select public.backfill_booking_reference_ids_batch(500);
```

These functions are bounded so each run handles a finite batch instead of locking or rewriting the whole table at once.

## 4. Use the transaction pooler for live runtimes

For web runtimes that can scale horizontally, use the Supabase transaction pooler connection string on port `6543`.

Do not paste secrets into source files. Put the production database URL in the deployment platform's encrypted environment variables.

Example shape:

```text
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@[REGION].pooler.supabase.com:6543/postgres
```

Use the Supabase SQL Editor or a maintenance connection for schema deployment tasks.
