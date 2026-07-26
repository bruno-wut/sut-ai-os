-- Hotel Inventory Bridge: anonymous-safe room-type availability search.
-- This is a capacity pre-check only. Consecutive-room/Tetris allocation and
-- atomic inventory locking are performed by later checkout RPCs.

create or replace function public.search_room_type_availability(
  p_check_in date,
  p_check_out date,
  p_room_type_id uuid,
  p_promo_code text default null
)
returns table (
  room_type_id uuid,
  room_type_name text,
  search_check_in date,
  search_check_out date,
  night_count integer,
  available_room_count integer
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_room_type_name text;
  v_operational_date date;
  v_inventory_horizon_days integer;
  v_active_room_count integer;
  v_expected_allotment_rows bigint;
  v_actual_allotment_rows bigint;
  v_available_room_count integer;
begin
  if p_check_in is null or p_check_out is null or p_room_type_id is null then
    raise exception using
      errcode = '22023',
      message = 'Check-in, check-out, and room type are required.';
  end if;

  if p_check_out <= p_check_in then
    raise exception using
      errcode = '22023',
      message = 'Check-out must be later than check-in.';
  end if;

  select
    rt.hotel_id,
    rt.name,
    hs.inventory_horizon_days
  into
    v_hotel_id,
    v_room_type_name,
    v_inventory_horizon_days
  from public.room_types rt
  join public.hotel_settings hs on hs.id = rt.hotel_id
  where rt.id = p_room_type_id
    and rt.is_active
    and hs.setup_completed_at is not null;

  if not found then
    return;
  end if;

  v_operational_date := public.hotel_operational_date(v_hotel_id);

  if p_check_in < v_operational_date then
    raise exception using
      errcode = '22023',
      message = 'Check-in cannot be earlier than the hotel operational date.';
  end if;

  if p_check_out > v_operational_date + v_inventory_horizon_days then
    raise exception using
      errcode = '22023',
      message = 'Requested dates are outside the currently published inventory horizon.';
  end if;

  select count(*)::integer
  into v_active_room_count
  from public.physical_rooms pr
  where pr.hotel_id = v_hotel_id
    and pr.room_type_id = p_room_type_id
    and pr.is_active;

  if v_active_room_count = 0 then
    return query
    select
      p_room_type_id,
      v_room_type_name,
      p_check_in,
      p_check_out,
      (p_check_out - p_check_in)::integer,
      0;
    return;
  end if;

  v_expected_allotment_rows :=
    v_active_room_count::bigint * (p_check_out - p_check_in)::bigint;

  select count(*)
  into v_actual_allotment_rows
  from public.physical_room_allotments pra
  join public.physical_rooms pr
    on pr.id = pra.room_id
   and pr.hotel_id = pra.hotel_id
  where pra.hotel_id = v_hotel_id
    and pra.room_type_id = p_room_type_id
    and pra.date >= p_check_in
    and pra.date < p_check_out
    and pr.is_active;

  if v_actual_allotment_rows <> v_expected_allotment_rows then
    raise exception using
      errcode = 'P0001',
      message = 'Inventory coverage is incomplete for the requested stay.',
      hint = 'Staff must repair the inventory horizon before this room type can be sold.';
  end if;

  select coalesce(min(nightly_capacity.available_count), 0)::integer
  into v_available_room_count
  from (
    select
      pra.date,
      count(*) filter (
        where not pra.is_booked
          and (
            pra.hold_id is null
            or pra.hold_expires_at <= now()
          )
          and (
            (
              pra.is_available
              and pra.group_block_id is null
            )
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
    join public.physical_rooms pr
      on pr.id = pra.room_id
     and pr.hotel_id = pra.hotel_id
    where pra.hotel_id = v_hotel_id
      and pra.room_type_id = p_room_type_id
      and pra.date >= p_check_in
      and pra.date < p_check_out
      and pr.is_active
    group by pra.date
  ) as nightly_capacity;

  return query
  select
    p_room_type_id,
    v_room_type_name,
    p_check_in,
    p_check_out,
    (p_check_out - p_check_in)::integer,
    v_available_room_count;
end;
$$;

revoke all on function public.search_room_type_availability(date, date, uuid, text)
  from public;

grant execute on function public.search_room_type_availability(date, date, uuid, text)
  to anon, authenticated;

comment on function public.search_room_type_availability(date, date, uuid, text) is
  'Returns only minimum nightly room-type capacity; validates coverage and supports promo-only group blocks without exposing room-level inventory.';
