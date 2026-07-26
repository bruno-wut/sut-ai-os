-- Regression coverage for abandoned checkout expiry and Stripe ledger idempotency.
-- All fixtures are transactional and roll back.

begin;

do $$
declare
  v_hotel_id uuid;
  v_room_type_id uuid;
  v_room_id uuid;
  v_room_number text := 'EXPIRY-' || substr(gen_random_uuid()::text, 1, 8);
  v_check_in date := current_date + 70;
  v_check_out date := current_date + 72;
  v_hold jsonb;
  v_replacement_hold jsonb;
  v_hold_id uuid;
  v_event_id text := 'evt_expiry_' || replace(gen_random_uuid()::text, '-', '');
  v_ledger_first jsonb;
  v_ledger_duplicate jsonb;
  v_expired_finalization_rejected boolean := false;
begin
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
    'EXPIRY',
    'Expiry Test Room',
    900
  )
  returning id into v_room_type_id;

  insert into public.physical_rooms (
    hotel_id,
    room_type_id,
    room_number
  ) values (
    v_hotel_id,
    v_room_type_id,
    v_room_number
  )
  returning id into v_room_id;

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
    v_room_id,
    v_room_type_id,
    stay_date,
    v_room_number,
    'Expiry Test Room',
    900
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
    'abandoned-hold-' || gen_random_uuid()::text,
    null
  );

  select id into v_hold_id
  from public.checkout_holds
  where public_token = (v_hold->>'hold_token')::uuid;

  if v_hold_id is null or (
    select count(*) from public.physical_room_allotments where hold_id = v_hold_id
  ) <> 2 then
    raise exception 'Checkout hold did not reserve both room nights.';
  end if;

  perform public.record_checkout_hold_consent(
    (v_hold->>'hold_token')::uuid,
    'Expired Guest',
    'expired@example.com',
    '+66000000003',
    true,
    false
  );

  -- Simulate passage of the database-controlled hold deadline.
  update public.checkout_holds
  set
    created_at = now() - interval '20 minutes',
    updated_at = now() - interval '1 minute',
    expires_at = now() - interval '1 minute'
  where id = v_hold_id;

  update public.physical_room_allotments
  set hold_expires_at = now() - interval '1 minute'
  where hold_id = v_hold_id;

  if public.release_expired_checkout_holds(v_hotel_id) <> 1 then
    raise exception 'Expired hold cleanup did not release exactly one hold.';
  end if;

  if public.release_expired_checkout_holds(v_hotel_id) <> 0 then
    raise exception 'Expired hold cleanup was not idempotent.';
  end if;

  if not exists (
    select 1 from public.checkout_holds
    where id = v_hold_id and status = 'expired'
  ) or exists (
    select 1 from public.physical_room_allotments
    where hold_id = v_hold_id or hold_expires_at is not null
  ) or exists (
    select 1 from public.checkout_hold_room_nights
    where hold_id = v_hold_id and released_at is null
  ) then
    raise exception 'Expired hold retained active inventory links.';
  end if;

  begin
    perform public.finalize_paid_checkout_hold(
      (v_hold->>'hold_token')::uuid,
      'cs_test_expired_' || replace(gen_random_uuid()::text, '-', ''),
      'Expired Guest',
      'expired@example.com',
      '+66000000003',
      1800,
      'THB',
      null
    );
  exception
    when others then
      v_expired_finalization_rejected := sqlerrm = 'HOLD_NOT_ACTIVE';
  end;

  if not v_expired_finalization_rejected or exists (
    select 1 from public.checkout_holds
    where id = v_hold_id and converted_reservation_id is not null
  ) then
    raise exception 'Expired hold was finalized into a reservation.';
  end if;

  -- Inventory released by expiry must be immediately reusable.
  v_replacement_hold := public.create_checkout_hold(
    v_check_in,
    v_check_out,
    v_room_type_id,
    1,
    2,
    0,
    'replacement-hold-' || gen_random_uuid()::text,
    null
  );

  if coalesce((v_replacement_hold->>'ok')::boolean, false) is not true then
    raise exception 'Released inventory could not be held again.';
  end if;

  v_ledger_first := public.record_stripe_webhook_event(
    v_hotel_id,
    v_event_id,
    'checkout.session.completed',
    'received'
  );
  v_ledger_duplicate := public.record_stripe_webhook_event(
    v_hotel_id,
    v_event_id,
    'checkout.session.completed',
    'received'
  );

  if coalesce((v_ledger_first->>'idempotent')::boolean, true) is not false
     or coalesce((v_ledger_duplicate->>'idempotent')::boolean, false) is not true
     or (
       select count(*) from public.stripe_webhook_events
       where stripe_event_id = v_event_id
     ) <> 1
     or (
       select count(*)
       from public.stripe_webhook_event_outcomes sweo
       join public.stripe_webhook_events swe on swe.id = sweo.webhook_event_id
       where swe.stripe_event_id = v_event_id
         and sweo.processing_state = 'received'
     ) <> 1 then
    raise exception 'Stripe webhook receipt ledger did not deduplicate the event.';
  end if;
end;
$$;

rollback;
