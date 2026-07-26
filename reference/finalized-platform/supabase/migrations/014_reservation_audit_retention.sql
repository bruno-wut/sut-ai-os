-- Hotel Inventory Bridge: retention coverage for reservation audit tables.

set lock_timeout = '5s';
set statement_timeout = '60s';

create index reservation_sync_events_hotel_created_idx
  on public.reservation_sync_events (hotel_id, created_at);

create index reservation_payment_events_hotel_created_idx
  on public.reservation_payment_events (hotel_id, created_at);

create index reservation_edit_events_hotel_created_idx
  on public.reservation_edit_events (hotel_id, created_at);

create or replace function public.run_hotel_retention_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inventory_events_deleted integer := 0;
  v_sync_events_deleted integer := 0;
  v_payment_events_deleted integer := 0;
  v_edit_events_deleted integer := 0;
  v_total_audit_events_deleted integer := 0;
  v_job_runs_deleted integer := 0;
begin
  v_inventory_events_deleted := public.prune_inventory_change_events();

  delete from public.reservation_sync_events rse
  using public.hotel_settings hs
  where hs.id = rse.hotel_id
    and rse.created_at < now() - make_interval(months => hs.audit_retention_months);
  get diagnostics v_sync_events_deleted = row_count;

  delete from public.reservation_payment_events rpe
  using public.hotel_settings hs
  where hs.id = rpe.hotel_id
    and rpe.created_at < now() - make_interval(months => hs.audit_retention_months);
  get diagnostics v_payment_events_deleted = row_count;

  delete from public.reservation_edit_events ree
  using public.hotel_settings hs
  where hs.id = ree.hotel_id
    and ree.created_at < now() - make_interval(months => hs.audit_retention_months);
  get diagnostics v_edit_events_deleted = row_count;

  v_total_audit_events_deleted :=
    v_inventory_events_deleted
    + v_sync_events_deleted
    + v_payment_events_deleted
    + v_edit_events_deleted;

  delete from public.background_job_runs
  where started_at < now() - interval '90 days';
  get diagnostics v_job_runs_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'audit_events_deleted', v_total_audit_events_deleted,
    'inventory_events_deleted', v_inventory_events_deleted,
    'reservation_sync_events_deleted', v_sync_events_deleted,
    'reservation_payment_events_deleted', v_payment_events_deleted,
    'reservation_edit_events_deleted', v_edit_events_deleted,
    'job_runs_deleted', v_job_runs_deleted
  );
end;
$$;

comment on function public.run_hotel_retention_jobs() is
  'Daily worker that enforces hotel audit retention across inventory and reservation event history, and removes background-job run history older than 90 days.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
