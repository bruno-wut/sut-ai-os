-- Regression test for reservation audit retention and privacy scrubbing.
-- Run after migrations 001-018.

begin;

do $$
declare
  v_hotel_id uuid;
  v_room_type_id uuid;
  v_room_id uuid;
  v_room_number text := 'RETTEST-' || substr(gen_random_uuid()::text, 1, 8);
  v_check_in date := current_date + 60;
  v_check_out date := current_date + 62;
  v_hold jsonb;
  v_finalized jsonb;
  v_reservation_id uuid;
  v_result jsonb;
begin
  insert into public.hotel_settings (
    setup_completed_at,
    audit_retention_months,
    booking_pii_retention_months
  ) values (
    now(),
    12,
    12
  )
  returning id into v_hotel_id;

  insert into public.room_types (hotel_id, code, name, base_nightly_rate)
  values (v_hotel_id, 'RETTEST', 'Retention Test Room', 1000)
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
    'Retention Test Room',
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
    'retention-test-' || gen_random_uuid()::text,
    null
  );

  perform public.set_checkout_hold_payment_mode(
    (v_hold->>'hold_token')::uuid,
    'pay_at_hotel'
  );

  perform public.record_checkout_hold_consent(
    (v_hold->>'hold_token')::uuid,
    'Retention Guest',
    'retention@example.com',
    '+66000000004',
    true,
    false
  );

  v_finalized := public.finalize_pay_at_hotel_checkout_hold(
    (v_hold->>'hold_token')::uuid,
    'Retention Guest',
    'retention@example.com',
    '+66000000004'
  );
  v_reservation_id := (v_finalized->>'reservation_id')::uuid;

  update public.web_reservations
  set
    check_in_date = current_date - 400,
    check_out_date = current_date - 398,
    consent_ip_address = '203.0.113.10',
    consent_user_agent = 'Retention test browser'
  where id = v_reservation_id;

  update public.consent_records
  set
    accepted_at = now() - interval '13 months',
    consent_ip_address = '203.0.113.10',
    consent_user_agent = 'Retention test browser'
  where reservation_id = v_reservation_id;

  update public.checkout_holds
  set
    created_at = now() - interval '13 months',
    updated_at = now() - interval '13 months',
    consent_ip_address = '203.0.113.10',
    consent_user_agent = 'Retention test browser'
  where converted_reservation_id = v_reservation_id;

  update public.notification_events
  set
    status = 'sent',
    sent_at = now() - interval '13 months',
    created_at = now() - interval '13 months',
    updated_at = now() - interval '13 months',
    payload = payload || jsonb_build_object('guest_name', 'Retention Guest')
  where reservation_id = v_reservation_id
    and kind = 'reservation_processing';

  insert into public.reservation_sync_events (
    hotel_id, reservation_id, from_status, to_status, reason, created_at
  ) values
    (
      v_hotel_id, v_reservation_id, 'Pending', 'Synced',
      'Old sync event', now() - interval '13 months'
    ),
    (
      v_hotel_id, v_reservation_id, 'Pending', 'Synced',
      'Recent sync event', now() - interval '11 months'
    );

  insert into public.reservation_payment_events (
    hotel_id, reservation_id, event_kind, payment_mode, from_status, to_status,
    amount, currency, reason, created_at
  ) values
    (
      v_hotel_id, v_reservation_id, 'payment_collected', 'pay_at_hotel',
      'not_collected', 'collected', 2000, 'THB',
      'Old payment event', now() - interval '13 months'
    ),
    (
      v_hotel_id, v_reservation_id, 'payment_refunded', 'pay_at_hotel',
      'collected', 'refunded', 2000, 'THB',
      'Recent payment event', now() - interval '11 months'
    );

  insert into public.reservation_edit_events (
    hotel_id, reservation_id, operation_id, edit_kind, field_name, old_value,
    new_value, reason, reservation_version, created_at
  ) values
    (
      v_hotel_id, v_reservation_id, gen_random_uuid(), 'field_edit',
      'guest_name', to_jsonb('Old Guest'::text), to_jsonb('New Guest'::text),
      'Old edit event', 1, now() - interval '13 months'
    ),
    (
      v_hotel_id, v_reservation_id, gen_random_uuid(), 'note_change',
      'internal_note', to_jsonb('Old note'::text), to_jsonb('New note'::text),
      'Recent edit event', 1, now() - interval '11 months'
    );

  v_result := public.run_hotel_retention_jobs();

  if (v_result->>'reservation_sync_events_deleted')::integer <> 1
     or (v_result->>'reservation_payment_events_deleted')::integer <> 1
     or (v_result->>'reservation_edit_events_deleted')::integer <> 1
     or (v_result->>'notification_events_deleted')::integer <> 1
     or (v_result->>'reservation_pii_scrubbed')::integer <> 1
     or (v_result->>'consent_pii_scrubbed')::integer <> 1 then
    raise exception 'Retention metrics did not include the expected reservation audit deletions: %', v_result;
  end if;

  if exists (
    select 1
    from public.reservation_sync_events
    where hotel_id = v_hotel_id
      and reason = 'Old sync event'
  ) or exists (
    select 1
    from public.reservation_payment_events
    where hotel_id = v_hotel_id
      and reason = 'Old payment event'
  ) or exists (
    select 1
    from public.reservation_edit_events
    where hotel_id = v_hotel_id
      and reason = 'Old edit event'
  ) then
    raise exception 'Retention job did not delete old reservation audit rows.';
  end if;

  if exists (
    select 1
    from public.notification_events
    where reservation_id = v_reservation_id
      and kind = 'reservation_processing'
  ) then
    raise exception 'Retention job did not delete old notification events.';
  end if;

  if exists (
    select 1
    from public.web_reservations
    where id = v_reservation_id
      and (
        guest_name is not null
        or guest_email is not null
        or guest_phone is not null
        or consent_ip_address is not null
        or consent_user_agent is not null
      )
  ) then
    raise exception 'Retention job did not scrub old reservation PII.';
  end if;

  if exists (
    select 1
    from public.consent_records
    where reservation_id = v_reservation_id
      and (
        guest_email is not null
        or consent_ip_address is not null
        or consent_user_agent is not null
      )
  ) then
    raise exception 'Retention job did not scrub old consent PII.';
  end if;

  if exists (
    select 1
    from public.checkout_holds
    where converted_reservation_id = v_reservation_id
      and (
        customer_name is not null
        or customer_email is not null
        or customer_phone is not null
        or consent_ip_address is not null
        or consent_user_agent is not null
      )
  ) then
    raise exception 'Retention job did not scrub old checkout hold PII.';
  end if;

  if not exists (
    select 1
    from public.reservation_sync_events
    where hotel_id = v_hotel_id
      and reason = 'Recent sync event'
  ) or not exists (
    select 1
    from public.reservation_payment_events
    where hotel_id = v_hotel_id
      and reason = 'Recent payment event'
  ) or not exists (
    select 1
    from public.reservation_edit_events
    where hotel_id = v_hotel_id
      and reason = 'Recent edit event'
  ) then
    raise exception 'Retention job deleted reservation audit rows inside the retention window.';
  end if;
end;
$$;

rollback;
