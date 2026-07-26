-- Keep guest-facing room choices simple while preserving the existing
-- room-type-specific inventory, hold, and Hotel Tetris implementation.

set lock_timeout = '5s';
set statement_timeout = '30s';

create or replace function public.create_category_checkout_hold_with_context(
  p_check_in date,
  p_check_out date,
  p_room_category text,
  p_rooms_requested integer,
  p_adults integer,
  p_children integer,
  p_idempotency_key text,
  p_promo_code text,
  p_payment_mode public.booking_payment_mode,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_pdpa_consent boolean,
  p_marketing_consent boolean default false,
  p_terms_version text default null,
  p_privacy_policy_version text default null,
  p_cancellation_policy_version text default null,
  p_consent_ip_address text default null,
  p_consent_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category text := lower(btrim(coalesce(p_room_category, '')));
  v_existing public.checkout_holds%rowtype;
  v_room_type_id uuid;
  v_result jsonb;
begin
  if v_category not in ('classic', 'executive') then
    raise exception using errcode = '22023', message = 'Room category is not available.';
  end if;

  if p_check_in is null
     or p_check_out is null
     or p_check_out <= p_check_in
     or p_rooms_requested is null
     or p_rooms_requested <= 0 then
    raise exception using errcode = '22023', message = 'Checkout dates or room quantity are invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(btrim(p_idempotency_key), 1)
  );

  select ch.*
  into v_existing
  from public.checkout_holds ch
  where ch.idempotency_key = btrim(p_idempotency_key)
  for update;

  if found then
    select rt.id
    into v_room_type_id
    from public.room_types rt
    where rt.id = v_existing.room_type_id
      and (
        (v_category = 'classic' and rt.name in ('Classic Room (Double)', 'Classic Room (Twin)'))
        or
        (v_category = 'executive' and rt.name in ('Executive Room (Double)', 'Executive Room (Twin)'))
      );

    if v_room_type_id is null then
      raise exception using errcode = '22023', message = 'Idempotency key belongs to another room category.';
    end if;
  else
    with nightly_capacity as (
      select
        rt.id as room_type_id,
        pra.date,
        count(*) filter (
          where pra.is_available
            and not pra.is_booked
            and pra.group_block_id is null
            and (pra.hold_id is null or pra.hold_expires_at <= now())
        )::integer as available_count
      from public.room_types rt
      join public.physical_room_allotments pra on pra.room_type_id = rt.id
      where rt.is_active
        and pra.date >= p_check_in
        and pra.date < p_check_out
        and (
          (v_category = 'classic' and rt.name in ('Classic Room (Double)', 'Classic Room (Twin)'))
          or
          (v_category = 'executive' and rt.name in ('Executive Room (Double)', 'Executive Room (Twin)'))
        )
      group by rt.id, pra.date
    ),
    eligible_types as (
      select nc.room_type_id
      from nightly_capacity nc
      group by nc.room_type_id
      having count(*) = (p_check_out - p_check_in)::integer
        and min(nc.available_count) >= p_rooms_requested
    )
    select et.room_type_id
    into v_room_type_id
    from eligible_types et
    order by md5(btrim(p_idempotency_key) || et.room_type_id::text)
    limit 1;

    if v_room_type_id is null then
      raise exception using errcode = 'P0001', message = 'INSUFFICIENT_INVENTORY';
    end if;
  end if;

  v_result := public.create_checkout_hold_with_context(
    p_check_in,
    p_check_out,
    v_room_type_id,
    p_rooms_requested,
    p_adults,
    p_children,
    p_idempotency_key,
    p_promo_code,
    p_payment_mode,
    p_customer_name,
    p_customer_email,
    p_customer_phone,
    p_pdpa_consent,
    p_marketing_consent,
    p_terms_version,
    p_privacy_policy_version,
    p_cancellation_policy_version,
    p_consent_ip_address,
    p_consent_user_agent
  );

  return v_result || jsonb_build_object('room_category', v_category);
end;
$$;

revoke all on function public.create_category_checkout_hold_with_context(
  date, date, text, integer, integer, integer, text, text,
  public.booking_payment_mode, text, text, text, boolean, boolean,
  text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.create_category_checkout_hold_with_context(
  date, date, text, integer, integer, integer, text, text,
  public.booking_payment_mode, text, text, text, boolean, boolean,
  text, text, text, text, text
) to service_role;

comment on function public.create_category_checkout_hold_with_context(
  date, date, text, integer, integer, integer, text, text,
  public.booking_payment_mode, text, text, text, boolean, boolean,
  text, text, text, text, text
) is
  'Server-only guest checkout entry point. Accepts Classic or Executive and deterministically randomizes Double/Twin allocation before invoking the atomic hold and Hotel Tetris engine.';

create or replace function public.search_guest_room_categories(
  p_check_in date,
  p_check_out date
)
returns table (
  category text,
  name text,
  nightly_price numeric,
  image_url text,
  available_count integer
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_hotel_id uuid;
  v_settings public.hotel_settings%rowtype;
  v_operational_date date;
begin
  select hs.* into v_settings
  from public.hotel_settings hs
  where hs.setup_completed_at is not null
  order by hs.created_at
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'Hotel inventory is not configured.';
  end if;

  v_hotel_id := v_settings.id;
  v_operational_date := public.hotel_operational_date(v_hotel_id);

  if p_check_in is null
     or p_check_out is null
     or p_check_out <= p_check_in
     or p_check_in < v_operational_date
     or p_check_out > v_operational_date + v_settings.inventory_horizon_days then
    raise exception using errcode = '22023', message = 'Stay dates are outside the booking window.';
  end if;

  return query
  with category_types as (
    select
      rt.id,
      case
        when rt.name in ('Classic Room (Double)', 'Classic Room (Twin)') then 'classic'
        when rt.name in ('Executive Room (Double)', 'Executive Room (Twin)') then 'executive'
      end as guest_category,
      rt.base_nightly_rate,
      rt.image_url
    from public.room_types rt
    where rt.hotel_id = v_hotel_id
      and rt.is_active
      and rt.name in (
        'Classic Room (Double)', 'Classic Room (Twin)',
        'Executive Room (Double)', 'Executive Room (Twin)'
      )
  ),
  type_capacity as (
    select
      ct.guest_category,
      ct.id,
      ct.base_nightly_rate,
      ct.image_url,
      min(nightly.available_count)::integer as available_count
    from category_types ct
    join lateral (
      select
        pra.date,
        count(*) filter (
          where pra.is_available
            and not pra.is_booked
            and pra.group_block_id is null
            and (pra.hold_id is null or pra.hold_expires_at <= now())
        )::integer as available_count
      from public.physical_room_allotments pra
      where pra.room_type_id = ct.id
        and pra.date >= p_check_in
        and pra.date < p_check_out
      group by pra.date
    ) nightly on true
    group by ct.guest_category, ct.id, ct.base_nightly_rate, ct.image_url
    having count(*) = (p_check_out - p_check_in)::integer
  )
  select
    tc.guest_category,
    initcap(tc.guest_category) || ' Room',
    min(tc.base_nightly_rate),
    min(tc.image_url),
    max(tc.available_count)::integer
  from type_capacity tc
  group by tc.guest_category
  order by tc.guest_category;
end;
$$;

revoke all on function public.search_guest_room_categories(date, date) from public;
grant execute on function public.search_guest_room_categories(date, date) to anon, authenticated;

comment on function public.search_guest_room_categories(date, date) is
  'Public-safe Classic/Executive availability summary. Double/Twin room types and room-level inventory remain private.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
