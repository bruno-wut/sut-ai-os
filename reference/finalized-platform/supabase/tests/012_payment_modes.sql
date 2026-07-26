-- Regression test for migration 012. Run after migrations 001-012.
-- The transaction rolls back all fixtures and reservation numbers.

begin;

do $$
declare
  v_hotel_id uuid;
  v_room_type_id uuid;
  v_room_a_id uuid;
  v_room_b_id uuid;
  v_staff_user_id uuid := gen_random_uuid();
  v_room_a_number text := 'PAYTEST-A-' || substr(gen_random_uuid()::text, 1, 8);
  v_room_b_number text := 'PAYTEST-B-' || substr(gen_random_uuid()::text, 1, 8);
  v_check_in date := current_date + 60;
  v_check_out date := current_date + 62;
  v_stripe_hold jsonb;
  v_hotel_hold jsonb;
  v_stripe_result jsonb;
  v_hotel_result jsonb;
  v_hotel_retry jsonb;
  v_stripe_reservation public.web_reservations%rowtype;
  v_hotel_reservation public.web_reservations%rowtype;
  v_mismatch_rejected boolean := false;
  v_consent_supported boolean := to_regprocedure(
    'public.record_checkout_hold_consent(uuid,text,text,text,boolean,boolean,text,text,text,text,text)'
  ) is not null;
  v_function_oid oid;
  v_backfilled integer;
  v_payment_events_backfilled integer;
begin
  v_function_oid := to_regprocedure(
    'public.finalize_paid_checkout_hold(uuid,text,text,text,text,numeric,text,text)'
  );

  if v_function_oid is null or not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = v_function_oid
      and p.prosecdef
      and p.pronargdefaults = 1
      and p.proargnames = array[
        'p_hold_token',
        'p_stripe_session_id',
        'p_guest_name',
        'p_guest_email',
        'p_guest_phone',
        'p_total_paid',
        'p_currency',
        'p_stripe_payment_intent_id'
      ]::text[]
  ) then
    raise exception 'Stripe wrapper signature, default, or SECURITY DEFINER contract changed.';
  end if;

  if not has_function_privilege(
    'service_role',
    v_function_oid,
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    v_function_oid,
    'EXECUTE'
  ) then
    raise exception 'Stripe wrapper execution grants do not match the service-role-only contract.';
  end if;

  if not has_function_privilege(
    'service_role',
    'public.finalize_pay_at_hotel_checkout_hold(uuid,text,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.finalize_pay_at_hotel_checkout_hold(uuid,text,text,text)',
    'EXECUTE'
  ) then
    raise exception 'Pay-at-hotel finalizer execution grants do not match the service-role-only contract.';
  end if;

  insert into public.hotel_settings (setup_completed_at)
  values (now())
  returning id into v_hotel_id;

  insert into public.room_types (
    hotel_id,
    code,
    name,
    base_nightly_rate
  ) values (
    v_hotel_id,
    'PAYTEST',
    'Payment Test Room',
    1000
  )
  returning id into v_room_type_id;

  insert into public.physical_rooms (
    hotel_id,
    room_type_id,
    room_number
  ) values (
    v_hotel_id,
    v_room_type_id,
    v_room_a_number
  )
  returning id into v_room_a_id;

  insert into public.physical_rooms (
    hotel_id,
    room_type_id,
    room_number
  ) values (
    v_hotel_id,
    v_room_type_id,
    v_room_b_number
  )
  returning id into v_room_b_id;

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
    room_fixture.room_id,
    v_room_type_id,
    stay_date,
    room_fixture.room_number,
    'Payment Test Room',
    1000
  from (
    values
      (v_room_a_id, v_room_a_number),
      (v_room_b_id, v_room_b_number)
  ) as room_fixture(room_id, room_number)
  cross join generate_series(
    v_check_in,
    v_check_out - 1,
    interval '1 day'
  ) as stay_date;

  -- Existing callers omit payment mode and must continue down the Stripe path.
  v_stripe_hold := public.create_checkout_hold(
    v_check_in,
    v_check_out,
    v_room_type_id,
    1,
    2,
    0,
    'payment-mode-stripe-' || gen_random_uuid()::text,
    null
  );

  if v_consent_supported then
    perform public.record_checkout_hold_consent(
      (v_stripe_hold->>'hold_token')::uuid,
      'Stripe Test Guest',
      'stripe-test@example.com',
      '+66000000001',
      true,
      false
    );
  end if;

  v_stripe_result := public.finalize_paid_checkout_hold(
    (v_stripe_hold->>'hold_token')::uuid,
    'cs_test_' || replace(gen_random_uuid()::text, '-', ''),
    'Stripe Test Guest',
    'stripe-test@example.com',
    '+66000000001',
    2000,
    'THB',
    'pi_test_' || replace(gen_random_uuid()::text, '-', '')
  );

  select wr.*
  into v_stripe_reservation
  from public.web_reservations wr
  where wr.id = (v_stripe_result->>'reservation_id')::uuid;

  if v_stripe_reservation.payment_mode <> 'stripe'
     or v_stripe_reservation.payment_status <> 'collected'
     or v_stripe_reservation.stripe_session_id is null
     or v_stripe_reservation.payment_received_at is null
     or v_stripe_reservation.total_paid <> 2000
     or v_stripe_reservation.amount_due <> 0
     then
    raise exception 'Stripe regression path did not preserve collected-payment semantics.';
  end if;

  v_hotel_hold := public.create_checkout_hold(
    v_check_in,
    v_check_out,
    v_room_type_id,
    1,
    2,
    0,
    'payment-mode-hotel-' || gen_random_uuid()::text,
    null
  );

  perform public.set_checkout_hold_payment_mode(
    (v_hotel_hold->>'hold_token')::uuid,
    'pay_at_hotel'
  );

  if v_consent_supported then
    perform public.record_checkout_hold_consent(
      (v_hotel_hold->>'hold_token')::uuid,
      'Hotel Payment Guest',
      'hotel-payment-test@example.com',
      '+66000000002',
      true,
      true
    );
  end if;

  v_hotel_result := public.finalize_pay_at_hotel_checkout_hold(
    (v_hotel_hold->>'hold_token')::uuid,
    'Hotel Payment Guest',
    'hotel-payment-test@example.com',
    '+66000000002'
  );

  v_hotel_retry := public.finalize_pay_at_hotel_checkout_hold(
    (v_hotel_hold->>'hold_token')::uuid,
    'Hotel Payment Guest',
    'hotel-payment-test@example.com',
    '+66000000002'
  );

  if coalesce((v_hotel_retry->>'idempotent')::boolean, false) is not true then
    raise exception 'Pay-at-hotel duplicate finalization was not idempotent.';
  end if;

  select wr.*
  into v_hotel_reservation
  from public.web_reservations wr
  where wr.id = (v_hotel_result->>'reservation_id')::uuid;

  if v_hotel_reservation.payment_mode <> 'pay_at_hotel'
     or v_hotel_reservation.payment_status <> 'not_collected'
     or v_hotel_reservation.stripe_session_id is not null
     or v_hotel_reservation.stripe_payment_intent_id is not null
     or v_hotel_reservation.payment_received_at is not null
     or v_hotel_reservation.total_paid <> 0
     or v_hotel_reservation.amount_due <> 2000
     or v_hotel_reservation.sync_status <> 'Pending'
     then
    raise exception 'Pay-at-hotel reservation did not preserve independent booking and payment states.';
  end if;

  begin
    perform public.finalize_paid_checkout_hold(
      (v_hotel_hold->>'hold_token')::uuid,
      'cs_test_wrong_mode',
      'Hotel Payment Guest',
      'hotel-payment-test@example.com',
      '+66000000002',
      2000,
      'THB',
      null
    );
  exception
    when others then
      v_mismatch_rejected := sqlerrm = 'PAYMENT_MODE_MISMATCH';
  end;

  if not v_mismatch_rejected then
    raise exception 'Stripe finalizer accepted a pay-at-hotel hold.';
  end if;

  if not exists (
    select 1
    from public.reservation_payment_events rpe
    where rpe.reservation_id = v_stripe_reservation.id
      and rpe.event_kind = 'booking_created'
      and rpe.payment_mode = 'stripe'
      and rpe.to_status = 'collected'
  ) or not exists (
    select 1
    from public.reservation_payment_events rpe
    where rpe.reservation_id = v_hotel_reservation.id
      and rpe.event_kind = 'booking_created'
      and rpe.payment_mode = 'pay_at_hotel'
      and rpe.to_status = 'not_collected'
  ) then
    raise exception 'Payment audit events were not created for both modes.';
  end if;

  delete from public.reservation_payment_events
  where reservation_id = v_stripe_reservation.id
    and event_kind = 'booking_created';

  v_payment_events_backfilled :=
    public.backfill_reservation_payment_events_batch(1);

  if v_payment_events_backfilled <> 1 or not exists (
    select 1
    from public.reservation_payment_events rpe
    where rpe.reservation_id = v_stripe_reservation.id
      and rpe.event_kind = 'booking_created'
      and rpe.payment_mode = 'stripe'
      and rpe.to_status = 'collected'
  ) then
    raise exception 'Bounded reservation payment-event backfill did not insert one row.';
  end if;

  if not exists (
    select 1
    from public.notification_events ne
    where ne.reservation_id = v_hotel_reservation.id
      and ne.payload->>'payment_mode' = 'pay_at_hotel'
      and ne.payload->>'payment_status' = 'not_collected'
      and (ne.payload->>'payment_collected')::boolean is false
  ) then
    raise exception 'Pay-at-hotel notification payload lacks payment context.';
  end if;

  update public.notification_events
  set payload = payload
    - 'payment_mode'
    - 'payment_status'
    - 'payment_collected'
    - 'amount_paid'
    - 'amount_due'
    - 'currency'
  where reservation_id = v_hotel_reservation.id;

  v_backfilled := public.backfill_notification_payment_context_batch(1);

  if v_backfilled <> 1 or not exists (
    select 1
    from public.notification_events ne
    where ne.reservation_id = v_hotel_reservation.id
      and ne.payload->>'payment_mode' = 'pay_at_hotel'
      and ne.payload->>'payment_status' = 'not_collected'
  ) then
    raise exception 'Bounded notification payment-context backfill did not enrich one row.';
  end if;

  -- PMS confirmation must not imply collection for a pay-at-hotel booking.
  insert into auth.users (id) values (v_staff_user_id);
  insert into public.staff_profiles (
    user_id,
    hotel_id,
    role,
    full_name
  ) values (
    v_staff_user_id,
    v_hotel_id,
    'front_desk',
    'Payment Mode Test Staff'
  );

  perform set_config('request.jwt.claim.sub', v_staff_user_id::text, true);
  perform public.mark_reservation_entered_in_pms(v_hotel_reservation.id, false);

  select wr.*
  into v_hotel_reservation
  from public.web_reservations wr
  where wr.id = v_hotel_reservation.id;

  if v_hotel_reservation.sync_status <> 'Synced'
     or v_hotel_reservation.payment_status <> 'not_collected'
     or v_hotel_reservation.amount_due <> 2000 then
    raise exception 'PMS confirmation incorrectly implied pay-at-hotel collection.';
  end if;

  perform public.mark_pay_at_hotel_payment_collected(
    v_hotel_reservation.id,
    2000,
    'Regression test collection at front desk'
  );

  select wr.*
  into v_hotel_reservation
  from public.web_reservations wr
  where wr.id = v_hotel_reservation.id;

  if v_hotel_reservation.sync_status <> 'Synced'
     or v_hotel_reservation.payment_status <> 'collected'
     or v_hotel_reservation.total_paid <> 2000
     or v_hotel_reservation.amount_due <> 0
     or v_hotel_reservation.payment_received_at is null then
    raise exception 'Hotel payment collection did not preserve the independent PMS state.';
  end if;

  if not exists (
    select 1
    from public.reservation_payment_events rpe
    where rpe.reservation_id = v_hotel_reservation.id
      and rpe.event_kind = 'payment_collected'
      and rpe.from_status = 'not_collected'
      and rpe.to_status = 'collected'
      and rpe.amount = 2000
  ) then
    raise exception 'Hotel payment collection audit event was not recorded.';
  end if;
end;
$$;

rollback;
