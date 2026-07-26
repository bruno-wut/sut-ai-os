-- Hotel Inventory Bridge: atomic direct allocation and 15-minute checkout holds.
-- Hotel Tetris fallback planning is added in the following migration.

alter table public.hotel_settings
  add column max_stay_nights integer not null default 30,
  add column max_rooms_per_booking integer not null default 5,
  add constraint hotel_settings_max_stay_nights_range
    check (max_stay_nights between 1 and 90),
  add constraint hotel_settings_max_rooms_per_booking_range
    check (max_rooms_per_booking between 1 and 5);

create or replace function public.release_expired_checkout_holds(
  p_hotel_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold_ids uuid[];
  v_released_count integer := 0;
begin
  select array_agg(expired.id)
  into v_hold_ids
  from (
    select ch.id
    from public.checkout_holds ch
    where ch.status = 'active'
      and ch.expires_at <= now()
      and (p_hotel_id is null or ch.hotel_id = p_hotel_id)
    order by ch.expires_at, ch.id
    for update skip locked
  ) as expired;

  if coalesce(cardinality(v_hold_ids), 0) = 0 then
    return 0;
  end if;

  update public.checkout_hold_room_nights chrn
  set released_at = coalesce(chrn.released_at, now())
  where chrn.hold_id = any(v_hold_ids);

  update public.physical_room_allotments pra
  set
    hold_id = null,
    hold_expires_at = null
  where pra.hold_id = any(v_hold_ids);

  update public.checkout_holds ch
  set status = 'expired'
  where ch.id = any(v_hold_ids)
    and ch.status = 'active';

  get diagnostics v_released_count = row_count;
  return v_released_count;
end;
$$;

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
  returning id, public_token into v_hold_id, v_public_token;

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
    'expires_at', v_expires_at,
    'total_amount', v_total_amount,
    'currency', v_settings.currency,
    'rooms_requested', p_rooms_requested,
    'night_count', v_night_count,
    'allocation_mode', 'direct'
  );
end;
$$;

revoke all on function public.release_expired_checkout_holds(uuid)
  from public, anon, authenticated;
revoke all on function public.create_checkout_hold(
  date, date, uuid, integer, integer, integer, text, text
) from public;

grant execute on function public.release_expired_checkout_holds(uuid)
  to service_role;
grant execute on function public.create_checkout_hold(
  date, date, uuid, integer, integer, integer, text, text
) to anon, authenticated;

comment on function public.release_expired_checkout_holds(uuid) is
  'Background-worker-safe cleanup that releases expired hold rows exactly once using row locks.';

comment on function public.create_checkout_hold(
  date, date, uuid, integer, integer, integer, text, text
) is
  'Atomically locks distinct consecutive room sequences and creates an idempotent database-timed checkout hold without exposing physical room identities.';
