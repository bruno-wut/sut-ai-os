-- Batch Flexible Dates Lookahead RPC
-- Returns next available check-in dates for a list of room type IDs in a single RPC call.

create or replace function public.find_next_available_dates(
  p_room_type_ids uuid[],
  p_start_date date,
  p_length_of_stay int,
  p_promo_code text default null
) returns table (
  room_type_id uuid,
  next_available_date date
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_room_type_id uuid;
  v_date date;
  v_available integer;
begin
  if p_room_type_ids is null or cardinality(p_room_type_ids) = 0 then
    return;
  end if;

  foreach v_room_type_id in array p_room_type_ids loop
    v_date := null;
    
    for v_date in
      select d::date from generate_series(p_start_date + 1, p_start_date + 7, '1 day'::interval) d
    loop
      begin
        select available_room_count into v_available
        from public.search_room_type_availability(v_date, v_date + p_length_of_stay, v_room_type_id, p_promo_code);

        if coalesce(v_available, 0) > 0 then
          room_type_id := v_room_type_id;
          next_available_date := v_date;
          return next;
          exit;
        end if;
      exception when others then
        null;
      end;
    end loop;
  end loop;

  return;
end;
$$;

revoke all on function public.find_next_available_dates(uuid[], date, int, text)
  from public;

grant execute on function public.find_next_available_dates(uuid[], date, int, text)
  to anon, authenticated, service_role;

comment on function public.find_next_available_dates(uuid[], date, int, text) is
  'Batch 7-day lookahead query to find next available start dates for multiple room types.';
