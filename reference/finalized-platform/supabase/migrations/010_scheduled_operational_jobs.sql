-- Hotel Inventory Bridge: scheduled hold cleanup and reservation SLA automation.

create table public.background_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null default 'running',
  metrics jsonb not null default '{}'::jsonb,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint background_job_runs_name_not_blank check (btrim(job_name) <> ''),
  constraint background_job_runs_status_valid check (
    status in ('running', 'completed', 'failed')
  ),
  constraint background_job_runs_completion_consistency check (
    (status = 'running' and completed_at is null and error_message is null)
    or (status = 'completed' and completed_at is not null and error_message is null)
    or (status = 'failed' and completed_at is not null and error_message is not null)
  )
);

create index background_job_runs_name_started_idx
  on public.background_job_runs (job_name, started_at desc);

create index background_job_runs_recent_failures_idx
  on public.background_job_runs (started_at desc)
  where status = 'failed';

alter table public.background_job_runs enable row level security;
revoke all on table public.background_job_runs from public, anon, authenticated;
grant select on table public.background_job_runs to authenticated;

create policy background_job_runs_management_select
on public.background_job_runs
for select
to authenticated
using (
  public.staff_has_any_role(array['admin', 'manager']::public.staff_role[])
);

create view public.recent_failed_background_jobs
with (security_invoker = true)
as
select
  id,
  job_name,
  error_message,
  started_at,
  completed_at
from public.background_job_runs
where status = 'failed'
order by started_at desc
limit 5;

create view public.system_health_summary
with (security_invoker = true)
as
select
  latest.id as latest_run_id,
  latest.status as latest_run_status,
  latest.started_at as latest_run_started_at,
  latest.completed_at as latest_run_completed_at,
  latest.metrics as latest_run_metrics,
  latest.id is null
    or latest.started_at < now() - interval '15 minutes' as operational_job_is_stale,
  (
    select count(*)::integer
    from public.background_job_runs failures
    where failures.status = 'failed'
      and failures.started_at >= now() - interval '24 hours'
  ) as failures_last_24_hours
from (select 1) as heartbeat
left join lateral (
  select bjr.*
  from public.background_job_runs bjr
  where bjr.job_name = 'hotel_operational_jobs'
  order by bjr.started_at desc
  limit 1
) as latest on true;

revoke all on table public.recent_failed_background_jobs
  from public, anon, authenticated;
revoke all on table public.system_health_summary
  from public, anon, authenticated;
grant select on table public.recent_failed_background_jobs to authenticated;
grant select on table public.system_health_summary to authenticated;

create or replace function public.enqueue_sla_escalations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_count integer;
begin
  with escalation_destinations as (
    select
      wr.id as reservation_id,
      wr.hotel_id,
      wr.reservation_number,
      wr.created_at,
      hs.management_email as recipient,
      'email'::public.notification_channel as channel
    from public.web_reservations wr
    join public.hotel_settings hs on hs.id = wr.hotel_id
    where wr.sync_status = 'Pending'
      and wr.created_at <= now() - make_interval(mins => hs.pending_escalation_minutes)
      and hs.management_email is not null

    union all

    select
      wr.id,
      wr.hotel_id,
      wr.reservation_number,
      wr.created_at,
      hs.management_webhook_url,
      'webhook_sms'::public.notification_channel
    from public.web_reservations wr
    join public.hotel_settings hs on hs.id = wr.hotel_id
    where wr.sync_status = 'Pending'
      and wr.created_at <= now() - make_interval(mins => hs.pending_escalation_minutes)
      and hs.management_webhook_url is not null
  )
  insert into public.notification_events (
    hotel_id,
    reservation_id,
    kind,
    channel,
    recipient,
    payload,
    idempotency_key
  )
  select
    destination.hotel_id,
    destination.reservation_id,
    'sla_escalation',
    destination.channel,
    destination.recipient,
    jsonb_build_object(
      'severity', 'high',
      'reservation_number', destination.reservation_number,
      'created_at', destination.created_at,
      'pending_minutes', floor(
        extract(epoch from (now() - destination.created_at)) / 60
      ),
      'message', 'Reservation has exceeded the PMS synchronization SLA.'
    ),
    'sla_escalation:'
      || destination.reservation_id::text
      || ':'
      || destination.channel::text
  from escalation_destinations destination
  on conflict (idempotency_key) do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

create or replace function public.run_hotel_operational_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_expired_holds integer := 0;
  v_staff_alerts integer := 0;
  v_sla_escalations integer := 0;
  v_error_message text;
  v_metrics jsonb;
begin
  insert into public.background_job_runs (job_name)
  values ('hotel_operational_jobs')
  returning id into v_run_id;

  begin
    v_expired_holds := public.release_expired_checkout_holds(null);
    v_staff_alerts := public.enqueue_pending_staff_alerts();
    v_sla_escalations := public.enqueue_sla_escalations();

    v_metrics := jsonb_build_object(
      'expired_holds_released', v_expired_holds,
      'staff_alerts_queued', v_staff_alerts,
      'sla_escalations_queued', v_sla_escalations
    );

    update public.background_job_runs
    set
      status = 'completed',
      metrics = v_metrics,
      completed_at = now()
    where id = v_run_id;

    return jsonb_build_object(
      'ok', true,
      'run_id', v_run_id,
      'metrics', v_metrics
    );
  exception
    when others then
      get stacked diagnostics v_error_message = message_text;

      update public.background_job_runs
      set
        status = 'failed',
        error_message = v_error_message,
        completed_at = now()
      where id = v_run_id;

      insert into public.notification_events (
        hotel_id,
        kind,
        channel,
        recipient,
        payload,
        idempotency_key
      )
      select
        hs.id,
        'background_job_failure',
        'email',
        hs.management_email,
        jsonb_build_object(
          'severity', 'high',
          'job_name', 'hotel_operational_jobs',
          'run_id', v_run_id,
          'error', v_error_message
        ),
        'background_job_failure:' || v_run_id::text || ':' || hs.id::text
      from public.hotel_settings hs
      where hs.management_email is not null
      on conflict (idempotency_key) do nothing;

      return jsonb_build_object(
        'ok', false,
        'run_id', v_run_id,
        'error', v_error_message
      );
  end;
end;
$$;

create or replace function public.run_hotel_retention_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_audit_events_deleted integer;
  v_job_runs_deleted integer;
begin
  v_audit_events_deleted := public.prune_inventory_change_events();

  delete from public.background_job_runs
  where started_at < now() - interval '90 days';
  get diagnostics v_job_runs_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'audit_events_deleted', v_audit_events_deleted,
    'job_runs_deleted', v_job_runs_deleted
  );
end;
$$;

revoke all on function public.enqueue_sla_escalations()
  from public, anon, authenticated;
revoke all on function public.run_hotel_operational_jobs()
  from public, anon, authenticated;
revoke all on function public.run_hotel_retention_jobs()
  from public, anon, authenticated;

grant execute on function public.enqueue_sla_escalations() to service_role;
grant execute on function public.run_hotel_operational_jobs() to service_role;
grant execute on function public.run_hotel_retention_jobs() to service_role;

comment on function public.enqueue_sla_escalations() is
  'Queues one high-priority email and/or webhook SMS escalation per Pending reservation after the configured four-hour SLA.';

comment on function public.run_hotel_operational_jobs() is
  'Five-minute worker for expired holds, two-hour staff reminders, and four-hour management escalations with durable run auditing.';

comment on function public.run_hotel_retention_jobs() is
  'Daily worker that enforces inventory audit retention and removes background-job run history older than 90 days.';

comment on view public.recent_failed_background_jobs is
  'Manager-visible latest five worker failures for the System Health dashboard.';

comment on view public.system_health_summary is
  'Manager-visible operational heartbeat that flags a missing or older-than-15-minute five-minute worker run.';

-- Supabase exposes pg_cron in supported projects. The conditional block keeps
-- local/test PostgreSQL environments portable while installing schedules when available.
do $$
begin
  if exists (
    select 1
    from pg_available_extensions
    where name = 'pg_cron'
  ) then
    execute 'create extension if not exists pg_cron';

    if to_regnamespace('cron') is not null then
      execute $schedule$
        select cron.unschedule(jobid)
        from cron.job
        where jobname in (
          'hotel-bridge-operational-jobs',
          'hotel-bridge-retention-jobs'
        )
      $schedule$;

      execute $schedule$
        select cron.schedule(
          'hotel-bridge-operational-jobs',
          '*/5 * * * *',
          'select public.run_hotel_operational_jobs();'
        )
      $schedule$;

      -- pg_cron schedules are UTC: 20:20 UTC is 03:20 in Asia/Bangkok.
      execute $schedule$
        select cron.schedule(
          'hotel-bridge-retention-jobs',
          '20 20 * * *',
          'select public.run_hotel_retention_jobs();'
        )
      $schedule$;
    end if;
  end if;
end;
$$;
