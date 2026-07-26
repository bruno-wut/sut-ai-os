alter table public.staff_profiles
  add column if not exists approval_pin_hash text,
  add constraint staff_profiles_approval_pin_hash_not_blank
    check (approval_pin_hash is null or btrim(approval_pin_hash) <> '');

comment on column public.staff_profiles.approval_pin_hash is
  'Optional bcrypt hash for manager/admin destructive-action approval PIN verification.';

create or replace function private.approver_user_id_for_manager_pin(
  p_hotel_id uuid,
  p_manager_approval_pin text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_approver_user_id uuid;
  v_normalized_pin text;
begin
  v_normalized_pin := nullif(btrim(p_manager_approval_pin), '');

  if v_normalized_pin is null then
    return null;
  end if;

  if v_normalized_pin !~ '^[0-9]{4,12}$' then
    return null;
  end if;

  select sp.user_id
  into v_approver_user_id
  from public.staff_profiles sp
  where sp.hotel_id = p_hotel_id
    and sp.is_active
    and sp.role = any (array['admin', 'manager']::public.staff_role[])
    and sp.approval_pin_hash is not null
    and extensions.crypt(v_normalized_pin, sp.approval_pin_hash) = sp.approval_pin_hash
  order by case when sp.role = 'admin' then 0 else 1 end, sp.created_at asc
  limit 1;

  return v_approver_user_id;
end;
$$;

revoke all on function private.approver_user_id_for_manager_pin(uuid, text)
  from public, anon, authenticated, service_role;

create or replace function private.record_manager_approval(
  p_hotel_id uuid,
  p_reservation_id uuid,
  p_approver_user_id uuid,
  p_reason text,
  p_reservation_version integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reservation_edit_events (
    hotel_id,
    reservation_id,
    actor_user_id,
    operation_id,
    edit_kind,
    field_name,
    old_value,
    new_value,
    reason,
    is_manager_override,
    reservation_version
  ) values (
    p_hotel_id,
    p_reservation_id,
    p_approver_user_id,
    gen_random_uuid(),
    'cancellation',
    'manager_approval',
    'null'::jsonb,
    jsonb_build_object('approver_user_id', p_approver_user_id),
    btrim(p_reason),
    true,
    p_reservation_version
  );
end;
$$;

revoke all on function private.record_manager_approval(uuid, uuid, uuid, text, integer)
  from public, anon, authenticated, service_role;

create or replace function public.cancel_reservation_with_approval(
  p_reservation_id uuid,
  p_expected_version integer,
  p_reason text,
  p_manager_approval_pin text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_check_in_date date;
  v_timezone text;
  v_is_manager_or_admin boolean;
  v_approver_user_id uuid;
  v_cancellation_result jsonb;
begin
  v_hotel_id := public.current_staff_hotel_id();
  v_is_manager_or_admin := public.staff_has_any_role(
    array['admin', 'manager']::public.staff_role[]
  );

  select wr.check_in_date, hs.timezone
  into v_check_in_date, v_timezone
  from public.web_reservations wr
  join public.hotel_settings hs on hs.id = wr.hotel_id
  where wr.id = p_reservation_id
    and wr.hotel_id = v_hotel_id;

  if v_check_in_date is null then
    raise exception 'Reservation was not found for the current hotel.';
  end if;

  if not v_is_manager_or_admin and (
    v_check_in_date::timestamp at time zone v_timezone
  ) <= now() + interval '24 hours' then
    if nullif(btrim(p_manager_approval_pin), '') is null then
      raise exception using
        errcode = '42501',
        message = 'MANAGER_APPROVAL_PIN_REQUIRED';
    end if;

    v_approver_user_id := private.approver_user_id_for_manager_pin(
      v_hotel_id,
      p_manager_approval_pin
    );

    if v_approver_user_id is null then
      raise exception using
        errcode = '42501',
        message = 'INVALID_MANAGER_APPROVAL_PIN';
    end if;
  end if;

  v_cancellation_result := private.cancel_reservation(
    p_reservation_id,
    p_expected_version,
    p_reason
  );

  if v_approver_user_id is not null then
    perform private.record_manager_approval(
      v_hotel_id,
      p_reservation_id,
      v_approver_user_id,
      p_reason,
      (v_cancellation_result ->> 'edit_version')::integer
    );
  end if;

  return v_cancellation_result;
end;
$$;

revoke all on function public.cancel_reservation_with_approval(uuid, integer, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_reservation_with_approval(uuid, integer, text, text)
  to authenticated;

comment on function public.cancel_reservation_with_approval(uuid, integer, text, text) is
  'Cancels a reservation with optimistic locking and manager/admin PIN verification for front-desk late cancellations.';
