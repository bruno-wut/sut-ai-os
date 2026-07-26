-- Hotel Inventory Bridge: enforce the final Next.js integration contract.
-- All checkout mutations pass through the server-only service-role boundary.

set lock_timeout = '5s';
set statement_timeout = '30s';

revoke all on function public.create_checkout_hold(
  date, date, uuid, integer, integer, integer, text, text
) from public, anon, authenticated;

revoke all on function public.set_checkout_hold_payment_mode(
  uuid, public.booking_payment_mode
) from public, anon, authenticated;

revoke all on function public.record_checkout_hold_consent(
  uuid, text, text, text, boolean, boolean, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.create_checkout_hold(
  date, date, uuid, integer, integer, integer, text, text
) to service_role;

grant execute on function public.set_checkout_hold_payment_mode(
  uuid, public.booking_payment_mode
) to service_role;

grant execute on function public.record_checkout_hold_consent(
  uuid, text, text, text, boolean, boolean, text, text, text, text, text
) to service_role;

-- Supabase hosts may provide this internal helper outside the application
-- migrations. Keep local PostgreSQL-compatible migration tests portable.
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    execute 'revoke all on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end;
$$;

comment on function public.create_checkout_hold(
  date, date, uuid, integer, integer, integer, text, text
) is
  'Creates an atomic checkout hold. Server-only: invoke through the rate-limited Next.js route with service-role credentials.';

comment on function public.record_checkout_hold_consent(
  uuid, text, text, text, boolean, boolean, text, text, text, text, text
) is
  'Captures checkout consent on an active hold. Server-only: invoke through the validated Next.js checkout flow.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
