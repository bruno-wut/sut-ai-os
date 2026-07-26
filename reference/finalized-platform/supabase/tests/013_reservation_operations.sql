-- Regression tests for edit_reservation, override_booking, cancellation, and
-- field-level audit history. Run after migrations 001-013.

begin;

do $$
declare
  v_hotel_id uuid;
  v_room_type_id uuid;
  v_room_a_id uuid;
  v_room_b_id uuid;
  v_staff_user_id uuid := gen_random_uuid();
  v_room_a_number text := 'EDITTEST-A-' || substr(gen_random_uuid()::text, 1, 8);
  v_room_b_number text := 'EDITTEST-B-' || substr(gen_random_uuid()::text, 1, 8);
  v_initial_check_in date := current_date + 60;
  v_initial_check_out date := current_date + 62;
  v_new_check_in date := current_date + 61;
  v_new_check_out date := current_date + 64;
  v_hold jsonb;
  v_finalized jsonb;
  v_edit_result jsonb;
  v_override_result jsonb;
  v_cancel_result jsonb;
  v_cancel_retry jsonb;
  v_reservation public.web_reservations%rowtype;
  v_version_conflict boolean := false;
begin
  insert into public.hotel_settings (setup_completed_at)
  values (now())
  returning id into v_hotel_id;

  insert into public.room_types (hotel_id, code, name, base_nightly_rate)
  values (v_hotel_id, 'EDITTEST', 'Edit Test Room', 1000)
  returning id into v_room_type_id;

  insert into public.physical_rooms (hotel_id, room_type_id, room_number)
  values (v_hotel_id, v_room_type_id, v_room_a_number)
  returning id into v_room_a_id;

  insert into public.physical_rooms (hotel_id, room_type_id, room_number)
  values (v_hotel_id, v_room_type_id, v_room_b_number)
  returning id into v_room_b_id;

  insert into public.physical_room_allotments (
    hotel_id, room_id, room_type_id, date, room_number, room_type, nightly_price
  )
  select
    v_hotel_id,
    room_fixture.room_id,
    v_room_type_id,
    stay_date,
    room_fixture.room_number,
    'Edit Test Room',
    1000
  from (
    values
      (v_room_a_id, v_room_a_number),
      (v_room_b_id, v_room_b_number)
  ) as room_fixture(room_id, room_number)
  cross join generate_series(
    v_initial_check_in,
    v_new_check_out - 1,
    interval '1 day'
  ) as stay_date;

  v_hold := public.create_checkout_hold(
    v_initial_check_in,
    v_initial_check_out,
    v_room_type_id,
    1,
    2,
    0,
    'reservation-edit-test-' || gen_random_uuid()::text,
    null
  );

  perform public.set_checkout_hold_payment_mode(
    (v_hold->>'hold_token')::uuid,
    'pay_at_hotel'
  );

  perform public.record_checkout_hold_consent(
    (v_hold->>'hold_token')::uuid,
    'Original Guest',
    'original@example.com',
    '+66000000003',
    true,
    false
  );

  v_finalized := public.finalize_pay_at_hotel_checkout_hold(
    (v_hold->>'hold_token')::uuid,
    'Original Guest',
    'original@example.com',
    '+66000000003'
  );

  insert into auth.users (id) values (v_staff_user_id);
  insert into public.staff_profiles (user_id, hotel_id, role, full_name)
  values (v_staff_user_id, v_hotel_id, 'manager', 'Reservation Edit Test Manager');
  perform set_config('request.jwt.claim.sub', v_staff_user_id::text, true);

  v_edit_result := public.edit_reservation(
    (v_finalized->>'reservation_id')::uuid,
    1,
    'Guest corrected contact details',
    'Updated Guest',
    'updated@example.com',
    null,
    'Late arrival after 20:00',
    false
  );

  select wr.*
  into v_reservation
  from public.web_reservations wr
  where wr.id = (v_finalized->>'reservation_id')::uuid;

  if v_reservation.edit_version <> 2
     or v_reservation.guest_name <> 'Updated Guest'
     or v_reservation.guest_email <> 'updated@example.com'
     or v_reservation.internal_note <> 'Late arrival after 20:00' then
    raise exception 'Dedicated reservation edit did not update fields and version.';
  end if;

  if (
    select count(*)
    from public.reservation_edit_events ree
    where ree.operation_id = (v_edit_result->>'operation_id')::uuid
  ) <> 3 then
    raise exception 'Field edit did not create one audit row per changed field.';
  end if;

  begin
    perform public.edit_reservation(
      v_reservation.id,
      1,
      'Stale edit test',
      'Stale Guest',
      null,
      null,
      null,
      false
    );
  exception
    when others then
      v_version_conflict := sqlerrm = 'RESERVATION_VERSION_CONFLICT';
  end;

  if not v_version_conflict then
    raise exception 'Stale reservation edit was not rejected.';
  end if;

  v_override_result := public.override_booking(
    v_reservation.id,
    2,
    'Manager approved room, date, and rate adjustment',
    v_new_check_in,
    v_new_check_out,
    v_room_b_id,
    1200,
    'Moved to room B with approved rate'
  );

  select wr.*
  into v_reservation
  from public.web_reservations wr
  where wr.id = v_reservation.id;

  if v_reservation.edit_version <> 3
     or v_reservation.check_in_date <> v_new_check_in
     or v_reservation.check_out_date <> v_new_check_out
     or v_reservation.amount_due <> 3600
     or v_reservation.payment_adjustment_required then
    raise exception 'Manager override did not update dates, due amount, or version safely.';
  end if;

  if (
    select count(*)
    from public.reservation_room_nights rrn
    where rrn.reservation_id = v_reservation.id
      and rrn.status = 'active'
      and rrn.room_id = v_room_b_id
      and rrn.nightly_price = 1200
  ) <> 3 then
    raise exception 'Manager override did not create the expected active room-night sequence.';
  end if;

  if exists (
    select 1
    from public.physical_room_allotments pra
    where pra.room_id = v_room_a_id
      and pra.booked_reservation_id = v_reservation.id
  ) or (
    select count(*)
    from public.physical_room_allotments pra
    where pra.room_id = v_room_b_id
      and pra.booked_reservation_id = v_reservation.id
      and pra.is_booked
  ) <> 3 then
    raise exception 'Room swap did not release old inventory and book the new sequence.';
  end if;

  if not exists (
    select 1
    from public.reservation_edit_events ree
    where ree.operation_id = (v_override_result->>'operation_id')::uuid
      and ree.edit_kind = 'room_swap'
      and ree.field_name = 'room_id'
      and ree.is_manager_override
  ) or not exists (
    select 1
    from public.reservation_edit_events ree
    where ree.operation_id = (v_override_result->>'operation_id')::uuid
      and ree.edit_kind = 'rate_change'
      and ree.field_name = 'booking_total'
  ) then
    raise exception 'Manager override field audit is incomplete.';
  end if;

  v_cancel_result := public.cancel_reservation(
    v_reservation.id,
    3,
    'Guest requested cancellation'
  );

  v_cancel_retry := public.cancel_reservation(
    v_reservation.id,
    3,
    'Duplicate cancellation retry'
  );

  select wr.*
  into v_reservation
  from public.web_reservations wr
  where wr.id = v_reservation.id;

  if v_reservation.sync_status <> 'Cancelled'
     or v_reservation.edit_version <> 4
     or v_reservation.amount_due <> 0
     or v_reservation.payment_adjustment_required
     or coalesce((v_cancel_retry->>'idempotent')::boolean, false) is not true then
    raise exception 'Cancellation did not preserve payment truth or idempotency.';
  end if;

  if exists (
    select 1
    from public.reservation_room_nights rrn
    where rrn.reservation_id = v_reservation.id
      and rrn.status = 'active'
  ) or exists (
    select 1
    from public.physical_room_allotments pra
    where pra.booked_reservation_id = v_reservation.id
  ) then
    raise exception 'Cancellation did not release active room inventory.';
  end if;

  if not exists (
    select 1
    from public.reservation_edit_events ree
    where ree.operation_id = (v_cancel_result->>'operation_id')::uuid
      and ree.edit_kind = 'cancellation'
      and ree.field_name = 'sync_status'
  ) then
    raise exception 'Cancellation audit event was not recorded.';
  end if;
end;
$$;

rollback;
