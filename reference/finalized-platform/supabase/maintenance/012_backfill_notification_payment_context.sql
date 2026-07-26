-- Post-deploy historical maintenance; do not append this file to migrations.
-- Run one statement per background job invocation until updated_rows is zero.
-- A small batch keeps row locks short and yields to notification workers.

select public.backfill_notification_payment_context_batch(250) as updated_notification_rows;
select public.backfill_reservation_payment_events_batch(250) as inserted_payment_event_rows;
