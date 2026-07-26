-- Every externally visible reservation status transition must invalidate
-- stale staff detail pages, even when the operation predates edit_version.

create or replace function private.bump_reservation_version_on_status_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.sync_status is distinct from old.sync_status
     and new.edit_version = old.edit_version then
    new.edit_version := old.edit_version + 1;
  end if;

  return new;
end;
$$;

drop trigger if exists web_reservations_status_version_trigger
  on public.web_reservations;

create trigger web_reservations_status_version_trigger
before update of sync_status on public.web_reservations
for each row
execute function private.bump_reservation_version_on_status_change();

revoke all on function private.bump_reservation_version_on_status_change()
  from public, anon, authenticated, service_role;
