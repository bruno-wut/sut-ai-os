-- Post-onboarding room configuration publishing, allocation sync, audit, and RBAC.

begin;

insert into public.hotel_settings (id, setup_completed_at) values
  ('51000000-0000-4000-8000-000000000001', now()),
  ('51000000-0000-4000-8000-000000000002', now());

insert into public.room_types (id, hotel_id, code, name, base_nightly_rate) values
  ('52000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'MANAGED', 'Managed Room', 1400),
  ('52000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000002', 'OTHER', 'Other Hotel Room', 1400);

insert into public.physical_rooms (id, hotel_id, room_type_id, room_number) values
  ('53000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'M-101'),
  ('53000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', 'M-102'),
  ('53000000-0000-4000-8000-000000000003', '51000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000002', 'O-101');

insert into public.physical_room_allotments (
  hotel_id, room_id, room_type_id, date, room_number, room_type, nightly_price
) values
  ('51000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000001', current_date + 10, 'M-101', 'Managed Room', 1400),
  ('51000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000002', '52000000-0000-4000-8000-000000000001', current_date + 10, 'M-102', 'Managed Room', 1400);

insert into auth.users (id) values
  ('54000000-0000-4000-8000-000000000001'),
  ('54000000-0000-4000-8000-000000000002');

insert into public.staff_profiles (user_id, hotel_id, role, full_name) values
  ('54000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'admin', 'Room Configuration Admin'),
  ('54000000-0000-4000-8000-000000000002', '51000000-0000-4000-8000-000000000001', 'front_desk', 'Room Configuration Front Desk');

set local role authenticated;
select set_config('request.jwt.claim.sub', '54000000-0000-4000-8000-000000000001', true);

select public.update_room_type_guest_configuration(
  '52000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'gallery_image_urls', jsonb_build_array(
      'https://assets.sriuthonghotels.com/library/images/rooms/managed-cover.jpg',
      'https://assets.sriuthonghotels.com/library/images/rooms/managed-bathroom.jpg'
    ),
    'room_size_sqm', 34,
    'max_adults', 3,
    'bed_configuration', 'One double bed and one single bed',
    'bed_configuration_th', 'เตียงใหญ่ 1 เตียง และเตียงเดี่ยว 1 เตียง',
    'extra_bed_policy', 'on-request',
    'full_description', 'A complete guest-facing description for the managed room configuration test.',
    'full_description_th', 'รายละเอียดห้องพักสำหรับการทดสอบระบบจัดการประเภทห้องพัก',
    'amenities', jsonb_build_array('air-conditioning', 'in-room-wifi', 'private-bathroom')
  ),
  array['M-102']
);

do $$
begin
  if not exists (
    select 1 from public.room_types
    where id = '52000000-0000-4000-8000-000000000001'
      and image_url = 'https://assets.sriuthonghotels.com/library/images/rooms/managed-cover.jpg'
      and jsonb_array_length(gallery_image_urls) = 2
      and max_adults = 3
      and amenities = array['air-conditioning', 'in-room-wifi', 'private-bathroom']::text[]
  ) then
    raise exception 'Guest room content was not published atomically.';
  end if;

  if exists (
    select 1 from public.physical_rooms
    where id = '53000000-0000-4000-8000-000000000001'
      and web_allocation_enabled
  ) or not exists (
    select 1 from public.physical_rooms
    where id = '53000000-0000-4000-8000-000000000002'
      and web_allocation_enabled
  ) then
    raise exception 'Website room allocation did not match the published selection.';
  end if;

  if exists (
    select 1 from public.physical_room_allotments
    where room_id = '53000000-0000-4000-8000-000000000001'
      and is_available
  ) or not exists (
    select 1 from public.physical_room_allotments
    where room_id = '53000000-0000-4000-8000-000000000002'
      and is_available
  ) then
    raise exception 'Future allotments did not synchronize with website allocation.';
  end if;

  if not exists (
    select 1 from public.inventory_change_events
    where room_type_id = '52000000-0000-4000-8000-000000000001'
      and metadata ->> 'operation' = 'room_type_configuration_publish'
  ) then
    raise exception 'Room configuration publish was not audited.';
  end if;

  begin
    perform public.update_room_type_guest_configuration(
      '52000000-0000-4000-8000-000000000002', '{}'::jsonb, '{}'::text[]
    );
    raise exception 'Cross-hotel room configuration unexpectedly succeeded.';
  exception when others then
    if sqlerrm not like '%does not belong to this hotel%' then raise; end if;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '54000000-0000-4000-8000-000000000002', true);

do $$
begin
  begin
    perform public.update_room_type_guest_configuration(
      '52000000-0000-4000-8000-000000000001', '{}'::jsonb, '{}'::text[]
    );
    raise exception 'Front desk room configuration unexpectedly succeeded.';
  exception when sqlstate '42501' then
    null;
  end;
end;
$$;

rollback;
