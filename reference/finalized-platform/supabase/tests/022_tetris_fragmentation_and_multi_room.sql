-- Regression coverage for fragmented Hotel Tetris allocation and complete
-- multi-room holds. The transaction rolls back every synthetic fixture.

begin;

do $$
declare
  v_hotel_id uuid;
  v_room_type_id uuid;
  v_room_ids uuid[];
  v_room_numbers text[];
  v_check_in date := current_date + 120;
  v_check_out date := current_date + 124;
  v_reservation_id uuid;
  v_allotment_id uuid;
  v_direct_requires_tetris boolean := false;
  v_tetris_hold jsonb;
  v_index integer;
begin
  insert into public.hotel_settings (
    setup_completed_at,
    inventory_horizon_days,
    max_rooms_per_booking
  )
  values (now(), 365, 5)
  returning id into v_hotel_id;

  insert into public.room_types (
    hotel_id,
    code,
    name,
    base_nightly_rate
  )
  values (
    v_hotel_id,
    'TETRIS-' || substr(gen_random_uuid()::text, 1, 8),
    'Tetris Fragmentation Test ' || substr(gen_random_uuid()::text, 1, 8),
    1800
  )
  returning id into v_room_type_id;

  with inserted_rooms as (
    insert into public.physical_rooms (
      hotel_id,
      room_type_id,
      room_number,
      web_allocation_enabled
    )
    select
      v_hotel_id,
      v_room_type_id,
      'TETRIS-' || substr(v_hotel_id::text, 1, 8) || '-' || room_index,
      true
    from generate_series(1, 6) as room_index
    returning id, room_number
  )
  select
    array_agg(id order by room_number),
    array_agg(room_number order by room_number)
  into v_room_ids, v_room_numbers
  from inserted_rooms;

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
    stay_date::date,
    room_fixture.room_number,
    (
      select rt.name
      from public.room_types rt
      where rt.id = v_room_type_id
    ),
    1800
  from unnest(v_room_ids, v_room_numbers)
    as room_fixture(room_id, room_number)
  cross join generate_series(
    v_check_in,
    v_check_out - 1,
    interval '1 day'
  ) as stay_date;

  -- Four one-night Pending reservations occupy four different rooms on
  -- different nights. Nightly capacity is five, but only two rooms are
  -- consecutive across all four nights, forcing the Tetris fallback.
  for v_index in 1..4 loop
    insert into public.web_reservations (
      hotel_id,
      reservation_number,
      stripe_session_id,
      guest_name,
      guest_email,
      guest_phone,
      check_in_date,
      check_out_date,
      room_type_id,
      room_type,
      rooms_requested,
      adults,
      children,
      assignment_status,
      assignments_finalized_at,
      total_paid,
      currency,
      sync_status,
      room_shuffle_required,
      payment_received_at,
      payment_mode,
      payment_status,
      amount_due
    )
    select
      v_hotel_id,
      'TETRIS-TEST-' || replace(gen_random_uuid()::text, '-', ''),
      null,
      'Tetris Regression Guest',
      'tetris-regression@example.invalid',
      '+66000000000',
      v_check_in + (v_index - 1),
      v_check_in + v_index,
      v_room_type_id,
      rt.name,
      1,
      2,
      0,
      'assigned',
      now(),
      0,
      'THB',
      'Pending',
      false,
      null,
      'pay_at_hotel',
      'not_collected',
      1800
    from public.room_types rt
    where rt.id = v_room_type_id
    returning id into v_reservation_id;

    update public.physical_room_allotments
    set
      is_booked = true,
      booked_reservation_id = v_reservation_id
    where hotel_id = v_hotel_id
      and room_id = v_room_ids[v_index]
      and date = v_check_in + (v_index - 1)
    returning id into v_allotment_id;

    insert into public.reservation_room_nights (
      reservation_id,
      allotment_id,
      stay_date,
      room_position,
      room_id,
      room_type_id,
      nightly_price
    )
    values (
      v_reservation_id,
      v_allotment_id,
      v_check_in + (v_index - 1),
      1,
      v_room_ids[v_index],
      v_room_type_id,
      1800
    );
  end loop;

  begin
    perform public.create_checkout_hold(
      v_check_in,
      v_check_out,
      v_room_type_id,
      3,
      6,
      0,
      'tetris-direct-probe-' || gen_random_uuid()::text,
      null
    );
  exception
    when others then
      v_direct_requires_tetris := sqlerrm = 'TETRIS_ALLOCATION_REQUIRED';
  end;

  if not v_direct_requires_tetris then
    raise exception 'Fragmented grid did not force the Tetris allocator.';
  end if;

  v_tetris_hold := public.create_tetris_checkout_hold(
    v_check_in,
    v_check_out,
    v_room_type_id,
    3,
    6,
    0,
    'tetris-regression-' || gen_random_uuid()::text,
    null
  );

  if v_tetris_hold->>'allocation_mode' <> 'tetris'
     or (v_tetris_hold->>'rooms_requested')::integer <> 3
     or (v_tetris_hold->>'night_count')::integer <> 4
     or (v_tetris_hold->>'shuffle_step_count')::integer <> 1 then
    raise exception 'Tetris result did not describe the expected single-hop plan.';
  end if;

  if (
    select count(*)
    from public.checkout_hold_room_nights chrn
    join public.checkout_holds ch on ch.id = chrn.hold_id
    where ch.public_token = (v_tetris_hold->>'hold_token')::uuid
  ) <> 12 then
    raise exception 'Three-room Tetris hold is incomplete across four nights.';
  end if;

  if (
    select count(*)
    from public.room_shuffle_steps rss
    where rss.plan_id = (v_tetris_hold->>'shuffle_plan_id')::uuid
  ) <> 1 then
    raise exception 'Tetris plan did not persist exactly one shuffle step.';
  end if;

  if (
    select count(*)
    from public.reservation_room_nights rrn
    join public.web_reservations wr on wr.id = rrn.reservation_id
    where wr.hotel_id = v_hotel_id
      and rrn.status = 'active'
  ) <> 4 then
    raise exception 'Tetris reshuffle lost or duplicated active reservation nights.';
  end if;

  if exists (
    select 1
    from public.physical_room_allotments pra
    where pra.hotel_id = v_hotel_id
      and pra.is_booked
      and pra.hold_id is not null
  ) then
    raise exception 'An allotment became simultaneously booked and held.';
  end if;
end;
$$;

rollback;
