-- Regression test for the atomic server-only checkout preparation RPC.

begin;

do $$
declare
  v_function regprocedure :=
    'public.create_checkout_hold_with_context(date,date,uuid,integer,integer,integer,text,text,public.booking_payment_mode,text,text,text,boolean,boolean,text,text,text,text,text)'::regprocedure;
begin
  if v_function is null then
    raise exception 'Atomic checkout context function is missing.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc p
    where p.oid = v_function
      and p.prosecdef
      and p.pronargdefaults = 6
  ) then
    raise exception 'Atomic checkout context function defaults or SECURITY DEFINER contract changed.';
  end if;

  if not has_function_privilege('service_role', v_function, 'EXECUTE')
     or has_function_privilege('anon', v_function, 'EXECUTE')
     or has_function_privilege('authenticated', v_function, 'EXECUTE') then
    raise exception 'Atomic checkout context function is not service-role-only.';
  end if;
end;
$$;

rollback;
