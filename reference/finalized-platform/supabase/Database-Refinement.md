1. Critical Backend Catches & Missing Logic
A. Infinite Growth of Audit Tables (Memory Leak)
File: 009_staff_reservation_operations.sql, 012_pay_at_hotel_bookings.sql, 013_reservation_edit_cancel_override.sql

The Issue: In 010_scheduled_operational_jobs.sql, your run_hotel_retention_jobs() function diligently prunes inventory_change_events and background job runs based on the hotel's audit_retention_months. However, you did not update this cron job to prune the newly introduced reservation_sync_events, reservation_payment_events, or reservation_edit_events.

The Risk: These tables will grow infinitely. Over a few years, a busy hotel will accumulate hundreds of thousands of historical field-edit and sync-state rows, bloating your Supabase instance and slowing down staff dashboard queries.

The Fix: You must amend run_hotel_retention_jobs() to cascade the pruning logic to these new tables.

Recommended SQL Patch:

SQL
create or replace function public.run_hotel_retention_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer := 0;
begin
  -- Existing inventory pruning
  v_deleted_count := v_deleted_count + public.prune_inventory_change_events();

  -- Add pruning for new audit tables based on hotel_settings.audit_retention_months
  delete from public.reservation_edit_events ree
  using public.hotel_settings hs
  where hs.id = ree.hotel_id
    and ree.created_at < now() - make_interval(months => hs.audit_retention_months);
  
  delete from public.reservation_sync_events rse
  using public.hotel_settings hs
  where hs.id = rse.hotel_id
    and rse.created_at < now() - make_interval(months => hs.audit_retention_months);

  delete from public.reservation_payment_events rpe
  using public.hotel_settings hs
  where hs.id = rpe.hotel_id
    and rpe.created_at < now() - make_interval(months => hs.audit_retention_months);

  -- Existing background jobs pruning
  delete from public.background_job_runs
  where started_at < now() - interval '90 days';

  return jsonb_build_object('ok', true, 'status', 'retention_enforced');
end;
$$;

---

### B. The Timezone Boundary Trap (API Input)
File: 004_guest_availability_search.sql & 006_atomic_checkout_holds.sql

The Issue: Your database brilliantly enforces the hotel's operational day using hotel_operational_date(p_hotel_id). However, the Next.js IBE will be passing p_check_in and p_check_out as standard PostgreSQL date types (strings like '2026-06-25').

The Risk: If a guest in New York (EST) attempts to book a room for "today", their local browser date might be June 24th, while the hotel in Bangkok (ICT) is already on June 25th. If the Next.js API passes '2026-06-24' to create_checkout_hold, the database will aggressively (and correctly) reject it with: "Check-in cannot be earlier than the hotel operational date."

The Fix: Your Next.js backend integration team must enforce that all date strings passed to Supabase RPCs are calculated relative to Asia/Bangkok, not the guest's local browser timezone or the Next.js edge runtime UTC.

C. Stripe Webhook Payload Security
File: 008_payment_finalization.sql

The Issue: finalize_paid_checkout_hold requires p_total_paid and rigidly verifies if p_total_paid <> v_hold.total_amount then raise exception 'PAYMENT_TOTAL_MISMATCH';.

The Risk: Because you are moving to a pure backend Next.js API route to process Stripe webhooks, the Next.js developers might be tempted to pass the total amount from a cached client state.

The Fix: Strict integration mandate: The p_total_paid variable must only be populated by event.data.object.amount_total straight from the verified, cryptographically signed Stripe Event object. Never trust the client.