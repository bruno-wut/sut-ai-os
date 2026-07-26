-- Stripe Checkout requires an expiry at least 30 minutes in the future.
-- Keep the database lock slightly longer and make Stripe use that exact time.

alter table public.hotel_settings
  alter column checkout_hold_minutes set default 35;

update public.hotel_settings
set checkout_hold_minutes = 35
where checkout_hold_minutes < 35;
