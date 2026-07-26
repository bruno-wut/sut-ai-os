-- Phase 4 RBAC and cross-hotel regression. All synthetic rows roll back.

begin;

insert into public.hotel_settings (id, setup_completed_at) values
  ('41000000-0000-4000-8000-000000000001', now()),
  ('41000000-0000-4000-8000-000000000002', now());

insert into public.room_types (id, hotel_id, code, name, base_nightly_rate) values
  ('42000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'P4A', 'Phase 4 Hotel A', 1000),
  ('42000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002', 'P4B', 'Phase 4 Hotel B', 1000);

insert into public.physical_rooms (id, hotel_id, room_type_id, room_number) values
  ('43000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', 'P4-A-1'),
  ('43000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', 'P4-B-1');

insert into public.physical_room_allotments (
  hotel_id, room_id, room_type_id, date, room_number, room_type, nightly_price
) values
  ('41000000-0000-4000-8000-000000000001', '43000000-0000-4000-8000-000000000001', '42000000-0000-4000-8000-000000000001', current_date + 10, 'P4-A-1', 'Phase 4 Hotel A', 1000),
  ('41000000-0000-4000-8000-000000000002', '43000000-0000-4000-8000-000000000002', '42000000-0000-4000-8000-000000000002', current_date + 10, 'P4-B-1', 'Phase 4 Hotel B', 1000);

insert into auth.users (id) values
  ('44000000-0000-4000-8000-000000000001'),
  ('44000000-0000-4000-8000-000000000002');

insert into public.staff_profiles (user_id, hotel_id, role, full_name) values
  ('44000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000001', 'front_desk', 'Phase 4 Front Desk'),
  ('44000000-0000-4000-8000-000000000002', '41000000-0000-4000-8000-000000000001', 'revenue_manager', 'Phase 4 Revenue Manager');

set local role authenticated;
select set_config('request.jwt.claim.sub', '44000000-0000-4000-8000-000000000001', true);

do $$
begin
  if public.current_staff_hotel_id() <> '41000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'Front desk identity was not scoped to Hotel A.';
  end if;

  if exists (select 1 from public.room_types where hotel_id = '41000000-0000-4000-8000-000000000002') then
    raise exception 'Cross-hotel room type data was visible to Hotel A staff.';
  end if;

  begin
    perform public.bulk_update_inventory(
      '42000000-0000-4000-8000-000000000001', current_date + 10, current_date + 11,
      null, 1000, true, null, false, 'Front desk denial regression'
    );
    raise exception 'Front desk inventory mutation unexpectedly succeeded.';
  exception when sqlstate '42501' then
    null;
  end;
end;
$$;

select set_config('request.jwt.claim.sub', '44000000-0000-4000-8000-000000000002', true);

do $$
begin
  perform public.bulk_update_inventory(
    '42000000-0000-4000-8000-000000000001', current_date + 10, current_date + 11,
    null, 1050, true, null, false, 'Revenue manager permitted regression'
  );

  begin
    perform public.bulk_update_inventory(
      '42000000-0000-4000-8000-000000000002', current_date + 10, current_date + 11,
      null, 1050, true, null, false, 'Cross hotel denial regression'
    );
    raise exception 'Cross-hotel inventory mutation unexpectedly succeeded.';
  exception when others then
    if sqlerrm not like '%does not belong to the current hotel%' then raise; end if;
  end;
end;
$$;

rollback;
