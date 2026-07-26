-- Allow partial Stripe refunds to audit without changing the overall
-- reservation payment_status from collected to refunded.

create or replace function public.complete_stripe_refund_request(
  p_refund_request_id uuid,
  p_stripe_refund_id text,
  p_stripe_status text,
  p_amount_refunded numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reservation_refund_requests%rowtype;
  v_reservation public.web_reservations%rowtype;
  v_refund_status public.reservation_refund_status;
  v_amount_refunded numeric(12, 2);
  v_was_succeeded boolean;
begin
  select rfr.*
  into v_request
  from public.reservation_refund_requests rfr
  where rfr.id = p_refund_request_id
  for update;

  if not found then
    raise exception 'Refund request was not found.';
  end if;

  if auth.uid() is not null
     and not public.staff_has_any_role(array['admin', 'manager']::public.staff_role[]) then
    raise exception using errcode = '42501', message = 'Manager or administrator access is required.';
  end if;

  v_was_succeeded := v_request.status = 'succeeded';
  v_refund_status := case p_stripe_status
    when 'succeeded' then 'succeeded'::public.reservation_refund_status
    when 'failed' then 'failed'::public.reservation_refund_status
    when 'canceled' then 'cancelled'::public.reservation_refund_status
    else 'processing'::public.reservation_refund_status
  end;
  v_amount_refunded := coalesce(p_amount_refunded, case when v_refund_status = 'succeeded' then v_request.amount_requested else 0 end);

  update public.reservation_refund_requests
  set
    status = v_refund_status,
    stripe_refund_id = p_stripe_refund_id,
    stripe_refund_status = p_stripe_status,
    amount_refunded = greatest(amount_refunded, v_amount_refunded),
    failure_message = case when v_refund_status = 'failed' then failure_message else null end
  where id = v_request.id
  returning * into v_request;

  update public.web_reservations
  set
    refund_status = v_refund_status,
    refund_status_note = case v_refund_status
      when 'succeeded' then 'Stripe refund succeeded.'
      when 'failed' then 'Stripe refund failed; manual repayment review is required.'
      when 'cancelled' then 'Stripe refund was cancelled.'
      else 'Stripe refund is processing.'
    end,
    refund_updated_at = now(),
    payment_adjustment_required = v_refund_status in ('failed', 'processing'),
    payment_adjustment_amount = case
      when v_refund_status = 'succeeded' then 0
      else -v_request.amount_requested
    end,
    payment_status = case
      when v_refund_status = 'succeeded'
        and v_request.amount_refunded >= total_paid then 'refunded'::public.reservation_payment_status
      else payment_status
    end
  where id = v_request.reservation_id
  returning * into v_reservation;

  if v_refund_status = 'succeeded' and not v_was_succeeded then
    insert into public.reservation_payment_events (
      hotel_id,
      reservation_id,
      actor_user_id,
      event_kind,
      payment_mode,
      from_status,
      to_status,
      amount,
      currency,
      reason
    ) values (
      v_request.hotel_id,
      v_request.reservation_id,
      v_request.actor_user_id,
      'payment_refunded',
      'stripe',
      case when v_reservation.payment_status = 'refunded' then 'collected'::public.reservation_payment_status else null end,
      v_reservation.payment_status,
      v_request.amount_refunded,
      v_request.currency,
      v_request.refund_reason::text
    );

    insert into public.notification_events (
      hotel_id,
      reservation_id,
      kind,
      channel,
      recipient,
      payload,
      idempotency_key
    ) values (
      v_reservation.hotel_id,
      v_reservation.id,
      'reservation_refund_processed',
      'email',
      lower(btrim(v_reservation.guest_email)),
      jsonb_build_object(
        'reservation_number', v_reservation.reservation_number,
        'check_in_date', v_reservation.check_in_date,
        'check_out_date', v_reservation.check_out_date,
        'rooms_requested', v_reservation.rooms_requested,
        'refund_amount', v_request.amount_refunded,
        'refund_status', v_refund_status,
        'message', 'Stripe refund processed.'
      ),
      'reservation_refund_processed:' || v_request.id::text
    )
    on conflict (idempotency_key) do nothing;
  end if;

  return jsonb_build_object(
    'ok', true,
    'refund_request_id', v_request.id,
    'reservation_id', v_request.reservation_id,
    'refund_status', v_refund_status,
    'stripe_refund_id', v_request.stripe_refund_id,
    'amount_refunded', v_request.amount_refunded
  );
end;
$$;

revoke all on function public.complete_stripe_refund_request(
  uuid, text, text, numeric
) from public, anon, authenticated, service_role;
grant execute on function public.complete_stripe_refund_request(
  uuid, text, text, numeric
) to authenticated, service_role;
