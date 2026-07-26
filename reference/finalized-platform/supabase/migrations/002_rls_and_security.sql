-- Hotel Inventory Bridge: staff identity, grants, and row-level security.
-- Public guest flows will use narrowly scoped security-definer RPCs in the next migration.

create type public.staff_role as enum (
  'admin',
  'manager',
  'front_desk',
  'revenue_manager'
);

create table public.staff_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  role public.staff_role not null,
  full_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint staff_profiles_full_name_not_blank check (btrim(full_name) <> ''),
  constraint staff_profiles_hotel_user_unique unique (hotel_id, user_id)
);

create index staff_profiles_active_hotel_role_idx
  on public.staff_profiles (hotel_id, role)
  where is_active;

create trigger staff_profiles_set_updated_at
before update on public.staff_profiles
for each row execute function public.set_updated_at();

create or replace function public.current_staff_hotel_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sp.hotel_id
  from public.staff_profiles sp
  where sp.user_id = auth.uid()
    and sp.is_active
  limit 1
$$;

create or replace function public.staff_has_any_role(required_roles public.staff_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_profiles sp
    where sp.user_id = auth.uid()
      and sp.is_active
      and sp.role = any(required_roles)
  )
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.current_staff_hotel_id() from public, anon;
revoke all on function public.staff_has_any_role(public.staff_role[]) from public, anon;

grant execute on function public.current_staff_hotel_id() to authenticated;
grant execute on function public.staff_has_any_role(public.staff_role[]) to authenticated;

alter table public.hotel_settings enable row level security;
alter table public.inventory_generation_runs enable row level security;
alter table public.room_types enable row level security;
alter table public.physical_rooms enable row level security;
alter table public.group_blocks enable row level security;
alter table public.physical_room_allotments enable row level security;
alter table public.web_reservations enable row level security;
alter table public.checkout_holds enable row level security;
alter table public.checkout_hold_room_nights enable row level security;
alter table public.reservation_room_nights enable row level security;
alter table public.room_shuffle_plans enable row level security;
alter table public.room_shuffle_steps enable row level security;
alter table public.notification_events enable row level security;
alter table public.staff_profiles enable row level security;

revoke all on table public.hotel_settings from public, anon, authenticated;
revoke all on table public.inventory_generation_runs from public, anon, authenticated;
revoke all on table public.room_types from public, anon, authenticated;
revoke all on table public.physical_rooms from public, anon, authenticated;
revoke all on table public.group_blocks from public, anon, authenticated;
revoke all on table public.physical_room_allotments from public, anon, authenticated;
revoke all on table public.web_reservations from public, anon, authenticated;
revoke all on table public.checkout_holds from public, anon, authenticated;
revoke all on table public.checkout_hold_room_nights from public, anon, authenticated;
revoke all on table public.reservation_room_nights from public, anon, authenticated;
revoke all on table public.room_shuffle_plans from public, anon, authenticated;
revoke all on table public.room_shuffle_steps from public, anon, authenticated;
revoke all on table public.notification_events from public, anon, authenticated;
revoke all on table public.staff_profiles from public, anon, authenticated;
revoke all on table public.inventory_coverage_gaps from public, anon, authenticated;
revoke all on table public.web_reservation_details from public, anon, authenticated;

grant select, update on table public.hotel_settings to authenticated;
grant select on table public.inventory_generation_runs to authenticated;
grant select, insert, update, delete on table public.room_types to authenticated;
grant select, insert, update, delete on table public.physical_rooms to authenticated;
grant select, insert, update, delete on table public.group_blocks to authenticated;
grant select on table public.physical_room_allotments to authenticated;
grant update (nightly_price, is_available, group_block_id)
  on table public.physical_room_allotments
  to authenticated;
grant select on table public.web_reservations to authenticated;
grant update (sync_status, synced_at, cancelled_at)
  on table public.web_reservations
  to authenticated;
grant select on table public.checkout_holds to authenticated;
grant select on table public.checkout_hold_room_nights to authenticated;
grant select on table public.reservation_room_nights to authenticated;
grant select on table public.room_shuffle_plans to authenticated;
grant select on table public.room_shuffle_steps to authenticated;
grant select on table public.notification_events to authenticated;
grant select, insert, update, delete on table public.staff_profiles to authenticated;
grant select on table public.inventory_coverage_gaps to authenticated;
grant select on table public.web_reservation_details to authenticated;

create policy hotel_settings_staff_select
on public.hotel_settings
for select
to authenticated
using (id = public.current_staff_hotel_id());

create policy hotel_settings_management_update
on public.hotel_settings
for update
to authenticated
using (
  id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin', 'manager']::public.staff_role[])
)
with check (
  id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin', 'manager']::public.staff_role[])
);

create policy inventory_generation_runs_staff_select
on public.inventory_generation_runs
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create policy room_types_staff_select
on public.room_types
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create policy room_types_inventory_management
on public.room_types
for all
to authenticated
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

create policy physical_rooms_staff_select
on public.physical_rooms
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create policy physical_rooms_inventory_management
on public.physical_rooms
for all
to authenticated
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

create policy group_blocks_staff_select
on public.group_blocks
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create policy group_blocks_inventory_management
on public.group_blocks
for all
to authenticated
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

create policy allotments_staff_select
on public.physical_room_allotments
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create policy allotments_staff_management
on public.physical_room_allotments
for all
to authenticated
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

create policy reservations_staff_select
on public.web_reservations
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create policy reservations_operations_update
on public.web_reservations
for update
to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'front_desk']::public.staff_role[]
  )
)
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(
    array['admin', 'manager', 'front_desk']::public.staff_role[]
  )
);

create policy checkout_holds_staff_select
on public.checkout_holds
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create policy checkout_hold_room_nights_staff_select
on public.checkout_hold_room_nights
for select
to authenticated
using (
  exists (
    select 1
    from public.checkout_holds ch
    where ch.id = checkout_hold_room_nights.hold_id
      and ch.hotel_id = public.current_staff_hotel_id()
  )
);

create policy reservation_room_nights_staff_select
on public.reservation_room_nights
for select
to authenticated
using (
  exists (
    select 1
    from public.web_reservations wr
    where wr.id = reservation_room_nights.reservation_id
      and wr.hotel_id = public.current_staff_hotel_id()
  )
);

create policy shuffle_plans_staff_select
on public.room_shuffle_plans
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create policy shuffle_steps_staff_select
on public.room_shuffle_steps
for select
to authenticated
using (
  exists (
    select 1
    from public.room_shuffle_plans rsp
    where rsp.id = room_shuffle_steps.plan_id
      and rsp.hotel_id = public.current_staff_hotel_id()
  )
);

create policy notification_events_management_select
on public.notification_events
for select
to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin', 'manager']::public.staff_role[])
);

create policy staff_profiles_select
on public.staff_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    hotel_id = public.current_staff_hotel_id()
    and public.staff_has_any_role(array['admin', 'manager']::public.staff_role[])
  )
);

create policy staff_profiles_admin_management
on public.staff_profiles
for all
to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin']::public.staff_role[])
)
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin']::public.staff_role[])
);

comment on table public.staff_profiles is
  'Supabase Auth staff identity mapped to one hotel and a least-privilege operational role.';

comment on function public.current_staff_hotel_id() is
  'Returns the active authenticated staff member hotel without exposing profile-table RLS internals.';

comment on function public.staff_has_any_role(public.staff_role[]) is
  'Role-check helper used by RLS policies; inactive users always return false.';
