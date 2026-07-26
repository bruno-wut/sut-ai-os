-- Staging regression coverage for near-arrival cancellation authorization.
-- The transaction rolls back all synthetic identity and reservation mutations.

begin;

do $$
declare
  v_hotel_id uuid;
  v_room_type_id uuid;
  v_room_id uuid;
  v_reservation_id uuid;
  v_version integer;
  v_hold jsonb;
  v_finalized jsonb;
  v_staff_user_id uuid := gen_random_uuid();
  v_manager_user_id uuid := gen_random_uuid();
  v_front_desk_blocked boolean := false;
  v_missing_pin_blocked boolean := false;
  v_invalid_pin_blocked boolean := false;
begin
  -- Create an isolated arrival-today reservation rather than relying on fixtures.
  insert into public.hotel_settings (setup_completed_at)
  values (now())
  returning id into v_hotel_id;
  insert into public.room_types (hotel_id, code, name, base_nightly_rate)
  values (v_hotel_id, 'PINTEST', 'PIN Test Room', 1000)
  returning id into v_room_type_id;
  insert into public.physical_rooms (hotel_id, room_type_id, room_number)
  values (v_hotel_id, v_room_type_id, 'PINTEST-' || substr(gen_random_uuid()::text, 1, 8))
  returning id into v_room_id;
  insert into public.physical_room_allotments (
    hotel_id, room_id, room_type_id, date, room_number, room_type, nightly_price
  )
  select v_hotel_id, pr.id, v_room_type_id, current_date + offset_days,
         pr.room_number, 'PIN Test Room', 1000
  from public.physical_rooms pr
  cross join generate_series(0, 1) as offset_days
  where pr.id = v_room_id;

  v_hold := public.create_checkout_hold(
    current_date,
    current_date + 1,
    v_room_type_id,
    1,
    2,
    0,
    'staff-pin-test-' || gen_random_uuid()::text,
    null
  );
  perform public.set_checkout_hold_payment_mode((v_hold->>'hold_token')::uuid, 'pay_at_hotel');
  perform public.record_checkout_hold_consent(
    (v_hold->>'hold_token')::uuid,
    'PIN Test Guest',
    'pin-test@example.com',
    '+66000000004',
    true,
    false
  );
  v_finalized := public.finalize_pay_at_hotel_checkout_hold(
    (v_hold->>'hold_token')::uuid,
    'PIN Test Guest',
    'pin-test@example.com',
    '+66000000004'
  );
  v_reservation_id := (v_finalized->>'reservation_id')::uuid;
  v_version := 1;

  insert into auth.users (id) values (v_staff_user_id);
  insert into public.staff_profiles (user_id, hotel_id, role, full_name)
  values (v_staff_user_id, v_hotel_id, 'front_desk', 'Staff Safety Regression Clerk');
  insert into auth.users (id) values (v_manager_user_id);
  insert into public.staff_profiles (user_id, hotel_id, role, full_name, approval_pin_hash)
  values (
    v_manager_user_id,
    v_hotel_id,
    'manager',
    'Staff Safety Regression Manager',
    extensions.crypt('246810', extensions.gen_salt('bf'))
  );
  perform set_config('request.jwt.claim.sub', v_staff_user_id::text, true);

  begin
    perform public.cancel_reservation(
      v_reservation_id,
      v_version,
      'Front desk near-arrival cancellation probe'
    );
  exception
    when others then
      v_front_desk_blocked := sqlerrm = 'MANAGER_APPROVAL_REQUIRED';
  end;

  if not v_front_desk_blocked then
    raise exception 'Front desk cancellation inside 24 hours was not blocked.';
  end if;

  begin
    perform public.cancel_reservation_with_approval(
      v_reservation_id,
      v_version,
      'Missing manager PIN probe',
      null
    );
  exception
    when others then
      v_missing_pin_blocked := sqlerrm = 'MANAGER_APPROVAL_PIN_REQUIRED';
  end;

  if not v_missing_pin_blocked then
    raise exception 'Front desk cancellation without a manager PIN was not blocked.';
  end if;

  begin
    perform public.cancel_reservation_with_approval(
      v_reservation_id,
      v_version,
      'Invalid manager PIN probe',
      '000000'
    );
  exception
    when others then
      v_invalid_pin_blocked := sqlerrm = 'INVALID_MANAGER_APPROVAL_PIN';
  end;

  if not v_invalid_pin_blocked then
    raise exception 'Front desk cancellation with an invalid manager PIN was not blocked.';
  end if;

  perform public.cancel_reservation_with_approval(
    v_reservation_id,
    v_version,
    'Manager-authorized near-arrival cancellation probe',
    '246810'
  );

  if not exists (
    select 1
    from public.web_reservations
    where id = v_reservation_id
      and sync_status = 'Cancelled'
      and edit_version = v_version + 1
  ) then
    raise exception 'Manager-authorized cancellation did not complete.';
  end if;

  if not exists (
    select 1
    from public.reservation_edit_events ree
    where ree.reservation_id = v_reservation_id
      and ree.actor_user_id = v_manager_user_id
      and ree.field_name = 'manager_approval'
      and ree.is_manager_override
  ) then
    raise exception 'Manager approval was not recorded in the audit history.';
  end if;
end;
$$;

rollback;
