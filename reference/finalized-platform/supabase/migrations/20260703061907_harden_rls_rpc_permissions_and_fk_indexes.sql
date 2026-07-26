-- Hotel Inventory Bridge: production RLS, RPC, privilege, and FK-index hardening.

set lock_timeout = '10s';
set statement_timeout = '120s';

-- Keep privileged staff-identity lookups outside the exposed API schema while
-- retaining stable public invoker wrappers for existing policies and RPCs.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.current_staff_hotel_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sp.hotel_id
  from public.staff_profiles sp
  where sp.user_id = (select auth.uid())
    and sp.is_active
  limit 1
$$;

create or replace function private.staff_has_any_role(
  required_roles public.staff_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = (select auth.uid())
      and sp.is_active
      and sp.role = any(required_roles)
  )
$$;

revoke all on function private.current_staff_hotel_id()
  from public, anon, authenticated, service_role;
revoke all on function private.staff_has_any_role(public.staff_role[])
  from public, anon, authenticated, service_role;
grant execute on function private.current_staff_hotel_id() to authenticated;
grant execute on function private.staff_has_any_role(public.staff_role[])
  to authenticated;

create or replace function public.current_staff_hotel_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
  select private.current_staff_hotel_id()
$$;

create or replace function public.staff_has_any_role(
  required_roles public.staff_role[]
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.staff_has_any_role(required_roles)
$$;

revoke all on function public.current_staff_hotel_id()
  from public, anon, authenticated, service_role;
revoke all on function public.staff_has_any_role(public.staff_role[])
  from public, anon, authenticated, service_role;
grant execute on function public.current_staff_hotel_id() to authenticated;
grant execute on function public.staff_has_any_role(public.staff_role[])
  to authenticated;

-- These legacy catalogue RPCs are no longer used by the application. The
-- server-side catalogue reads narrowly selected inventory columns with the
-- service role, so the definer RPCs do not need an anonymous API surface.
revoke all on function public.search_guest_room_categories(date, date)
  from public, anon, authenticated, service_role;
revoke all on function public.search_room_type_availability(
  date, date, uuid, text
) from public, anon, authenticated, service_role;

-- Anonymous legal-document reads must not expose the staff creator UUID.
revoke select on table public.legal_policy_documents from anon;
grant select (
  id,
  hotel_id,
  policy_kind,
  version,
  title,
  body_markdown,
  effective_at,
  is_active,
  created_at,
  updated_at
) on table public.legal_policy_documents to anon;

-- Keep the public policy anonymous-only. Authenticated staff use the
-- hotel-scoped staff policy, avoiding overlapping permissive SELECT policies.
drop policy if exists legal_policy_documents_public_active_select
  on public.legal_policy_documents;
create policy legal_policy_documents_public_active_select
on public.legal_policy_documents
for select
to anon
using (is_active);

-- Replace broad ALL policies with write-only policies so they do not overlap
-- the existing staff SELECT policies.
drop policy if exists group_blocks_inventory_management
  on public.group_blocks;
create policy group_blocks_inventory_insert
on public.group_blocks for insert to authenticated
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
);
create policy group_blocks_inventory_update
on public.group_blocks for update to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
)
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
);
create policy group_blocks_inventory_delete
on public.group_blocks for delete to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
);

drop policy if exists physical_rooms_inventory_management
  on public.physical_rooms;
create policy physical_rooms_inventory_insert
on public.physical_rooms for insert to authenticated
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
);
create policy physical_rooms_inventory_update
on public.physical_rooms for update to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
)
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
);
create policy physical_rooms_inventory_delete
on public.physical_rooms for delete to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
);

drop policy if exists room_types_inventory_management
  on public.room_types;
create policy room_types_inventory_insert
on public.room_types for insert to authenticated
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
);
create policy room_types_inventory_update
on public.room_types for update to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
)
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
);
create policy room_types_inventory_delete
on public.room_types for delete to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'revenue_manager']::public.staff_role[]
  )
);

drop policy if exists allotments_staff_management
  on public.physical_room_allotments;
create policy allotments_staff_insert
on public.physical_room_allotments for insert to authenticated
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'front_desk', 'revenue_manager']::public.staff_role[]
  )
);
create policy allotments_staff_update
on public.physical_room_allotments for update to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'front_desk', 'revenue_manager']::public.staff_role[]
  )
)
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'front_desk', 'revenue_manager']::public.staff_role[]
  )
);
create policy allotments_staff_delete
on public.physical_room_allotments for delete to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'front_desk', 'revenue_manager']::public.staff_role[]
  )
);

drop policy if exists staff_profiles_admin_management
  on public.staff_profiles;
create policy staff_profiles_admin_insert
on public.staff_profiles for insert to authenticated
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin']::public.staff_role[])
);
create policy staff_profiles_admin_update
on public.staff_profiles for update to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin']::public.staff_role[])
)
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin']::public.staff_role[])
);
create policy staff_profiles_admin_delete
on public.staff_profiles for delete to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin']::public.staff_role[])
);

drop policy if exists staff_profiles_select on public.staff_profiles;
create policy staff_profiles_select
on public.staff_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or (
    hotel_id = public.current_staff_hotel_id()
    and public.staff_has_any_role(
      array['admin', 'manager']::public.staff_role[]
    )
  )
);

drop policy if exists legal_policy_documents_manager_write
  on public.legal_policy_documents;
create policy legal_policy_documents_manager_insert
on public.legal_policy_documents for insert to authenticated
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager']::public.staff_role[]
  )
);
create policy legal_policy_documents_manager_update
on public.legal_policy_documents for update to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager']::public.staff_role[]
  )
)
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager']::public.staff_role[]
  )
);
create policy legal_policy_documents_manager_delete
on public.legal_policy_documents for delete to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager']::public.staff_role[]
  )
);

-- Cover every live foreign key with a matching left-prefix index. Composite
-- indexes intentionally cover the duplicate hotel-only foreign keys.
create index if not exists checkout_hold_room_nights_room_id_idx
  on public.checkout_hold_room_nights (room_id);
create index if not exists checkout_holds_converted_reservation_id_idx
  on public.checkout_holds (converted_reservation_id);
create index if not exists checkout_holds_hotel_room_type_idx
  on public.checkout_holds (hotel_id, room_type_id);
create index if not exists consent_records_hold_id_idx
  on public.consent_records (hold_id);
create index if not exists inventory_change_events_actor_user_id_idx
  on public.inventory_change_events (actor_user_id);
create index if not exists inventory_change_events_room_type_id_idx
  on public.inventory_change_events (room_type_id);
create index if not exists legal_policy_documents_created_by_idx
  on public.legal_policy_documents (created_by);
create index if not exists notification_events_hotel_id_idx
  on public.notification_events (hotel_id);
create index if not exists notification_events_reservation_id_idx
  on public.notification_events (reservation_id);
create index if not exists allotments_hotel_group_block_idx
  on public.physical_room_allotments (hotel_id, group_block_id);
create index if not exists allotments_hold_id_idx
  on public.physical_room_allotments (hold_id);
create index if not exists allotments_booked_reservation_id_idx
  on public.physical_room_allotments (booked_reservation_id);
create index if not exists allotments_room_identity_idx
  on public.physical_room_allotments (
    hotel_id, room_id, room_type_id, room_number
  );
create index if not exists allotments_room_type_identity_idx
  on public.physical_room_allotments (hotel_id, room_type_id, room_type);
create index if not exists reservation_edit_events_actor_user_id_idx
  on public.reservation_edit_events (actor_user_id);
create index if not exists reservation_payment_events_actor_user_id_idx
  on public.reservation_payment_events (actor_user_id);
create index if not exists reservation_room_nights_room_id_idx
  on public.reservation_room_nights (room_id);
create index if not exists reservation_room_nights_room_type_id_idx
  on public.reservation_room_nights (room_type_id);
create index if not exists reservation_room_nights_superseded_by_id_idx
  on public.reservation_room_nights (superseded_by_id);
create index if not exists reservation_sync_events_actor_user_id_idx
  on public.reservation_sync_events (actor_user_id);
create index if not exists room_shuffle_plans_hold_id_idx
  on public.room_shuffle_plans (hold_id);
create index if not exists room_shuffle_plans_reservation_id_idx
  on public.room_shuffle_plans (reservation_id);
create index if not exists shuffle_steps_affected_reservation_id_idx
  on public.room_shuffle_steps (affected_reservation_id);
create index if not exists shuffle_steps_from_room_id_idx
  on public.room_shuffle_steps (from_room_id);
create index if not exists shuffle_steps_to_room_id_idx
  on public.room_shuffle_steps (to_room_id);
create index if not exists web_reservations_hotel_room_type_identity_idx
  on public.web_reservations (hotel_id, room_type_id, room_type);

comment on function private.current_staff_hotel_id() is
  'Privileged staff-to-hotel lookup used through an invoker wrapper.';
comment on function private.staff_has_any_role(public.staff_role[]) is
  'Privileged staff-role lookup used through an invoker wrapper.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
