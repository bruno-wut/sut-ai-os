-- Hotel Inventory Bridge: Early booking reference generation
-- Generates the booking reference at the checkout hold stage so it is available
-- immediately for confirmation pages, rather than waiting for the Stripe webhook.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.checkout_holds
  add column booking_reference_id text;

-- Generate reference considering both tables
create or replace function public.generate_booking_reference_id()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
begin
  loop
    v_reference := 'SUT-' || upper(encode(extensions.gen_random_bytes(8), 'hex'));

    exit when not exists (
      select 1
      from public.web_reservations wr
      where wr.booking_reference_id = v_reference
    ) and not exists (
      select 1
      from public.checkout_holds ch
      where ch.booking_reference_id = v_reference
    );
  end loop;

  return v_reference;
end;
$$;

alter table public.checkout_holds
  alter column booking_reference_id set default public.generate_booking_reference_id();

update public.checkout_holds ch
set booking_reference_id = public.generate_booking_reference_id()
where ch.booking_reference_id is null;

create unique index checkout_holds_booking_reference_unique_idx
  on public.checkout_holds (booking_reference_id)
  where booking_reference_id is not null;

alter table public.checkout_holds
  add constraint checkout_holds_booking_reference_format
    check (
      booking_reference_id is null
      or booking_reference_id ~ '^SUT-[A-F0-9]{16}$'
    ) not valid;

create or replace function public.create_checkout_hold(
  p_check_in date,
  p_check_out date,
  p_room_type_id uuid,
  p_rooms_requested integer,
  p_adults integer,
  p_children integer,
  p_idempotency_key text,
  p_promo_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_settings public.hotel_settings%rowtype;
  v_operational_date date;
  v_night_count integer;
  v_active_room_count integer;
  v_expected_rows bigint;
  v_actual_rows bigint;
  v_selected_room_ids uuid[];
  v_selected_room_count integer;
  v_min_nightly_capacity integer;
  v_total_amount numeric(12, 2);
  v_hold_id uuid;
  v_public_token uuid;
  v_booking_reference_id text;
  v_expires_at timestamptz;
  v_existing public.checkout_holds%rowtype;
begin
  if p_check_in is null
     or p_check_out is null
     or p_room_type_id is null
     or p_rooms_requested is null
     or p_adults is null
     or p_children is null then
    raise exception using
      errcode = '22023',
      message = 'Dates, room type, room quantity, and occupancy are required.';
  end if;

  if p_check_out <= p_check_in then
    raise exception using errcode = '22023', message = 'Check-out must be later than check-in.';
  end if;

  if p_rooms_requested <= 0 or p_adults <= 0 or p_children < 0 then
    raise exception using errcode = '22023', message = 'Room quantity and occupancy are invalid.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null
     or length(btrim(p_idempotency_key)) < 16
     or length(btrim(p_idempotency_key)) > 128 then
    raise exception using
      errcode = '22023',
      message = 'A 16-128 character idempotency key is required.';
  end if;

  select hs.*
  into v_settings
  from public.room_types rt
  join public.hotel_settings hs on hs.id = rt.hotel_id
  where rt.id = p_room_type_id
    and rt.is_active
    and hs.setup_completed_at is not null;

  if not found then
    raise exception using errcode = '22023', message = 'Room type is not available.';
  end if;

  v_hotel_id := v_settings.id;

  v_operational_date := public.hotel_operational_date(v_hotel_id);
  v_night_count := (p_check_out - p_check_in)::integer;

  if p_check_in < v_operational_date then
    raise exception using
      errcode = '22023',
      message = 'Check-in cannot be earlier than the hotel operational date.';
  end if;

  if v_night_count > v_settings.max_stay_nights then
    raise exception using
      errcode = '22023',
      message = 'Requested stay exceeds the hotel maximum stay length.';
  end if;

  if p_check_out > v_operational_date + v_settings.inventory_horizon_days then
    raise exception using
      errcode = '22023',
      message = 'Requested dates are outside the published inventory horizon.';
  end if;

  if p_rooms_requested > v_settings.max_rooms_per_booking then
    raise exception using
      errcode = '22023',
      message = 'Requested room quantity exceeds the online booking limit.';
  end if;

  -- A high-entropy idempotency key is also the browser session's hold authority.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(btrim(p_idempotency_key), 1)
  );

  select ch.*
  into v_existing
  from public.checkout_holds ch
  where ch.idempotency_key = btrim(p_idempotency_key)
  for update;

  if found then
    if v_existing.hotel_id <> v_hotel_id
       or v_existing.room_type_id <> p_room_type_id
       or v_existing.check_in_date <> p_check_in
       or v_existing.check_out_date <> p_check_out
       or v_existing.rooms_requested <> p_rooms_requested then
      raise exception using
        errcode = '22023',
        message = 'Idempotency key was already used for a different checkout request.';
    end if;

    return jsonb_build_object(
      'ok', v_existing.status = 'active' and v_existing.expires_at > now(),
      'status', v_existing.status,
      'hold_token', v_existing.public_token,
      'booking_reference_id', v_existing.booking_reference_id,
      'expires_at', v_existing.expires_at,
      'total_amount', v_existing.total_amount,
      'currency', v_existing.currency,
      'rooms_requested', v_existing.rooms_requested,
      'night_count', (v_existing.check_out_date - v_existing.check_in_date)::integer,
      'allocation_mode', 'direct'
    );
  end if;

  perform public.release_expired_checkout_holds(v_hotel_id);

  -- Serialize allocations for this hotel/room type, then lock every relevant
  -- room-night so selection and hold creation share one authoritative snapshot.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_hotel_id::text || ':' || p_room_type_id::text, 2)
  );

  perform 1
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.room_type_id = p_room_type_id
    and pra.date >= p_check_in
    and pra.date < p_check_out
  order by pra.date, pra.room_id
  for update;

  select count(*)::integer
  into v_active_room_count
  from public.physical_rooms pr
  where pr.hotel_id = v_hotel_id
    and pr.room_type_id = p_room_type_id
    and pr.is_active;

  if v_active_room_count = 0 then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_INVENTORY';
  end if;

  v_expected_rows := v_active_room_count::bigint * v_night_count::bigint;

  select count(*)
  into v_actual_rows
  from public.physical_room_allotments pra
  join public.physical_rooms pr on pr.id = pra.room_id
  where pra.hotel_id = v_hotel_id
    and pra.room_type_id = p_room_type_id
    and pra.date >= p_check_in
    and pra.date < p_check_out
    and pr.is_active;

  if v_actual_rows <> v_expected_rows then
    raise exception using
      errcode = 'P0001',
      message = 'INVENTORY_COVERAGE_INCOMPLETE',
      hint = 'Staff must repair the inventory horizon before checkout can continue.';
  end if;

  select array_agg(candidates.room_id order by candidates.room_number)
  into v_selected_room_ids
  from (
    select
      pra.room_id,
      min(pra.room_number) as room_number
    from public.physical_room_allotments pra
    join public.physical_rooms pr
      on pr.id = pra.room_id
     and pr.hotel_id = pra.hotel_id
    where pra.hotel_id = v_hotel_id
      and pra.room_type_id = p_room_type_id
      and pra.date >= p_check_in
      and pra.date < p_check_out
      and pr.is_active
    group by pra.room_id
    having count(*) = v_night_count
       and bool_and(
         not pra.is_booked
         and (pra.hold_id is null or pra.hold_expires_at <= now())
         and (
           (pra.is_available and pra.group_block_id is null)
           or exists (
             select 1
             from public.group_blocks gb
             where gb.id = pra.group_block_id
               and gb.hotel_id = pra.hotel_id
               and gb.is_active
               and pra.date >= gb.valid_from
               and pra.date < gb.valid_to_exclusive
               and p_promo_code is not null
               and upper(btrim(gb.promo_code)) = upper(btrim(p_promo_code))
           )
         )
       )
    order by min(pra.room_number)
    limit p_rooms_requested
  ) as candidates;

  v_selected_room_count := coalesce(cardinality(v_selected_room_ids), 0);

  if v_selected_room_count < p_rooms_requested then
    select coalesce(min(capacity.available_count), 0)::integer
    into v_min_nightly_capacity
    from (
      select
        pra.date,
        count(*) filter (
          where not pra.is_booked
            and (pra.hold_id is null or pra.hold_expires_at <= now())
            and (
              (pra.is_available and pra.group_block_id is null)
              or exists (
                select 1
                from public.group_blocks gb
                where gb.id = pra.group_block_id
                  and gb.hotel_id = pra.hotel_id
                  and gb.is_active
                  and pra.date >= gb.valid_from
                  and pra.date < gb.valid_to_exclusive
                  and p_promo_code is not null
                  and upper(btrim(gb.promo_code)) = upper(btrim(p_promo_code))
              )
            )
        )::integer as available_count
      from public.physical_room_allotments pra
      join public.physical_rooms pr on pr.id = pra.room_id
      where pra.hotel_id = v_hotel_id
        and pra.room_type_id = p_room_type_id
        and pra.date >= p_check_in
        and pra.date < p_check_out
        and pr.is_active
      group by pra.date
    ) as capacity;

    if v_min_nightly_capacity >= p_rooms_requested then
      raise exception using
        errcode = 'P0001',
        message = 'TETRIS_ALLOCATION_REQUIRED',
        hint = 'Total capacity exists but no direct consecutive room sequence is currently available.';
    end if;

    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_INVENTORY';
  end if;

  select sum(pra.nightly_price)::numeric(12, 2)
  into v_total_amount
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.room_id = any(v_selected_room_ids)
    and pra.date >= p_check_in
    and pra.date < p_check_out;

  v_expires_at := now() + make_interval(mins => v_settings.checkout_hold_minutes);

  insert into public.checkout_holds (
    hotel_id,
    room_type_id,
    idempotency_key,
    check_in_date,
    check_out_date,
    rooms_requested,
    adults,
    children,
    promo_code,
    total_amount,
    currency,
    expires_at
  )
  values (
    v_hotel_id,
    p_room_type_id,
    btrim(p_idempotency_key),
    p_check_in,
    p_check_out,
    p_rooms_requested,
    p_adults,
    p_children,
    nullif(upper(btrim(p_promo_code)), ''),
    v_total_amount,
    v_settings.currency,
    v_expires_at
  )
  returning id, public_token, booking_reference_id into v_hold_id, v_public_token, v_booking_reference_id;

  insert into public.checkout_hold_room_nights (
    hold_id,
    allotment_id,
    room_position,
    stay_date,
    room_id,
    nightly_price
  )
  select
    v_hold_id,
    pra.id,
    selected.ordinality::integer,
    pra.date,
    pra.room_id,
    pra.nightly_price
  from unnest(v_selected_room_ids) with ordinality as selected(room_id, ordinality)
  join public.physical_room_allotments pra
    on pra.room_id = selected.room_id
   and pra.hotel_id = v_hotel_id
   and pra.date >= p_check_in
   and pra.date < p_check_out;

  update public.physical_room_allotments pra
  set
    hold_id = v_hold_id,
    hold_expires_at = v_expires_at
  where pra.hotel_id = v_hotel_id
    and pra.room_id = any(v_selected_room_ids)
    and pra.date >= p_check_in
    and pra.date < p_check_out
    and not pra.is_booked
    and (pra.hold_id is null or pra.hold_expires_at <= now());

  if not found then
    raise exception 'Hold allocation changed before it could be persisted.';
  end if;

  if (
    select count(*)
    from public.physical_room_allotments pra
    where pra.hold_id = v_hold_id
  ) <> p_rooms_requested * v_night_count then
    raise exception 'Hold allocation row count mismatch.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'active',
    'hold_token', v_public_token,
    'booking_reference_id', v_booking_reference_id,
    'expires_at', v_expires_at,
    'total_amount', v_total_amount,
    'currency', v_settings.currency,
    'rooms_requested', p_rooms_requested,
    'night_count', v_night_count,
    'allocation_mode', 'direct'
  );
end;
$$;

create or replace function public.finalize_stripe_checkout_hold_legacy(
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
  if p_hold_token is null or nullif(btrim(p_stripe_session_id), '') is null then
    raise exception using errcode = '22023', message = 'Hold token and Stripe session are required.';
  end if;

  if nullif(btrim(p_guest_name), '') is null
     or nullif(btrim(p_guest_email), '') is null
     or position('@' in p_guest_email) <= 1
     or nullif(btrim(p_guest_phone), '') is null then
    raise exception using errcode = '22023', message = 'Complete guest contact details are required.';
  end if;

  if p_total_paid is null or p_total_paid < 0
     or p_currency is null or upper(btrim(p_currency)) !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'Payment amount or currency is invalid.';
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

  if v_hold.status = 'converted' then
    select wr.*
    into v_reservation
    from public.web_reservations wr
    where wr.id = v_hold.converted_reservation_id;

    if not found or v_reservation.stripe_session_id <> btrim(p_stripe_session_id) then
      raise exception using errcode = 'P0001', message = 'PAYMENT_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'reservation_id', v_reservation.id,
      'reservation_number', v_reservation.reservation_number,
      'sync_status', v_reservation.sync_status,
      'assignment_status', v_reservation.assignment_status,
      'shuffle_plan_id', v_reservation.shuffle_plan_id,
      'message', 'Reservation Received & Processing (Awaiting PMS Confirmation).'
    );
  end if;

  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception using
      errcode = 'P0001',
      message = 'HOLD_NOT_ACTIVE',
      hint = 'Do not create a reservation; route the payment to manual review or refund handling.';
  end if;

  if v_hold.stripe_session_id is not null
     and v_hold.stripe_session_id <> btrim(p_stripe_session_id) then
    raise exception using errcode = 'P0001', message = 'STRIPE_SESSION_MISMATCH';
  end if;

  if exists (
    select 1
    from public.web_reservations wr
    where wr.stripe_session_id = btrim(p_stripe_session_id)
       or (
         p_stripe_payment_intent_id is not null
         and wr.stripe_payment_intent_id = btrim(p_stripe_payment_intent_id)
       )
  ) then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALREADY_USED';
  end if;

  if p_total_paid <> v_hold.total_amount
     or upper(btrim(p_currency)) <> v_hold.currency then
    raise exception using
      errcode = 'P0001',
      message = 'PAYMENT_TOTAL_MISMATCH',
      detail = format(
        'Expected %s %s for this hold.',
        v_hold.total_amount,
        v_hold.currency
      );
  end if;

  v_expected_rows :=
    v_hold.rooms_requested * (v_hold.check_out_date - v_hold.check_in_date)::integer;

  perform 1
  from public.physical_room_allotments pra
  join public.checkout_hold_room_nights chrn
    on chrn.allotment_id = pra.id
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
    raise exception using
      errcode = 'P0001',
      message = 'HOLD_OWNERSHIP_VERIFICATION_FAILED',
      hint = 'The database hold no longer owns every requested room-night.';
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
    lpad(
      v_sequence_number::text,
      greatest(8, length(v_sequence_number::text)),
      '0'
    )
  );

  insert into public.web_reservations (
    hotel_id,
    reservation_number,
    booking_reference_id,
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
    currency,
    room_shuffle_required,
    shuffle_plan_id,
    payment_received_at
  ) values (
    v_hold.hotel_id,
    v_reservation_number,
    v_hold.booking_reference_id,
    btrim(p_stripe_session_id),
    nullif(btrim(p_stripe_payment_intent_id), ''),
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
    p_total_paid,
    v_hold.currency,
    v_shuffle_plan_id is not null,
    v_shuffle_plan_id,
    now()
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
    raise exception 'Final booking row count changed during payment finalization.';
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
    converted_reservation_id = v_reservation_id,
    stripe_session_id = btrim(p_stripe_session_id)
  where id = v_hold.id
    and status = 'active';

  if v_shuffle_plan_id is not null then
    update public.room_shuffle_plans
    set
      reservation_id = v_reservation_id,
      status = 'required'
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
      'message', 'Reservation Received & Processing (Awaiting PMS Confirmation).'
    ),
    'reservation_processing:' || v_reservation_id::text
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'reservation_id', v_reservation_id,
    'reservation_number', v_reservation_number,
    'sync_status', 'Pending',
    'assignment_status', case
      when v_shuffle_plan_id is null then 'assigned'
      else 'shuffle_required'
    end,
    'shuffle_plan_id', v_shuffle_plan_id,
    'message', 'Reservation Received & Processing (Awaiting PMS Confirmation).'
  );
end;
$$;

create or replace function public.finalize_pay_at_hotel_checkout_hold_legacy(
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
    booking_reference_id,
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
    v_hold.booking_reference_id,
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

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
