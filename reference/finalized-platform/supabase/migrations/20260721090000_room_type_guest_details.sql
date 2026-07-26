-- Guest-facing room galleries, descriptions, occupancy and amenities.

alter table public.room_types
  add column if not exists gallery_image_urls jsonb not null default '["/images/grand-superior-room.jpg"]'::jsonb,
  add column if not exists room_size_sqm numeric(6, 2) not null default 28,
  add column if not exists max_adults integer not null default 2,
  add column if not exists bed_configuration text not null default 'Bed configuration confirmed by the hotel',
  add column if not exists bed_configuration_th text not null default '',
  add column if not exists extra_bed_policy text not null default 'not-available',
  add column if not exists full_description text not null default 'A comfortable guest room with the hotel essentials for a restful stay.',
  add column if not exists full_description_th text not null default '',
  add column if not exists amenities text[] not null default array[
    'air-conditioning',
    'daily-housekeeping',
    'in-room-wifi',
    'non-smoking',
    'private-bathroom',
    'television',
    'toiletries'
  ]::text[];

update public.room_types
set gallery_image_urls = jsonb_build_array(image_url)
where jsonb_array_length(gallery_image_urls) = 0;

alter table public.room_types
  alter column gallery_image_urls set default '["/images/grand-superior-room.jpg"]'::jsonb;

alter table public.room_types
  drop constraint if exists room_types_image_url_format,
  drop constraint if exists room_types_gallery_image_urls_shape,
  drop constraint if exists room_types_size_positive,
  drop constraint if exists room_types_max_adults_positive,
  drop constraint if exists room_types_bed_configuration_not_blank,
  drop constraint if exists room_types_extra_bed_policy_valid,
  drop constraint if exists room_types_full_description_not_blank,
  drop constraint if exists room_types_amenities_not_empty;

alter table public.room_types
  add constraint room_types_image_url_format check (
    image_url ~ '^/images/[A-Za-z0-9._/-]+$'
    or image_url ~ '^https://imagedelivery[.]net/[^[:space:]]+$'
    or image_url ~ '^https://[A-Za-z0-9.-]+/library/images/[A-Za-z0-9._/-]+$'
  ),
  add constraint room_types_gallery_image_urls_shape check (
    jsonb_typeof(gallery_image_urls) = 'array'
    and jsonb_array_length(gallery_image_urls) between 1 and 8
  ),
  add constraint room_types_size_positive check (room_size_sqm > 0),
  add constraint room_types_max_adults_positive check (max_adults between 1 and 20),
  add constraint room_types_bed_configuration_not_blank check (btrim(bed_configuration) <> ''),
  add constraint room_types_extra_bed_policy_valid check (
    extra_bed_policy in ('available', 'not-available', 'on-request')
  ),
  add constraint room_types_full_description_not_blank check (btrim(full_description) <> ''),
  add constraint room_types_amenities_not_empty check (cardinality(amenities) between 1 and 50);

comment on column public.room_types.gallery_image_urls is
  'Ordered guest gallery. The first image is the booking-card cover; maximum eight images.';
comment on column public.room_types.amenities is
  'Stable amenity identifiers localized by the guest booking interface.';
comment on column public.room_types.extra_bed_policy is
  'Guest-facing extra-bed availability: available, on-request, or not-available.';

create or replace function public.initialize_hotel_inventory(p_room_types jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_inventory_room_types jsonb;
  v_result jsonb;
begin
  select jsonb_agg(
    jsonb_set(
      item.value,
      '{image_url}',
      to_jsonb('/images/grand-superior-room.jpg'::text),
      true
    )
  )
  into v_inventory_room_types
  from jsonb_array_elements(p_room_types) as item(value);

  select private.initialize_hotel_inventory(v_inventory_room_types)
  into v_result;

  v_hotel_id := public.current_staff_hotel_id();

  update public.room_types rt
  set
    image_url = coalesce(nullif(btrim(item.value ->> 'image_url'), ''), rt.image_url),
    gallery_image_urls = coalesce(item.value -> 'gallery_image_urls', jsonb_build_array(rt.image_url)),
    room_size_sqm = coalesce((item.value ->> 'room_size_sqm')::numeric, rt.room_size_sqm),
    max_adults = coalesce((item.value ->> 'max_adults')::integer, rt.max_adults),
    bed_configuration = coalesce(nullif(btrim(item.value ->> 'bed_configuration'), ''), rt.bed_configuration),
    bed_configuration_th = coalesce(btrim(item.value ->> 'bed_configuration_th'), rt.bed_configuration_th),
    extra_bed_policy = coalesce(nullif(btrim(item.value ->> 'extra_bed_policy'), ''), rt.extra_bed_policy),
    full_description = coalesce(nullif(btrim(item.value ->> 'full_description'), ''), rt.full_description),
    full_description_th = coalesce(btrim(item.value ->> 'full_description_th'), rt.full_description_th),
    amenities = case
      when item.value ? 'amenities'
        then array(select jsonb_array_elements_text(item.value -> 'amenities'))
      else rt.amenities
    end
  from jsonb_array_elements(p_room_types) as item(value)
  where rt.hotel_id = v_hotel_id
    and rt.code = upper(btrim(item.value ->> 'code'));

  return v_result;
end;
$$;

revoke all on function public.initialize_hotel_inventory(jsonb) from public, anon;
grant execute on function public.initialize_hotel_inventory(jsonb) to authenticated, service_role;
