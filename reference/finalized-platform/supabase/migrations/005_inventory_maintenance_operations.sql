-- Hotel Inventory Bridge: audited inventory editing, horizon repair, and panic close.

create type public.inventory_change_kind as enum (
  'bulk_update',
  'horizon_repair',
  'panic_close'
);

create table public.inventory_change_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  kind public.inventory_change_kind not null,
  range_start date not null,
  range_end_exclusive date not null,
  room_type_id uuid references public.room_types(id) on delete set null,
  affected_rows integer not null default 0,
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint inventory_change_events_dates_valid check (
    range_end_exclusive > range_start
  ),
  constraint inventory_change_events_rows_nonnegative check (affected_rows >= 0)
);

create index inventory_change_events_hotel_created_idx
  on public.inventory_change_events (hotel_id, created_at desc);

alter table public.inventory_change_events enable row level security;

revoke all on table public.inventory_change_events
  from public, anon, authenticated;
grant select on table public.inventory_change_events to authenticated;

create policy inventory_change_events_staff_select
on public.inventory_change_events
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

-- Force all staff allotment changes through audited RPCs from this point forward.
revoke update (nightly_price, is_available, group_block_id)
  on table public.physical_room_allotments
  from authenticated;

create or replace function public.bulk_update_inventory(
  p_room_type_id uuid,
  p_start_date date,
  p_end_date_exclusive date,
  p_room_ids uuid[] default null,
  p_nightly_price numeric default null,
  p_is_available boolean default null,
  p_group_block_id uuid default null,
  p_clear_group_block boolean default false,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_operational_date date;
  v_selected_room_count integer;
  v_expected_rows bigint;
  v_actual_rows bigint;
  v_affected_rows integer;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null then
    raise exception using errcode = '42501', message = 'An active staff profile is required.';
  end if;

  if not public.staff_has_any_role(
    array['admin', 'manager', 'front_desk', 'revenue_manager']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'This staff role cannot edit inventory.';
  end if;

  if p_room_type_id is null or p_start_date is null or p_end_date_exclusive is null then
    raise exception 'Room type and date range are required.';
  end if;

  if p_end_date_exclusive <= p_start_date then
    raise exception 'Inventory edit end date must be later than its start date.';
  end if;

  v_operational_date := public.hotel_operational_date(v_hotel_id);

  if p_start_date < v_operational_date then
    raise exception 'Past operational dates cannot be edited.';
  end if;

  if p_nightly_price is null
     and p_is_available is null
     and p_group_block_id is null
     and not p_clear_group_block then
    raise exception 'At least one inventory change is required.';
  end if;

  if p_nightly_price is not null and p_nightly_price < 0 then
    raise exception 'Nightly price cannot be negative.';
  end if;

  if p_nightly_price is not null
     and not public.staff_has_any_role(
       array['admin', 'manager', 'revenue_manager']::public.staff_role[]
     ) then
    raise exception using errcode = '42501', message = 'Front desk staff cannot change pricing.';
  end if;

  if (p_group_block_id is not null or p_clear_group_block)
     and not public.staff_has_any_role(
       array['admin', 'manager', 'revenue_manager']::public.staff_role[]
     ) then
    raise exception using errcode = '42501', message = 'Front desk staff cannot change group blocks.';
  end if;

  if p_group_block_id is not null and p_clear_group_block then
    raise exception 'A group block cannot be assigned and cleared in the same update.';
  end if;

  if p_group_block_id is not null and p_is_available is true then
    raise exception 'Promo-only group-block inventory cannot also be publicly available.';
  end if;

  if not exists (
    select 1
    from public.room_types rt
    where rt.id = p_room_type_id
      and rt.hotel_id = v_hotel_id
  ) then
    raise exception 'Room type does not belong to the current hotel.';
  end if;

  if p_group_block_id is not null and not exists (
    select 1
    from public.group_blocks gb
    where gb.id = p_group_block_id
      and gb.hotel_id = v_hotel_id
      and gb.is_active
      and p_start_date >= gb.valid_from
      and p_end_date_exclusive <= gb.valid_to_exclusive
  ) then
    raise exception 'Group block is inactive, belongs to another hotel, or does not cover the selected dates.';
  end if;

  if p_room_ids is not null and (
    select count(*) from unnest(p_room_ids)
  ) <> (
    select count(distinct room_id) from unnest(p_room_ids) as selected(room_id)
  ) then
    raise exception 'Selected room IDs must be unique.';
  end if;

  select count(*)::integer
  into v_selected_room_count
  from public.physical_rooms pr
  where pr.hotel_id = v_hotel_id
    and pr.room_type_id = p_room_type_id
    and pr.is_active
    and (p_room_ids is null or pr.id = any(p_room_ids));

  if v_selected_room_count = 0 then
    raise exception 'No active rooms matched the requested inventory edit.';
  end if;

  if p_room_ids is not null and v_selected_room_count <> cardinality(p_room_ids) then
    raise exception 'One or more selected rooms are inactive or outside the requested room type.';
  end if;

  v_expected_rows :=
    v_selected_room_count::bigint * (p_end_date_exclusive - p_start_date)::bigint;

  select count(*)
  into v_actual_rows
  from public.physical_room_allotments pra
  join public.physical_rooms pr on pr.id = pra.room_id
  where pra.hotel_id = v_hotel_id
    and pra.room_type_id = p_room_type_id
    and pra.date >= p_start_date
    and pra.date < p_end_date_exclusive
    and pr.is_active
    and (p_room_ids is null or pra.room_id = any(p_room_ids));

  if v_actual_rows <> v_expected_rows then
    raise exception using
      errcode = 'P0001',
      message = 'Inventory coverage is incomplete for the requested edit.',
      hint = 'Run repair_inventory_horizon before applying this change.';
  end if;

  if p_is_available is true
     and not p_clear_group_block
     and p_group_block_id is null
     and exists (
       select 1
       from public.physical_room_allotments pra
       where pra.hotel_id = v_hotel_id
         and pra.room_type_id = p_room_type_id
         and pra.date >= p_start_date
         and pra.date < p_end_date_exclusive
         and pra.group_block_id is not null
         and (p_room_ids is null or pra.room_id = any(p_room_ids))
     ) then
    raise exception 'Clear the existing group block before making this inventory public.';
  end if;

  perform 1
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.room_type_id = p_room_type_id
    and pra.date >= p_start_date
    and pra.date < p_end_date_exclusive
    and (p_room_ids is null or pra.room_id = any(p_room_ids))
  for update;

  update public.physical_room_allotments pra
  set
    nightly_price = coalesce(p_nightly_price, pra.nightly_price),
    is_available = case
      when p_group_block_id is not null then false
      when p_is_available is not null then p_is_available
      else pra.is_available
    end,
    group_block_id = case
      when p_clear_group_block then null
      when p_group_block_id is not null then p_group_block_id
      else pra.group_block_id
    end
  where pra.hotel_id = v_hotel_id
    and pra.room_type_id = p_room_type_id
    and pra.date >= p_start_date
    and pra.date < p_end_date_exclusive
    and (p_room_ids is null or pra.room_id = any(p_room_ids));

  get diagnostics v_affected_rows = row_count;

  insert into public.inventory_change_events (
    hotel_id,
    actor_user_id,
    kind,
    range_start,
    range_end_exclusive,
    room_type_id,
    affected_rows,
    reason,
    metadata
  )
  values (
    v_hotel_id,
    auth.uid(),
    'bulk_update',
    p_start_date,
    p_end_date_exclusive,
    p_room_type_id,
    v_affected_rows,
    nullif(btrim(p_reason), ''),
    jsonb_build_object(
      'room_ids', p_room_ids,
      'nightly_price', p_nightly_price,
      'is_available', p_is_available,
      'group_block_id', p_group_block_id,
      'clear_group_block', p_clear_group_block
    )
  );

  return jsonb_build_object(
    'ok', true,
    'affected_rows', v_affected_rows,
    'range_start', p_start_date,
    'range_end_exclusive', p_end_date_exclusive
  );
end;
$$;

create or replace function public.repair_inventory_horizon(
  p_room_type_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_settings public.hotel_settings%rowtype;
  v_run_id uuid;
  v_start_date date;
  v_end_date_exclusive date;
  v_expected_rows integer := 0;
  v_generated_rows integer := 0;
  v_remaining_gaps integer := 0;
  v_error_message text;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null then
    raise exception using errcode = '42501', message = 'An active staff profile is required.';
  end if;

  if not public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'This staff role cannot repair inventory.';
  end if;

  select hs.*
  into v_settings
  from public.hotel_settings hs
  where hs.id = v_hotel_id
  for update;

  if not found or v_settings.setup_completed_at is null then
    raise exception 'Hotel onboarding must be completed before repairing inventory.';
  end if;

  if p_room_type_id is not null and not exists (
    select 1
    from public.room_types rt
    where rt.id = p_room_type_id
      and rt.hotel_id = v_hotel_id
  ) then
    raise exception 'Room type does not belong to the current hotel.';
  end if;

  v_start_date := public.hotel_operational_date(v_hotel_id);
  v_end_date_exclusive := v_start_date + v_settings.inventory_horizon_days;

  select count(*)::integer
  into v_expected_rows
  from public.inventory_coverage_gaps gap
  where gap.hotel_id = v_hotel_id
    and (p_room_type_id is null or gap.room_type_id = p_room_type_id);

  insert into public.inventory_generation_runs (
    hotel_id,
    range_start,
    range_end_exclusive,
    status,
    expected_rows
  )
  values (
    v_hotel_id,
    v_start_date,
    v_end_date_exclusive,
    'running',
    v_expected_rows
  )
  returning id into v_run_id;

  begin
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
      gap.hotel_id,
      gap.room_id,
      gap.room_type_id,
      gap.missing_date,
      pr.room_number,
      rt.name,
      rt.base_nightly_rate
    from public.inventory_coverage_gaps gap
    join public.physical_rooms pr
      on pr.id = gap.room_id
     and pr.hotel_id = gap.hotel_id
    join public.room_types rt
      on rt.id = gap.room_type_id
     and rt.hotel_id = gap.hotel_id
    where gap.hotel_id = v_hotel_id
      and (p_room_type_id is null or gap.room_type_id = p_room_type_id)
    on conflict (date, room_number) do nothing;

    get diagnostics v_generated_rows = row_count;

    select count(*)::integer
    into v_remaining_gaps
    from public.inventory_coverage_gaps gap
    where gap.hotel_id = v_hotel_id
      and (p_room_type_id is null or gap.room_type_id = p_room_type_id);

    if v_remaining_gaps <> 0 then
      raise exception 'Inventory repair completed with % unresolved coverage gaps.', v_remaining_gaps;
    end if;

    update public.inventory_generation_runs
    set
      status = 'completed',
      generated_rows = v_generated_rows,
      completed_at = now()
    where id = v_run_id;

    insert into public.inventory_change_events (
      hotel_id,
      actor_user_id,
      kind,
      range_start,
      range_end_exclusive,
      room_type_id,
      affected_rows,
      metadata
    )
    values (
      v_hotel_id,
      auth.uid(),
      'horizon_repair',
      v_start_date,
      v_end_date_exclusive,
      p_room_type_id,
      v_generated_rows,
      jsonb_build_object('detected_gaps', v_expected_rows)
    );

    return jsonb_build_object(
      'ok', true,
      'detected_gaps', v_expected_rows,
      'generated_rows', v_generated_rows,
      'remaining_gaps', 0
    );
  exception
    when others then
      get stacked diagnostics v_error_message = message_text;

      update public.inventory_generation_runs
      set
        status = 'failed',
        generated_rows = 0,
        error_message = v_error_message,
        completed_at = now()
      where id = v_run_id;

      return jsonb_build_object(
        'ok', false,
        'detected_gaps', v_expected_rows,
        'generated_rows', 0,
        'error', v_error_message
      );
  end;
end;
$$;

create or replace function public.panic_close_inventory(
  p_start_date date,
  p_end_date_exclusive date,
  p_room_type_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_operational_date date;
  v_hold_ids uuid[];
  v_cancelled_hold_count integer := 0;
  v_affected_rows integer := 0;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null then
    raise exception using errcode = '42501', message = 'An active staff profile is required.';
  end if;

  if not public.staff_has_any_role(
    array['admin', 'manager', 'front_desk', 'revenue_manager']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'This staff role cannot close inventory.';
  end if;

  if p_start_date is null or p_end_date_exclusive is null then
    raise exception 'A panic-close date range is required.';
  end if;

  if p_end_date_exclusive <= p_start_date then
    raise exception 'Panic-close end date must be later than its start date.';
  end if;

  if nullif(btrim(p_reason), '') is null then
    raise exception 'A reason is required for the panic-button audit trail.';
  end if;

  v_operational_date := public.hotel_operational_date(v_hotel_id);

  if p_start_date < v_operational_date then
    raise exception 'Past operational dates cannot be panic-closed.';
  end if;

  if p_room_type_id is not null and not exists (
    select 1
    from public.room_types rt
    where rt.id = p_room_type_id
      and rt.hotel_id = v_hotel_id
  ) then
    raise exception 'Room type does not belong to the current hotel.';
  end if;

  perform 1
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.date >= p_start_date
    and pra.date < p_end_date_exclusive
    and (p_room_type_id is null or pra.room_type_id = p_room_type_id)
  for update;

  select array_agg(distinct pra.hold_id)
  into v_hold_ids
  from public.physical_room_allotments pra
  where pra.hotel_id = v_hotel_id
    and pra.date >= p_start_date
    and pra.date < p_end_date_exclusive
    and pra.hold_id is not null
    and (p_room_type_id is null or pra.room_type_id = p_room_type_id);

  if coalesce(cardinality(v_hold_ids), 0) > 0 then
    update public.checkout_holds ch
    set status = 'cancelled'
    where ch.id = any(v_hold_ids)
      and ch.status = 'active';

    get diagnostics v_cancelled_hold_count = row_count;

    update public.checkout_hold_room_nights chrn
    set released_at = coalesce(chrn.released_at, now())
    where chrn.hold_id = any(v_hold_ids);

    update public.physical_room_allotments pra
    set
      hold_id = null,
      hold_expires_at = null
    where pra.hold_id = any(v_hold_ids);
  end if;

  update public.physical_room_allotments pra
  set
    is_available = false,
    group_block_id = null
  where pra.hotel_id = v_hotel_id
    and pra.date >= p_start_date
    and pra.date < p_end_date_exclusive
    and (p_room_type_id is null or pra.room_type_id = p_room_type_id);

  get diagnostics v_affected_rows = row_count;

  insert into public.inventory_change_events (
    hotel_id,
    actor_user_id,
    kind,
    range_start,
    range_end_exclusive,
    room_type_id,
    affected_rows,
    reason,
    metadata
  )
  values (
    v_hotel_id,
    auth.uid(),
    'panic_close',
    p_start_date,
    p_end_date_exclusive,
    p_room_type_id,
    v_affected_rows,
    btrim(p_reason),
    jsonb_build_object('cancelled_hold_count', v_cancelled_hold_count)
  );

  return jsonb_build_object(
    'ok', true,
    'range_start', p_start_date,
    'range_end_exclusive', p_end_date_exclusive,
    'affected_rows', v_affected_rows,
    'cancelled_hold_count', v_cancelled_hold_count
  );
end;
$$;

create or replace function public.prune_inventory_change_events()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_rows integer;
begin
  delete from public.inventory_change_events ice
  using public.hotel_settings hs
  where hs.id = ice.hotel_id
    and ice.created_at < now() - make_interval(months => hs.audit_retention_months);

  get diagnostics v_deleted_rows = row_count;
  return v_deleted_rows;
end;
$$;

revoke all on function public.bulk_update_inventory(
  uuid, date, date, uuid[], numeric, boolean, uuid, boolean, text
) from public, anon;
revoke all on function public.repair_inventory_horizon(uuid)
  from public, anon;
revoke all on function public.panic_close_inventory(date, date, uuid, text)
  from public, anon;
revoke all on function public.prune_inventory_change_events()
  from public, anon, authenticated;

grant execute on function public.bulk_update_inventory(
  uuid, date, date, uuid[], numeric, boolean, uuid, boolean, text
) to authenticated;
grant execute on function public.repair_inventory_horizon(uuid)
  to authenticated;
grant execute on function public.panic_close_inventory(date, date, uuid, text)
  to authenticated;
grant execute on function public.prune_inventory_change_events()
  to service_role;

comment on function public.bulk_update_inventory(
  uuid, date, date, uuid[], numeric, boolean, uuid, boolean, text
) is 'Audited spreadsheet/bulk inventory editor with coverage, role, pricing, and promo-block safeguards.';

comment on function public.repair_inventory_horizon(uuid) is
  'Idempotently regenerates missing expected allotment rows without overwriting existing staff changes.';

comment on function public.panic_close_inventory(date, date, uuid, text) is
  'Immediately removes public and promo inventory for a date range and atomically cancels affected active checkout holds.';

comment on function public.prune_inventory_change_events() is
  'Background-worker entry point that deletes audit events beyond each hotel configured 12-24 month retention window.';
