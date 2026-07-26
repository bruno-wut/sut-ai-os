-- Hotel Inventory Bridge: Stripe-confirmed reservation finalization.
-- The calling server must verify the Stripe webhook signature before invoking
-- this service-role-only function.

create sequence public.web_reservation_number_seq start with 1 increment by 1;
revoke all on sequence public.web_reservation_number_seq from public, anon, authenticated;

create or replace function public.finalize_paid_checkout_hold(
  p_hold_token uuid,
  p_stripe_session_id text,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text,
  p_total_paid numeric,
  p_currency text,
  p_stripe_payment_intent_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.checkout_holds%rowtype;
  v_reservation public.web_reservations%rowtype;
  v_room_type_name text;
  v_hotel_timezone text;
  v_expected_rows integer;
  v_verified_rows integer;
  v_updated_rows integer;
  v_reservation_id uuid;
  v_reservation_number text;
  v_sequence_number bigint;
  v_shuffle_plan_id uuid;
begin
  if p_hold_token is null or nullif(btrim(p_stripe_session_id), '') is null then
    raise exception using errcode = '22023', message = 'Hold token and Stripe session are required.';
  end if;

  if nullif(btrim(p_guest_name), '') is null
     or nullif(btrim(p_guest_email), '') is null
     or position('@' in p_guest_email) <= 1
     or nullif(btrim(p_guest_phone), '') is null then
    raise exception using errcode = '22023', message = 'Complete guest contact details are required.';
  end if;

  if p_total_paid is null or p_total_paid < 0
     or p_currency is null or upper(btrim(p_currency)) !~ '^[A-Z]{3}$' then
    raise exception using errcode = '22023', message = 'Payment amount or currency is invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_hold_token::text, 3)
  );

  select ch.*
  into v_hold
  from public.checkout_holds ch
  where ch.public_token = p_hold_token
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'HOLD_NOT_FOUND';
  end if;

  if v_hold.status = 'converted' then
    select wr.*
    into v_reservation
    from public.web_reservations wr
    where wr.id = v_hold.converted_reservation_id;

    if not found or v_reservation.stripe_session_id <> btrim(p_stripe_session_id) then
      raise exception using errcode = 'P0001', message = 'PAYMENT_IDEMPOTENCY_CONFLICT';
    end if;

    return jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'reservation_id', v_reservation.id,
      'reservation_number', v_reservation.reservation_number,
      'sync_status', v_reservation.sync_status,
      'assignment_status', v_reservation.assignment_status,
      'shuffle_plan_id', v_reservation.shuffle_plan_id,
      'message', 'Reservation Received & Processing (Awaiting PMS Confirmation).'
    );
  end if;

  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception using
      errcode = 'P0001',
      message = 'HOLD_NOT_ACTIVE',
      hint = 'Do not create a reservation; route the payment to manual review or refund handling.';
  end if;

  if v_hold.stripe_session_id is not null
     and v_hold.stripe_session_id <> btrim(p_stripe_session_id) then
    raise exception using errcode = 'P0001', message = 'STRIPE_SESSION_MISMATCH';
  end if;

  if exists (
    select 1
    from public.web_reservations wr
    where wr.stripe_session_id = btrim(p_stripe_session_id)
       or (
         p_stripe_payment_intent_id is not null
         and wr.stripe_payment_intent_id = btrim(p_stripe_payment_intent_id)
       )
  ) then
    raise exception using errcode = 'P0001', message = 'PAYMENT_ALREADY_USED';
  end if;

  if p_total_paid <> v_hold.total_amount
     or upper(btrim(p_currency)) <> v_hold.currency then
    raise exception using
      errcode = 'P0001',
      message = 'PAYMENT_TOTAL_MISMATCH',
      detail = format(
        'Expected %s %s for this hold.',
        v_hold.total_amount,
        v_hold.currency
      );
  end if;

  v_expected_rows :=
    v_hold.rooms_requested * (v_hold.check_out_date - v_hold.check_in_date)::integer;

  perform 1
  from public.physical_room_allotments pra
  join public.checkout_hold_room_nights chrn
    on chrn.allotment_id = pra.id
  where chrn.hold_id = v_hold.id
  order by pra.date, pra.room_id
  for update of pra;

  select count(*)::integer
  into v_verified_rows
  from public.checkout_hold_room_nights chrn
  join public.physical_room_allotments pra on pra.id = chrn.allotment_id
  where chrn.hold_id = v_hold.id
    and chrn.released_at is null
    and pra.hold_id = v_hold.id
    and pra.hold_expires_at = v_hold.expires_at
    and pra.hold_expires_at > now()
    and not pra.is_booked
    and pra.booked_reservation_id is null;

  if v_verified_rows <> v_expected_rows then
    raise exception using
      errcode = 'P0001',
      message = 'HOLD_OWNERSHIP_VERIFICATION_FAILED',
      hint = 'The database hold no longer owns every requested room-night.';
  end if;

  select rt.name, hs.timezone
  into v_room_type_name, v_hotel_timezone
  from public.room_types rt
  join public.hotel_settings hs on hs.id = rt.hotel_id
  where rt.id = v_hold.room_type_id
    and rt.hotel_id = v_hold.hotel_id;

  select rsp.id
  into v_shuffle_plan_id
  from public.room_shuffle_plans rsp
  where rsp.hold_id = v_hold.id
    and rsp.status = 'proposed'
  order by rsp.generated_at desc
  limit 1
  for update;

  v_sequence_number := nextval('public.web_reservation_number_seq');
  v_reservation_number := format(
    'WEB-%s-%s',
    to_char(now() at time zone v_hotel_timezone, 'YYYYMMDD'),
    lpad(
      v_sequence_number::text,
      greatest(8, length(v_sequence_number::text)),
      '0'
    )
  );

  insert into public.web_reservations (
    hotel_id,
    reservation_number,
    stripe_session_id,
    stripe_payment_intent_id,
    guest_name,
    guest_email,
    guest_phone,
    check_in_date,
    check_out_date,
    room_type_id,
    room_type,
    rooms_requested,
    adults,
    children,
    promo_code,
    assignment_status,
    assignments_finalized_at,
    total_paid,
    currency,
    room_shuffle_required,
    shuffle_plan_id,
    payment_received_at
  ) values (
    v_hold.hotel_id,
    v_reservation_number,
    btrim(p_stripe_session_id),
    nullif(btrim(p_stripe_payment_intent_id), ''),
    btrim(p_guest_name),
    lower(btrim(p_guest_email)),
    btrim(p_guest_phone),
    v_hold.check_in_date,
    v_hold.check_out_date,
    v_hold.room_type_id,
    v_room_type_name,
    v_hold.rooms_requested,
    v_hold.adults,
    v_hold.children,
    v_hold.promo_code,
    case
      when v_shuffle_plan_id is null then 'assigned'::public.reservation_assignment_status
      else 'shuffle_required'::public.reservation_assignment_status
    end,
    now(),
    p_total_paid,
    v_hold.currency,
    v_shuffle_plan_id is not null,
    v_shuffle_plan_id,
    now()
  )
  returning id into v_reservation_id;

  update public.physical_room_allotments pra
  set
    is_booked = true,
    booked_reservation_id = v_reservation_id,
    hold_id = null,
    hold_expires_at = null
  where pra.id in (
    select chrn.allotment_id
    from public.checkout_hold_room_nights chrn
    where chrn.hold_id = v_hold.id
  )
    and pra.hold_id = v_hold.id
    and pra.hold_expires_at = v_hold.expires_at
    and not pra.is_booked;

  get diagnostics v_updated_rows = row_count;

  if v_updated_rows <> v_expected_rows then
    raise exception 'Final booking row count changed during payment finalization.';
  end if;

  insert into public.reservation_room_nights (
    reservation_id,
    allotment_id,
    stay_date,
    room_position,
    room_id,
    room_type_id,
    nightly_price
  )
  select
    v_reservation_id,
    chrn.allotment_id,
    chrn.stay_date,
    chrn.room_position,
    chrn.room_id,
    v_hold.room_type_id,
    chrn.nightly_price
  from public.checkout_hold_room_nights chrn
  where chrn.hold_id = v_hold.id
  order by chrn.stay_date, chrn.room_position;

  update public.checkout_hold_room_nights
  set released_at = coalesce(released_at, now())
  where hold_id = v_hold.id;

  update public.checkout_holds
  set
    status = 'converted',
    converted_reservation_id = v_reservation_id,
    stripe_session_id = btrim(p_stripe_session_id)
  where id = v_hold.id
    and status = 'active';

  if v_shuffle_plan_id is not null then
    update public.room_shuffle_plans
    set
      reservation_id = v_reservation_id,
      status = 'required'
    where id = v_shuffle_plan_id
      and hold_id = v_hold.id;
  end if;

  insert into public.notification_events (
    hotel_id,
    reservation_id,
    kind,
    channel,
    recipient,
    payload,
    idempotency_key
  ) values (
    v_hold.hotel_id,
    v_reservation_id,
    'reservation_processing',
    'email',
    lower(btrim(p_guest_email)),
    jsonb_build_object(
      'reservation_number', v_reservation_number,
      'check_in_date', v_hold.check_in_date,
      'check_out_date', v_hold.check_out_date,
      'rooms_requested', v_hold.rooms_requested,
      'message', 'Reservation Received & Processing (Awaiting PMS Confirmation).'
    ),
    'reservation_processing:' || v_reservation_id::text
  );

  return jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'reservation_id', v_reservation_id,
    'reservation_number', v_reservation_number,
    'sync_status', 'Pending',
    'assignment_status', case
      when v_shuffle_plan_id is null then 'assigned'
      else 'shuffle_required'
    end,
    'shuffle_plan_id', v_shuffle_plan_id,
    'message', 'Reservation Received & Processing (Awaiting PMS Confirmation).'
  );
end;
$$;

revoke all on function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) from public, anon, authenticated;

grant execute on function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) to service_role;

comment on function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) is
  'Service-role-only Stripe finalizer that re-locks and verifies hold ownership immediately before creating a reservation and payment-processing notification.';
