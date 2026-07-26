alter table public.web_reservations
  add column if not exists stripe_payment_method_type text,
  add column if not exists stripe_payment_method_brand text,
  add column if not exists stripe_payment_method_last4 text;

alter table public.web_reservations
  drop constraint if exists web_reservations_stripe_payment_method_type_check,
  add constraint web_reservations_stripe_payment_method_type_check
    check (
      stripe_payment_method_type is null
      or stripe_payment_method_type ~ '^[a-z0-9_]{2,64}$'
    );

alter table public.web_reservations
  drop constraint if exists web_reservations_stripe_payment_method_brand_check,
  add constraint web_reservations_stripe_payment_method_brand_check
    check (
      stripe_payment_method_brand is null
      or stripe_payment_method_brand ~ '^[A-Za-z0-9 _-]{1,64}$'
    );

alter table public.web_reservations
  drop constraint if exists web_reservations_stripe_payment_method_last4_check,
  add constraint web_reservations_stripe_payment_method_last4_check
    check (
      stripe_payment_method_last4 is null
      or stripe_payment_method_last4 ~ '^[0-9]{4}$'
    );
