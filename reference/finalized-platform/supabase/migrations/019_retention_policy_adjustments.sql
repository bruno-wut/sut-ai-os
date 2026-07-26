-- Hotel Inventory Bridge: legal retention policy adjustments.
--
-- Aligns the database defaults and validation ranges with the latest legal
-- feedback:
--   - audit_retention_months = 84
--   - consent_retention_months = 6
--   - booking_pii_retention_months = 120
--   - abandoned_hold_retention_days = 7

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.hotel_settings
  alter column audit_retention_months set default 84,
  alter column consent_retention_months set default 6,
  alter column booking_pii_retention_months set default 120,
  alter column abandoned_hold_retention_days set default 7;

alter table public.hotel_settings
  drop constraint if exists hotel_settings_audit_retention_range,
  drop constraint if exists hotel_settings_consent_retention_range,
  drop constraint if exists hotel_settings_booking_pii_retention_range,
  drop constraint if exists hotel_settings_abandoned_hold_retention_range;

alter table public.hotel_settings
  add constraint hotel_settings_audit_retention_range
    check (audit_retention_months between 12 and 120),
  add constraint hotel_settings_consent_retention_range
    check (consent_retention_months between 1 and 120),
  add constraint hotel_settings_booking_pii_retention_range
    check (booking_pii_retention_months between 12 and 120),
  add constraint hotel_settings_abandoned_hold_retention_range
    check (abandoned_hold_retention_days between 1 and 365);

update public.hotel_settings
set
  audit_retention_months = 84,
  consent_retention_months = 6,
  booking_pii_retention_months = 120,
  abandoned_hold_retention_days = 7
where
  audit_retention_months is distinct from 84
  or consent_retention_months is distinct from 6
  or booking_pii_retention_months is distinct from 120
  or abandoned_hold_retention_days is distinct from 7;

comment on table public.hotel_settings is
  'Hotel configuration including operational timing, retention windows, and guest-facing defaults.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
