-- Snapshot guest-facing presentation data into notification payloads so the
-- delivery worker remains deterministic and does not query mutable booking data.
create or replace function public.enrich_notification_guest_email_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation public.web_reservations%rowtype;
  v_room_image_url text;
begin
  if new.reservation_id is null then
    return new;
  end if;

  select wr.*
  into v_reservation
  from public.web_reservations wr
  where wr.id = new.reservation_id;

  if found then
    select rt.image_url
    into v_room_image_url
    from public.room_types rt
    where rt.hotel_id = v_reservation.hotel_id
      and rt.id = v_reservation.room_type_id;

    new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
      'guest_name', v_reservation.guest_name,
      'room_type', v_reservation.room_type,
      'room_image_url', v_room_image_url,
      'adults', v_reservation.adults,
      'children', v_reservation.children
    );
  end if;

  return new;
end;
$$;

drop trigger if exists notification_events_enrich_guest_email_context
  on public.notification_events;

create trigger notification_events_enrich_guest_email_context
before insert on public.notification_events
for each row execute function public.enrich_notification_guest_email_context();

revoke all on function public.enrich_notification_guest_email_context()
  from public, anon, authenticated;

comment on function public.enrich_notification_guest_email_context() is
  'Snapshots guest name, occupancy, room category, and booked room image into reservation email payloads.';
