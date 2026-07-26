-- Hotel Inventory Bridge: auditable Stripe and pay-at-hotel booking modes.
-- PMS synchronization remains independent from payment collection.

-- Fail the deployment cleanly instead of waiting behind long-lived production
-- transactions. The migration can be retried after the blocking session clears.
set lock_timeout = '5s';
set statement_timeout = '60s';

create type public.booking_payment_mode as enum (
  'stripe',
  'pay_at_hotel'
);

create type public.reservation_payment_status as enum (
  'not_collected',
  'collected',
  'refunded'
);

create type public.reservation_payment_event_kind as enum (
  'booking_created',
  'payment_collected',
  'payment_refunded'
);

alter table public.checkout_holds
  add column payment_mode public.booking_payment_mode not null default 'stripe';

alter table public.web_reservations
  alter column stripe_session_id drop not null,
  alter column payment_received_at drop not null,
  add column payment_mode public.booking_payment_mode not null default 'stripe',
  add column payment_status public.reservation_payment_status not null default 'collected',
  add column amount_due numeric(12, 2) not null default 0,
  add constraint web_reservations_amount_due_nonnegative check (amount_due >= 0) not valid,
  add constraint web_reservations_payment_mode_consistency check (
    (
      payment_mode = 'stripe'
      and stripe_session_id is not null
      and payment_status in ('collected', 'refunded')
      and payment_received_at is not null
      and amount_due = 0
    )
    or (
      payment_mode = 'pay_at_hotel'
      and stripe_session_id is null
      and stripe_payment_intent_id is null
      and (
        (
          payment_status = 'not_collected'
          and payment_received_at is null
          and total_paid = 0
          and amount_due >= 0
        )
        or (
          payment_status in ('collected', 'refunded')
          and payment_received_at is not null
          and amount_due = 0
        )
      )
    )
  ) not valid;

create table public.reservation_payment_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  reservation_id uuid not null references public.web_reservations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_kind public.reservation_payment_event_kind not null,
  payment_mode public.booking_payment_mode not null,
  from_status public.reservation_payment_status,
  to_status public.reservation_payment_status not null,
  amount numeric(12, 2) not null default 0,
  currency text not null,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint reservation_payment_events_amount_nonnegative check (amount >= 0),
  constraint reservation_payment_events_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint reservation_payment_events_reason_not_blank check (btrim(reason) <> ''),
  constraint reservation_payment_events_status_change check (
    from_status is null or from_status <> to_status
  )
);

create index reservation_payment_events_reservation_created_idx
  on public.reservation_payment_events (reservation_id, created_at desc);

alter table public.reservation_payment_events enable row level security;
revoke all on table public.reservation_payment_events from public, anon, authenticated;
grant select on table public.reservation_payment_events to authenticated;

create policy reservation_payment_events_staff_select
on public.reservation_payment_events
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create unique index reservation_payment_events_initial_state_unique
  on public.reservation_payment_events (reservation_id, event_kind)
  where event_kind = 'booking_created';

create or replace function public.backfill_reservation_payment_events_batch(
  p_batch_size integer default 250
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inserted_count integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 1000 then
    raise exception using
      errcode = '22023',
      message = 'Reservation payment-event batch size must be between 1 and 1000.';
  end if;

  with candidates as (
    select wr.*
    from public.web_reservations wr
    where not exists (
      select 1
      from public.reservation_payment_events rpe
      where rpe.reservation_id = wr.id
        and rpe.event_kind = 'booking_created'
    )
    order by wr.id
    for update of wr skip locked
    limit p_batch_size
  )
  insert into public.reservation_payment_events (
    hotel_id,
    reservation_id,
    event_kind,
    payment_mode,
    from_status,
    to_status,
    amount,
    currency,
    reason,
    created_at
  )
  select
    candidates.hotel_id,
    candidates.id,
    'booking_created',
    candidates.payment_mode,
    null,
    candidates.payment_status,
    candidates.total_paid,
    candidates.currency,
    'Backfilled payment audit event for reservation created before payment-mode migration.',
    candidates.created_at
  from candidates
  on conflict do nothing;

  get diagnostics v_inserted_count = row_count;
  return v_inserted_count;
end;
$$;

create or replace function public.audit_new_reservation_payment_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reservation_payment_events (
    hotel_id,
    reservation_id,
    event_kind,
    payment_mode,
    from_status,
    to_status,
    amount,
    currency,
    reason
  ) values (
    new.hotel_id,
    new.id,
    'booking_created',
    new.payment_mode,
    null,
    new.payment_status,
    new.total_paid,
    new.currency,
    case
      when new.payment_mode = 'stripe' then 'Stripe reservation created after verified payment.'
      else 'Pay-at-hotel reservation created with payment due at the property.'
    end
  );

  return new;
end;
$$;

create trigger web_reservations_audit_initial_payment_state
after insert on public.web_reservations
for each row execute function public.audit_new_reservation_payment_state();

create or replace function public.enrich_reservation_notification_payment_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.web_reservations%rowtype;
begin
  if new.reservation_id is null then
    return new;
  end if;

  select wr.*
  into v_reservation
  from public.web_reservations wr
  where wr.id = new.reservation_id;

  if found then
    new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
      'payment_mode', v_reservation.payment_mode,
      'payment_status', v_reservation.payment_status,
      'payment_collected', v_reservation.payment_status = 'collected',
      'amount_paid', v_reservation.total_paid,
      'amount_due', v_reservation.amount_due,
      'currency', v_reservation.currency
    );
  end if;

  return new;
end;
$$;

create trigger notification_events_enrich_payment_context
before insert on public.notification_events
for each row execute function public.enrich_reservation_notification_payment_context();

-- Historical notification rows are deliberately not rewritten in this schema
-- migration. Operations can call this bounded worker repeatedly after deploy;
-- each invocation locks at most p_batch_size rows and cooperates safely with
-- notification workers through SKIP LOCKED.
create or replace function public.backfill_notification_payment_context_batch(
  p_batch_size integer default 250
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated_count integer := 0;
begin
  if p_batch_size < 1 or p_batch_size > 1000 then
    raise exception using
      errcode = '22023',
      message = 'Notification payment-context batch size must be between 1 and 1000.';
  end if;

  with candidates as (
    select ne.id, ne.reservation_id
    from public.notification_events ne
    where ne.reservation_id is not null
      and not (ne.payload ? 'payment_mode')
    order by ne.id
    for update skip locked
    limit p_batch_size
  )
  update public.notification_events ne
  set payload = ne.payload || jsonb_build_object(
    'payment_mode', wr.payment_mode,
    'payment_status', wr.payment_status,
    'payment_collected', wr.payment_status = 'collected',
    'amount_paid', wr.total_paid,
    'amount_due', wr.amount_due,
    'currency', wr.currency
  )
  from candidates
  join public.web_reservations wr
    on wr.id = candidates.reservation_id
  where ne.id = candidates.id;

  get diagnostics v_updated_count = row_count;
  return v_updated_count;
end;
$$;

create or replace function public.enforce_checkout_hold_reservation_payment_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation_mode public.booking_payment_mode;
begin
  if new.status = 'converted' and old.status <> 'converted' then
    select wr.payment_mode
    into v_reservation_mode
    from public.web_reservations wr
    where wr.id = new.converted_reservation_id;

    if not found or v_reservation_mode <> old.payment_mode then
      raise exception using errcode = 'P0001', message = 'PAYMENT_MODE_MISMATCH';
    end if;
  end if;

  return new;
end;
$$;

create trigger checkout_holds_enforce_reservation_payment_mode
before update of status, converted_reservation_id on public.checkout_holds
for each row execute function public.enforce_checkout_hold_reservation_payment_mode();

create or replace function public.set_checkout_hold_payment_mode(
  p_hold_token uuid,
  p_payment_mode public.booking_payment_mode
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.checkout_holds%rowtype;
begin
  if p_hold_token is null or p_payment_mode is null then
    raise exception using errcode = '22023', message = 'Hold token and payment mode are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_hold_token::text, 3)
  );

  select ch.*
  into v_hold
  from public.checkout_holds ch
  where ch.public_token = p_hold_token
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'HOLD_NOT_FOUND';
  end if;

  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'HOLD_NOT_ACTIVE';
  end if;

  if v_hold.stripe_session_id is not null and p_payment_mode <> 'stripe' then
    raise exception using errcode = 'P0001', message = 'STRIPE_SESSION_ALREADY_ATTACHED';
  end if;

  update public.checkout_holds
  set payment_mode = p_payment_mode
  where id = v_hold.id;

  return jsonb_build_object(
    'ok', true,
    'hold_token', v_hold.public_token,
    'payment_mode', p_payment_mode,
    'status', v_hold.status,
    'expires_at', v_hold.expires_at,
    'total_amount', v_hold.total_amount,
    'currency', v_hold.currency
  );
end;
$$;

-- Preserve the proven Stripe finalizer unchanged and expose it through the
-- original public function name with a payment-mode guard.
alter function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) rename to finalize_stripe_checkout_hold_legacy;

revoke all on function public.finalize_stripe_checkout_hold_legacy(
  uuid, text, text, text, text, numeric, text, text
) from public, anon, authenticated, service_role;

create or replace function public.finalize_paid_checkout_hold(
  p_hold_token uuid,
  p_stripe_session_id text,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_total_paid numeric,
  p_currency text,
  p_stripe_payment_intent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment_mode public.booking_payment_mode;
begin
  select ch.payment_mode
  into v_payment_mode
  from public.checkout_holds ch
  where ch.public_token = p_hold_token;

  if not found then
    raise exception using errcode = 'P0001', message = 'HOLD_NOT_FOUND';
  end if;

  if v_payment_mode <> 'stripe' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_MODE_MISMATCH';
  end if;

  return public.finalize_stripe_checkout_hold_legacy(
    p_hold_token,
    p_stripe_session_id,
    p_guest_name,
    p_guest_email,
    p_guest_phone,
    p_total_paid,
    p_currency,
    p_stripe_payment_intent_id
  );
end;
$$;

create or replace function public.finalize_pay_at_hotel_checkout_hold(
  p_hold_token uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.checkout_holds%rowtype;
  v_reservation public.web_reservations%rowtype;
  v_room_type_name text;
  v_hotel_timezone text;
  v_expected_rows integer;
  v_verified_rows integer;
  v_updated_rows integer;
  v_reservation_id uuid;
  v_reservation_number text;
  v_sequence_number bigint;
  v_shuffle_plan_id uuid;
begin
  if p_hold_token is null then
    raise exception using errcode = '22023', message = 'Hold token is required.';
  end if;

  if nullif(btrim(p_guest_name), '') is null
     or nullif(btrim(p_guest_email), '') is null
     or position('@' in p_guest_email) <= 1
     or nullif(btrim(p_guest_phone), '') is null then
    raise exception using errcode = '22023', message = 'Complete guest contact details are required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_hold_token::text, 3)
  );

  select ch.*
  into v_hold
  from public.checkout_holds ch
  where ch.public_token = p_hold_token
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'HOLD_NOT_FOUND';
  end if;

  if v_hold.payment_mode <> 'pay_at_hotel' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_MODE_MISMATCH';
  end if;

  if v_hold.status = 'converted' then
    select wr.*
    into v_reservation
    from public.web_reservations wr
    where wr.id = v_hold.converted_reservation_id;

    if not found or v_reservation.payment_mode <> 'pay_at_hotel' then
      raise exception using errcode = 'P0001', message = 'PAYMENT_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'reservation_id', v_reservation.id,
      'reservation_number', v_reservation.reservation_number,
      'sync_status', v_reservation.sync_status,
      'payment_mode', v_reservation.payment_mode,
      'payment_status', v_reservation.payment_status,
      'amount_due', v_reservation.amount_due,
      'assignment_status', v_reservation.assignment_status,
      'shuffle_plan_id', v_reservation.shuffle_plan_id,
      'message', 'Reservation Received & Processing (Payment Due at Hotel; Awaiting PMS Confirmation).'
    );
  end if;

  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'HOLD_NOT_ACTIVE';
  end if;

  v_expected_rows :=
    v_hold.rooms_requested * (v_hold.check_out_date - v_hold.check_in_date)::integer;

  perform 1
  from public.physical_room_allotments pra
  join public.checkout_hold_room_nights chrn on chrn.allotment_id = pra.id
  where chrn.hold_id = v_hold.id
  order by pra.date, pra.room_id
  for update of pra;

  select count(*)::integer
  into v_verified_rows
  from public.checkout_hold_room_nights chrn
  join public.physical_room_allotments pra on pra.id = chrn.allotment_id
  where chrn.hold_id = v_hold.id
    and chrn.released_at is null
    and pra.hold_id = v_hold.id
    and pra.hold_expires_at = v_hold.expires_at
    and pra.hold_expires_at > now()
    and not pra.is_booked
    and pra.booked_reservation_id is null;

  if v_verified_rows <> v_expected_rows then
    raise exception using errcode = 'P0001', message = 'HOLD_OWNERSHIP_VERIFICATION_FAILED';
  end if;

  select rt.name, hs.timezone
  into v_room_type_name, v_hotel_timezone
  from public.room_types rt
  join public.hotel_settings hs on hs.id = rt.hotel_id
  where rt.id = v_hold.room_type_id
    and rt.hotel_id = v_hold.hotel_id;

  select rsp.id
  into v_shuffle_plan_id
  from public.room_shuffle_plans rsp
  where rsp.hold_id = v_hold.id
    and rsp.status = 'proposed'
  order by rsp.generated_at desc
  limit 1
  for update;

  v_sequence_number := nextval('public.web_reservation_number_seq');
  v_reservation_number := format(
    'WEB-%s-%s',
    to_char(now() at time zone v_hotel_timezone, 'YYYYMMDD'),
    lpad(v_sequence_number::text, greatest(8, length(v_sequence_number::text)), '0')
  );

  insert into public.web_reservations (
    hotel_id,
    reservation_number,
    stripe_session_id,
    stripe_payment_intent_id,
    guest_name,
    guest_email,
    guest_phone,
    check_in_date,
    check_out_date,
    room_type_id,
    room_type,
    rooms_requested,
    adults,
    children,
    promo_code,
    assignment_status,
    assignments_finalized_at,
    total_paid,
    amount_due,
    currency,
    payment_mode,
    payment_status,
    room_shuffle_required,
    shuffle_plan_id,
    payment_received_at
  ) values (
    v_hold.hotel_id,
    v_reservation_number,
    null,
    null,
    btrim(p_guest_name),
    lower(btrim(p_guest_email)),
    btrim(p_guest_phone),
    v_hold.check_in_date,
    v_hold.check_out_date,
    v_hold.room_type_id,
    v_room_type_name,
    v_hold.rooms_requested,
    v_hold.adults,
    v_hold.children,
    v_hold.promo_code,
    case
      when v_shuffle_plan_id is null then 'assigned'::public.reservation_assignment_status
      else 'shuffle_required'::public.reservation_assignment_status
    end,
    now(),
    0,
    v_hold.total_amount,
    v_hold.currency,
    'pay_at_hotel',
    'not_collected',
    v_shuffle_plan_id is not null,
    v_shuffle_plan_id,
    null
  )
  returning id into v_reservation_id;

  update public.physical_room_allotments pra
  set
    is_booked = true,
    booked_reservation_id = v_reservation_id,
    hold_id = null,
    hold_expires_at = null
  where pra.id in (
    select chrn.allotment_id
    from public.checkout_hold_room_nights chrn
    where chrn.hold_id = v_hold.id
  )
    and pra.hold_id = v_hold.id
    and pra.hold_expires_at = v_hold.expires_at
    and not pra.is_booked;

  get diagnostics v_updated_rows = row_count;

  if v_updated_rows <> v_expected_rows then
    raise exception 'Final booking row count changed during pay-at-hotel finalization.';
  end if;

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
    v_reservation_id,
    chrn.allotment_id,
    chrn.stay_date,
    chrn.room_position,
    chrn.room_id,
    v_hold.room_type_id,
    chrn.nightly_price
  from public.checkout_hold_room_nights chrn
  where chrn.hold_id = v_hold.id
  order by chrn.stay_date, chrn.room_position;

  update public.checkout_hold_room_nights
  set released_at = coalesce(released_at, now())
  where hold_id = v_hold.id;

  update public.checkout_holds
  set
    status = 'converted',
    converted_reservation_id = v_reservation_id
  where id = v_hold.id
    and status = 'active';

  if v_shuffle_plan_id is not null then
    update public.room_shuffle_plans
    set reservation_id = v_reservation_id, status = 'required'
    where id = v_shuffle_plan_id
      and hold_id = v_hold.id;
  end if;

  insert into public.notification_events (
    hotel_id,
    reservation_id,
    kind,
    channel,
    recipient,
    payload,
    idempotency_key
  ) values (
    v_hold.hotel_id,
    v_reservation_id,
    'reservation_processing',
    'email',
    lower(btrim(p_guest_email)),
    jsonb_build_object(
      'reservation_number', v_reservation_number,
      'check_in_date', v_hold.check_in_date,
      'check_out_date', v_hold.check_out_date,
      'rooms_requested', v_hold.rooms_requested,
      'message', 'Reservation Received & Processing (Payment Due at Hotel; Awaiting PMS Confirmation).'
    ),
    'reservation_processing:' || v_reservation_id::text
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'reservation_id', v_reservation_id,
    'reservation_number', v_reservation_number,
    'sync_status', 'Pending',
    'payment_mode', 'pay_at_hotel',
    'payment_status', 'not_collected',
    'amount_due', v_hold.total_amount,
    'assignment_status', case
      when v_shuffle_plan_id is null then 'assigned'
      else 'shuffle_required'
    end,
    'shuffle_plan_id', v_shuffle_plan_id,
    'message', 'Reservation Received & Processing (Payment Due at Hotel; Awaiting PMS Confirmation).'
  );
end;
$$;

create or replace function public.mark_pay_at_hotel_payment_collected(
  p_reservation_id uuid,
  p_amount numeric,
  p_reason text default 'Collected at hotel'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_reservation public.web_reservations%rowtype;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null or not public.staff_has_any_role(
    array['admin', 'manager', 'front_desk']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'This staff role cannot record hotel payments.';
  end if;

  if p_amount is null or p_amount < 0 or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'A valid amount and audit reason are required.';
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

  if v_reservation.payment_mode <> 'pay_at_hotel' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_MODE_MISMATCH';
  end if;

  if v_reservation.payment_status = 'collected' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'reservation_id', v_reservation.id,
      'payment_status', v_reservation.payment_status,
      'total_paid', v_reservation.total_paid,
      'amount_due', v_reservation.amount_due
    );
  end if;

  if v_reservation.payment_status <> 'not_collected'
     or p_amount <> v_reservation.amount_due then
    raise exception using errcode = 'P0001', message = 'PAYMENT_TOTAL_MISMATCH';
  end if;

  update public.web_reservations
  set
    payment_status = 'collected',
    total_paid = p_amount,
    amount_due = 0,
    payment_received_at = now()
  where id = v_reservation.id
  returning * into v_reservation;

  insert into public.reservation_payment_events (
    hotel_id,
    reservation_id,
    actor_user_id,
    event_kind,
    payment_mode,
    from_status,
    to_status,
    amount,
    currency,
    reason
  ) values (
    v_reservation.hotel_id,
    v_reservation.id,
    auth.uid(),
    'payment_collected',
    v_reservation.payment_mode,
    'not_collected',
    'collected',
    p_amount,
    v_reservation.currency,
    btrim(p_reason)
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'reservation_id', v_reservation.id,
    'payment_status', v_reservation.payment_status,
    'payment_received_at', v_reservation.payment_received_at,
    'total_paid', v_reservation.total_paid,
    'amount_due', v_reservation.amount_due,
    'sync_status', v_reservation.sync_status
  );
end;
$$;

revoke all on function public.audit_new_reservation_payment_state()
  from public, anon, authenticated;
revoke all on function public.backfill_reservation_payment_events_batch(integer)
  from public, anon, authenticated;
revoke all on function public.enrich_reservation_notification_payment_context()
  from public, anon, authenticated;
revoke all on function public.backfill_notification_payment_context_batch(integer)
  from public, anon, authenticated;
revoke all on function public.enforce_checkout_hold_reservation_payment_mode()
  from public, anon, authenticated;
revoke all on function public.set_checkout_hold_payment_mode(uuid, public.booking_payment_mode)
  from public;
revoke all on function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) from public, anon, authenticated;
alter function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) security definer;
grant execute on function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) to service_role;

revoke all on function public.finalize_pay_at_hotel_checkout_hold(uuid, text, text, text)
  from public, anon, authenticated;
alter function public.finalize_pay_at_hotel_checkout_hold(uuid, text, text, text)
  security definer;
grant execute on function public.finalize_pay_at_hotel_checkout_hold(uuid, text, text, text)
  to service_role;

revoke all on function public.mark_pay_at_hotel_payment_collected(uuid, numeric, text)
  from public, anon;
alter function public.mark_pay_at_hotel_payment_collected(uuid, numeric, text)
  security definer;
grant execute on function public.mark_pay_at_hotel_payment_collected(uuid, numeric, text)
  to authenticated;

grant execute on function public.set_checkout_hold_payment_mode(uuid, public.booking_payment_mode)
  to anon, authenticated;
alter function public.backfill_notification_payment_context_batch(integer)
  security definer;
grant execute on function public.backfill_notification_payment_context_batch(integer)
  to service_role;
alter function public.backfill_reservation_payment_events_batch(integer)
  security definer;
grant execute on function public.backfill_reservation_payment_events_batch(integer)
  to service_role;

comment on column public.checkout_holds.payment_mode is
  'Guest-selected settlement path. Existing and unspecified holds default to Stripe for backward compatibility.';
comment on column public.web_reservations.payment_status is
  'Payment collection state independent from sync_status, which tracks PMS confirmation.';
comment on function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) is
  'Backward-compatible Stripe finalizer wrapper that rejects non-Stripe holds before invoking the proven payment finalization path.';
comment on function public.finalize_pay_at_hotel_checkout_hold(uuid, text, text, text) is
  'Service-role-only finalizer that converts an active pay-at-hotel hold without Stripe identifiers and leaves payment due independently of PMS confirmation.';
comment on function public.mark_pay_at_hotel_payment_collected(uuid, numeric, text) is
  'Audited staff operation that records full collection for a pay-at-hotel reservation without changing PMS sync status.';
comment on function public.backfill_notification_payment_context_batch(integer) is
  'Post-deploy bounded backfill for historical notification payment context; run repeatedly until it returns zero.';
comment on function public.backfill_reservation_payment_events_batch(integer) is
  'Post-deploy bounded backfill for historical reservation payment audit events; run repeatedly until it returns zero.';

-- Ensure PostgREST refreshes the restored public Stripe signature and its
-- trailing default argument immediately after the migration commits.
notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
