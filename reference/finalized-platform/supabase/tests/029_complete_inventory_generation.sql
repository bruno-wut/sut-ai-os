-- Complete one-time inventory generation and opening website allocation.
-- This file is transaction-safe and leaves no hotel, staff, room, or allotment rows behind.

begin;

insert into public.hotel_settings (
  id, hotel_name, timezone, operational_day_rollover, inventory_horizon_days
) values (
  '61000000-0000-4000-8000-000000000001',
  'Transactional Generation Hotel',
  'Asia/Bangkok',
  '04:00',
  365
);

insert into auth.users (id) values ('64000000-0000-4000-8000-000000000001');
insert into public.staff_profiles (user_id, hotel_id, role, full_name) values (
  '64000000-0000-4000-8000-000000000001',
  '61000000-0000-4000-8000-000000000001',
  'admin',
  'Transactional Generation Admin'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '64000000-0000-4000-8000-000000000001', true);

select public.initialize_hotel_inventory(jsonb_build_array(
  jsonb_build_object(
    'code', 'TX-CLASSIC',
    'name', 'Transactional Classic',
    'base_nightly_rate', 900,
    'image_url', 'https://assets.sriuthonghotels.com/library/images/rooms/tx-classic.jpg',
    'gallery_image_urls', jsonb_build_array(
      'https://assets.sriuthonghotels.com/library/images/rooms/tx-classic.jpg',
      'https://assets.sriuthonghotels.com/library/images/rooms/tx-classic-bath.jpg'
    ),
    'room_size_sqm', 28,
    'max_adults', 2,
    'bed_configuration', 'One double bed',
    'bed_configuration_th', 'เตียงใหญ่ 1 เตียง',
    'extra_bed_policy', 'not-available',
    'full_description', 'A complete transactional room used to verify first inventory generation.',
    'full_description_th', 'ห้องพักสำหรับทดสอบการสร้างคลังห้องพักครั้งแรก',
    'amenities', jsonb_build_array('air-conditioning', 'in-room-wifi'),
    'room_numbers', jsonb_build_array('TX101', 'TX102')
  ),
  jsonb_build_object(
    'code', 'TX-SUITE',
    'name', 'Transactional Suite',
    'base_nightly_rate', 1800,
    'image_url', 'https://assets.sriuthonghotels.com/library/images/rooms/tx-suite.jpg',
    'gallery_image_urls', jsonb_build_array(
      'https://assets.sriuthonghotels.com/library/images/rooms/tx-suite.jpg'
    ),
    'room_size_sqm', 48,
    'max_adults', 3,
    'bed_configuration', 'One king bed',
    'bed_configuration_th', 'เตียงคิงไซส์ 1 เตียง',
    'extra_bed_policy', 'on-request',
    'full_description', 'A complete transactional suite used to verify first inventory generation.',
    'full_description_th', 'ห้องสวีทสำหรับทดสอบการสร้างคลังห้องพักครั้งแรก',
    'amenities', jsonb_build_array('air-conditioning', 'in-room-wifi', 'private-bathroom'),
    'room_numbers', jsonb_build_array('TX201')
  )
));

select public.publish_initial_web_allocation(array['TX101', 'TX201']);

do $$
declare
  v_start date;
begin
  select min(date)
  into v_start
  from public.physical_room_allotments
  where hotel_id = '61000000-0000-4000-8000-000000000001';

  if (select count(*) from public.room_types where hotel_id = '61000000-0000-4000-8000-000000000001') <> 2 then
    raise exception 'Expected two generated room types.';
  end if;

  if (select count(*) from public.physical_rooms where hotel_id = '61000000-0000-4000-8000-000000000001') <> 3 then
    raise exception 'Expected three generated physical rooms.';
  end if;

  if (select count(*) from public.physical_room_allotments where hotel_id = '61000000-0000-4000-8000-000000000001') <> 1095 then
    raise exception 'Expected 1,095 generated allotments (3 rooms x 365 days).';
  end if;

  if (select count(*) from public.physical_room_allotments where hotel_id = '61000000-0000-4000-8000-000000000001' and is_available) <> 730 then
    raise exception 'Expected 730 open website allotments (2 rooms x 365 days).';
  end if;

  if (select count(*) from public.physical_room_allotments where hotel_id = '61000000-0000-4000-8000-000000000001' and not is_available) <> 365 then
    raise exception 'Expected 365 closed non-web allotments.';
  end if;

  if not exists (
    select 1 from public.inventory_generation_runs
    where hotel_id = '61000000-0000-4000-8000-000000000001'
      and status = 'completed'
      and expected_rows = 1095
      and generated_rows = 1095
  ) then
    raise exception 'Completed generation run did not reconcile.';
  end if;

  if not exists (
    select 1 from public.hotel_settings
    where id = '61000000-0000-4000-8000-000000000001'
      and setup_completed_at is not null
  ) then
    raise exception 'Setup completion marker was not written.';
  end if;

  if not exists (
    select 1 from public.room_types
    where hotel_id = '61000000-0000-4000-8000-000000000001'
      and code = 'TX-CLASSIC'
      and image_url = 'https://assets.sriuthonghotels.com/library/images/rooms/tx-classic.jpg'
      and jsonb_array_length(gallery_image_urls) = 2
  ) then
    raise exception 'Guest gallery details did not persist during generation.';
  end if;

  if not exists (
    select 1 from public.inventory_change_events
    where hotel_id = '61000000-0000-4000-8000-000000000001'
      and reason = 'Opening website room allocation'
      and metadata ->> 'website_room_count' = '2'
  ) then
    raise exception 'Opening website allocation was not audited.';
  end if;

  if (select count(distinct date) from public.physical_room_allotments where hotel_id = '61000000-0000-4000-8000-000000000001') <> 365
     or (select max(date) from public.physical_room_allotments where hotel_id = '61000000-0000-4000-8000-000000000001') <> v_start + 364 then
    raise exception 'Generated inventory does not cover the exact operational 365-day horizon.';
  end if;

  begin
    perform public.initialize_hotel_inventory(jsonb_build_array(
      jsonb_build_object(
        'code', 'TX-RETRY', 'name', 'Transactional Retry',
        'base_nightly_rate', 1000, 'room_numbers', jsonb_build_array('TX999')
      )
    ));
    raise exception 'Duplicate inventory generation unexpectedly succeeded.';
  exception when others then
    if sqlerrm not like '%already been initialized%' then raise; end if;
  end;
end;
$$;

rollback;
