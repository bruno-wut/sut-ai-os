-- Hotel Inventory Bridge: first-time onboarding and initial inventory generation.

create or replace function public.hotel_operational_date(p_hotel_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select (
    (now() at time zone hs.timezone)
    - (hs.operational_day_rollover - time '00:00')
  )::date
  from public.hotel_settings hs
  where hs.id = p_hotel_id
$$;

create or replace function public.initialize_hotel_inventory(p_room_types jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_settings public.hotel_settings%rowtype;
  v_run_id uuid;
  v_start_date date;
  v_end_date_exclusive date;
  v_room_type_count integer := 0;
  v_room_count integer := 0;
  v_expected_rows integer := 0;
  v_generated_rows integer := 0;
  v_error_message text;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null then
    raise exception using
      errcode = '42501',
      message = 'An active staff profile is required.';
  end if;

  if not public.staff_has_any_role(
    array['admin', 'manager']::public.staff_role[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only an admin or manager can initialize hotel inventory.';
  end if;

  select hs.*
  into v_settings
  from public.hotel_settings hs
  where hs.id = v_hotel_id
  for update;

  if not found then
    raise exception 'Hotel settings were not found for the current staff profile.';
  end if;

  if v_settings.setup_completed_at is not null
     or exists (
       select 1
       from public.physical_room_allotments pra
       where pra.hotel_id = v_hotel_id
     ) then
    raise exception 'Hotel inventory has already been initialized.';
  end if;

  if exists (
    select 1 from public.room_types rt where rt.hotel_id = v_hotel_id
  ) or exists (
    select 1 from public.physical_rooms pr where pr.hotel_id = v_hotel_id
  ) then
    raise exception 'Partial room configuration exists; resolve it before onboarding.';
  end if;

  if p_room_types is null
     or jsonb_typeof(p_room_types) <> 'array'
     or jsonb_array_length(p_room_types) = 0 then
    raise exception 'At least one room type is required.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_room_types) as item(value)
    where jsonb_typeof(item.value) <> 'object'
       or nullif(btrim(item.value ->> 'code'), '') is null
       or nullif(btrim(item.value ->> 'name'), '') is null
       or not (item.value ? 'base_nightly_rate')
       or jsonb_typeof(item.value -> 'base_nightly_rate') <> 'number'
       or (
         item.value ? 'image_url'
         and (
           jsonb_typeof(item.value -> 'image_url') <> 'string'
           or nullif(btrim(item.value ->> 'image_url'), '') is null
         )
       )
       or jsonb_typeof(item.value -> 'room_numbers') <> 'array'
       or jsonb_array_length(item.value -> 'room_numbers') = 0
  ) then
    raise exception 'Every room type requires code, name, base_nightly_rate, optional image_url text, and room_numbers.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_room_types) as item(value)
    where item.value ? 'image_url'
      and not (
        btrim(item.value ->> 'image_url') ~ '^/images/[A-Za-z0-9._/-]+$'
        or btrim(item.value ->> 'image_url') ~ '^https://imagedelivery[.]net/[^[:space:]]+$'
      )
  ) then
    raise exception 'Room type image_url must be a local /images path or a Cloudflare Images delivery URL.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_room_types) as item(value)
    where (item.value ->> 'base_nightly_rate')::numeric < 0
  ) then
    raise exception 'Base nightly rates cannot be negative.';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_room_types) as item(value)
    cross join lateral jsonb_array_elements(item.value -> 'room_numbers') as rn(value)
    where jsonb_typeof(rn.value) <> 'string'
       or nullif(btrim(rn.value #>> '{}'), '') is null
  ) then
    raise exception 'Room numbers must be non-blank text values.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_room_types)
  ) <> (
    select count(distinct upper(btrim(item.value ->> 'code')))
    from jsonb_array_elements(p_room_types) as item(value)
  ) then
    raise exception 'Room type codes must be unique.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_room_types)
  ) <> (
    select count(distinct lower(btrim(item.value ->> 'name')))
    from jsonb_array_elements(p_room_types) as item(value)
  ) then
    raise exception 'Room type names must be unique.';
  end if;

  if (
    select count(*)
    from jsonb_array_elements(p_room_types) as item(value)
    cross join lateral jsonb_array_elements_text(item.value -> 'room_numbers') as rn(value)
  ) <> (
    select count(distinct upper(btrim(rn.value)))
    from jsonb_array_elements(p_room_types) as item(value)
    cross join lateral jsonb_array_elements_text(item.value -> 'room_numbers') as rn(value)
  ) then
    raise exception 'Physical room numbers must be unique across all room types.';
  end if;

  v_start_date := public.hotel_operational_date(v_hotel_id);
  v_end_date_exclusive := v_start_date + v_settings.inventory_horizon_days;

  insert into public.inventory_generation_runs (
    hotel_id,
    range_start,
    range_end_exclusive,
    status
  )
  values (
    v_hotel_id,
    v_start_date,
    v_end_date_exclusive,
    'running'
  )
  returning id into v_run_id;

  begin
    insert into public.room_types (
      hotel_id,
      code,
      name,
      base_nightly_rate,
      image_url
    )
    select
      v_hotel_id,
      upper(btrim(item.value ->> 'code')),
      btrim(item.value ->> 'name'),
      (item.value ->> 'base_nightly_rate')::numeric,
      coalesce(nullif(btrim(item.value ->> 'image_url'), ''), '/images/grand-superior-room.jpg')
    from jsonb_array_elements(p_room_types) as item(value);

    get diagnostics v_room_type_count = row_count;

    insert into public.physical_rooms (
      hotel_id,
      room_type_id,
      room_number
    )
    select
      v_hotel_id,
      rt.id,
      btrim(rn.value)
    from jsonb_array_elements(p_room_types) as item(value)
    join public.room_types rt
      on rt.hotel_id = v_hotel_id
     and rt.code = upper(btrim(item.value ->> 'code'))
    cross join lateral jsonb_array_elements_text(item.value -> 'room_numbers') as rn(value);

    get diagnostics v_room_count = row_count;
    v_expected_rows := v_room_count * v_settings.inventory_horizon_days;

    update public.inventory_generation_runs
    set expected_rows = v_expected_rows
    where id = v_run_id;

    insert into public.physical_room_allotments (
      hotel_id,
      room_id,
      room_type_id,
      date,
      room_number,
      room_type,
      nightly_price
    )
    select
      v_hotel_id,
      pr.id,
      rt.id,
      inventory_date::date,
      pr.room_number,
      rt.name,
      rt.base_nightly_rate
    from public.physical_rooms pr
    join public.room_types rt
      on rt.id = pr.room_type_id
     and rt.hotel_id = pr.hotel_id
    cross join lateral generate_series(
      v_start_date,
      v_end_date_exclusive - 1,
      interval '1 day'
    ) as inventory_date
    where pr.hotel_id = v_hotel_id;

    get diagnostics v_generated_rows = row_count;

    if v_generated_rows <> v_expected_rows then
      raise exception
        'Inventory generation count mismatch: expected %, generated %.',
        v_expected_rows,
        v_generated_rows;
    end if;

    update public.hotel_settings
    set setup_completed_at = now()
    where id = v_hotel_id;

    update public.inventory_generation_runs
    set
      status = 'completed',
      generated_rows = v_generated_rows,
      completed_at = now()
    where id = v_run_id;

    return jsonb_build_object(
      'ok', true,
      'hotel_id', v_hotel_id,
      'room_type_count', v_room_type_count,
      'room_count', v_room_count,
      'generated_rows', v_generated_rows,
      'range_start', v_start_date,
      'range_end_exclusive', v_end_date_exclusive
    );
  exception
    when others then
      get stacked diagnostics v_error_message = message_text;

      update public.inventory_generation_runs
      set
        status = 'failed',
        generated_rows = 0,
        error_message = v_error_message,
        completed_at = now()
      where id = v_run_id;

      return jsonb_build_object(
        'ok', false,
        'hotel_id', v_hotel_id,
        'error', v_error_message
      );
  end;
end;
$$;

revoke all on function public.hotel_operational_date(uuid)
  from public, anon, authenticated;
revoke all on function public.initialize_hotel_inventory(jsonb)
  from public, anon;

grant execute on function public.initialize_hotel_inventory(jsonb)
  to authenticated;

comment on function public.hotel_operational_date(uuid) is
  'Returns the hotel business date after applying its timezone and 4:00 AM rollover.';

comment on function public.initialize_hotel_inventory(jsonb) is
  'Atomically validates first-time room configuration and generates the configured inventory horizon.';
