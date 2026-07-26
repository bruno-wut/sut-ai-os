-- Regression test for the server-only checkout mutation boundary.

begin;

do $$
declare
  v_create_hold regprocedure :=
    'public.create_checkout_hold(date,date,uuid,integer,integer,integer,text,text)'::regprocedure;
  v_set_mode regprocedure :=
    'public.set_checkout_hold_payment_mode(uuid,public.booking_payment_mode)'::regprocedure;
  v_record_consent regprocedure :=
    'public.record_checkout_hold_consent(uuid,text,text,text,boolean,boolean,text,text,text,text,text)'::regprocedure;
begin
  if not has_function_privilege('service_role', v_create_hold, 'EXECUTE')
     or has_function_privilege('anon', v_create_hold, 'EXECUTE')
     or has_function_privilege('authenticated', v_create_hold, 'EXECUTE') then
    raise exception 'Checkout hold creation is not service-role-only.';
  end if;

  if not has_function_privilege('service_role', v_set_mode, 'EXECUTE')
     or has_function_privilege('anon', v_set_mode, 'EXECUTE')
     or has_function_privilege('authenticated', v_set_mode, 'EXECUTE') then
    raise exception 'Checkout payment-mode selection is not service-role-only.';
  end if;

  if not has_function_privilege('service_role', v_record_consent, 'EXECUTE')
     or has_function_privilege('anon', v_record_consent, 'EXECUTE')
     or has_function_privilege('authenticated', v_record_consent, 'EXECUTE') then
    raise exception 'Checkout consent capture is not service-role-only.';
  end if;
end;
$$;

rollback;
