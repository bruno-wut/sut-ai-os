-- Safe post-initialization publishing for guest room content and website allocation.

create or replace function public.update_room_type_guest_configuration(
  p_room_type_id uuid,
  p_configuration jsonb,
  p_website_room_numbers text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_operational_date date;
  v_end_date_exclusive date;
  v_requested_count integer := 0;
  v_matched_count integer := 0;
  v_allocation_changed boolean := false;
  v_affected_rows integer := 0;
  v_amenities text[];
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null then
    raise exception using errcode = '42501', message = 'An active staff profile is required.';
  end if;

  if not public.staff_has_any_role(array['admin', 'manager']::public.staff_role[]) then
    raise exception using errcode = '42501', message = 'Only an admin or manager can manage room types.';
  end if;

  if not exists (
    select 1
    from public.hotel_settings hs
    where hs.id = v_hotel_id
      and hs.setup_completed_at is not null
  ) then
    raise exception 'Initial hotel configuration must be completed first.';
  end if;

  if not exists (
    select 1
    from public.room_types rt
    where rt.id = p_room_type_id
      and rt.hotel_id = v_hotel_id
      and rt.is_active
  ) then
    raise exception 'The selected room type is inactive or does not belong to this hotel.';
  end if;

  if p_configuration is null or jsonb_typeof(p_configuration) <> 'object' then
    raise exception 'A valid room configuration is required.';
  end if;

  if jsonb_typeof(p_configuration -> 'gallery_image_urls') <> 'array'
     or jsonb_array_length(p_configuration -> 'gallery_image_urls') not between 1 and 8
     or exists (
       select 1
       from jsonb_array_elements(p_configuration -> 'gallery_image_urls') as image(value)
       where jsonb_typeof(image.value) <> 'string'
          or not (
            btrim(image.value #>> '{}') ~ '^/images/[A-Za-z0-9._/-]+$'
            or btrim(image.value #>> '{}') ~ '^https://imagedelivery[.]net/[^[:space:]]+$'
            or btrim(image.value #>> '{}') ~ '^https://[A-Za-z0-9.-]+/library/images/[A-Za-z0-9._/-]+$'
          )
     ) then
    raise exception 'Room galleries require one to eight approved image URLs.';
  end if;

  if nullif(btrim(p_configuration ->> 'bed_configuration'), '') is null
     or length(btrim(p_configuration ->> 'bed_configuration')) > 160
     or length(btrim(coalesce(p_configuration ->> 'bed_configuration_th', ''))) > 160
     or nullif(btrim(p_configuration ->> 'full_description'), '') is null
     or length(btrim(p_configuration ->> 'full_description')) not between 20 and 1500
     or length(btrim(coalesce(p_configuration ->> 'full_description_th', ''))) > 1500
     or (p_configuration ->> 'extra_bed_policy') not in ('available', 'not-available', 'on-request')
     or (p_configuration ->> 'room_size_sqm')::numeric not between 1 and 1000
     or (p_configuration ->> 'max_adults')::integer not between 1 and 20 then
    raise exception 'Room details are incomplete or outside the supported limits.';
  end if;

  if jsonb_typeof(p_configuration -> 'amenities') <> 'array'
     or jsonb_array_length(p_configuration -> 'amenities') not between 1 and 14
     or exists (
       select 1
       from jsonb_array_elements_text(p_configuration -> 'amenities') as amenity(value)
       where amenity.value <> all(array[
         'air-conditioning', 'breakfast', 'city-view', 'daily-housekeeping',
         'desk', 'electric-kettle', 'hair-dryer', 'in-room-wifi',
         'non-smoking', 'private-bathroom', 'refrigerator', 'television',
         'toiletries', 'wardrobe'
       ]::text[])
     ) then
    raise exception 'Select one or more supported room amenities.';
  end if;

  select array_agg(amenity.value order by amenity.ordinality)
  into v_amenities
  from jsonb_array_elements_text(p_configuration -> 'amenities')
    with ordinality as amenity(value, ordinality);

  if cardinality(v_amenities) <> (select count(distinct value) from unnest(v_amenities) as selected(value)) then
    raise exception 'Room amenities must be unique.';
  end if;

  p_website_room_numbers := coalesce(p_website_room_numbers, '{}'::text[]);

  select count(distinct upper(btrim(room_number)))
  into v_requested_count
  from unnest(p_website_room_numbers) as requested(room_number)
  where nullif(btrim(room_number), '') is not null;

  if v_requested_count <> cardinality(p_website_room_numbers) then
    raise exception 'Website room numbers must be non-blank and unique.';
  end if;

  select count(*)
  into v_matched_count
  from public.physical_rooms pr
  where pr.hotel_id = v_hotel_id
    and pr.room_type_id = p_room_type_id
    and pr.is_active
    and upper(pr.room_number) = any(
      select upper(btrim(room_number))
      from unnest(p_website_room_numbers) as requested(room_number)
    );

  if v_matched_count <> v_requested_count then
    raise exception 'Website allocation must use active rooms from the selected room type.';
  end if;

  select exists (
    select 1
    from public.physical_rooms pr
    where pr.hotel_id = v_hotel_id
      and pr.room_type_id = p_room_type_id
      and pr.is_active
      and pr.web_allocation_enabled is distinct from (
        upper(pr.room_number) = any(
          select upper(btrim(room_number))
          from unnest(p_website_room_numbers) as requested(room_number)
        )
      )
  ) into v_allocation_changed;

  v_operational_date := public.hotel_operational_date(v_hotel_id);

  if v_allocation_changed and exists (
    select 1
    from public.physical_room_allotments pra
    where pra.hotel_id = v_hotel_id
      and pra.room_type_id = p_room_type_id
      and pra.date >= v_operational_date
      and (
        (pra.hold_id is not null and pra.hold_expires_at > now())
        or pra.group_block_id is not null
      )
  ) then
    raise exception 'Clear active checkout holds and group blocks before changing this website allocation.';
  end if;

  update public.room_types rt
  set
    image_url = p_configuration -> 'gallery_image_urls' ->> 0,
    gallery_image_urls = p_configuration -> 'gallery_image_urls',
    room_size_sqm = (p_configuration ->> 'room_size_sqm')::numeric,
    max_adults = (p_configuration ->> 'max_adults')::integer,
    bed_configuration = btrim(p_configuration ->> 'bed_configuration'),
    bed_configuration_th = btrim(coalesce(p_configuration ->> 'bed_configuration_th', '')),
    extra_bed_policy = p_configuration ->> 'extra_bed_policy',
    full_description = btrim(p_configuration ->> 'full_description'),
    full_description_th = btrim(coalesce(p_configuration ->> 'full_description_th', '')),
    amenities = v_amenities,
    updated_at = now()
  where rt.id = p_room_type_id
    and rt.hotel_id = v_hotel_id;

  if v_allocation_changed then
    update public.physical_rooms pr
    set
      web_allocation_enabled = (
        upper(pr.room_number) = any(
          select upper(btrim(room_number))
          from unnest(p_website_room_numbers) as requested(room_number)
        )
      ),
      updated_at = now()
    where pr.hotel_id = v_hotel_id
      and pr.room_type_id = p_room_type_id
      and pr.is_active;

    update public.physical_room_allotments pra
    set is_available = pr.web_allocation_enabled
    from public.physical_rooms pr
    where pr.id = pra.room_id
      and pr.hotel_id = pra.hotel_id
      and pra.hotel_id = v_hotel_id
      and pra.room_type_id = p_room_type_id
      and pra.date >= v_operational_date
      and not pra.is_booked
      and pra.hold_id is null
      and pra.group_block_id is null;

    get diagnostics v_affected_rows = row_count;
  end if;

  select coalesce(max(pra.date) + 1, v_operational_date + 1)
  into v_end_date_exclusive
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.room_type_id = p_room_type_id
    and pra.date >= v_operational_date;

  insert into public.inventory_change_events (
    hotel_id, actor_user_id, kind, range_start, range_end_exclusive,
    room_type_id, affected_rows, reason, metadata
  ) values (
    v_hotel_id, auth.uid(), 'bulk_update', v_operational_date, v_end_date_exclusive,
    p_room_type_id, v_affected_rows, 'Published room type configuration',
    jsonb_build_object(
      'operation', 'room_type_configuration_publish',
      'gallery_image_count', jsonb_array_length(p_configuration -> 'gallery_image_urls'),
      'website_room_count', v_requested_count,
      'website_allocation_changed', v_allocation_changed
    )
  );

  return jsonb_build_object(
    'ok', true,
    'room_type_id', p_room_type_id,
    'gallery_image_urls', p_configuration -> 'gallery_image_urls',
    'website_room_count', v_requested_count,
    'allocation_rows_updated', v_affected_rows
  );
end;
$$;

revoke all on function public.update_room_type_guest_configuration(uuid, jsonb, text[])
  from public, anon;
grant execute on function public.update_room_type_guest_configuration(uuid, jsonb, text[])
  to authenticated;

comment on function public.update_room_type_guest_configuration(uuid, jsonb, text[]) is
  'Admin/manager-only atomic publish of guest room content and one room type website allocation after onboarding.';
