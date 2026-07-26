-- Legacy/demo tenants may contain generated inventory without the completion
-- marker introduced by onboarding. Mark only tenants with a complete catalog.

update public.hotel_settings hs
set setup_completed_at = coalesce(
  (
    select max(igr.completed_at)
    from public.inventory_generation_runs igr
    where igr.hotel_id = hs.id
      and igr.status = 'completed'
  ),
  now()
)
where hs.setup_completed_at is null
  and exists (
    select 1 from public.room_types rt
    where rt.hotel_id = hs.id
      and rt.is_active
  )
  and exists (
    select 1 from public.physical_rooms pr
    where pr.hotel_id = hs.id
      and pr.is_active
  )
  and exists (
    select 1 from public.physical_room_allotments pra
    where pra.hotel_id = hs.id
  );

comment on column public.hotel_settings.setup_completed_at is
  'Completion marker for one-time onboarding; legacy generated inventories were backfilled on 2026-07-21.';
