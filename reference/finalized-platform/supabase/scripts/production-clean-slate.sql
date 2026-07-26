-- Production clean-slate procedure.
-- Run only after a backup, a target-project/ref confirmation, and owner content sign-off.
-- The label must be the exact synthetic-test prefix used in the target database.

begin;

set local app.launch_cleanup_label = 'REPLACE_WITH_EXACT_SYNTHETIC_PREFIX';
set local app.launch_cleanup_execute = 'false';

do $$
declare
  v_label text := current_setting('app.launch_cleanup_label', true);
begin
  if v_label is null or v_label = '' or v_label like 'REPLACE_%' or length(v_label) < 12 then
    raise exception 'Set app.launch_cleanup_label to the exact, non-production synthetic test prefix before continuing.';
  end if;
end;
$$;

-- Inspect these counts before setting app.launch_cleanup_execute to true.
with synthetic_reservations as (
  select id from public.web_reservations
  where reservation_number like current_setting('app.launch_cleanup_label') || '%'
), synthetic_holds as (
  select id from public.checkout_holds
  where idempotency_key like current_setting('app.launch_cleanup_label') || '%'
)
select
  (select count(*) from synthetic_reservations) as reservations,
  (select count(*) from synthetic_holds) as checkout_holds,
  (select count(*) from public.room_shuffle_plans where reservation_id in (select id from synthetic_reservations) or hold_id in (select id from synthetic_holds)) as shuffle_plans,
  (select count(*) from public.notification_events where reservation_id in (select id from synthetic_reservations) or idempotency_key like current_setting('app.launch_cleanup_label') || '%') as notification_events,
  (select count(*) from public.stripe_webhook_events where stripe_event_id like current_setting('app.launch_cleanup_label') || '%') as stripe_webhook_events;

do $$
declare
  v_label text := current_setting('app.launch_cleanup_label', true);
begin
  if current_setting('app.launch_cleanup_execute', true) <> 'true' then
    raise notice 'Dry run only. Set app.launch_cleanup_execute to true after approving the row counts.';
    return;
  end if;

  -- Test-only records are identified exclusively by the approved synthetic prefix.
  delete from public.notification_events
  where idempotency_key like v_label || '%'
     or reservation_id in (
       select id from public.web_reservations where reservation_number like v_label || '%'
     );

  delete from public.stripe_webhook_events
  where stripe_event_id like v_label || '%';

  delete from public.room_shuffle_plans
  where reservation_id in (
    select id from public.web_reservations where reservation_number like v_label || '%'
  )
  or hold_id in (
    select id from public.checkout_holds where idempotency_key like v_label || '%'
  );

  delete from public.checkout_holds
  where idempotency_key like v_label || '%';

  delete from public.web_reservations
  where reservation_number like v_label || '%';
end;
$$;

-- Verify that inventory, staff, and hotel configuration survived untouched.
select
  (select count(*) from public.hotel_settings) as hotel_settings,
  (select count(*) from public.staff_profiles where is_active) as active_staff_profiles,
  (select count(*) from public.physical_rooms where is_active) as active_physical_rooms,
  (select count(*) from public.physical_room_allotments where is_booked) as booked_allotments;

commit;
