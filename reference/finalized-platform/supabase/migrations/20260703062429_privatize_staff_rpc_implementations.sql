-- Hotel Inventory Bridge: keep privileged staff RPC implementations outside
-- the exposed API schema while preserving stable public invoker wrappers.

set lock_timeout = '10s';
set statement_timeout = '60s';

alter function public.bulk_update_inventory(
  uuid, date, date, uuid[], numeric, boolean, uuid, boolean, text
) set schema private;
alter function public.cancel_reservation(uuid, integer, text)
  set schema private;
alter function public.edit_reservation(
  uuid, integer, text, text, text, text, text, boolean
) set schema private;
alter function public.initialize_hotel_inventory(jsonb)
  set schema private;
alter function public.mark_pay_at_hotel_payment_collected(uuid, numeric, text)
  set schema private;
alter function public.mark_reservation_entered_in_pms(uuid, boolean)
  set schema private;
alter function public.override_booking(
  uuid, integer, text, date, date, uuid, numeric, text
) set schema private;
alter function public.panic_close_inventory(date, date, uuid, text)
  set schema private;
alter function public.publish_initial_web_allocation(text[])
  set schema private;
alter function public.reopen_reservation_for_pms(uuid, text)
  set schema private;
alter function public.repair_inventory_horizon(uuid)
  set schema private;

revoke all on function private.bulk_update_inventory(
  uuid, date, date, uuid[], numeric, boolean, uuid, boolean, text
) from public, anon, authenticated, service_role;
revoke all on function private.cancel_reservation(uuid, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function private.edit_reservation(
  uuid, integer, text, text, text, text, text, boolean
) from public, anon, authenticated, service_role;
revoke all on function private.initialize_hotel_inventory(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.mark_pay_at_hotel_payment_collected(
  uuid, numeric, text
) from public, anon, authenticated, service_role;
revoke all on function private.mark_reservation_entered_in_pms(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function private.override_booking(
  uuid, integer, text, date, date, uuid, numeric, text
) from public, anon, authenticated, service_role;
revoke all on function private.panic_close_inventory(date, date, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.publish_initial_web_allocation(text[])
  from public, anon, authenticated, service_role;
revoke all on function private.reopen_reservation_for_pms(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function private.repair_inventory_horizon(uuid)
  from public, anon, authenticated, service_role;

grant execute on function private.bulk_update_inventory(
  uuid, date, date, uuid[], numeric, boolean, uuid, boolean, text
) to authenticated;
grant execute on function private.cancel_reservation(uuid, integer, text)
  to authenticated;
grant execute on function private.edit_reservation(
  uuid, integer, text, text, text, text, text, boolean
) to authenticated;
grant execute on function private.initialize_hotel_inventory(jsonb)
  to authenticated;
grant execute on function private.mark_pay_at_hotel_payment_collected(
  uuid, numeric, text
) to authenticated;
grant execute on function private.mark_reservation_entered_in_pms(uuid, boolean)
  to authenticated;
grant execute on function private.override_booking(
  uuid, integer, text, date, date, uuid, numeric, text
) to authenticated;
grant execute on function private.panic_close_inventory(date, date, uuid, text)
  to authenticated;
grant execute on function private.publish_initial_web_allocation(text[])
  to authenticated;
grant execute on function private.reopen_reservation_for_pms(uuid, text)
  to authenticated;
grant execute on function private.repair_inventory_horizon(uuid)
  to authenticated;

create function public.bulk_update_inventory(
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
language sql
security invoker
set search_path = ''
as $$
  select private.bulk_update_inventory(
    p_room_type_id,
    p_start_date,
    p_end_date_exclusive,
    p_room_ids,
    p_nightly_price,
    p_is_available,
    p_group_block_id,
    p_clear_group_block,
    p_reason
  )
$$;

create function public.cancel_reservation(
  p_reservation_id uuid,
  p_expected_version integer,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_reservation(
    p_reservation_id, p_expected_version, p_reason
  )
$$;

create function public.edit_reservation(
  p_reservation_id uuid,
  p_expected_version integer,
  p_reason text,
  p_guest_name text default null,
  p_guest_email text default null,
  p_guest_phone text default null,
  p_internal_note text default null,
  p_clear_internal_note boolean default false
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.edit_reservation(
    p_reservation_id,
    p_expected_version,
    p_reason,
    p_guest_name,
    p_guest_email,
    p_guest_phone,
    p_internal_note,
    p_clear_internal_note
  )
$$;

create function public.initialize_hotel_inventory(p_room_types jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.initialize_hotel_inventory(p_room_types)
$$;

create function public.mark_pay_at_hotel_payment_collected(
  p_reservation_id uuid,
  p_amount numeric,
  p_reason text default 'Collected at hotel'
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.mark_pay_at_hotel_payment_collected(
    p_reservation_id, p_amount, p_reason
  )
$$;

create function public.mark_reservation_entered_in_pms(
  p_reservation_id uuid,
  p_confirm_shuffle_completed boolean default false
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.mark_reservation_entered_in_pms(
    p_reservation_id, p_confirm_shuffle_completed
  )
$$;

create function public.override_booking(
  p_reservation_id uuid,
  p_expected_version integer,
  p_reason text,
  p_new_check_in date default null,
  p_new_check_out date default null,
  p_new_room_id uuid default null,
  p_new_nightly_rate numeric default null,
  p_internal_note text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.override_booking(
    p_reservation_id,
    p_expected_version,
    p_reason,
    p_new_check_in,
    p_new_check_out,
    p_new_room_id,
    p_new_nightly_rate,
    p_internal_note
  )
$$;

create function public.panic_close_inventory(
  p_start_date date,
  p_end_date_exclusive date,
  p_room_type_id uuid default null,
  p_reason text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.panic_close_inventory(
    p_start_date, p_end_date_exclusive, p_room_type_id, p_reason
  )
$$;

create function public.publish_initial_web_allocation(
  p_room_numbers text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.publish_initial_web_allocation(p_room_numbers)
$$;

create function public.reopen_reservation_for_pms(
  p_reservation_id uuid,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.reopen_reservation_for_pms(p_reservation_id, p_reason)
$$;

create function public.repair_inventory_horizon(
  p_room_type_id uuid default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.repair_inventory_horizon(p_room_type_id)
$$;

revoke all on function public.bulk_update_inventory(
  uuid, date, date, uuid[], numeric, boolean, uuid, boolean, text
) from public, anon, authenticated, service_role;
revoke all on function public.cancel_reservation(uuid, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.edit_reservation(
  uuid, integer, text, text, text, text, text, boolean
) from public, anon, authenticated, service_role;
revoke all on function public.initialize_hotel_inventory(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function public.mark_pay_at_hotel_payment_collected(
  uuid, numeric, text
) from public, anon, authenticated, service_role;
revoke all on function public.mark_reservation_entered_in_pms(uuid, boolean)
  from public, anon, authenticated, service_role;
revoke all on function public.override_booking(
  uuid, integer, text, date, date, uuid, numeric, text
) from public, anon, authenticated, service_role;
revoke all on function public.panic_close_inventory(date, date, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.publish_initial_web_allocation(text[])
  from public, anon, authenticated, service_role;
revoke all on function public.reopen_reservation_for_pms(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.repair_inventory_horizon(uuid)
  from public, anon, authenticated, service_role;

grant execute on function public.bulk_update_inventory(
  uuid, date, date, uuid[], numeric, boolean, uuid, boolean, text
) to authenticated;
grant execute on function public.cancel_reservation(uuid, integer, text)
  to authenticated;
grant execute on function public.edit_reservation(
  uuid, integer, text, text, text, text, text, boolean
) to authenticated;
grant execute on function public.initialize_hotel_inventory(jsonb)
  to authenticated;
grant execute on function public.mark_pay_at_hotel_payment_collected(
  uuid, numeric, text
) to authenticated;
grant execute on function public.mark_reservation_entered_in_pms(uuid, boolean)
  to authenticated;
grant execute on function public.override_booking(
  uuid, integer, text, date, date, uuid, numeric, text
) to authenticated;
grant execute on function public.panic_close_inventory(date, date, uuid, text)
  to authenticated;
grant execute on function public.publish_initial_web_allocation(text[])
  to authenticated;
grant execute on function public.reopen_reservation_for_pms(uuid, text)
  to authenticated;
grant execute on function public.repair_inventory_horizon(uuid)
  to authenticated;

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
