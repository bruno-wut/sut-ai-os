-- Stripe refund review workflow for staff-approved cancellation refunds.
-- Keeps cancellation, refund approval, Stripe idempotency, and webhook status
-- reconciliation auditable without exposing financial write paths to clients.

set lock_timeout = '10s';
set statement_timeout = '60s';

alter type public.notification_kind add value if not exists 'reservation_cancelled';
alter type public.notification_kind add value if not exists 'reservation_refund_processed';

do $$
begin
  create type public.reservation_refund_status as enum (
    'not_required',
    'pending',
    'processing',
    'succeeded',
    'failed',
    'cancelled'
  );
exception
  when duplicate_object then null;
end;
$$;

do $$
begin
  create type public.reservation_refund_reason as enum (
    'guest_requested',
    'force_majeure',
    'manager_override',
    'hotel_initiated',
    'duplicate_charge'
  );
exception
  when duplicate_object then null;
end;
$$;

alter table public.web_reservations
  add column if not exists refund_status public.reservation_refund_status not null default 'not_required',
  add column if not exists refund_eligible boolean not null default false,
  add column if not exists refund_max_amount numeric(12, 2) not null default 0,
  add column if not exists refund_status_note text,
  add column if not exists refund_updated_at timestamptz,
  add constraint web_reservations_refund_max_nonnegative
    check (refund_max_amount >= 0);

create table if not exists public.reservation_refund_requests (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  reservation_id uuid not null references public.web_reservations(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  status public.reservation_refund_status not null,
  refund_reason public.reservation_refund_reason not null,
  staff_note text,
  amount_requested numeric(12, 2) not null,
  amount_refunded numeric(12, 2) not null default 0,
  currency text not null default 'THB',
  stripe_payment_intent_id text not null,
  stripe_refund_id text,
  stripe_refund_status text,
  idempotency_key text not null,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_refund_requests_amount_requested_positive check (amount_requested > 0),
  constraint reservation_refund_requests_amount_refunded_nonnegative check (amount_refunded >= 0),
  constraint reservation_refund_requests_currency_upper check (currency = upper(currency) and currency ~ '^[A-Z]{3}$'),
  constraint reservation_refund_requests_stripe_pi_format check (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]{6,250}$'),
  constraint reservation_refund_requests_stripe_refund_format check (
    stripe_refund_id is null or stripe_refund_id ~ '^re_[A-Za-z0-9_]{6,250}$'
  ),
  constraint reservation_refund_requests_idempotency_unique unique (idempotency_key),
  constraint reservation_refund_requests_reservation_unique unique (reservation_id)
);

create index if not exists reservation_refund_requests_hotel_status_idx
  on public.reservation_refund_requests (hotel_id, status, created_at);
create index if not exists reservation_refund_requests_stripe_refund_idx
  on public.reservation_refund_requests (stripe_refund_id)
  where stripe_refund_id is not null;

drop trigger if exists reservation_refund_requests_set_updated_at
  on public.reservation_refund_requests;
create trigger reservation_refund_requests_set_updated_at
before update on public.reservation_refund_requests
for each row execute function public.set_updated_at();

alter table public.reservation_refund_requests enable row level security;

revoke all on table public.reservation_refund_requests from public, anon, authenticated;
grant select on table public.reservation_refund_requests to authenticated;
grant select, insert, update on table public.reservation_refund_requests to service_role;

drop policy if exists reservation_refund_requests_staff_select
  on public.reservation_refund_requests;
create policy reservation_refund_requests_staff_select
on public.reservation_refund_requests
for select
to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin', 'manager', 'front_desk']::public.staff_role[])
);

create or replace function private.cancel_reservation(
  p_reservation_id uuid,
  p_expected_version integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_before public.web_reservations%rowtype;
  v_after public.web_reservations%rowtype;
  v_operation_id uuid := gen_random_uuid();
  v_released_nights integer := 0;
  v_timezone text;
  v_local_now timestamp;
  v_refund_deadline timestamp;
  v_refund_eligible boolean := false;
  v_refund_max_amount numeric(12, 2) := 0;
  v_refund_status public.reservation_refund_status := 'not_required';
  v_refund_note text;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null or not public.staff_has_any_role(
    array['admin', 'manager', 'front_desk']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'This staff role cannot cancel reservations.';
  end if;

  if p_expected_version is null or nullif(btrim(p_reason), '') is null then
    raise exception using errcode = '22023', message = 'Expected version and cancellation reason are required.';
  end if;

  select wr.*
  into v_before
  from public.web_reservations wr
  join public.hotel_settings hs on hs.id = wr.hotel_id
  where wr.id = p_reservation_id
    and wr.hotel_id = v_hotel_id
  for update;

  if not found then
    raise exception 'Reservation was not found for the current hotel.';
  end if;

  if v_before.sync_status = 'Cancelled' then
    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'reservation_id', v_before.id,
      'sync_status', v_before.sync_status,
      'edit_version', v_before.edit_version,
      'refund_status', v_before.refund_status
    );
  end if;

  if v_before.edit_version <> p_expected_version then
    raise exception using errcode = 'P0001', message = 'RESERVATION_VERSION_CONFLICT';
  end if;

  select hs.timezone
  into v_timezone
  from public.hotel_settings hs
  where hs.id = v_before.hotel_id;

  v_local_now := now() at time zone coalesce(v_timezone, 'Asia/Bangkok');
  v_refund_deadline := v_before.check_in_date::timestamp - interval '1 day';
  v_refund_eligible :=
    v_before.payment_mode = 'stripe'
    and v_before.payment_status = 'collected'
    and v_before.total_paid > 0
    and v_before.stripe_payment_intent_id is not null
    and v_local_now < v_refund_deadline;

  if v_refund_eligible then
    v_refund_status := 'pending';
    v_refund_max_amount := v_before.total_paid;
    v_refund_note := 'Refund review in progress.';
  elsif v_before.payment_mode = 'stripe'
        and v_before.payment_status = 'collected'
        and v_before.total_paid > 0 then
    v_refund_note := 'Past the standard cancellation window; no automatic refund is due.';
  elsif v_before.payment_status = 'not_collected' then
    v_refund_note := 'No online payment was collected; no refund is due.';
  else
    v_refund_note := 'No Stripe refund is required for this cancellation.';
  end if;

  perform 1
  from public.reservation_room_nights rrn
  where rrn.reservation_id = v_before.id
    and rrn.status = 'active'
  order by rrn.stay_date, rrn.room_position
  for update;

  update public.physical_room_allotments pra
  set is_booked = false, booked_reservation_id = null
  where pra.booked_reservation_id = v_before.id
    and pra.is_booked;

  update public.reservation_room_nights
  set status = 'cancelled', released_at = now()
  where reservation_id = v_before.id
    and status = 'active';
  get diagnostics v_released_nights = row_count;

  update public.room_shuffle_plans
  set status = 'cancelled'
  where reservation_id = v_before.id
    and status in ('proposed', 'required');

  update public.web_reservations
  set
    sync_status = 'Cancelled',
    synced_at = null,
    cancelled_at = now(),
    amount_due = case
      when payment_mode = 'pay_at_hotel' and payment_status = 'not_collected' then 0
      else amount_due
    end,
    payment_adjustment_required = v_refund_status = 'pending',
    payment_adjustment_amount = case
      when v_refund_status = 'pending' then -v_refund_max_amount
      else 0
    end,
    refund_status = v_refund_status,
    refund_eligible = v_refund_eligible,
    refund_max_amount = v_refund_max_amount,
    refund_status_note = v_refund_note,
    refund_updated_at = now(),
    edit_version = edit_version + 1
  where id = v_before.id
  returning * into v_after;

  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'cancellation', 'sync_status',
    to_jsonb(v_before.sync_status), to_jsonb(v_after.sync_status), p_reason, false, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'cancellation', 'amount_due',
    to_jsonb(v_before.amount_due), to_jsonb(v_after.amount_due), p_reason, false, v_after.edit_version
  );
  perform public.record_reservation_field_edit(
    v_after.hotel_id, v_after.id, v_operation_id, 'cancellation', 'payment_adjustment_amount',
    to_jsonb(v_before.payment_adjustment_amount), to_jsonb(v_after.payment_adjustment_amount), p_reason, false, v_after.edit_version
  );

  insert into public.reservation_sync_events (
    hotel_id, reservation_id, actor_user_id, from_status, to_status, reason
  ) values (
    v_after.hotel_id, v_after.id, auth.uid(), v_before.sync_status, 'Cancelled', btrim(p_reason)
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
    v_after.hotel_id,
    v_after.id,
    'reservation_cancelled',
    'email',
    lower(btrim(v_after.guest_email)),
    jsonb_build_object(
      'reservation_number', v_after.reservation_number,
      'check_in_date', v_after.check_in_date,
      'check_out_date', v_after.check_out_date,
      'rooms_requested', v_after.rooms_requested,
      'refund_eligible', v_refund_eligible,
      'refund_status', v_refund_status,
      'refund_max_amount', v_refund_max_amount,
      'message', v_refund_note
    ),
    'reservation_cancelled:' || v_after.id::text
  )
  on conflict (idempotency_key) do nothing;

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'operation_id', v_operation_id,
    'reservation_id', v_after.id,
    'sync_status', v_after.sync_status,
    'edit_version', v_after.edit_version,
    'released_room_nights', v_released_nights,
    'payment_status', v_after.payment_status,
    'payment_adjustment_required', v_after.payment_adjustment_required,
    'payment_adjustment_amount', v_after.payment_adjustment_amount,
    'refund_status', v_after.refund_status,
    'refund_eligible', v_after.refund_eligible,
    'refund_max_amount', v_after.refund_max_amount
  );
end;
$$;

create or replace function public.create_stripe_refund_request(
  p_reservation_id uuid,
  p_refund_amount numeric,
  p_refund_reason public.reservation_refund_reason,
  p_staff_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hotel_id uuid;
  v_reservation public.web_reservations%rowtype;
  v_request public.reservation_refund_requests%rowtype;
  v_idempotency_key text;
begin
  v_hotel_id := public.current_staff_hotel_id();

  if v_hotel_id is null or not public.staff_has_any_role(
    array['admin', 'manager']::public.staff_role[]
  ) then
    raise exception using errcode = '42501', message = 'Manager or administrator access is required to issue refunds.';
  end if;

  if p_refund_amount is null or p_refund_amount <= 0 then
    raise exception using errcode = '22023', message = 'A positive refund amount is required.';
  end if;

  select wr.*
  into v_reservation
  from public.web_reservations wr
  where wr.id = p_reservation_id
    and wr.hotel_id = v_hotel_id
  for update;

  if not found then
    raise exception 'Reservation was not found for the current hotel.';
  end if;

  if v_reservation.sync_status <> 'Cancelled' then
    raise exception using errcode = 'P0001', message = 'RESERVATION_NOT_CANCELLED';
  end if;

  if v_reservation.payment_mode <> 'stripe'
     or v_reservation.payment_status <> 'collected'
     or v_reservation.stripe_payment_intent_id is null then
    raise exception using errcode = 'P0001', message = 'STRIPE_REFUND_NOT_AVAILABLE';
  end if;

  if v_reservation.refund_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'REFUND_NOT_PENDING';
  end if;

  if p_refund_amount > v_reservation.refund_max_amount then
    raise exception using errcode = 'P0001', message = 'REFUND_AMOUNT_EXCEEDS_AVAILABLE';
  end if;

  v_idempotency_key := 'refund_req_' || v_reservation.id::text;

  update public.web_reservations
  set
    refund_status = 'processing',
    refund_status_note = 'Stripe refund request submitted by staff.',
    refund_updated_at = now()
  where id = v_reservation.id;

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
    idempotency_key
  ) values (
    v_reservation.hotel_id,
    v_reservation.id,
    auth.uid(),
    'processing',
    p_refund_reason,
    nullif(btrim(coalesce(p_staff_note, '')), ''),
    p_refund_amount,
    v_reservation.currency,
    v_reservation.stripe_payment_intent_id,
    v_idempotency_key
  )
  returning * into v_request;

  return jsonb_build_object(
    'ok', true,
    'refund_request_id', v_request.id,
    'reservation_id', v_reservation.id,
    'reservation_number', v_reservation.reservation_number,
    'stripe_payment_intent_id', v_request.stripe_payment_intent_id,
    'amount', v_request.amount_requested,
    'amount_minor', round(v_request.amount_requested * 100)::integer,
    'currency', v_request.currency,
    'idempotency_key', v_request.idempotency_key,
    'refund_reason', v_request.refund_reason
  );
end;
$$;

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

create or replace function public.fail_stripe_refund_request(
  p_refund_request_id uuid,
  p_error_message text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reservation_refund_requests%rowtype;
begin
  if nullif(btrim(coalesce(p_error_message, '')), '') is null then
    raise exception 'A refund failure message is required.';
  end if;

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

  update public.reservation_refund_requests
  set
    status = 'failed',
    stripe_refund_status = coalesce(stripe_refund_status, 'failed'),
    failure_message = left(btrim(p_error_message), 500)
  where id = v_request.id;

  update public.web_reservations
  set
    refund_status = 'failed',
    refund_status_note = 'Stripe refund failed; manual repayment review is required.',
    refund_updated_at = now(),
    payment_adjustment_required = true,
    payment_adjustment_amount = -v_request.amount_requested
  where id = v_request.reservation_id;

  return jsonb_build_object(
    'ok', true,
    'refund_request_id', v_request.id,
    'reservation_id', v_request.reservation_id,
    'refund_status', 'failed'
  );
end;
$$;

create or replace function public.sync_stripe_refund_status(
  p_stripe_refund_id text,
  p_stripe_status text,
  p_failure_reason text default null,
  p_amount_refunded numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.reservation_refund_requests%rowtype;
  v_result jsonb;
begin
  if nullif(btrim(coalesce(p_stripe_refund_id, '')), '') is null then
    raise exception 'Stripe refund id is required.';
  end if;

  select rfr.*
  into v_request
  from public.reservation_refund_requests rfr
  where rfr.stripe_refund_id = btrim(p_stripe_refund_id)
  for update;

  if not found then
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

  return v_result;
end;
$$;

revoke all on function public.create_stripe_refund_request(
  uuid, numeric, public.reservation_refund_reason, text
) from public, anon, authenticated, service_role;
revoke all on function public.complete_stripe_refund_request(
  uuid, text, text, numeric
) from public, anon, authenticated, service_role;
revoke all on function public.fail_stripe_refund_request(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.sync_stripe_refund_status(text, text, text, numeric)
  from public, anon, authenticated, service_role;

grant execute on function public.create_stripe_refund_request(
  uuid, numeric, public.reservation_refund_reason, text
) to authenticated;
grant execute on function public.complete_stripe_refund_request(
  uuid, text, text, numeric
) to authenticated, service_role;
grant execute on function public.fail_stripe_refund_request(uuid, text)
  to authenticated, service_role;
grant execute on function public.sync_stripe_refund_status(text, text, text, numeric)
  to service_role;

comment on table public.reservation_refund_requests is
  'Audited staff-approved Stripe refund requests with idempotency keys, actor identity, exact amount, reason, and asynchronous provider status.';
comment on function public.create_stripe_refund_request(uuid, numeric, public.reservation_refund_reason, text) is
  'Locks a cancelled Stripe reservation in pending refund review and creates one auditable Stripe refund request for staff approval.';
comment on function public.sync_stripe_refund_status(text, text, text, numeric) is
  'Service-role Stripe webhook reconciliation for asynchronous refund status changes and failures.';
