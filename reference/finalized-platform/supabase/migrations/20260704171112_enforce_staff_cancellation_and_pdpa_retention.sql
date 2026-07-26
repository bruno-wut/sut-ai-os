-- Require manager/admin authorization for cancellations inside 24 hours,
-- and align booking PII retention with the seven-year PDPA policy.

create or replace function public.cancel_reservation(
  p_reservation_id uuid,
  p_expected_version integer,
  p_reason text
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
begin
  v_hotel_id := public.current_staff_hotel_id();

  select wr.check_in_date, hs.timezone
  into v_check_in_date, v_timezone
  from public.web_reservations wr
  join public.hotel_settings hs on hs.id = wr.hotel_id
  where wr.id = p_reservation_id
    and wr.hotel_id = v_hotel_id;

  if v_check_in_date is null then
    raise exception 'Reservation was not found for the current hotel.';
  end if;

  if not public.staff_has_any_role(
    array['admin', 'manager']::public.staff_role[]
  ) and (
    v_check_in_date::timestamp at time zone v_timezone
  ) <= now() + interval '24 hours' then
    raise exception using
      errcode = '42501',
      message = 'MANAGER_APPROVAL_REQUIRED';
  end if;

  return private.cancel_reservation(
    p_reservation_id,
    p_expected_version,
    p_reason
  );
end;
$$;

revoke all on function public.cancel_reservation(uuid, integer, text)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_reservation(uuid, integer, text)
  to authenticated;

alter table public.hotel_settings
  alter column booking_pii_retention_months set default 84;

update public.hotel_settings
set booking_pii_retention_months = 84
where booking_pii_retention_months is distinct from 84;

comment on function public.cancel_reservation(uuid, integer, text) is
  'Human API cancellation boundary with optimistic locking and manager/admin authorization inside 24 hours of check-in.';
