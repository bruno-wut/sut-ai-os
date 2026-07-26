-- Flexible Dates Lookahead
-- Fast, constrained RPC to find nearby available dates when a room is fully booked.

create or replace function public.find_next_available_date(
  p_room_type_id uuid,
  p_start_date date,
  p_length_of_stay int,
  p_promo_code text default null
) returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_date date;
  v_available integer;
begin
  -- Iterate through the next 7 days from the requested start date
  for v_date in
    select d::date from generate_series(p_start_date + 1, p_start_date + 7, '1 day'::interval) d
  loop
    begin
      -- Utilize the existing robust availability check function
      select available_room_count into v_available
      from public.search_room_type_availability(v_date, v_date + p_length_of_stay, p_room_type_id, p_promo_code);

      if coalesce(v_available, 0) > 0 then
        return v_date;
      end if;
    exception when others then
      -- If we hit an inventory boundary or other error, fail gracefully and return null
      return null;
    end;
  end loop;

  return null;
end;
$$;

revoke all on function public.find_next_available_date(uuid, date, int, text)
  from public;

grant execute on function public.find_next_available_date(uuid, date, int, text)
  to anon, authenticated;

comment on function public.find_next_available_date(uuid, date, int, text) is
  'Constrained 7-day lookahead query to find the next available start date for a specific room type and length of stay.';
