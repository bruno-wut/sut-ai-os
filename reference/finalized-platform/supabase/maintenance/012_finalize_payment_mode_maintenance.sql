-- Run once, outside a transaction, after both migration-012 batch functions
-- consistently return zero. Schedule this for a low-traffic maintenance window.

-- Validation scans historical rows with a lighter lock than adding an
-- immediately-valid check during the schema migration.
alter table public.web_reservations
  validate constraint web_reservations_amount_due_nonnegative;
alter table public.web_reservations
  validate constraint web_reservations_payment_mode_consistency;

-- CONCURRENTLY keeps active reservation writes available during index build.
create index concurrently if not exists web_reservations_payment_mode_status_idx
  on public.web_reservations (
    hotel_id,
    payment_mode,
    payment_status,
    created_at desc
  );
