-- Stripe reconciliation is performed only by the server-side refund action and
-- webhook/reconciliation path. Staff can create a reviewed refund request but
-- must never be able to mark a Stripe refund complete or failed via PostgREST.

revoke all on function public.complete_stripe_refund_request(
  uuid, text, text, numeric
) from authenticated;

revoke all on function public.fail_stripe_refund_request(uuid, text)
  from authenticated;

grant execute on function public.complete_stripe_refund_request(
  uuid, text, text, numeric
) to service_role;

grant execute on function public.fail_stripe_refund_request(uuid, text)
  to service_role;
