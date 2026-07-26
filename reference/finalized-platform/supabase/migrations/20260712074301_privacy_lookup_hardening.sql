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
  v_hotel public.hotel_settings%rowtype;
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
    select wr.*
    into v_reservation
    from public.web_reservations wr
    where (
        wr.booking_reference_id = v_reference
        or upper(wr.reservation_number) = v_reference
      )
    limit 1;

    if found and v_reservation.guest_email is null then
      raise exception using errcode = 'P0001', message = 'BOOKING_LOOKUP_PII_SCRUBBED';
    else
      raise exception using errcode = 'P0001', message = 'BOOKING_LOOKUP_NOT_FOUND';
    end if;
  end if;

  select hs.*
  into v_hotel
  from public.hotel_settings hs
  where hs.id = v_reservation.hotel_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'HOTEL_NOT_FOUND';
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
      'name', v_hotel.hotel_name,
      'phone', v_hotel.public_contact_phone,
      'address', v_hotel.public_contact_address
    )
  );
end;
$$;
