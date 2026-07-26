-- Hotel Inventory Bridge: Human API PMS synchronization and staff reminders.

-- Prevent staff clients from bypassing confirmation-email and shuffle-plan logic.
revoke update (sync_status, synced_at, cancelled_at)
  on table public.web_reservations
  from authenticated;

create table public.reservation_sync_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  reservation_id uuid not null references public.web_reservations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  from_status public.reservation_sync_status not null,
  to_status public.reservation_sync_status not null,
  reason text not null,
  confirmation_email_status public.notification_delivery_status,
  created_at timestamptz not null default now(),
  constraint reservation_sync_events_status_changed check (from_status <> to_status),
  constraint reservation_sync_events_reason_not_blank check (btrim(reason) <> '')
);

create index reservation_sync_events_reservation_created_idx
  on public.reservation_sync_events (reservation_id, created_at desc);

alter table public.reservation_sync_events enable row level security;
revoke all on table public.reservation_sync_events from public, anon, authenticated;
grant select on table public.reservation_sync_events to authenticated;

create policy reservation_sync_events_staff_select
on public.reservation_sync_events
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create or replace function public.mark_reservation_entered_in_pms(
  p_reservation_id uuid,
  p_confirm_shuffle_completed boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_reservation public.web_reservations%rowtype;
  v_email_rows integer := 0;
  v_email_status public.notification_delivery_status;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null then
    raise exception using errcode = '42501', message = 'An active staff profile is required.';
  end if;

  if not public.staff_has_any_role(
    array['admin', 'manager', 'front_desk']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'This staff role cannot synchronize reservations.';
  end if;

  select wr.*
  into v_reservation
  from public.web_reservations wr
  where wr.id = p_reservation_id
    and wr.hotel_id = v_hotel_id
  for update;

  if not found then
    raise exception 'Reservation was not found for the current hotel.';
  end if;

  if v_reservation.sync_status = 'Cancelled' then
    raise exception 'A cancelled reservation cannot be entered in the PMS.';
  end if;

  if v_reservation.sync_status = 'Synced' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'reservation_id', v_reservation.id,
      'reservation_number', v_reservation.reservation_number,
      'sync_status', v_reservation.sync_status,
      'synced_at', v_reservation.synced_at
    );
  end if;

  if v_reservation.shuffle_plan_id is not null
     and not p_confirm_shuffle_completed then
    raise exception using
      errcode = 'P0001',
      message = 'SHUFFLE_CONFIRMATION_REQUIRED',
      hint = 'Review and complete the room-migration instructions before marking this reservation entered in the PMS.';
  end if;

  if v_reservation.shuffle_plan_id is not null then
    update public.room_shuffle_steps
    set
      completed_at = coalesce(completed_at, now()),
      completed_by = coalesce(completed_by, auth.uid())
    where plan_id = v_reservation.shuffle_plan_id;

    update public.room_shuffle_plans
    set
      status = 'completed',
      completed_at = now(),
      completed_by = auth.uid()
    where id = v_reservation.shuffle_plan_id
      and reservation_id = v_reservation.id
      and status = 'required';
  end if;

  update public.web_reservations
  set
    sync_status = 'Synced',
    synced_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  insert into public.notification_events (
    hotel_id,
    reservation_id,
    kind,
    channel,
    recipient,
    payload,
    idempotency_key
  ) values (
    v_reservation.hotel_id,
    v_reservation.id,
    'reservation_confirmed',
    'email',
    v_reservation.guest_email,
    jsonb_build_object(
      'reservation_number', v_reservation.reservation_number,
      'check_in_date', v_reservation.check_in_date,
      'check_out_date', v_reservation.check_out_date,
      'rooms_requested', v_reservation.rooms_requested,
      'message', 'Booking Confirmed'
    ),
    'reservation_confirmed:' || v_reservation.id::text
  )
  on conflict (idempotency_key) do nothing;

  get diagnostics v_email_rows = row_count;

  select ne.status
  into v_email_status
  from public.notification_events ne
  where ne.idempotency_key = 'reservation_confirmed:' || v_reservation.id::text;

  insert into public.reservation_sync_events (
    hotel_id,
    reservation_id,
    actor_user_id,
    from_status,
    to_status,
    reason,
    confirmation_email_status
  ) values (
    v_reservation.hotel_id,
    v_reservation.id,
    auth.uid(),
    'Pending',
    'Synced',
    'Marked entered in PMS',
    v_email_status
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'reservation_id', v_reservation.id,
    'reservation_number', v_reservation.reservation_number,
    'sync_status', v_reservation.sync_status,
    'synced_at', v_reservation.synced_at,
    'confirmation_email_queued', v_email_rows = 1,
    'confirmation_email_status', v_email_status
  );
end;
$$;

create or replace function public.reopen_reservation_for_pms(
  p_reservation_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_reservation public.web_reservations%rowtype;
  v_email_status public.notification_delivery_status;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null or not public.staff_has_any_role(
    array['admin', 'manager']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'Only an admin or manager can reopen a synced reservation.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A reason is required to return a reservation to Pending.';
  end if;

  select wr.*
  into v_reservation
  from public.web_reservations wr
  where wr.id = p_reservation_id
    and wr.hotel_id = v_hotel_id
  for update;

  if not found then
    raise exception 'Reservation was not found for the current hotel.';
  end if;

  if v_reservation.sync_status = 'Cancelled' then
    raise exception 'A cancelled reservation cannot be reopened for PMS entry.';
  end if;

  select ne.status
  into v_email_status
  from public.notification_events ne
  where ne.idempotency_key = 'reservation_confirmed:' || v_reservation.id::text;

  if v_reservation.sync_status = 'Pending' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'reservation_id', v_reservation.id,
      'sync_status', v_reservation.sync_status,
      'confirmation_email_status', v_email_status,
      'confirmation_email_already_sent', coalesce(v_email_status = 'sent', false)
    );
  end if;

  if v_reservation.shuffle_plan_id is not null then
    update public.room_shuffle_steps
    set completed_at = null, completed_by = null
    where plan_id = v_reservation.shuffle_plan_id;

    update public.room_shuffle_plans
    set status = 'required', completed_at = null, completed_by = null
    where id = v_reservation.shuffle_plan_id
      and reservation_id = v_reservation.id
      and status = 'completed';
  end if;

  update public.web_reservations
  set sync_status = 'Pending', synced_at = null
  where id = v_reservation.id
  returning * into v_reservation;

  insert into public.reservation_sync_events (
    hotel_id,
    reservation_id,
    actor_user_id,
    from_status,
    to_status,
    reason,
    confirmation_email_status
  ) values (
    v_reservation.hotel_id,
    v_reservation.id,
    auth.uid(),
    'Synced',
    'Pending',
    btrim(p_reason),
    v_email_status
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'reservation_id', v_reservation.id,
    'reservation_number', v_reservation.reservation_number,
    'sync_status', v_reservation.sync_status,
    'confirmation_email_status', v_email_status,
    'confirmation_email_already_sent', coalesce(v_email_status = 'sent', false),
    'warning', case
      when v_email_status = 'sent' then 'The guest confirmation email was already sent and cannot be recalled.'
      else null
    end
  );
end;
$$;

create or replace function public.enqueue_pending_staff_alerts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_count integer;
begin
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
    wr.hotel_id,
    wr.id,
    'pending_staff_alert'::public.notification_kind,
    'email'::public.notification_channel,
    coalesce(hs.staff_alert_email, hs.management_email),
    jsonb_build_object(
      'reservation_number', wr.reservation_number,
      'created_at', wr.created_at,
      'pending_minutes', floor(extract(epoch from (now() - wr.created_at)) / 60),
      'message', 'Reservation requires entry in the PMS.'
    ),
    'pending_staff_alert:' || wr.id::text
  from public.web_reservations wr
  join public.hotel_settings hs on hs.id = wr.hotel_id
  where wr.sync_status = 'Pending'
    and wr.created_at <= now() - make_interval(mins => hs.pending_staff_alert_minutes)
    and coalesce(hs.staff_alert_email, hs.management_email) is not null
  on conflict (idempotency_key) do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

revoke all on function public.mark_reservation_entered_in_pms(uuid, boolean)
  from public, anon;
revoke all on function public.reopen_reservation_for_pms(uuid, text)
  from public, anon;
revoke all on function public.enqueue_pending_staff_alerts()
  from public, anon, authenticated;

grant execute on function public.mark_reservation_entered_in_pms(uuid, boolean)
  to authenticated;
grant execute on function public.reopen_reservation_for_pms(uuid, text)
  to authenticated;
grant execute on function public.enqueue_pending_staff_alerts()
  to service_role;

comment on function public.mark_reservation_entered_in_pms(uuid, boolean) is
  'Human API operation that completes required shuffle instructions, marks a reservation Synced, and queues the guest confirmation email atomically.';

comment on function public.reopen_reservation_for_pms(uuid, text) is
  'Manager-only audited reversal to Pending that reopens shuffle tasks and reports whether the original guest confirmation was already sent.';

comment on function public.enqueue_pending_staff_alerts() is
  'Idempotently queues one staff reminder per reservation after the configured default two-hour Pending threshold.';
