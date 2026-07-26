-- Phase 4 regression: cancelling an eligible collected Stripe reservation must
-- open the audited refund-review workflow. The transaction is rolled back.

begin;

do $$
declare
  v_hotel_id uuid;
  v_room_type_id uuid;
  v_room_id uuid;
  v_room_number text := 'P4-REFUND-' || substr(gen_random_uuid()::text, 1, 8);
  v_staff_user_id uuid := gen_random_uuid();
  v_check_in date := current_date + 60;
  v_check_out date := current_date + 62;
  v_hold jsonb;
  v_finalized jsonb;
  v_cancelled jsonb;
  v_reservation public.web_reservations%rowtype;
begin
  insert into public.hotel_settings (setup_completed_at)
  values (now())
  returning id into v_hotel_id;

  insert into public.room_types (hotel_id, code, name, base_nightly_rate)
  values (v_hotel_id, 'P4REFUND', 'Phase 4 Refund Room', 1000)
  returning id into v_room_type_id;

  insert into public.physical_rooms (hotel_id, room_type_id, room_number)
  values (v_hotel_id, v_room_type_id, v_room_number)
  returning id into v_room_id;

  insert into public.physical_room_allotments (
    hotel_id, room_id, room_type_id, date, room_number, room_type, nightly_price
  )
  select
    v_hotel_id, v_room_id, v_room_type_id, stay_date,
    v_room_number, 'Phase 4 Refund Room', 1000
  from generate_series(v_check_in, v_check_out - 1, interval '1 day') as stay_date;

  v_hold := public.create_checkout_hold(
    v_check_in, v_check_out, v_room_type_id, 1, 2, 0,
    'phase4-refund-' || gen_random_uuid()::text, null
  );

  perform public.record_checkout_hold_consent(
    (v_hold->>'hold_token')::uuid,
    'Phase 4 Refund Guest', 'phase4-refund@example.com', '+66000000027', true, false
  );

  v_finalized := public.finalize_paid_checkout_hold(
    (v_hold->>'hold_token')::uuid,
    'cs_test_' || replace(gen_random_uuid()::text, '-', ''),
    'Phase 4 Refund Guest', 'phase4-refund@example.com', '+66000000027',
    2000, 'THB', 'pi_test_' || replace(gen_random_uuid()::text, '-', '')
  );

  insert into auth.users (id) values (v_staff_user_id);
  insert into public.staff_profiles (user_id, hotel_id, role, full_name)
  values (v_staff_user_id, v_hotel_id, 'manager', 'Phase 4 Refund Manager');
  perform set_config('request.jwt.claim.sub', v_staff_user_id::text, true);

  v_cancelled := public.cancel_reservation(
    (v_finalized->>'reservation_id')::uuid,
    1,
    'Phase 4 eligible Stripe cancellation regression'
  );

  select wr.* into v_reservation
  from public.web_reservations wr
  where wr.id = (v_finalized->>'reservation_id')::uuid;

  if v_reservation.sync_status <> 'Cancelled'
     or not v_reservation.refund_eligible
     or v_reservation.refund_status <> 'pending'
     or v_reservation.refund_max_amount <> 2000
     or not v_reservation.payment_adjustment_required
     or v_reservation.payment_adjustment_amount <> -2000
     or (v_cancelled->>'refund_status') <> 'pending' then
    raise exception 'Eligible Stripe cancellation did not open refund review correctly.';
  end if;

  if not exists (
    select 1
    from public.notification_events ne
    where ne.reservation_id = v_reservation.id
      and ne.kind = 'reservation_cancelled'
  ) then
    raise exception 'Eligible Stripe cancellation did not queue its cancellation notification.';
  end if;
end;
$$;

rollback;
