-- Hotel Inventory Bridge: create the hold, select payment mode, and capture
-- required consent in one transaction so partial checkout preparation cannot
-- strand inventory without its legal/payment context.

set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function public.create_checkout_hold_with_context(
  p_check_in date,
  p_check_out date,
  p_room_type_id uuid,
  p_rooms_requested integer,
  p_adults integer,
  p_children integer,
  p_idempotency_key text,
  p_promo_code text,
  p_payment_mode public.booking_payment_mode,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pdpa_consent boolean,
  p_marketing_consent boolean default false,
  p_terms_version text default null,
  p_privacy_policy_version text default null,
  p_cancellation_policy_version text default null,
  p_consent_ip_address text default null,
  p_consent_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold jsonb;
  v_hold_token uuid;
  v_mode jsonb;
  v_consent jsonb;
begin
  v_hold := public.create_checkout_hold(
    p_check_in,
    p_check_out,
    p_room_type_id,
    p_rooms_requested,
    p_adults,
    p_children,
    p_idempotency_key,
    p_promo_code
  );

  v_hold_token := (v_hold->>'hold_token')::uuid;

  if coalesce((v_hold->>'ok')::boolean, false) is false then
    return v_hold;
  end if;

  if v_hold_token is null then
    raise exception using errcode = 'P0001', message = 'HOLD_CREATION_FAILED';
  end if;

  v_mode := public.set_checkout_hold_payment_mode(
    v_hold_token,
    p_payment_mode
  );

  v_consent := public.record_checkout_hold_consent(
    v_hold_token,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_pdpa_consent,
    p_marketing_consent,
    p_terms_version,
    p_privacy_policy_version,
    p_cancellation_policy_version,
    p_consent_ip_address,
    p_consent_user_agent
  );

  return v_hold || jsonb_build_object(
    'payment_mode', v_mode->>'payment_mode',
    'consent_recorded', coalesce((v_consent->>'ok')::boolean, false)
  );
end;
$$;

revoke all on function public.create_checkout_hold_with_context(
  date, date, uuid, integer, integer, integer, text, text,
  public.booking_payment_mode, text, text, text, boolean, boolean,
  text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.create_checkout_hold_with_context(
  date, date, uuid, integer, integer, integer, text, text,
  public.booking_payment_mode, text, text, text, boolean, boolean,
  text, text, text, text, text
) to service_role;

comment on function public.create_checkout_hold_with_context(
  date, date, uuid, integer, integer, integer, text, text,
  public.booking_payment_mode, text, text, text, boolean, boolean,
  text, text, text, text, text
) is
  'Server-only atomic checkout preparation: creates an idempotent inventory hold, selects payment mode, and records required legal consent in one transaction.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;;
