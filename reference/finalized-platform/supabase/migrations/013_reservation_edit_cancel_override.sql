-- Hotel Inventory Bridge: explicit reservation edits, cancellation, overrides,
-- and immutable field-level audit history.

set lock_timeout = '5s';
set statement_timeout = '60s';

create type public.reservation_edit_kind as enum (
  'field_edit',
  'note_change',
  'room_swap',
  'date_change',
  'rate_change',
  'cancellation',
  'override'
);

alter table public.web_reservations
  add column internal_note text,
  add column edit_version integer not null default 1,
  add column payment_adjustment_required boolean not null default false,
  add column payment_adjustment_amount numeric(12, 2) not null default 0,
  add constraint web_reservations_edit_version_positive
    check (edit_version > 0) not valid,
  add constraint web_reservations_payment_adjustment_consistency check (
    (not payment_adjustment_required and payment_adjustment_amount = 0)
    or (payment_adjustment_required and payment_adjustment_amount <> 0)
  ) not valid;

create table public.reservation_edit_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  reservation_id uuid not null references public.web_reservations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  operation_id uuid not null,
  edit_kind public.reservation_edit_kind not null,
  field_name text not null,
  old_value jsonb,
  new_value jsonb,
  reason text not null,
  is_manager_override boolean not null default false,
  reservation_version integer not null,
  created_at timestamptz not null default now(),
  constraint reservation_edit_events_field_not_blank check (btrim(field_name) <> ''),
  constraint reservation_edit_events_reason_not_blank check (btrim(reason) <> ''),
  constraint reservation_edit_events_version_positive check (reservation_version > 0),
  constraint reservation_edit_events_value_changed check (old_value is distinct from new_value)
);

create index reservation_edit_events_reservation_created_idx
  on public.reservation_edit_events (reservation_id, created_at desc, id desc);

alter table public.reservation_edit_events enable row level security;
revoke all on table public.reservation_edit_events from public, anon, authenticated;
grant select on table public.reservation_edit_events to authenticated;

create policy reservation_edit_events_staff_select
on public.reservation_edit_events
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create or replace function public.record_reservation_field_edit(
  p_hotel_id uuid,
  p_reservation_id uuid,
  p_operation_id uuid,
  p_edit_kind public.reservation_edit_kind,
  p_field_name text,
  p_old_value jsonb,
  p_new_value jsonb,
  p_reason text,
  p_is_manager_override boolean,
  p_reservation_version integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_old_value is not distinct from p_new_value then
    return;
  end if;

  insert into public.reservation_edit_events (
    hotel_id,
    reservation_id,
    actor_user_id,
    operation_id,
    edit_kind,
    field_name,
    old_value,
    new_value,
    reason,
    is_manager_override,
    reservation_version
  ) values (
    p_hotel_id,
    p_reservation_id,
    auth.uid(),
    p_operation_id,
    p_edit_kind,
    p_field_name,
    p_old_value,
    p_new_value,
    btrim(p_reason),
    p_is_manager_override,
    p_reservation_version
  );
end;
$$;

create or replace function public.edit_reservation(
  p_reservation_id uuid,
  p_expected_version integer,
  p_reason text,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_internal_note text default null,
  p_clear_internal_note boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_before public.web_reservations%rowtype;
  v_after public.web_reservations%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_guest_name text;
  v_guest_email text;
  v_guest_phone text;
  v_internal_note text;
  v_guest_fields_changed boolean;
  v_changed boolean;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null or not public.staff_has_any_role(
    array['admin', 'manager', 'front_desk']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'This staff role cannot edit reservations.';
  end if;

  if p_expected_version is null or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'Expected version and edit reason are required.';
  end if;

  select wr.*
  into v_before
  from public.web_reservations wr
  where wr.id = p_reservation_id
    and wr.hotel_id = v_hotel_id
  for update;

  if not found then
    raise exception 'Reservation was not found for the current hotel.';
  end if;

  if v_before.sync_status = 'Cancelled' then
    raise exception using errcode = 'P0001', message = 'RESERVATION_CANCELLED';
  end if;

  if v_before.edit_version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'RESERVATION_VERSION_CONFLICT';
  end if;

  v_guest_name := coalesce(nullif(btrim(p_guest_name), ''), v_before.guest_name);
  v_guest_email := coalesce(nullif(lower(btrim(p_guest_email)), ''), v_before.guest_email);
  v_guest_phone := coalesce(nullif(btrim(p_guest_phone), ''), v_before.guest_phone);
  v_internal_note := case
    when p_clear_internal_note then null
    when p_internal_note is not null then nullif(btrim(p_internal_note), '')
    else v_before.internal_note
  end;

  if position('@' in v_guest_email) <= 1 then
    raise exception using errcode = '22023', message = 'Guest email is invalid.';
  end if;

  v_guest_fields_changed :=
    v_guest_name is distinct from v_before.guest_name
    or v_guest_email is distinct from v_before.guest_email
    or v_guest_phone is distinct from v_before.guest_phone;

  v_changed := v_guest_fields_changed
    or v_internal_note is distinct from v_before.internal_note;

  if not v_changed then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'reservation_id', v_before.id,
      'edit_version', v_before.edit_version,
      'sync_status', v_before.sync_status
    );
  end if;

  update public.web_reservations
  set
    guest_name = v_guest_name,
    guest_email = v_guest_email,
    guest_phone = v_guest_phone,
    internal_note = v_internal_note,
    sync_status = case
      when v_guest_fields_changed and sync_status = 'Synced' then 'Pending'
      else sync_status
    end,
    synced_at = case
      when v_guest_fields_changed and sync_status = 'Synced' then null
      else synced_at
    end,
    edit_version = edit_version + 1
  where id = v_before.id
  returning * into v_after;

  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'field_edit', 'guest_name',
    to_jsonb(v_before.guest_name), to_jsonb(v_after.guest_name), p_reason, false, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'field_edit', 'guest_email',
    to_jsonb(v_before.guest_email), to_jsonb(v_after.guest_email), p_reason, false, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'field_edit', 'guest_phone',
    to_jsonb(v_before.guest_phone), to_jsonb(v_after.guest_phone), p_reason, false, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'note_change', 'internal_note',
    to_jsonb(v_before.internal_note), to_jsonb(v_after.internal_note), p_reason, false, v_after.edit_version
  );

  if v_before.sync_status = 'Synced' and v_after.sync_status = 'Pending' then
    insert into public.reservation_sync_events (
      hotel_id, reservation_id, actor_user_id, from_status, to_status, reason
    ) values (
      v_after.hotel_id, v_after.id, auth.uid(), 'Synced', 'Pending',
      'Guest details edited; PMS update required: ' || btrim(p_reason)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'operation_id', v_operation_id,
    'reservation_id', v_after.id,
    'edit_version', v_after.edit_version,
    'sync_status', v_after.sync_status,
    'pms_update_required', v_before.sync_status = 'Synced' and v_after.sync_status = 'Pending'
  );
end;
$$;

create or replace function public.cancel_reservation(
  p_reservation_id uuid,
  p_expected_version integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_before public.web_reservations%rowtype;
  v_after public.web_reservations%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_released_nights integer := 0;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null or not public.staff_has_any_role(
    array['admin', 'manager', 'front_desk']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'This staff role cannot cancel reservations.';
  end if;

  if p_expected_version is null or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'Expected version and cancellation reason are required.';
  end if;

  select wr.*
  into v_before
  from public.web_reservations wr
  where wr.id = p_reservation_id
    and wr.hotel_id = v_hotel_id
  for update;

  if not found then
    raise exception 'Reservation was not found for the current hotel.';
  end if;

  if v_before.sync_status = 'Cancelled' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'reservation_id', v_before.id,
      'sync_status', v_before.sync_status,
      'edit_version', v_before.edit_version
    );
  end if;

  if v_before.edit_version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'RESERVATION_VERSION_CONFLICT';
  end if;

  perform 1
  from public.reservation_room_nights rrn
  where rrn.reservation_id = v_before.id
    and rrn.status = 'active'
  order by rrn.stay_date, rrn.room_position
  for update;

  update public.physical_room_allotments pra
  set is_booked = false, booked_reservation_id = null
  where pra.booked_reservation_id = v_before.id
    and pra.is_booked;

  update public.reservation_room_nights
  set status = 'cancelled', released_at = now()
  where reservation_id = v_before.id
    and status = 'active';
  get diagnostics v_released_nights = row_count;

  update public.room_shuffle_plans
  set status = 'cancelled'
  where reservation_id = v_before.id
    and status in ('proposed', 'required');

  update public.web_reservations
  set
    sync_status = 'Cancelled',
    synced_at = null,
    cancelled_at = now(),
    amount_due = case
      when payment_mode = 'pay_at_hotel' and payment_status = 'not_collected' then 0
      else amount_due
    end,
    payment_adjustment_required = payment_status = 'collected' and total_paid > 0,
    payment_adjustment_amount = case
      when payment_status = 'collected' and total_paid > 0 then -total_paid
      else 0
    end,
    edit_version = edit_version + 1
  where id = v_before.id
  returning * into v_after;

  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'cancellation', 'sync_status',
    to_jsonb(v_before.sync_status), to_jsonb(v_after.sync_status), p_reason, false, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'cancellation', 'amount_due',
    to_jsonb(v_before.amount_due), to_jsonb(v_after.amount_due), p_reason, false, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'cancellation', 'payment_adjustment_amount',
    to_jsonb(v_before.payment_adjustment_amount), to_jsonb(v_after.payment_adjustment_amount), p_reason, false, v_after.edit_version
  );

  insert into public.reservation_sync_events (
    hotel_id, reservation_id, actor_user_id, from_status, to_status, reason
  ) values (
    v_after.hotel_id, v_after.id, auth.uid(), v_before.sync_status, 'Cancelled', btrim(p_reason)
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'operation_id', v_operation_id,
    'reservation_id', v_after.id,
    'sync_status', v_after.sync_status,
    'edit_version', v_after.edit_version,
    'released_room_nights', v_released_nights,
    'payment_status', v_after.payment_status,
    'payment_adjustment_required', v_after.payment_adjustment_required,
    'payment_adjustment_amount', v_after.payment_adjustment_amount
  );
end;
$$;

create or replace function public.override_booking(
  p_reservation_id uuid,
  p_expected_version integer,
  p_reason text,
  p_new_check_in date default null,
  p_new_check_out date default null,
  p_new_room_id uuid default null,
  p_new_nightly_rate numeric default null,
  p_internal_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_before public.web_reservations%rowtype;
  v_after public.web_reservations%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_target_check_in date;
  v_target_check_out date;
  v_target_room_id uuid;
  v_current_room_id uuid;
  v_current_room_count integer;
  v_target_room_type_id uuid;
  v_target_room_number text;
  v_expected_nights integer;
  v_available_nights integer;
  v_old_total numeric(12, 2);
  v_new_total numeric(12, 2);
  v_new_adjustment numeric(12, 2);
  v_old_status public.reservation_sync_status;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null or not public.staff_has_any_role(
    array['admin', 'manager']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'Only an admin or manager can override a booking.';
  end if;

  if p_expected_version is null or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'Expected version and override reason are required.';
  end if;

  if p_new_nightly_rate is not null and p_new_nightly_rate < 0 then
    raise exception using errcode = '22023', message = 'Nightly rate cannot be negative.';
  end if;

  select wr.*
  into v_before
  from public.web_reservations wr
  where wr.id = p_reservation_id
    and wr.hotel_id = v_hotel_id
  for update;

  if not found then
    raise exception 'Reservation was not found for the current hotel.';
  end if;

  if v_before.sync_status = 'Cancelled' then
    raise exception using errcode = 'P0001', message = 'RESERVATION_CANCELLED';
  end if;

  if v_before.edit_version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'RESERVATION_VERSION_CONFLICT';
  end if;

  if v_before.rooms_requested <> 1 then
    raise exception using
      errcode = 'P0001',
      message = 'MULTI_ROOM_OVERRIDE_REQUIRES_DEDICATED_PLANNER';
  end if;

  perform public.release_expired_checkout_holds(v_hotel_id);

  perform 1
  from public.reservation_room_nights rrn
  where rrn.reservation_id = v_before.id
    and rrn.status = 'active'
  order by rrn.stay_date, rrn.room_position
  for update;

  select
    (array_agg(rrn.room_id order by rrn.stay_date, rrn.room_position))[1],
    count(distinct rrn.room_id)::integer,
    sum(rrn.nightly_price)::numeric(12, 2)
  into v_current_room_id, v_current_room_count, v_old_total
  from public.reservation_room_nights rrn
  where rrn.reservation_id = v_before.id
    and rrn.status = 'active';

  if v_current_room_count <> 1 then
    raise exception using errcode = 'P0001', message = 'NON_CONSECUTIVE_ASSIGNMENT_REQUIRES_PLANNER';
  end if;

  v_target_check_in := coalesce(p_new_check_in, v_before.check_in_date);
  v_target_check_out := coalesce(p_new_check_out, v_before.check_out_date);
  v_target_room_id := coalesce(p_new_room_id, v_current_room_id);

  if v_target_check_out <= v_target_check_in then
    raise exception using errcode = '22023', message = 'Check-out must be later than check-in.';
  end if;

  select pr.room_type_id, pr.room_number
  into v_target_room_type_id, v_target_room_number
  from public.physical_rooms pr
  where pr.id = v_target_room_id
    and pr.hotel_id = v_hotel_id
    and pr.is_active;

  if not found or v_target_room_type_id <> v_before.room_type_id then
    raise exception using errcode = 'P0001', message = 'ROOM_TYPE_OVERRIDE_NOT_ALLOWED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_hotel_id::text || ':' || v_before.room_type_id::text, 2)
  );

  perform 1
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.room_id = v_target_room_id
    and pra.date >= v_target_check_in
    and pra.date < v_target_check_out
  order by pra.date
  for update;

  v_expected_nights := (v_target_check_out - v_target_check_in)::integer;

  select count(*)::integer
  into v_available_nights
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.room_id = v_target_room_id
    and pra.date >= v_target_check_in
    and pra.date < v_target_check_out
    and (
      not pra.is_booked
      or pra.booked_reservation_id = v_before.id
    )
    and (pra.hold_id is null or pra.hold_expires_at <= now());

  if v_available_nights <> v_expected_nights then
    raise exception using errcode = 'P0001', message = 'OVERRIDE_INVENTORY_CONFLICT';
  end if;

  update public.physical_room_allotments
  set is_booked = false, booked_reservation_id = null
  where booked_reservation_id = v_before.id
    and is_booked;

  update public.reservation_room_nights
  set status = 'moved', released_at = now()
  where reservation_id = v_before.id
    and status = 'active';

  insert into public.reservation_room_nights (
    reservation_id,
    allotment_id,
    stay_date,
    room_position,
    room_id,
    room_type_id,
    nightly_price
  )
  select
    v_before.id,
    pra.id,
    pra.date,
    1,
    pra.room_id,
    pra.room_type_id,
    coalesce(p_new_nightly_rate, pra.nightly_price)
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.room_id = v_target_room_id
    and pra.date >= v_target_check_in
    and pra.date < v_target_check_out
  order by pra.date;

  update public.physical_room_allotments
  set
    is_booked = true,
    booked_reservation_id = v_before.id,
    hold_id = null,
    hold_expires_at = null
  where hotel_id = v_hotel_id
    and room_id = v_target_room_id
    and date >= v_target_check_in
    and date < v_target_check_out;

  select sum(rrn.nightly_price)::numeric(12, 2)
  into v_new_total
  from public.reservation_room_nights rrn
  where rrn.reservation_id = v_before.id
    and rrn.status = 'active';

  v_new_adjustment := case
    when v_before.payment_mode = 'pay_at_hotel'
      and v_before.payment_status = 'not_collected' then 0
    else v_new_total - v_before.total_paid
  end;
  v_old_status := v_before.sync_status;

  update public.web_reservations
  set
    check_in_date = v_target_check_in,
    check_out_date = v_target_check_out,
    internal_note = case
      when p_internal_note is null then internal_note
      else nullif(btrim(p_internal_note), '')
    end,
    assignment_status = 'assigned',
    room_shuffle_required = false,
    shuffle_plan_id = null,
    sync_status = case when sync_status = 'Synced' then 'Pending' else sync_status end,
    synced_at = case when sync_status = 'Synced' then null else synced_at end,
    amount_due = case
      when payment_mode = 'pay_at_hotel' and payment_status = 'not_collected' then v_new_total
      else amount_due
    end,
    payment_adjustment_required = v_new_adjustment <> 0,
    payment_adjustment_amount = v_new_adjustment,
    edit_version = edit_version + 1
  where id = v_before.id
  returning * into v_after;

  update public.room_shuffle_plans
  set status = 'cancelled'
  where reservation_id = v_before.id
    and status in ('proposed', 'required');

  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'date_change', 'check_in_date',
    to_jsonb(v_before.check_in_date), to_jsonb(v_after.check_in_date), p_reason, true, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'date_change', 'check_out_date',
    to_jsonb(v_before.check_out_date), to_jsonb(v_after.check_out_date), p_reason, true, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'room_swap', 'room_id',
    to_jsonb(v_current_room_id), to_jsonb(v_target_room_id), p_reason, true, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'rate_change', 'booking_total',
    to_jsonb(v_old_total), to_jsonb(v_new_total), p_reason, true, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'note_change', 'internal_note',
    to_jsonb(v_before.internal_note), to_jsonb(v_after.internal_note), p_reason, true, v_after.edit_version
  );

  if v_old_status = 'Synced' and v_after.sync_status = 'Pending' then
    insert into public.reservation_sync_events (
      hotel_id, reservation_id, actor_user_id, from_status, to_status, reason
    ) values (
      v_after.hotel_id, v_after.id, auth.uid(), 'Synced', 'Pending',
      'Manager booking override requires PMS update: ' || btrim(p_reason)
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'operation_id', v_operation_id,
    'reservation_id', v_after.id,
    'edit_version', v_after.edit_version,
    'sync_status', v_after.sync_status,
    'check_in_date', v_after.check_in_date,
    'check_out_date', v_after.check_out_date,
    'room_id', v_target_room_id,
    'room_number', v_target_room_number,
    'booking_total', v_new_total,
    'payment_status', v_after.payment_status,
    'amount_due', v_after.amount_due,
    'payment_adjustment_required', v_after.payment_adjustment_required,
    'payment_adjustment_amount', v_after.payment_adjustment_amount,
    'pms_update_required', v_old_status = 'Synced'
  );
end;
$$;

revoke all on function public.record_reservation_field_edit(
  uuid, uuid, uuid, public.reservation_edit_kind, text, jsonb, jsonb, text, boolean, integer
) from public, anon, authenticated, service_role;

revoke all on function public.edit_reservation(
  uuid, integer, text, text, text, text, text, boolean
) from public, anon;
alter function public.edit_reservation(
  uuid, integer, text, text, text, text, text, boolean
) security definer;
grant execute on function public.edit_reservation(
  uuid, integer, text, text, text, text, text, boolean
) to authenticated;

revoke all on function public.cancel_reservation(uuid, integer, text)
  from public, anon;
alter function public.cancel_reservation(uuid, integer, text) security definer;
grant execute on function public.cancel_reservation(uuid, integer, text)
  to authenticated;

revoke all on function public.override_booking(
  uuid, integer, text, date, date, uuid, numeric, text
) from public, anon;
alter function public.override_booking(
  uuid, integer, text, date, date, uuid, numeric, text
) security definer;
grant execute on function public.override_booking(
  uuid, integer, text, date, date, uuid, numeric, text
) to authenticated;

comment on table public.reservation_edit_events is
  'Immutable field-level reservation history grouped by operation_id for edits, room swaps, date/rate changes, notes, cancellation, and manager overrides.';
comment on function public.edit_reservation(
  uuid, integer, text, text, text, text, text, boolean
) is
  'Optimistic-lock staff edit for guest contact fields and internal notes with one audit row per changed field.';
comment on function public.cancel_reservation(uuid, integer, text) is
  'Dedicated cancellation operation that releases active room nights, records PMS cancellation, and preserves payment/refund truth independently.';
comment on function public.override_booking(
  uuid, integer, text, date, date, uuid, numeric, text
) is
  'Manager-only inventory-locked room/date/rate override for one-room bookings with PMS re-pending, payment reconciliation flags, and field audits.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
