-- Production delivery outcomes, provider webhook ledger, suppression, and
-- controlled dead-letter recovery for transactional email.

create type public.notification_provider_status as enum (
  'accepted',
  'delayed',
  'delivered',
  'bounced',
  'complained',
  'failed',
  'suppressed'
);

alter table public.notification_events
  add column provider_status public.notification_provider_status,
  add column provider_status_at timestamptz,
  add column delivered_at timestamptz,
  add column dead_letter_resolved_at timestamptz,
  add column dead_letter_resolved_by uuid references auth.users(id) on delete set null,
  add column dead_letter_resolution text,
  add constraint notification_events_provider_status_consistency check (
    (provider_status is null and provider_status_at is null)
    or (provider_status is not null and provider_status_at is not null)
  ),
  add constraint notification_events_delivered_consistency check (
    delivered_at is null or provider_status is not null
  ),
  add constraint notification_events_dead_letter_resolution_consistency check (
    (
      dead_letter_resolved_at is null
      and dead_letter_resolved_by is null
      and dead_letter_resolution is null
    )
    or (
      dead_letter_resolved_at is not null
      and dead_letter_resolved_by is not null
      and nullif(btrim(dead_letter_resolution), '') is not null
    )
  );

create index notification_events_provider_delivery_idx
  on public.notification_events (provider_delivery_id)
  where provider_delivery_id is not null;

create table public.notification_provider_events (
  id uuid primary key default gen_random_uuid(),
  webhook_event_id text not null,
  provider text not null default 'resend',
  provider_delivery_id text not null,
  event_type text not null,
  occurred_at timestamptz not null,
  recipient text,
  details jsonb not null default '{}'::jsonb,
  notification_event_id uuid references public.notification_events(id) on delete set null,
  received_at timestamptz not null default now(),
  constraint notification_provider_events_webhook_unique unique (provider, webhook_event_id),
  constraint notification_provider_events_provider_not_blank check (btrim(provider) <> ''),
  constraint notification_provider_events_delivery_not_blank check (btrim(provider_delivery_id) <> ''),
  constraint notification_provider_events_type_not_blank check (btrim(event_type) <> '')
);

create index notification_provider_events_delivery_idx
  on public.notification_provider_events (provider, provider_delivery_id, occurred_at desc);

create table public.email_suppressions (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  email text not null,
  reason text not null,
  source_event_type text not null,
  provider_delivery_id text,
  created_at timestamptz not null default now(),
  cleared_at timestamptz,
  cleared_by uuid references auth.users(id) on delete set null,
  clear_reason text,
  constraint email_suppressions_email_normalized check (email = lower(btrim(email))),
  constraint email_suppressions_email_not_blank check (email <> ''),
  constraint email_suppressions_reason_not_blank check (btrim(reason) <> ''),
  constraint email_suppressions_clear_consistency check (
    (
      cleared_at is null
      and cleared_by is null
      and clear_reason is null
    )
    or (
      cleared_at is not null
      and cleared_by is not null
      and nullif(btrim(clear_reason), '') is not null
    )
  )
);

create unique index email_suppressions_active_hotel_email_unique
  on public.email_suppressions (hotel_id, email)
  where cleared_at is null;

alter table public.notification_provider_events enable row level security;
alter table public.email_suppressions enable row level security;

revoke all on table public.notification_provider_events from public, anon, authenticated;
revoke all on table public.email_suppressions from public, anon, authenticated;
grant select on table public.notification_provider_events to authenticated;
grant select on table public.email_suppressions to authenticated;

create policy notification_provider_events_manager_select
on public.notification_provider_events
for select
to authenticated
using (
  exists (
    select 1
    from public.notification_events ne
    where ne.id = notification_event_id
      and ne.hotel_id = public.current_staff_hotel_id()
  )
  and public.staff_has_any_role(array['admin', 'manager']::public.staff_role[])
);

create policy email_suppressions_manager_select
on public.email_suppressions
for select
to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin', 'manager']::public.staff_role[])
);

create or replace function public.record_resend_email_event(
  p_webhook_event_id text,
  p_provider_delivery_id text,
  p_event_type text,
  p_occurred_at timestamptz,
  p_recipient text,
  p_details jsonb default '{}'::jsonb,
  p_should_suppress boolean default false,
  p_suppression_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_hotel_id uuid;
  v_inserted_id uuid;
  v_status public.notification_provider_status;
begin
  if nullif(btrim(p_webhook_event_id), '') is null
     or nullif(btrim(p_provider_delivery_id), '') is null then
    raise exception 'Webhook and provider delivery identifiers are required.';
  end if;

  v_status := case p_event_type
    when 'email.sent' then 'accepted'::public.notification_provider_status
    when 'email.delivery_delayed' then 'delayed'::public.notification_provider_status
    when 'email.delivered' then 'delivered'::public.notification_provider_status
    when 'email.bounced' then 'bounced'::public.notification_provider_status
    when 'email.complained' then 'complained'::public.notification_provider_status
    when 'email.failed' then 'failed'::public.notification_provider_status
    when 'email.suppressed' then 'suppressed'::public.notification_provider_status
    else null
  end;

  if v_status is null then
    return jsonb_build_object('ok', true, 'ignored', true, 'duplicate', false);
  end if;

  select ne.id, ne.hotel_id
  into v_event_id, v_hotel_id
  from public.notification_events ne
  where ne.provider_delivery_id = p_provider_delivery_id
  limit 1;

  insert into public.notification_provider_events (
    webhook_event_id,
    provider_delivery_id,
    event_type,
    occurred_at,
    recipient,
    details,
    notification_event_id
  ) values (
    btrim(p_webhook_event_id),
    btrim(p_provider_delivery_id),
    p_event_type,
    p_occurred_at,
    nullif(lower(btrim(p_recipient)), ''),
    coalesce(p_details, '{}'::jsonb),
    v_event_id
  )
  on conflict (provider, webhook_event_id) do nothing
  returning id into v_inserted_id;

  if v_inserted_id is null then
    return jsonb_build_object('ok', true, 'ignored', false, 'duplicate', true);
  end if;

  if v_event_id is not null then
    update public.notification_events ne
    set
      provider_status = v_status,
      provider_status_at = p_occurred_at,
      delivered_at = case when v_status = 'delivered' then p_occurred_at else ne.delivered_at end
    where ne.id = v_event_id
      and (
        ne.provider_status_at is null
        or p_occurred_at >= ne.provider_status_at
      );
  end if;

  if p_should_suppress and v_hotel_id is not null and nullif(lower(btrim(p_recipient)), '') is not null then
    insert into public.email_suppressions (
      hotel_id,
      email,
      reason,
      source_event_type,
      provider_delivery_id
    ) values (
      v_hotel_id,
      lower(btrim(p_recipient)),
      coalesce(nullif(btrim(p_suppression_reason), ''), 'Provider suppression event'),
      p_event_type,
      p_provider_delivery_id
    )
    on conflict (hotel_id, email) where cleared_at is null
    do update set
      reason = excluded.reason,
      source_event_type = excluded.source_event_type,
      provider_delivery_id = excluded.provider_delivery_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'ignored', false,
    'duplicate', false,
    'matched', v_event_id is not null
  );
end;
$$;

create or replace function public.requeue_dead_letter_notification(
  p_event_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated_id uuid;
begin
  if v_user_id is null
     or not public.staff_has_any_role(array['admin', 'manager']::public.staff_role[]) then
    raise exception using errcode = '42501', message = 'Manager access is required.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A recovery reason is required.';
  end if;

  update public.notification_events ne
  set
    status = 'pending',
    attempts = 0,
    next_attempt_at = now(),
    last_error = null,
    provider_message_id = 'hib-replay-' || gen_random_uuid()::text,
    provider_delivery_id = null,
    provider_status = null,
    provider_status_at = null,
    delivered_at = null,
    dead_letter_resolved_at = now(),
    dead_letter_resolved_by = v_user_id,
    dead_letter_resolution = left(btrim(p_reason), 1000)
  from public.hotel_settings hs
  where ne.id = p_event_id
    and hs.id = ne.hotel_id
    and ne.hotel_id = public.current_staff_hotel_id()
    and ne.status = 'failed'
    and ne.attempts >= hs.notification_max_attempts
  returning ne.id into v_updated_id;

  if v_updated_id is null then
    return jsonb_build_object('ok', false, 'event_id', p_event_id);
  end if;

  return jsonb_build_object('ok', true, 'event_id', v_updated_id);
end;
$$;

create or replace function public.clear_email_suppression(
  p_suppression_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_updated_id uuid;
begin
  if v_user_id is null
     or not public.staff_has_any_role(array['admin']::public.staff_role[]) then
    raise exception using errcode = '42501', message = 'Administrator access is required.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A clearance reason is required.';
  end if;

  update public.email_suppressions es
  set
    cleared_at = now(),
    cleared_by = v_user_id,
    clear_reason = left(btrim(p_reason), 1000)
  where es.id = p_suppression_id
    and es.hotel_id = public.current_staff_hotel_id()
    and es.cleared_at is null
  returning es.id into v_updated_id;

  return jsonb_build_object('ok', v_updated_id is not null, 'suppression_id', p_suppression_id);
end;
$$;

create or replace function public.cancel_notification_delivery(
  p_event_id uuid,
  p_lease_id uuid,
  p_attempt_number integer,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_id uuid;
begin
  if nullif(btrim(p_error_message), '') is null then
    raise exception 'A sanitized cancellation reason is required.';
  end if;

  update public.notification_events ne
  set
    status = 'cancelled',
    processing_started_at = null,
    processing_lease_id = null,
    processing_leased_until = null,
    last_error = left(btrim(p_error_message), 1000)
  where ne.id = p_event_id
    and ne.status = 'processing'
    and ne.processing_lease_id = p_lease_id
    and ne.attempts = p_attempt_number
  returning ne.id into v_updated_id;

  return jsonb_build_object(
    'ok', v_updated_id is not null,
    'stale_lease', v_updated_id is null,
    'event_id', p_event_id
  );
end;
$$;

create or replace function public.notification_recipient_is_suppressed(
  p_event_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.notification_events ne
    join public.email_suppressions es
      on es.hotel_id = ne.hotel_id
     and es.email = lower(btrim(ne.recipient))
     and es.cleared_at is null
    where ne.id = p_event_id
  )
$$;

create or replace function public.dead_letter_notification_delivery(
  p_event_id uuid,
  p_lease_id uuid,
  p_attempt_number integer,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_id uuid;
begin
  if nullif(btrim(p_error_message), '') is null then
    raise exception 'A sanitized terminal error is required.';
  end if;

  update public.notification_events ne
  set
    status = 'failed',
    attempts = hs.notification_max_attempts,
    next_attempt_at = now(),
    processing_started_at = null,
    processing_lease_id = null,
    processing_leased_until = null,
    last_error = left(btrim(p_error_message), 1000)
  from public.hotel_settings hs
  where ne.id = p_event_id
    and hs.id = ne.hotel_id
    and ne.status = 'processing'
    and ne.processing_lease_id = p_lease_id
    and ne.attempts = p_attempt_number
  returning ne.id into v_updated_id;

  return jsonb_build_object(
    'ok', v_updated_id is not null,
    'stale_lease', v_updated_id is null,
    'event_id', p_event_id
  );
end;
$$;

revoke all on function public.record_resend_email_event(text, text, text, timestamptz, text, jsonb, boolean, text)
  from public, anon, authenticated;
revoke all on function public.requeue_dead_letter_notification(uuid, text)
  from public, anon;
revoke all on function public.clear_email_suppression(uuid, text)
  from public, anon;
revoke all on function public.cancel_notification_delivery(uuid, uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.notification_recipient_is_suppressed(uuid)
  from public, anon, authenticated;
revoke all on function public.dead_letter_notification_delivery(uuid, uuid, integer, text)
  from public, anon, authenticated;

grant execute on function public.record_resend_email_event(text, text, text, timestamptz, text, jsonb, boolean, text)
  to service_role;
grant execute on function public.requeue_dead_letter_notification(uuid, text)
  to authenticated;
grant execute on function public.clear_email_suppression(uuid, text)
  to authenticated;
grant execute on function public.cancel_notification_delivery(uuid, uuid, integer, text)
  to service_role;
grant execute on function public.notification_recipient_is_suppressed(uuid)
  to service_role;
grant execute on function public.dead_letter_notification_delivery(uuid, uuid, integer, text)
  to service_role;

drop view public.dead_letter_notification_events;

create view public.dead_letter_notification_events
with (security_invoker = true)
as
select
  ne.id,
  ne.kind,
  ne.channel,
  ne.recipient,
  ne.attempts,
  ne.last_error,
  ne.provider_status,
  ne.provider_status_at,
  ne.created_at,
  ne.updated_at
from public.notification_events ne
join public.hotel_settings hs on hs.id = ne.hotel_id
where ne.status = 'failed'
  and ne.attempts >= hs.notification_max_attempts
order by ne.updated_at desc;

revoke all on table public.dead_letter_notification_events from public, anon;
grant select on table public.dead_letter_notification_events to authenticated;

comment on table public.notification_provider_events is
  'Idempotent ledger of verified Resend delivery webhooks retained independently of provider history.';
comment on table public.email_suppressions is
  'Hotel-scoped transactional email suppressions created from permanent delivery failures and complaints.';
comment on function public.requeue_dead_letter_notification(uuid, text) is
  'Manager-only audited dead-letter recovery that creates a fresh provider idempotency identity.';

drop view public.system_health_summary;

create view public.system_health_summary
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
    min(ne.next_attempt_at) filter (
      where ne.status in ('pending', 'failed')
        and ne.next_attempt_at <= now()
        and ne.attempts < hs.notification_max_attempts
    ) as notification_oldest_ready_at,
    count(*) filter (where ne.status = 'processing')::integer as notification_processing_count,
    count(*) filter (
      where ne.status = 'processing' and ne.processing_leased_until <= now()
    )::integer as notification_stale_processing_count,
    count(*) filter (
      where ne.status = 'failed' and ne.attempts < hs.notification_max_attempts
    )::integer as notification_retrying_count,
    count(*) filter (
      where ne.status = 'failed' and ne.attempts >= hs.notification_max_attempts
    )::integer as notification_dead_letter_count,
    count(*) filter (
      where ne.provider_status in ('bounced', 'complained', 'failed', 'suppressed')
        and ne.provider_status_at >= now() - interval '24 hours'
    )::integer as notification_adverse_provider_events_24h
  from public.hotel_settings hs
  left join public.notification_events ne on ne.hotel_id = hs.id
  where hs.id = public.current_staff_hotel_id()
), suppressions as (
  select count(*)::integer as active_email_suppression_count
  from public.email_suppressions es
  where es.hotel_id = public.current_staff_hotel_id()
    and es.cleared_at is null
)
select
  latest.id as latest_run_id,
  latest.status as latest_run_status,
  latest.started_at as latest_run_started_at,
  latest.completed_at as latest_run_completed_at,
  latest.metrics as latest_run_metrics,
  latest.id is null or latest.started_at < now() - interval '15 minutes' as operational_job_is_stale,
  (
    select count(*)::integer
    from public.background_job_runs failures
    where failures.status = 'failed'
      and failures.started_at >= now() - interval '24 hours'
  ) as failures_last_24_hours,
  coalesce(queue.notification_ready_to_claim_count, 0) as notification_ready_to_claim_count,
  queue.notification_oldest_ready_at,
  coalesce(queue.notification_processing_count, 0) as notification_processing_count,
  coalesce(queue.notification_stale_processing_count, 0) as notification_stale_processing_count,
  coalesce(queue.notification_retrying_count, 0) as notification_retrying_count,
  coalesce(queue.notification_dead_letter_count, 0) as notification_dead_letter_count,
  coalesce(queue.notification_adverse_provider_events_24h, 0) as notification_adverse_provider_events_24h,
  coalesce(suppressions.active_email_suppression_count, 0) as active_email_suppression_count
from (select 1) as heartbeat
left join latest on true
left join queue on true
left join suppressions on true;

revoke all on table public.system_health_summary from public, anon;
grant select on table public.system_health_summary to authenticated;
