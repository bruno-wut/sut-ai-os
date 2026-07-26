-- Migration to harden data retention and prevent accidental cascading deletes of critical reservation logs.
-- This changes the foreign keys on reservation child tables from ON DELETE CASCADE to ON DELETE RESTRICT.

-- Set timeouts to prevent queuing locks in production.
set lock_timeout = '10s';
set statement_timeout = '120s';

-- 1. reservation_room_nights
alter table public.reservation_room_nights
  drop constraint if exists reservation_room_nights_reservation_id_fkey,
  add constraint reservation_room_nights_reservation_id_fkey
    foreign key (reservation_id) references public.web_reservations(id) on delete restrict;

-- 2. room_shuffle_plans
alter table public.room_shuffle_plans
  drop constraint if exists room_shuffle_plans_reservation_id_fkey,
  add constraint room_shuffle_plans_reservation_id_fkey
    foreign key (reservation_id) references public.web_reservations(id) on delete restrict;

-- 3. notification_events
alter table public.notification_events
  drop constraint if exists notification_events_reservation_id_fkey,
  add constraint notification_events_reservation_id_fkey
    foreign key (reservation_id) references public.web_reservations(id) on delete restrict;

-- 4. reservation_sync_events
alter table public.reservation_sync_events
  drop constraint if exists reservation_sync_events_reservation_id_fkey,
  add constraint reservation_sync_events_reservation_id_fkey
    foreign key (reservation_id) references public.web_reservations(id) on delete restrict;

-- 5. reservation_payment_events
alter table public.reservation_payment_events
  drop constraint if exists reservation_payment_events_reservation_id_fkey,
  add constraint reservation_payment_events_reservation_id_fkey
    foreign key (reservation_id) references public.web_reservations(id) on delete restrict;

-- 6. reservation_edit_events
alter table public.reservation_edit_events
  drop constraint if exists reservation_edit_events_reservation_id_fkey,
  add constraint reservation_edit_events_reservation_id_fkey
    foreign key (reservation_id) references public.web_reservations(id) on delete restrict;

-- 7. consent_records
alter table public.consent_records
  drop constraint if exists consent_records_reservation_id_fkey,
  add constraint consent_records_reservation_id_fkey
    foreign key (reservation_id) references public.web_reservations(id) on delete restrict;

-- 8. reservation_refund_requests
alter table public.reservation_refund_requests
  drop constraint if exists reservation_refund_requests_reservation_id_fkey,
  add constraint reservation_refund_requests_reservation_id_fkey
    foreign key (reservation_id) references public.web_reservations(id) on delete restrict;
