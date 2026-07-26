-- Hotel Inventory Bridge: production hardening for retention PII scrubbing,
-- tenant-aware booking lookup contact details, and validated lookup constraints.
--
-- SOURCE OF TRUTH: this migration's run_hotel_retention_jobs() definition
-- supersedes the worker introduced by migration 014. Future retention changes
-- must replace the complete function defined below, not migration 014.

set lock_timeout = '5s';
set statement_timeout = '60s';

alter table public.hotel_settings
  add column public_contact_phone text not null default '+66 35 501 290-3',
  add column public_contact_address text not null default '19 Nangpim Road, Suphanburi, Thailand 72000',
  add constraint hotel_settings_public_contact_phone_not_blank
    check (btrim(public_contact_phone) <> ''),
  add constraint hotel_settings_public_contact_address_not_blank
    check (btrim(public_contact_address) <> '');

alter table public.web_reservations
  alter column guest_name drop not null,
  alter column guest_email drop not null,
  alter column guest_phone drop not null;

alter table public.consent_records
  alter column guest_email drop not null;

alter table public.web_reservations
  validate constraint web_reservations_booking_reference_format;

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
    raise exception using errcode = 'P0001', message = 'BOOKING_LOOKUP_NOT_FOUND';
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

create or replace function public.run_hotel_retention_jobs()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inventory_events_deleted integer := 0;
  v_sync_events_deleted integer := 0;
  v_payment_events_deleted integer := 0;
  v_edit_events_deleted integer := 0;
  v_notification_events_deleted integer := 0;
  v_reservation_pii_scrubbed integer := 0;
  v_consent_pii_scrubbed integer := 0;
  v_checkout_hold_pii_scrubbed integer := 0;
  v_orphaned_consent_records_deleted integer := 0;
  v_abandoned_holds_deleted integer := 0;
  v_total_audit_events_deleted integer := 0;
  v_job_runs_deleted integer := 0;
begin
  v_inventory_events_deleted := public.prune_inventory_change_events();

  delete from public.reservation_sync_events rse
  using public.hotel_settings hs
  where hs.id = rse.hotel_id
    and rse.created_at < now() - make_interval(months => hs.audit_retention_months);
  get diagnostics v_sync_events_deleted = row_count;

  delete from public.reservation_payment_events rpe
  using public.hotel_settings hs
  where hs.id = rpe.hotel_id
    and rpe.created_at < now() - make_interval(months => hs.audit_retention_months);
  get diagnostics v_payment_events_deleted = row_count;

  delete from public.reservation_edit_events ree
  using public.hotel_settings hs
  where hs.id = ree.hotel_id
    and ree.created_at < now() - make_interval(months => hs.audit_retention_months);
  get diagnostics v_edit_events_deleted = row_count;

  delete from public.notification_events ne
  using public.hotel_settings hs
  where hs.id = ne.hotel_id
    and ne.status in ('sent', 'failed', 'cancelled')
    and ne.created_at < now() - make_interval(months => hs.audit_retention_months);
  get diagnostics v_notification_events_deleted = row_count;

  update public.web_reservations wr
  set
    guest_name = null,
    guest_email = null,
    guest_phone = null,
    consent_ip_address = null,
    consent_user_agent = null,
    updated_at = now()
  from public.hotel_settings hs
  where hs.id = wr.hotel_id
    and wr.check_out_date < (now() - make_interval(months => hs.booking_pii_retention_months))::date
    and (
      wr.guest_name is not null
      or wr.guest_email is not null
      or wr.guest_phone is not null
      or wr.consent_ip_address is not null
      or wr.consent_user_agent is not null
    );
  get diagnostics v_reservation_pii_scrubbed = row_count;

  update public.consent_records cr
  set
    guest_email = null,
    consent_ip_address = null,
    consent_user_agent = null
  from public.hotel_settings hs
  where hs.id = cr.hotel_id
    and cr.accepted_at < now() - make_interval(months => hs.booking_pii_retention_months)
    and (
      cr.guest_email is not null
      or cr.consent_ip_address is not null
      or cr.consent_user_agent is not null
    );
  get diagnostics v_consent_pii_scrubbed = row_count;

  update public.checkout_holds ch
  set
    customer_name = null,
    customer_email = null,
    customer_phone = null,
    terms_version = null,
    privacy_policy_version = null,
    cancellation_policy_version = null,
    pdpa_consent = false,
    marketing_consent = false,
    consent_timestamp = null,
    consent_ip_address = null,
    consent_user_agent = null,
    updated_at = now()
  from public.hotel_settings hs
  where hs.id = ch.hotel_id
    and ch.created_at < now() - make_interval(months => hs.booking_pii_retention_months)
    and (ch.status <> 'active' or ch.converted_reservation_id is not null)
    and (
      ch.customer_name is not null
      or ch.customer_email is not null
      or ch.customer_phone is not null
      or ch.consent_ip_address is not null
      or ch.consent_user_agent is not null
    );
  get diagnostics v_checkout_hold_pii_scrubbed = row_count;

  delete from public.consent_records cr
  using public.hotel_settings hs
  where hs.id = cr.hotel_id
    and cr.reservation_id is null
    and cr.accepted_at < now() - make_interval(months => hs.consent_retention_months);
  get diagnostics v_orphaned_consent_records_deleted = row_count;

  delete from public.checkout_holds ch
  using public.hotel_settings hs
  where hs.id = ch.hotel_id
    and ch.status in ('expired', 'cancelled')
    and ch.updated_at < now() - make_interval(days => hs.abandoned_hold_retention_days);
  get diagnostics v_abandoned_holds_deleted = row_count;

  v_total_audit_events_deleted :=
    v_inventory_events_deleted
    + v_sync_events_deleted
    + v_payment_events_deleted
    + v_edit_events_deleted
    + v_notification_events_deleted;

  delete from public.background_job_runs
  where started_at < now() - interval '90 days';
  get diagnostics v_job_runs_deleted = row_count;

  return jsonb_build_object(
    'ok', true,
    'audit_events_deleted', v_total_audit_events_deleted,
    'inventory_events_deleted', v_inventory_events_deleted,
    'reservation_sync_events_deleted', v_sync_events_deleted,
    'reservation_payment_events_deleted', v_payment_events_deleted,
    'reservation_edit_events_deleted', v_edit_events_deleted,
    'notification_events_deleted', v_notification_events_deleted,
    'reservation_pii_scrubbed', v_reservation_pii_scrubbed,
    'consent_pii_scrubbed', v_consent_pii_scrubbed,
    'checkout_hold_pii_scrubbed', v_checkout_hold_pii_scrubbed,
    'orphaned_consent_records_deleted', v_orphaned_consent_records_deleted,
    'abandoned_holds_deleted', v_abandoned_holds_deleted,
    'job_runs_deleted', v_job_runs_deleted
  );
end;
$$;

revoke all on function public.lookup_guest_reservation(text, text)
  from public, anon, authenticated;
revoke all on function public.run_hotel_retention_jobs()
  from public, anon, authenticated;

grant execute on function public.lookup_guest_reservation(text, text)
  to service_role;
grant execute on function public.run_hotel_retention_jobs()
  to service_role;

comment on column public.hotel_settings.public_contact_phone is
  'Guest-facing phone number used in public booking lookup responses.';
comment on column public.hotel_settings.public_contact_address is
  'Guest-facing address used in public booking lookup responses.';
comment on function public.run_hotel_retention_jobs() is
  'Authoritative daily retention worker (supersedes migration 014). Enforces configurable retention across audit history, notification events, finalized reservation PII, consent PII, abandoned holds, and background-job runs.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
