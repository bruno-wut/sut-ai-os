-- Hotel Inventory Bridge: stateless guest booking lookup.
-- Adds a non-account lookup reference and a masked read RPC for the public
-- booking-status portal.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.web_reservations
  add column booking_reference_id text;

create unique index web_reservations_booking_reference_unique_idx
  on public.web_reservations (booking_reference_id)
  where booking_reference_id is not null;

alter table public.web_reservations
  add constraint web_reservations_booking_reference_format
    check (
      booking_reference_id is null
      or booking_reference_id ~ '^SUT-[A-F0-9]{16}$'
    ) not valid;

create or replace function public.generate_booking_reference_id()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
begin
  loop
    v_reference := 'SUT-' || upper(encode(extensions.gen_random_bytes(8), 'hex'));

    exit when not exists (
      select 1
      from public.web_reservations wr
      where wr.booking_reference_id = v_reference
    );
  end loop;

  return v_reference;
end;
$$;

alter table public.web_reservations
  alter column booking_reference_id set default public.generate_booking_reference_id();

create or replace function public.backfill_booking_reference_ids_batch(
  p_limit integer default 500
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer := 0;
begin
  if p_limit is null or p_limit < 1 or p_limit > 5000 then
    raise exception using errcode = '22023', message = 'Batch limit must be between 1 and 5000.';
  end if;

  with candidates as (
    select wr.id
    from public.web_reservations wr
    where wr.booking_reference_id is null
    order by wr.created_at, wr.id
    limit p_limit
    for update skip locked
  )
  update public.web_reservations wr
  set booking_reference_id = public.generate_booking_reference_id()
  from candidates
  where wr.id = candidates.id;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

create or replace function public.lookup_guest_reservation(
  p_booking_reference_id text,
  p_guest_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reference text;
  v_email text;
  v_reservation public.web_reservations%rowtype;
  v_public_status text;
  v_status_label text;
  v_payment_summary text;
begin
  v_reference := upper(btrim(coalesce(p_booking_reference_id, '')));
  v_email := lower(btrim(coalesce(p_guest_email, '')));

  if v_reference = ''
     or length(v_reference) > 64
     or v_email = ''
     or length(v_email) > 320
     or position('@' in v_email) <= 1 then
    raise exception using errcode = '22023', message = 'INVALID_LOOKUP_INPUT';
  end if;

  select wr.*
  into v_reservation
  from public.web_reservations wr
  where lower(wr.guest_email) = v_email
    and (
      wr.booking_reference_id = v_reference
      or upper(wr.reservation_number) = v_reference
    )
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'BOOKING_LOOKUP_NOT_FOUND';
  end if;

  v_public_status := case
    when v_reservation.sync_status = 'Cancelled' then 'cancelled'
    when v_reservation.sync_status = 'Synced'
      and v_reservation.check_out_date < current_date then 'completed'
    when v_reservation.sync_status = 'Synced' then 'confirmed'
    else 'pending'
  end;

  v_status_label := case v_public_status
    when 'pending' then 'Booking received'
    when 'confirmed' then 'Confirmed by hotel'
    when 'completed' then 'Stay completed'
    when 'cancelled' then 'Booking cancelled'
    else 'Booking received'
  end;

  v_payment_summary := case
    when v_reservation.payment_status = 'collected' then 'Payment collected'
    when v_reservation.payment_mode = 'pay_at_hotel'
      and v_reservation.payment_status = 'not_collected' then 'Payment due at hotel'
    when v_reservation.payment_status = 'refunded' then 'Payment refunded'
    else 'Payment pending'
  end;

  return jsonb_build_object(
    'bookingReferenceId', coalesce(v_reservation.booking_reference_id, v_reservation.reservation_number),
    'reservationNumber', v_reservation.reservation_number,
    'status', v_public_status,
    'statusLabel', v_status_label,
    'roomCategory', v_reservation.room_type,
    'rooms', v_reservation.rooms_requested,
    'checkInDate', v_reservation.check_in_date,
    'checkOutDate', v_reservation.check_out_date,
    'paymentMode', v_reservation.payment_mode,
    'paymentSummary', v_payment_summary,
    'updatedAt', v_reservation.updated_at,
    'hotel', jsonb_build_object(
      'name', 'Sri U-Thong Grand Hotel',
      'phone', '+66 35 501 290-3',
      'address', '19 Nangpim Road, Suphanburi, Thailand 72000'
    )
  );
end;
$$;

create or replace function public.enrich_notification_booking_lookup_context()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_booking_reference_id text;
begin
  if new.reservation_id is null then
    return new;
  end if;

  select coalesce(wr.booking_reference_id, wr.reservation_number)
  into v_booking_reference_id
  from public.web_reservations wr
  where wr.id = new.reservation_id;

  if v_booking_reference_id is null then
    return new;
  end if;

  new.payload := coalesce(new.payload, '{}'::jsonb) || jsonb_build_object(
    'booking_reference_id', v_booking_reference_id,
    'booking_lookup_path', '/lookup'
  );

  return new;
end;
$$;

create trigger notification_events_enrich_booking_lookup_context
before insert on public.notification_events
for each row execute function public.enrich_notification_booking_lookup_context();

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
  v_result jsonb;
  v_payment_mode public.booking_payment_mode;
  v_booking_reference_id text;
begin
  perform public.assert_checkout_hold_has_required_consent(p_hold_token);

  select ch.payment_mode
  into v_payment_mode
  from public.checkout_holds ch
  where ch.public_token = p_hold_token;

  if not found then
    raise exception using errcode = 'P0001', message = 'HOLD_NOT_FOUND';
  end if;

  if v_payment_mode <> 'stripe' then
    raise exception using errcode = 'P0001', message = 'PAYMENT_MODE_MISMATCH';
  end if;

  v_result := public.finalize_stripe_checkout_hold_legacy(
    p_hold_token,
    p_stripe_session_id,
    p_guest_name,
    p_guest_email,
    p_guest_phone,
    p_total_paid,
    p_currency,
    p_stripe_payment_intent_id
  );

  select coalesce(wr.booking_reference_id, wr.reservation_number)
  into v_booking_reference_id
  from public.web_reservations wr
  where wr.id = (v_result->>'reservation_id')::uuid;

  return v_result || jsonb_build_object(
    'booking_reference_id', v_booking_reference_id
  );
end;
$$;

create or replace function public.finalize_pay_at_hotel_checkout_hold(
  p_hold_token uuid,
  p_guest_name text,
  p_guest_email text,
  p_guest_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
  v_booking_reference_id text;
begin
  perform public.assert_checkout_hold_has_required_consent(p_hold_token);

  v_result := public.finalize_pay_at_hotel_checkout_hold_legacy(
    p_hold_token,
    p_guest_name,
    p_guest_email,
    p_guest_phone
  );

  select coalesce(wr.booking_reference_id, wr.reservation_number)
  into v_booking_reference_id
  from public.web_reservations wr
  where wr.id = (v_result->>'reservation_id')::uuid;

  return v_result || jsonb_build_object(
    'booking_reference_id', v_booking_reference_id
  );
end;
$$;

revoke all on function public.generate_booking_reference_id()
  from public, anon, authenticated;
revoke all on function public.backfill_booking_reference_ids_batch(integer)
  from public, anon, authenticated;
revoke all on function public.lookup_guest_reservation(text, text)
  from public, anon, authenticated;
revoke all on function public.enrich_notification_booking_lookup_context()
  from public, anon, authenticated;
revoke all on function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) from public, anon, authenticated;
revoke all on function public.finalize_pay_at_hotel_checkout_hold(uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.lookup_guest_reservation(text, text)
  to service_role;
grant execute on function public.backfill_booking_reference_ids_batch(integer)
  to service_role;
grant execute on function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) to service_role;
grant execute on function public.finalize_pay_at_hotel_checkout_hold(uuid, text, text, text)
  to service_role;

comment on column public.web_reservations.booking_reference_id is
  'Cryptographically generated guest-facing lookup reference. Use with guest email for stateless booking-status lookup.';
comment on function public.lookup_guest_reservation(text, text) is
  'Returns a masked, read-only booking status view when booking reference and guest email match exactly.';
comment on function public.backfill_booking_reference_ids_batch(integer) is
  'Bounded utility for assigning guest lookup references to older reservations without a full-table rewrite.';
comment on function public.enrich_notification_booking_lookup_context() is
  'Adds guest booking lookup reference context to reservation notification payloads.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
