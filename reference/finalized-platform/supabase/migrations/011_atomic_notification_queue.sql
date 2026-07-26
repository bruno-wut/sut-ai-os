-- Hotel Inventory Bridge: leased, retry-safe transactional notification queue.

alter table public.hotel_settings
  add column notification_lease_seconds integer not null default 600,
  add column notification_max_attempts integer not null default 8,
  add constraint hotel_settings_notification_lease_range
    check (notification_lease_seconds between 60 and 1800),
  add constraint hotel_settings_notification_attempts_range
    check (notification_max_attempts between 1 and 20);

alter table public.notification_events
  add column processing_lease_id uuid,
  add column processing_leased_until timestamptz,
  add column provider_message_id text,
  add column provider_delivery_id text;

-- Normalize any in-flight rows when upgrading an already-running environment.
update public.notification_events
set
  status = 'failed',
  next_attempt_at = now(),
  processing_started_at = null,
  last_error = 'Processing lease reset during queue upgrade.'
where status = 'processing';

update public.notification_events
set provider_message_id = 'hib-notification-' || id::text
where provider_message_id is null;

alter table public.notification_events
  alter column provider_message_id set not null,
  add constraint notification_events_provider_message_id_unique
    unique (provider_message_id),
  add constraint notification_events_processing_lease_consistency check (
    (
      status = 'processing'
      and processing_started_at is not null
      and processing_lease_id is not null
      and processing_leased_until is not null
    )
    or (
      status <> 'processing'
      and processing_started_at is null
      and processing_lease_id is null
      and processing_leased_until is null
    )
  );

create or replace function public.set_notification_provider_message_id()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.provider_message_id := 'hib-notification-' || new.id::text;
  return new;
end;
$$;

create trigger notification_events_set_provider_message_id
before insert on public.notification_events
for each row execute function public.set_notification_provider_message_id();

create index notification_events_expired_processing_lease_idx
  on public.notification_events (processing_leased_until)
  where status = 'processing';

create or replace function public.claim_notification_batch(
  p_batch_size integer default 25
)
returns table (
  event_id uuid,
  kind public.notification_kind,
  channel public.notification_channel,
  recipient text,
  delivery_payload jsonb,
  attempt_number integer,
  lease_id uuid,
  leased_until timestamptz,
  provider_message_id text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_batch_size < 1 or p_batch_size > 100 then
    raise exception using errcode = '22023', message = 'Notification batch size must be between 1 and 100.';
  end if;

  -- Expired leases become retryable only if their token/attempt has not already
  -- been replaced. The subsequent claim creates a new token and increments attempts.
  update public.notification_events ne
  set
    status = 'failed',
    next_attempt_at = now(),
    processing_started_at = null,
    processing_lease_id = null,
    processing_leased_until = null,
    last_error = 'Processing lease expired before completion.'
  where ne.status = 'processing'
    and ne.processing_leased_until <= now();

  return query
  with candidates as (
    select
      ne.id,
      hs.notification_lease_seconds
    from public.notification_events ne
    join public.hotel_settings hs on hs.id = ne.hotel_id
    where ne.status in ('pending', 'failed')
      and ne.next_attempt_at <= now()
      and ne.attempts < hs.notification_max_attempts
    order by ne.next_attempt_at, ne.created_at, ne.id
    for update of ne skip locked
    limit p_batch_size
  ), claimed as (
    update public.notification_events ne
    set
      status = 'processing',
      attempts = ne.attempts + 1,
      processing_started_at = now(),
      processing_lease_id = gen_random_uuid(),
      processing_leased_until = now()
        + make_interval(secs => candidates.notification_lease_seconds),
      last_error = null
    from candidates
    where ne.id = candidates.id
    returning
      ne.id,
      ne.kind,
      ne.channel,
      ne.recipient,
      ne.payload,
      ne.attempts,
      ne.processing_lease_id,
      ne.processing_leased_until,
      ne.provider_message_id
  )
  select
    claimed.id,
    claimed.kind,
    claimed.channel,
    claimed.recipient,
    claimed.payload || jsonb_build_object(
      'provider_message_id', claimed.provider_message_id,
      'notification_event_id', claimed.id,
      'attempt_number', claimed.attempts
    ),
    claimed.attempts,
    claimed.processing_lease_id,
    claimed.processing_leased_until,
    claimed.provider_message_id
  from claimed
  order by claimed.id;
end;
$$;

create or replace function public.complete_notification_delivery(
  p_event_id uuid,
  p_lease_id uuid,
  p_attempt_number integer,
  p_provider_delivery_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_id uuid;
begin
  update public.notification_events ne
  set
    status = 'sent',
    sent_at = now(),
    provider_delivery_id = nullif(btrim(p_provider_delivery_id), ''),
    processing_started_at = null,
    processing_lease_id = null,
    processing_leased_until = null,
    last_error = null
  where ne.id = p_event_id
    and ne.status = 'processing'
    and ne.processing_lease_id = p_lease_id
    and ne.attempts = p_attempt_number
  returning ne.id into v_updated_id;

  if v_updated_id is null then
    return jsonb_build_object(
      'ok', false,
      'stale_lease', true,
      'event_id', p_event_id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'stale_lease', false,
    'event_id', v_updated_id,
    'attempt_number', p_attempt_number
  );
end;
$$;

create or replace function public.fail_notification_delivery(
  p_event_id uuid,
  p_lease_id uuid,
  p_attempt_number integer,
  p_error_message text,
  p_retry_after_seconds integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_retry_seconds integer;
  v_updated_id uuid;
begin
  if nullif(btrim(p_error_message), '') is null then
    raise exception 'A sanitized provider error is required.';
  end if;

  if p_retry_after_seconds is not null
     and p_retry_after_seconds not between 30 and 86400 then
    raise exception 'Explicit retry delay must be between 30 seconds and 24 hours.';
  end if;

  v_retry_seconds := coalesce(
    p_retry_after_seconds,
    least(3600, (30 * power(2, least(greatest(p_attempt_number - 1, 0), 7)))::integer)
  );

  update public.notification_events ne
  set
    status = 'failed',
    next_attempt_at = now() + make_interval(secs => v_retry_seconds),
    processing_started_at = null,
    processing_lease_id = null,
    processing_leased_until = null,
    last_error = left(btrim(p_error_message), 1000)
  where ne.id = p_event_id
    and ne.status = 'processing'
    and ne.processing_lease_id = p_lease_id
    and ne.attempts = p_attempt_number
  returning ne.id into v_updated_id;

  if v_updated_id is null then
    return jsonb_build_object(
      'ok', false,
      'stale_lease', true,
      'event_id', p_event_id
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'stale_lease', false,
    'event_id', v_updated_id,
    'attempt_number', p_attempt_number,
    'retry_after_seconds', v_retry_seconds
  );
end;
$$;

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
  ne.created_at,
  ne.updated_at
from public.notification_events ne
join public.hotel_settings hs on hs.id = ne.hotel_id
where ne.status = 'failed'
  and ne.attempts >= hs.notification_max_attempts
order by ne.updated_at desc;

revoke all on function public.set_notification_provider_message_id()
  from public, anon, authenticated;
revoke all on function public.claim_notification_batch(integer)
  from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(uuid, uuid, integer, text)
  from public, anon, authenticated;
revoke all on function public.fail_notification_delivery(uuid, uuid, integer, text, integer)
  from public, anon, authenticated;
revoke all on table public.dead_letter_notification_events
  from public, anon, authenticated;

grant execute on function public.claim_notification_batch(integer) to service_role;
grant execute on function public.complete_notification_delivery(uuid, uuid, integer, text)
  to service_role;
grant execute on function public.fail_notification_delivery(uuid, uuid, integer, text, integer)
  to service_role;
grant select on table public.dead_letter_notification_events to authenticated;

comment on function public.claim_notification_batch(integer) is
  'Atomically claims due notifications using SKIP LOCKED and returns attempt-bound lease tokens plus deterministic provider idempotency IDs.';

comment on function public.complete_notification_delivery(uuid, uuid, integer, text) is
  'Marks delivery sent only when the worker still owns the exact lease token and attempt.';

comment on function public.fail_notification_delivery(uuid, uuid, integer, text, integer) is
  'Schedules bounded exponential retry only when the worker still owns the exact lease token and attempt.';

comment on view public.dead_letter_notification_events is
  'Manager-visible notifications that exhausted the configured retry limit.';
