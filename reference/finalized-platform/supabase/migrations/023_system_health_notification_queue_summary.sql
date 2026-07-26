-- Hotel Inventory Bridge: live system-health queue counters for manager monitoring.

create or replace view public.system_health_summary
with (security_invoker = true)
as
with latest as (
  select bjr.*
  from public.background_job_runs bjr
  where bjr.job_name = 'hotel_operational_jobs'
  order by bjr.started_at desc
  limit 1
), queue as (
  select
    count(*) filter (
      where ne.status in ('pending', 'failed')
        and ne.next_attempt_at <= now()
        and ne.attempts < hs.notification_max_attempts
    )::integer as notification_ready_to_claim_count,
    count(*) filter (
      where ne.status = 'processing'
    )::integer as notification_processing_count,
    count(*) filter (
      where ne.status = 'processing'
        and ne.processing_leased_until <= now()
    )::integer as notification_stale_processing_count,
    count(*) filter (
      where ne.status = 'failed'
        and ne.attempts < hs.notification_max_attempts
    )::integer as notification_retrying_count,
    count(*) filter (
      where ne.status = 'failed'
        and ne.attempts >= hs.notification_max_attempts
    )::integer as notification_dead_letter_count
  from public.hotel_settings hs
  left join public.notification_events ne
    on ne.hotel_id = hs.id
  where hs.id = public.current_staff_hotel_id()
)
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
  ) as failures_last_24_hours,
  coalesce(queue.notification_ready_to_claim_count, 0) as notification_ready_to_claim_count,
  coalesce(queue.notification_processing_count, 0) as notification_processing_count,
  coalesce(queue.notification_stale_processing_count, 0) as notification_stale_processing_count,
  coalesce(queue.notification_retrying_count, 0) as notification_retrying_count,
  coalesce(queue.notification_dead_letter_count, 0) as notification_dead_letter_count
from (select 1) as heartbeat
left join latest on true
left join queue on true;

comment on view public.system_health_summary is
  'Manager-visible operational heartbeat with queue counters for ready, retrying, processing, stale-lease, and dead-letter notifications.';
