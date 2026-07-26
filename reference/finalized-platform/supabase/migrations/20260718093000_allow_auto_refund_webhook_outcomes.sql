-- Allow the Stripe webhook ledger to retain bounded automatic-refund evidence
-- for paid sessions whose checkout hold is no longer active.

alter table public.stripe_webhook_event_outcomes
  drop constraint if exists stripe_webhook_event_outcomes_context_keys;

alter table public.stripe_webhook_event_outcomes
  add constraint stripe_webhook_event_outcomes_context_keys
  check (
    context - array[
      'idempotent',
      'reservation_id',
      'http_acknowledged',
      'retryable',
      'auto_refund_id',
      'auto_refund_status',
      'auto_refund_error'
    ] = '{}'::jsonb
  );

create or replace function public.record_stripe_webhook_event(
  p_hotel_id uuid,
  p_stripe_event_id text,
  p_event_type text,
  p_processing_state text,
  p_checkout_session_id text default null,
  p_hold_token uuid default null,
  p_review_code text default null,
  p_event_context jsonb default '{}'::jsonb,
  p_outcome_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_existing public.stripe_webhook_events%rowtype;
  v_valid_hold_token uuid;
  v_outcome_id bigint;
begin
  if p_hotel_id is null
     or not exists (
       select 1 from public.hotel_settings hs where hs.id = p_hotel_id
     ) then
    raise exception using errcode = '22023', message = 'INVALID_HOTEL';
  end if;

  if p_stripe_event_id is null
     or p_stripe_event_id !~ '^evt_[A-Za-z0-9_]{6,250}$'
     or p_event_type is null
     or p_event_type !~ '^[a-z0-9_.]{1,100}$'
     or p_processing_state not in ('received', 'processed', 'manual_review', 'ignored')
     or (
       p_checkout_session_id is not null
       and p_checkout_session_id !~ '^cs_(test_|live_)?[A-Za-z0-9_]{6,250}$'
     )
     or (
       p_review_code is not null
       and p_review_code !~ '^[A-Z0-9_]{1,80}$'
     )
     or (p_processing_state = 'manual_review' and p_review_code is null) then
    raise exception using errcode = '22023', message = 'INVALID_WEBHOOK_LEDGER_INPUT';
  end if;

  if jsonb_typeof(coalesce(p_event_context, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_event_context, '{}'::jsonb)) > 4096
     or coalesce(p_event_context, '{}'::jsonb) - array[
       'livemode', 'payment_status', 'checkout_status', 'currency',
       'amount_total_minor', 'request_id'
     ] <> '{}'::jsonb
     or jsonb_typeof(coalesce(p_outcome_context, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_outcome_context, '{}'::jsonb)) > 4096
     or coalesce(p_outcome_context, '{}'::jsonb) - array[
       'idempotent', 'reservation_id', 'http_acknowledged', 'retryable',
       'auto_refund_id', 'auto_refund_status', 'auto_refund_error'
     ] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'INVALID_WEBHOOK_LEDGER_CONTEXT';
  end if;

  select ch.public_token
  into v_valid_hold_token
  from public.checkout_holds ch
  where ch.hotel_id = p_hotel_id
    and ch.public_token = p_hold_token;

  insert into public.stripe_webhook_events (
    hotel_id,
    stripe_event_id,
    event_type,
    checkout_session_id,
    hold_token,
    context
  )
  values (
    p_hotel_id,
    p_stripe_event_id,
    p_event_type,
    p_checkout_session_id,
    v_valid_hold_token,
    coalesce(p_event_context, '{}'::jsonb)
  )
  on conflict (stripe_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select swe.*
    into v_existing
    from public.stripe_webhook_events swe
    where swe.stripe_event_id = p_stripe_event_id;

    if v_existing.hotel_id <> p_hotel_id
       or v_existing.event_type <> p_event_type
       or v_existing.checkout_session_id is distinct from p_checkout_session_id
       or v_existing.hold_token is distinct from v_valid_hold_token then
      raise exception using errcode = 'P0001', message = 'STRIPE_EVENT_ID_CONFLICT';
    end if;

    v_event_id := v_existing.id;
  end if;

  insert into public.stripe_webhook_event_outcomes (
    webhook_event_id,
    processing_state,
    review_code,
    context
  )
  values (
    v_event_id,
    p_processing_state,
    p_review_code,
    coalesce(p_outcome_context, '{}'::jsonb)
  )
  on conflict (webhook_event_id, processing_state, review_code) do nothing
  returning id into v_outcome_id;

  return jsonb_build_object(
    'ok', true,
    'event_id', v_event_id,
    'state', p_processing_state,
    'idempotent', v_outcome_id is null
  );
end;
$$;

revoke all on function public.record_stripe_webhook_event(
  uuid, text, text, text, text, uuid, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.record_stripe_webhook_event(
  uuid, text, text, text, text, uuid, text, jsonb, jsonb
) to service_role;

