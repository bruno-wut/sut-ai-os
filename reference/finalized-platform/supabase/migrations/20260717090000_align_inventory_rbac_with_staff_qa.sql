-- Align inventory mutation permissions with the staff QA role contract:
-- admins, managers, and revenue managers may edit; front desk remains read-only.
-- The private implementation retains all inventory safety and audit checks; this
-- authenticated public boundary adds the stricter role gate.

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
security invoker
set search_path = ''
as $$
begin
  if not public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'This staff role cannot edit inventory.';
  end if;

  return private.bulk_update_inventory(
    p_room_type_id,
    p_start_date,
    p_end_date_exclusive,
    p_room_ids,
    p_nightly_price,
    p_is_available,
    p_group_block_id,
    p_clear_group_block,
    p_reason
  );
end;
$$;

revoke all on function public.bulk_update_inventory(
  uuid, date, date, uuid[], numeric, boolean, uuid, boolean, text
) from public, anon;
grant execute on function public.bulk_update_inventory(
  uuid, date, date, uuid[], numeric, boolean, uuid, boolean, text
) to authenticated;
