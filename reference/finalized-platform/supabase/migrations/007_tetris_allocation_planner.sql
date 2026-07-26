-- Hotel Inventory Bridge: deterministic, single-hop Hotel Tetris planner.
-- Server-only: the Next.js backend invokes this after direct allocation reports
-- TETRIS_ALLOCATION_REQUIRED. Only future Pending reservations may be moved.

alter table public.web_reservations
  add column shuffle_plan_id uuid
    references public.room_shuffle_plans(id)
    on delete set null;

create unique index web_reservations_shuffle_plan_unique
  on public.web_reservations (shuffle_plan_id)
  where shuffle_plan_id is not null;

create or replace function public.create_tetris_checkout_hold(
  p_check_in date,
  p_check_out date,
  p_room_type_id uuid,
  p_rooms_requested integer,
  p_adults integer,
  p_children integer,
  p_idempotency_key text,
  p_promo_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_settings public.hotel_settings%rowtype;
  v_operational_date date;
  v_night_count integer;
  v_active_room_count integer;
  v_expected_rows bigint;
  v_actual_rows bigint;
  v_min_nightly_capacity integer;
  v_selected_target_ids uuid[] := '{}'::uuid[];
  v_reserved_replacement_ids uuid[] := '{}'::uuid[];
  v_candidate_replacement_ids uuid[];
  v_moves jsonb := '[]'::jsonb;
  v_candidate_moves jsonb;
  v_candidate record;
  v_blocker record;
  v_replacement record;
  v_move record;
  v_assignment record;
  v_candidate_valid boolean;
  v_total_amount numeric(12, 2);
  v_hold_id uuid;
  v_public_token uuid;
  v_expires_at timestamptz;
  v_plan_id uuid;
  v_step_order integer := 0;
  v_new_assignment_id uuid;
  v_existing public.checkout_holds%rowtype;
begin
  if p_check_in is null
     or p_check_out is null
     or p_room_type_id is null
     or p_rooms_requested is null
     or p_adults is null
     or p_children is null then
    raise exception using errcode = '22023', message = 'Checkout request is incomplete.';
  end if;

  if p_check_out <= p_check_in
     or p_rooms_requested <= 0
     or p_adults <= 0
     or p_children < 0 then
    raise exception using errcode = '22023', message = 'Checkout dates, room quantity, or occupancy are invalid.';
  end if;

  if nullif(btrim(p_idempotency_key), '') is null
     or length(btrim(p_idempotency_key)) < 16
     or length(btrim(p_idempotency_key)) > 128 then
    raise exception using errcode = '22023', message = 'A 16-128 character idempotency key is required.';
  end if;

  select hs.*
  into v_settings
  from public.room_types rt
  join public.hotel_settings hs on hs.id = rt.hotel_id
  where rt.id = p_room_type_id
    and rt.is_active
    and hs.setup_completed_at is not null;

  if not found then
    raise exception using errcode = '22023', message = 'Room type is not available.';
  end if;

  v_hotel_id := v_settings.id;
  v_operational_date := public.hotel_operational_date(v_hotel_id);
  v_night_count := (p_check_out - p_check_in)::integer;

  if p_check_in < v_operational_date
     or p_check_out > v_operational_date + v_settings.inventory_horizon_days
     or v_night_count > v_settings.max_stay_nights
     or p_rooms_requested > v_settings.max_rooms_per_booking then
    raise exception using errcode = '22023', message = 'Checkout request is outside the configured booking limits.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(btrim(p_idempotency_key), 1)
  );

  select ch.*
  into v_existing
  from public.checkout_holds ch
  where ch.idempotency_key = btrim(p_idempotency_key)
  for update;

  if found then
    if v_existing.hotel_id <> v_hotel_id
       or v_existing.room_type_id <> p_room_type_id
       or v_existing.check_in_date <> p_check_in
       or v_existing.check_out_date <> p_check_out
       or v_existing.rooms_requested <> p_rooms_requested then
      raise exception using errcode = '22023', message = 'Idempotency key belongs to another checkout request.';
    end if;

    return jsonb_build_object(
      'ok', v_existing.status = 'active' and v_existing.expires_at > now(),
      'status', v_existing.status,
      'hold_token', v_existing.public_token,
      'expires_at', v_existing.expires_at,
      'total_amount', v_existing.total_amount,
      'currency', v_existing.currency,
      'rooms_requested', v_existing.rooms_requested,
      'night_count', (v_existing.check_out_date - v_existing.check_in_date)::integer,
      'allocation_mode', 'tetris',
      'shuffle_plan_id', (
        select rsp.id
        from public.room_shuffle_plans rsp
        where rsp.hold_id = v_existing.id
        order by rsp.generated_at desc
        limit 1
      )
    );
  end if;

  perform public.release_expired_checkout_holds(v_hotel_id);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_hotel_id::text || ':' || p_room_type_id::text, 2)
  );

  perform 1
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.room_type_id = p_room_type_id
    and pra.date >= p_check_in
    and pra.date < p_check_out
  order by pra.date, pra.room_id
  for update;

  select count(*)::integer
  into v_active_room_count
  from public.physical_rooms pr
  where pr.hotel_id = v_hotel_id
    and pr.room_type_id = p_room_type_id
    and pr.is_active;

  v_expected_rows := v_active_room_count::bigint * v_night_count::bigint;

  select count(*)
  into v_actual_rows
  from public.physical_room_allotments pra
  join public.physical_rooms pr on pr.id = pra.room_id
  where pra.hotel_id = v_hotel_id
    and pra.room_type_id = p_room_type_id
    and pra.date >= p_check_in
    and pra.date < p_check_out
    and pr.is_active;

  if v_actual_rows <> v_expected_rows then
    raise exception using errcode = 'P0001', message = 'INVENTORY_COVERAGE_INCOMPLETE';
  end if;

  select coalesce(min(capacity.available_count), 0)::integer
  into v_min_nightly_capacity
  from (
    select
      pra.date,
      count(*) filter (
        where not pra.is_booked
          and (pra.hold_id is null or pra.hold_expires_at <= now())
          and (
            (pra.is_available and pra.group_block_id is null)
            or exists (
              select 1
              from public.group_blocks gb
              where gb.id = pra.group_block_id
                and gb.hotel_id = pra.hotel_id
                and gb.is_active
                and pra.date >= gb.valid_from
                and pra.date < gb.valid_to_exclusive
                and p_promo_code is not null
                and upper(btrim(gb.promo_code)) = upper(btrim(p_promo_code))
            )
          )
      )::integer as available_count
    from public.physical_room_allotments pra
    join public.physical_rooms pr on pr.id = pra.room_id
    where pra.hotel_id = v_hotel_id
      and pra.room_type_id = p_room_type_id
      and pra.date >= p_check_in
      and pra.date < p_check_out
      and pr.is_active
    group by pra.date
  ) as capacity;

  if v_min_nightly_capacity < p_rooms_requested then
    raise exception using errcode = 'P0001', message = 'INSUFFICIENT_INVENTORY';
  end if;

  for v_candidate in
    select pr.id as room_id, pr.room_number
    from public.physical_rooms pr
    where pr.hotel_id = v_hotel_id
      and pr.room_type_id = p_room_type_id
      and pr.is_active
      and not (pr.id = any(v_selected_target_ids))
      and not (pr.id = any(v_reserved_replacement_ids))
      and (
        select count(*)
        from public.physical_room_allotments pra
        where pra.hotel_id = v_hotel_id
          and pra.room_id = pr.id
          and pra.date >= p_check_in
          and pra.date < p_check_out
      ) = v_night_count
      and not exists (
        select 1
        from public.physical_room_allotments pra
        where pra.hotel_id = v_hotel_id
          and pra.room_id = pr.id
          and pra.date >= p_check_in
          and pra.date < p_check_out
          and (
            (pra.hold_id is not null and pra.hold_expires_at > now())
            or not (
              (pra.is_available and pra.group_block_id is null)
              or exists (
                select 1
                from public.group_blocks gb
                where gb.id = pra.group_block_id
                  and gb.hotel_id = pra.hotel_id
                  and gb.is_active
                  and pra.date >= gb.valid_from
                  and pra.date < gb.valid_to_exclusive
                  and p_promo_code is not null
                  and upper(btrim(gb.promo_code)) = upper(btrim(p_promo_code))
              )
            )
            or (
              pra.is_booked
              and not exists (
                select 1
                from public.reservation_room_nights rrn
                join public.web_reservations wr on wr.id = rrn.reservation_id
                where rrn.allotment_id = pra.id
                  and rrn.status = 'active'
                  and wr.id = pra.booked_reservation_id
                  and wr.sync_status = 'Pending'
                  and wr.check_in_date > v_operational_date
              )
            )
          )
      )
    order by (
      select count(distinct (rrn.reservation_id, rrn.room_position))
      from public.reservation_room_nights rrn
      where rrn.room_id = pr.id
        and rrn.status = 'active'
        and rrn.stay_date >= p_check_in
        and rrn.stay_date < p_check_out
    ), pr.room_number
  loop
    v_candidate_valid := true;
    v_candidate_moves := '[]'::jsonb;
    v_candidate_replacement_ids := '{}'::uuid[];

    for v_blocker in
      select
        wr.id as reservation_id,
        wr.reservation_number,
        rrn.room_position,
        min(all_rrn.stay_date) as move_start,
        max(all_rrn.stay_date) + 1 as move_end_exclusive
      from public.reservation_room_nights rrn
      join public.web_reservations wr on wr.id = rrn.reservation_id
      join public.reservation_room_nights all_rrn
        on all_rrn.reservation_id = rrn.reservation_id
       and all_rrn.room_position = rrn.room_position
       and all_rrn.status = 'active'
      where rrn.room_id = v_candidate.room_id
        and rrn.status = 'active'
        and rrn.stay_date >= p_check_in
        and rrn.stay_date < p_check_out
      group by wr.id, wr.reservation_number, rrn.room_position
    loop
      perform 1
      from public.web_reservations wr
      where wr.id = v_blocker.reservation_id
        and wr.sync_status = 'Pending'
        and wr.check_in_date > v_operational_date
      for update;

      if not found or exists (
        select 1
        from public.reservation_room_nights rrn
        where rrn.reservation_id = v_blocker.reservation_id
          and rrn.room_position = v_blocker.room_position
          and rrn.status = 'active'
          and rrn.room_id <> v_candidate.room_id
      ) then
        v_candidate_valid := false;
        exit;
      end if;

      select replacement.room_id, replacement.room_number
      into v_replacement
      from (
        select pr.id as room_id, pr.room_number
        from public.physical_rooms pr
        where pr.hotel_id = v_hotel_id
          and pr.room_type_id = p_room_type_id
          and pr.is_active
          and pr.id <> v_candidate.room_id
          and not (pr.id = any(v_selected_target_ids))
          and not (pr.id = any(v_reserved_replacement_ids))
          and not (pr.id = any(v_candidate_replacement_ids))
          and (
            select count(*)
            from public.physical_room_allotments pra
            where pra.hotel_id = v_hotel_id
              and pra.room_id = pr.id
              and pra.date >= v_blocker.move_start
              and pra.date < v_blocker.move_end_exclusive
          ) = (v_blocker.move_end_exclusive - v_blocker.move_start)
          and not exists (
            select 1
            from public.physical_room_allotments pra
            where pra.hotel_id = v_hotel_id
              and pra.room_id = pr.id
              and pra.date >= v_blocker.move_start
              and pra.date < v_blocker.move_end_exclusive
              and (
                pra.is_booked
                or (pra.hold_id is not null and pra.hold_expires_at > now())
                or not pra.is_available
                or pra.group_block_id is not null
              )
          )
        order by pr.room_number
        limit 1
      ) as replacement;

      if not found then
        v_candidate_valid := false;
        exit;
      end if;

      perform 1
      from public.physical_room_allotments pra
      where pra.hotel_id = v_hotel_id
        and pra.room_id in (v_candidate.room_id, v_replacement.room_id)
        and pra.date >= v_blocker.move_start
        and pra.date < v_blocker.move_end_exclusive
      order by pra.date, pra.room_id
      for update;

      if exists (
        select 1
        from public.physical_room_allotments pra
        where pra.hotel_id = v_hotel_id
          and pra.room_id = v_replacement.room_id
          and pra.date >= v_blocker.move_start
          and pra.date < v_blocker.move_end_exclusive
          and (
            pra.is_booked
            or (pra.hold_id is not null and pra.hold_expires_at > now())
            or not pra.is_available
            or pra.group_block_id is not null
          )
      ) then
        v_candidate_valid := false;
        exit;
      end if;

      v_candidate_replacement_ids := array_append(
        v_candidate_replacement_ids,
        v_replacement.room_id
      );
      v_candidate_moves := v_candidate_moves || jsonb_build_array(
        jsonb_build_object(
          'reservation_id', v_blocker.reservation_id,
          'reservation_number', v_blocker.reservation_number,
          'room_position', v_blocker.room_position,
          'from_room_id', v_candidate.room_id,
          'to_room_id', v_replacement.room_id,
          'move_start', v_blocker.move_start,
          'move_end_exclusive', v_blocker.move_end_exclusive
        )
      );
    end loop;

    if v_candidate_valid then
      v_selected_target_ids := array_append(v_selected_target_ids, v_candidate.room_id);
      v_reserved_replacement_ids := v_reserved_replacement_ids || v_candidate_replacement_ids;
      v_moves := v_moves || v_candidate_moves;
    end if;

    exit when cardinality(v_selected_target_ids) = p_rooms_requested;
  end loop;

  if cardinality(v_selected_target_ids) <> p_rooms_requested then
    raise exception using
      errcode = 'P0001',
      message = 'TETRIS_PLAN_NOT_FOUND',
      hint = 'Nightly capacity exists, but no safe single-hop reassignment plan was found.';
  end if;

  select sum(pra.nightly_price)::numeric(12, 2)
  into v_total_amount
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.room_id = any(v_selected_target_ids)
    and pra.date >= p_check_in
    and pra.date < p_check_out;

  v_expires_at := now() + make_interval(mins => v_settings.checkout_hold_minutes);

  insert into public.checkout_holds (
    hotel_id, room_type_id, idempotency_key,
    check_in_date, check_out_date, rooms_requested,
    adults, children, promo_code, total_amount, currency, expires_at
  ) values (
    v_hotel_id, p_room_type_id, btrim(p_idempotency_key),
    p_check_in, p_check_out, p_rooms_requested,
    p_adults, p_children, nullif(upper(btrim(p_promo_code)), ''),
    v_total_amount, v_settings.currency, v_expires_at
  )
  returning id, public_token into v_hold_id, v_public_token;

  insert into public.room_shuffle_plans (
    hotel_id, hold_id, status, summary
  ) values (
    v_hotel_id,
    v_hold_id,
    'proposed',
    format(
      'Defragment %s room(s) for %s through %s before final assignment.',
      p_rooms_requested,
      p_check_in,
      p_check_out
    )
  )
  returning id into v_plan_id;

  for v_move in
    select *
    from jsonb_to_recordset(v_moves) as move(
      reservation_id uuid,
      reservation_number text,
      room_position integer,
      from_room_id uuid,
      to_room_id uuid,
      move_start date,
      move_end_exclusive date
    )
  loop
    v_step_order := v_step_order + 1;

    insert into public.room_shuffle_steps (
      plan_id, step_order, affected_reservation_id,
      from_room_id, to_room_id, from_date, to_date_exclusive, instruction
    ) values (
      v_plan_id,
      v_step_order,
      v_move.reservation_id,
      v_move.from_room_id,
      v_move.to_room_id,
      v_move.move_start,
      v_move.move_end_exclusive,
      format(
        'Reassign reservation %s, room position %s, for the specified stay dates.',
        v_move.reservation_number,
        v_move.room_position
      )
    );

    for v_assignment in
      select
        rrn.id as old_assignment_id,
        rrn.allotment_id as old_allotment_id,
        rrn.stay_date,
        rrn.nightly_price,
        replacement.id as new_allotment_id
      from public.reservation_room_nights rrn
      join public.physical_room_allotments replacement
        on replacement.hotel_id = v_hotel_id
       and replacement.room_id = v_move.to_room_id
       and replacement.date = rrn.stay_date
      where rrn.reservation_id = v_move.reservation_id
        and rrn.room_position = v_move.room_position
        and rrn.room_id = v_move.from_room_id
        and rrn.status = 'active'
      order by rrn.stay_date
    loop
      update public.reservation_room_nights
      set status = 'moved', released_at = now()
      where id = v_assignment.old_assignment_id;

      update public.physical_room_allotments
      set is_booked = false, booked_reservation_id = null
      where id = v_assignment.old_allotment_id
        and booked_reservation_id = v_move.reservation_id;

      update public.physical_room_allotments
      set is_booked = true, booked_reservation_id = v_move.reservation_id
      where id = v_assignment.new_allotment_id
        and not is_booked
        and (hold_id is null or hold_expires_at <= now());

      if not found then
        raise exception 'Replacement room changed while applying the Tetris plan.';
      end if;

      insert into public.reservation_room_nights (
        reservation_id, allotment_id, stay_date, room_position,
        room_id, room_type_id, nightly_price
      ) values (
        v_move.reservation_id,
        v_assignment.new_allotment_id,
        v_assignment.stay_date,
        v_move.room_position,
        v_move.to_room_id,
        p_room_type_id,
        v_assignment.nightly_price
      )
      returning id into v_new_assignment_id;

      update public.reservation_room_nights
      set superseded_by_id = v_new_assignment_id
      where id = v_assignment.old_assignment_id;
    end loop;
  end loop;

  if exists (
    select 1
    from public.physical_room_allotments pra
    where pra.hotel_id = v_hotel_id
      and pra.room_id = any(v_selected_target_ids)
      and pra.date >= p_check_in
      and pra.date < p_check_out
      and (
        pra.is_booked
        or (pra.hold_id is not null and pra.hold_expires_at > now())
      )
  ) then
    raise exception 'Tetris plan did not clear every target room-night.';
  end if;

  insert into public.checkout_hold_room_nights (
    hold_id, allotment_id, room_position, stay_date, room_id, nightly_price
  )
  select
    v_hold_id,
    pra.id,
    selected.ordinality::integer,
    pra.date,
    pra.room_id,
    pra.nightly_price
  from unnest(v_selected_target_ids) with ordinality as selected(room_id, ordinality)
  join public.physical_room_allotments pra
    on pra.hotel_id = v_hotel_id
   and pra.room_id = selected.room_id
   and pra.date >= p_check_in
   and pra.date < p_check_out;

  update public.physical_room_allotments pra
  set hold_id = v_hold_id, hold_expires_at = v_expires_at
  where pra.hotel_id = v_hotel_id
    and pra.room_id = any(v_selected_target_ids)
    and pra.date >= p_check_in
    and pra.date < p_check_out
    and not pra.is_booked
    and (pra.hold_id is null or pra.hold_expires_at <= now());

  if (
    select count(*)
    from public.physical_room_allotments pra
    where pra.hold_id = v_hold_id
  ) <> p_rooms_requested * v_night_count then
    raise exception 'Tetris hold allocation row count mismatch.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'status', 'active',
    'hold_token', v_public_token,
    'expires_at', v_expires_at,
    'total_amount', v_total_amount,
    'currency', v_settings.currency,
    'rooms_requested', p_rooms_requested,
    'night_count', v_night_count,
    'allocation_mode', 'tetris',
    'shuffle_plan_id', v_plan_id,
    'shuffle_step_count', v_step_order
  );
end;
$$;

revoke all on function public.create_tetris_checkout_hold(
  date, date, uuid, integer, integer, integer, text, text
) from public, anon, authenticated;

grant execute on function public.create_tetris_checkout_hold(
  date, date, uuid, integer, integer, integer, text, text
) to service_role;

comment on function public.create_tetris_checkout_hold(
  date, date, uuid, integer, integer, integer, text, text
) is
  'Server-only single-hop defragmentation planner that locks, revalidates, moves future Pending assignments, and creates a proposed staff shuffle plan plus checkout hold.';
