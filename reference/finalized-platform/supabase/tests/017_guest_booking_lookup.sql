-- Regression test for guest booking lookup references and masked lookup RPC.
-- Run after migrations 001-018.

begin;

do $$
declare
  v_hotel_id uuid;
  v_room_type_id uuid;
  v_room_id uuid;
  v_room_number text := 'LOOKUP-' || substr(gen_random_uuid()::text, 1, 8);
  v_check_in date := current_date + 60;
  v_check_out date := current_date + 62;
  v_hold jsonb;
  v_finalized jsonb;
  v_reservation public.web_reservations%rowtype;
  v_lookup jsonb;
  v_notification_payload jsonb;
  v_backfilled integer;
  v_wrong_email_rejected boolean := false;
begin
  insert into public.hotel_settings (
    hotel_name,
    public_contact_phone,
    public_contact_address,
    setup_completed_at
  ) values (
    'Lookup Test Hotel',
    '+66 99 000 0000',
    'Lookup Test Address',
    now()
  )
  returning id into v_hotel_id;

  insert into public.room_types (hotel_id, code, name, base_nightly_rate)
  values (v_hotel_id, 'LOOKUP', 'Lookup Test Room', 1000)
  returning id into v_room_type_id;

  insert into public.physical_rooms (hotel_id, room_type_id, room_number)
  values (v_hotel_id, v_room_type_id, v_room_number)
  returning id into v_room_id;

  insert into public.physical_room_allotments (
    hotel_id, room_id, room_type_id, date, room_number, room_type, nightly_price
  )
  select
    v_hotel_id,
    v_room_id,
    v_room_type_id,
    stay_date,
    v_room_number,
    'Lookup Test Room',
    1000
  from generate_series(
    v_check_in,
    v_check_out - 1,
    interval '1 day'
  ) as stay_date;

  v_hold := public.create_checkout_hold(
    v_check_in,
    v_check_out,
    v_room_type_id,
    1,
    2,
    0,
    'lookup-test-' || gen_random_uuid()::text,
    null
  );

  perform public.set_checkout_hold_payment_mode(
    (v_hold->>'hold_token')::uuid,
    'pay_at_hotel'
  );

  perform public.record_checkout_hold_consent(
    (v_hold->>'hold_token')::uuid,
    'Lookup Guest',
    'lookup@example.com',
    '+66000000005',
    true,
    false
  );

  v_finalized := public.finalize_pay_at_hotel_checkout_hold(
    (v_hold->>'hold_token')::uuid,
    'Lookup Guest',
    'lookup@example.com',
    '+66000000005'
  );

  select wr.*
  into v_reservation
  from public.web_reservations wr
  where wr.id = (v_finalized->>'reservation_id')::uuid;

  if v_reservation.booking_reference_id !~ '^SUT-[A-F0-9]{16}$' then
    raise exception 'Booking lookup reference was not generated in the expected format: %',
      v_reservation.booking_reference_id;
  end if;

  if v_finalized->>'booking_reference_id' <> v_reservation.booking_reference_id then
    raise exception 'Finalizer response did not include the guest lookup reference: %', v_finalized;
  end if;

  select ne.payload
  into v_notification_payload
  from public.notification_events ne
  where ne.reservation_id = v_reservation.id
    and ne.kind = 'reservation_processing'
  order by ne.created_at desc
  limit 1;

  if v_notification_payload->>'booking_reference_id' <> v_reservation.booking_reference_id
     or v_notification_payload->>'booking_lookup_path' <> '/lookup' then
    raise exception 'Notification payload did not include booking lookup context: %',
      v_notification_payload;
  end if;

  begin
    perform public.lookup_guest_reservation(
      v_reservation.booking_reference_id,
      'wrong@example.com'
    );
  exception
    when others then
      v_wrong_email_rejected := sqlerrm = 'BOOKING_LOOKUP_NOT_FOUND';
  end;

  if not v_wrong_email_rejected then
    raise exception 'Lookup RPC accepted a mismatched guest email.';
  end if;

  v_lookup := public.lookup_guest_reservation(
    v_reservation.booking_reference_id,
    'lookup@example.com'
  );

  if v_lookup->>'bookingReferenceId' <> v_reservation.booking_reference_id
     or v_lookup->>'status' <> 'pending'
     or v_lookup->>'roomCategory' <> 'Lookup Test Room'
     or v_lookup #>> '{hotel,name}' <> 'Lookup Test Hotel'
     or v_lookup #>> '{hotel,phone}' <> '+66 99 000 0000'
     or v_lookup #>> '{hotel,address}' <> 'Lookup Test Address'
     or v_lookup ? 'guestEmail'
     or v_lookup ? 'guestName'
     or v_lookup ? 'internal_note'
     or v_lookup ? 'stripe_session_id' then
    raise exception 'Lookup RPC did not return the expected masked guest-safe payload: %', v_lookup;
  end if;

  update public.web_reservations
  set booking_reference_id = null
  where id = v_reservation.id;

  v_backfilled := public.backfill_booking_reference_ids_batch(1);

  if v_backfilled <> 1 or not exists (
    select 1
    from public.web_reservations wr
    where wr.id = v_reservation.id
      and wr.booking_reference_id ~ '^SUT-[A-F0-9]{16}$'
  ) then
    raise exception 'Bounded booking-reference backfill did not update one missing reservation.';
  end if;
end;
$$;

rollback;
