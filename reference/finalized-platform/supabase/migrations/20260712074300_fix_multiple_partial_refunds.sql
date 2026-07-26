create or replace function public.sync_stripe_refund_status(
  p_stripe_refund_id text,
  p_stripe_status text,
  p_failure_reason text default null,
  p_amount_refunded numeric default null,
  p_stripe_payment_intent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reservation_refund_requests%rowtype;
  v_reservation public.web_reservations%rowtype;
  v_result jsonb;
  v_amount numeric(12, 2);
  v_matched_by text := 'refund_id';
begin
  if nullif(btrim(coalesce(p_stripe_refund_id, '')), '') is null then
    raise exception 'Stripe refund id is required.';
  end if;

  v_amount := greatest(coalesce(p_amount_refunded, 0), 0);

  select rfr.*
  into v_request
  from public.reservation_refund_requests rfr
  where rfr.stripe_refund_id = btrim(p_stripe_refund_id)
  for update;

  if not found and nullif(btrim(coalesce(p_stripe_payment_intent_id, '')), '') is not null then
    v_matched_by := 'payment_intent';

    select wr.*
    into v_reservation
    from public.web_reservations wr
    where wr.stripe_payment_intent_id = btrim(p_stripe_payment_intent_id)
      and wr.payment_mode = 'stripe'
    for update;

    if found then
      select rfr.*
      into v_request
      from public.reservation_refund_requests rfr
      where rfr.reservation_id = v_reservation.id
        and (rfr.stripe_refund_id = btrim(p_stripe_refund_id) or rfr.stripe_refund_id is null)
      order by
        case when rfr.stripe_refund_id = btrim(p_stripe_refund_id) then 0 else 1 end,
        rfr.created_at asc
      limit 1
      for update;

      if found then
        update public.reservation_refund_requests
        set
          stripe_refund_id = coalesce(stripe_refund_id, btrim(p_stripe_refund_id)),
          stripe_refund_status = coalesce(stripe_refund_status, p_stripe_status),
          amount_requested = greatest(amount_requested, v_amount)
        where id = v_request.id
        returning * into v_request;
      elsif v_amount > 0 then
        insert into public.reservation_refund_requests (
          hotel_id,
          reservation_id,
          actor_user_id,
          status,
          refund_reason,
          staff_note,
          amount_requested,
          currency,
          stripe_payment_intent_id,
          stripe_refund_id,
          stripe_refund_status,
          idempotency_key
        ) values (
          v_reservation.hotel_id,
          v_reservation.id,
          null,
          'processing',
          'manager_override',
          'Refund was created manually in Stripe Dashboard and reconciled by webhook.',
          v_amount,
          v_reservation.currency,
          v_reservation.stripe_payment_intent_id,
          btrim(p_stripe_refund_id),
          p_stripe_status,
          'stripe_manual_refund_' || btrim(p_stripe_refund_id)
        )
        returning * into v_request;
      end if;
    end if;
  end if;

  if v_request.id is null then
    return jsonb_build_object('ok', false, 'reason', 'REFUND_REQUEST_NOT_FOUND');
  end if;

  if p_stripe_status = 'failed' then
    v_result := public.fail_stripe_refund_request(
      v_request.id,
      coalesce(nullif(btrim(p_failure_reason), ''), 'Stripe reported the refund as failed.')
    );
  else
    v_result := public.complete_stripe_refund_request(
      v_request.id,
      p_stripe_refund_id,
      p_stripe_status,
      p_amount_refunded
    );
  end if;

  return v_result || jsonb_build_object(
    'stripe_payment_intent_id', coalesce(p_stripe_payment_intent_id, v_request.stripe_payment_intent_id),
    'matched_by', v_matched_by
  );
end;
$$;
