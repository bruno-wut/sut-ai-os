-- Hotel Inventory Bridge: PDPA consent capture, legal policy versions, and
-- configurable retention controls.

set lock_timeout = '5s';
set statement_timeout = '60s';

create type public.legal_policy_kind as enum (
  'terms',
  'privacy_policy',
  'cancellation_policy'
);

alter table public.hotel_settings
  add column legal_terms_version text not null default '2026-06-01',
  add column legal_privacy_policy_version text not null default '2026-06-01',
  add column legal_cancellation_policy_version text not null default '2026-06-01',
  add column consent_retention_months integer not null default 84,
  add column booking_pii_retention_months integer not null default 84,
  add column abandoned_hold_retention_days integer not null default 30,
  add constraint hotel_settings_legal_terms_version_not_blank
    check (btrim(legal_terms_version) <> ''),
  add constraint hotel_settings_legal_privacy_policy_version_not_blank
    check (btrim(legal_privacy_policy_version) <> ''),
  add constraint hotel_settings_legal_cancellation_policy_version_not_blank
    check (btrim(legal_cancellation_policy_version) <> ''),
  add constraint hotel_settings_consent_retention_range
    check (consent_retention_months between 12 and 120),
  add constraint hotel_settings_booking_pii_retention_range
    check (booking_pii_retention_months between 12 and 120),
  add constraint hotel_settings_abandoned_hold_retention_range
    check (abandoned_hold_retention_days between 1 and 365);

create table public.legal_policy_documents (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  policy_kind public.legal_policy_kind not null,
  version text not null,
  title text not null,
  body_markdown text not null,
  effective_at timestamptz not null default now(),
  is_active boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint legal_policy_documents_version_not_blank check (btrim(version) <> ''),
  constraint legal_policy_documents_title_not_blank check (btrim(title) <> ''),
  constraint legal_policy_documents_body_not_blank check (btrim(body_markdown) <> ''),
  constraint legal_policy_documents_hotel_kind_version_unique unique (
    hotel_id,
    policy_kind,
    version
  )
);

create unique index legal_policy_documents_one_active_kind_idx
  on public.legal_policy_documents (hotel_id, policy_kind)
  where is_active;

create trigger legal_policy_documents_set_updated_at
before update on public.legal_policy_documents
for each row execute function public.set_updated_at();

alter table public.checkout_holds
  add column customer_name text,
  add column customer_email text,
  add column customer_phone text,
  add column terms_version text,
  add column privacy_policy_version text,
  add column cancellation_policy_version text,
  add column pdpa_consent boolean not null default false,
  add column marketing_consent boolean not null default false,
  add column consent_timestamp timestamptz,
  add column consent_ip_address text,
  add column consent_user_agent text,
  add constraint checkout_holds_customer_email_format check (
    customer_email is null or position('@' in customer_email) > 1
  ),
  add constraint checkout_holds_consent_versions_present check (
    (
      pdpa_consent is false
      and consent_timestamp is null
    )
    or (
      pdpa_consent is true
      and consent_timestamp is not null
      and nullif(btrim(terms_version), '') is not null
      and nullif(btrim(privacy_policy_version), '') is not null
      and nullif(btrim(cancellation_policy_version), '') is not null
      and nullif(btrim(customer_name), '') is not null
      and nullif(btrim(customer_email), '') is not null
      and nullif(btrim(customer_phone), '') is not null
    )
  );

alter table public.web_reservations
  add column terms_version text,
  add column privacy_policy_version text,
  add column cancellation_policy_version text,
  add column pdpa_consent boolean not null default false,
  add column marketing_consent boolean not null default false,
  add column consent_timestamp timestamptz,
  add column consent_ip_address text,
  add column consent_user_agent text;

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  hold_id uuid references public.checkout_holds(id) on delete set null,
  reservation_id uuid references public.web_reservations(id) on delete cascade,
  guest_email text not null,
  terms_version text not null,
  privacy_policy_version text not null,
  cancellation_policy_version text not null,
  pdpa_consent boolean not null,
  marketing_consent boolean not null default false,
  consent_ip_address text,
  consent_user_agent text,
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint consent_records_guest_email_format check (position('@' in guest_email) > 1),
  constraint consent_records_required_consent_true check (pdpa_consent is true),
  constraint consent_records_terms_version_not_blank check (btrim(terms_version) <> ''),
  constraint consent_records_privacy_version_not_blank check (btrim(privacy_policy_version) <> ''),
  constraint consent_records_cancellation_version_not_blank check (btrim(cancellation_policy_version) <> ''),
  constraint consent_records_booking_reference_present check (
    hold_id is not null or reservation_id is not null
  )
);

create unique index consent_records_reservation_unique_idx
  on public.consent_records (reservation_id)
  where reservation_id is not null;

create index consent_records_hotel_accepted_idx
  on public.consent_records (hotel_id, accepted_at);

alter table public.legal_policy_documents enable row level security;
alter table public.consent_records enable row level security;

revoke all on table public.legal_policy_documents from public, anon, authenticated;
revoke all on table public.consent_records from public, anon, authenticated;

grant select on table public.legal_policy_documents to anon, authenticated;
grant select, insert, update on table public.legal_policy_documents to authenticated;
grant select on table public.consent_records to authenticated;

create policy legal_policy_documents_public_active_select
on public.legal_policy_documents
for select
to anon, authenticated
using (is_active);

create policy legal_policy_documents_staff_select
on public.legal_policy_documents
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create policy legal_policy_documents_manager_write
on public.legal_policy_documents
for all
to authenticated
using (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin', 'manager']::public.staff_role[])
)
with check (
  hotel_id = public.current_staff_hotel_id()
  and public.staff_has_any_role(array['admin', 'manager']::public.staff_role[])
);

create policy consent_records_staff_select
on public.consent_records
for select
to authenticated
using (hotel_id = public.current_staff_hotel_id());

create or replace function public.record_checkout_hold_consent(
  p_hold_token uuid,
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
  v_hold public.checkout_holds%rowtype;
  v_settings public.hotel_settings%rowtype;
  v_terms_version text;
  v_privacy_version text;
  v_cancellation_version text;
begin
  if p_hold_token is null then
    raise exception using errcode = '22023', message = 'Hold token is required.';
  end if;

  if p_pdpa_consent is not true then
    raise exception using errcode = '22023', message = 'PDPA and booking terms consent is required.';
  end if;

  if nullif(btrim(p_customer_name), '') is null
     or nullif(btrim(p_customer_email), '') is null
     or position('@' in p_customer_email) <= 1
     or nullif(btrim(p_customer_phone), '') is null then
    raise exception using errcode = '22023', message = 'Complete guest contact details are required for consent capture.';
  end if;

  select ch.*
  into v_hold
  from public.checkout_holds ch
  where ch.public_token = p_hold_token
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'HOLD_NOT_FOUND';
  end if;

  if v_hold.status <> 'active' or v_hold.expires_at <= now() then
    raise exception using errcode = 'P0001', message = 'HOLD_NOT_ACTIVE';
  end if;

  select hs.*
  into v_settings
  from public.hotel_settings hs
  where hs.id = v_hold.hotel_id;

  v_terms_version := coalesce(nullif(btrim(p_terms_version), ''), v_settings.legal_terms_version);
  v_privacy_version := coalesce(nullif(btrim(p_privacy_policy_version), ''), v_settings.legal_privacy_policy_version);
  v_cancellation_version := coalesce(nullif(btrim(p_cancellation_policy_version), ''), v_settings.legal_cancellation_policy_version);

  update public.checkout_holds
  set
    customer_name = btrim(p_customer_name),
    customer_email = lower(btrim(p_customer_email)),
    customer_phone = btrim(p_customer_phone),
    terms_version = v_terms_version,
    privacy_policy_version = v_privacy_version,
    cancellation_policy_version = v_cancellation_version,
    pdpa_consent = true,
    marketing_consent = coalesce(p_marketing_consent, false),
    consent_timestamp = now(),
    consent_ip_address = nullif(btrim(p_consent_ip_address), ''),
    consent_user_agent = nullif(left(btrim(coalesce(p_consent_user_agent, '')), 500), ''),
    updated_at = now()
  where id = v_hold.id
  returning * into v_hold;

  return jsonb_build_object(
    'ok', true,
    'hold_token', v_hold.public_token,
    'terms_version', v_hold.terms_version,
    'privacy_policy_version', v_hold.privacy_policy_version,
    'cancellation_policy_version', v_hold.cancellation_policy_version,
    'pdpa_consent', v_hold.pdpa_consent,
    'marketing_consent', v_hold.marketing_consent,
    'consent_timestamp', v_hold.consent_timestamp
  );
end;
$$;

create or replace function public.assert_checkout_hold_has_required_consent(
  p_hold_token uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hold public.checkout_holds%rowtype;
begin
  select ch.*
  into v_hold
  from public.checkout_holds ch
  where ch.public_token = p_hold_token;

  if not found then
    raise exception using errcode = 'P0001', message = 'HOLD_NOT_FOUND';
  end if;

  if v_hold.pdpa_consent is not true
     or v_hold.consent_timestamp is null
     or nullif(btrim(v_hold.terms_version), '') is null
     or nullif(btrim(v_hold.privacy_policy_version), '') is null
     or nullif(btrim(v_hold.cancellation_policy_version), '') is null then
    raise exception using errcode = 'P0001', message = 'REQUIRED_CONSENT_MISSING';
  end if;
end;
$$;

create or replace function public.copy_checkout_hold_consent_to_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.converted_reservation_id is null or new.pdpa_consent is not true then
    return new;
  end if;

  update public.web_reservations
  set
    terms_version = new.terms_version,
    privacy_policy_version = new.privacy_policy_version,
    cancellation_policy_version = new.cancellation_policy_version,
    pdpa_consent = new.pdpa_consent,
    marketing_consent = new.marketing_consent,
    consent_timestamp = new.consent_timestamp,
    consent_ip_address = new.consent_ip_address,
    consent_user_agent = new.consent_user_agent
  where id = new.converted_reservation_id;

  insert into public.consent_records (
    hotel_id,
    hold_id,
    reservation_id,
    guest_email,
    terms_version,
    privacy_policy_version,
    cancellation_policy_version,
    pdpa_consent,
    marketing_consent,
    consent_ip_address,
    consent_user_agent,
    accepted_at
  ) values (
    new.hotel_id,
    new.id,
    new.converted_reservation_id,
    new.customer_email,
    new.terms_version,
    new.privacy_policy_version,
    new.cancellation_policy_version,
    true,
    new.marketing_consent,
    new.consent_ip_address,
    new.consent_user_agent,
    new.consent_timestamp
  )
  on conflict do nothing;

  return new;
end;
$$;

create trigger checkout_holds_copy_consent_to_reservation
after update of converted_reservation_id on public.checkout_holds
for each row
when (
  new.converted_reservation_id is not null
  and old.converted_reservation_id is distinct from new.converted_reservation_id
)
execute function public.copy_checkout_hold_consent_to_reservation();

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
  v_payment_mode public.booking_payment_mode;
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

  return public.finalize_stripe_checkout_hold_legacy(
    p_hold_token,
    p_stripe_session_id,
    p_guest_name,
    p_guest_email,
    p_guest_phone,
    p_total_paid,
    p_currency,
    p_stripe_payment_intent_id
  );
end;
$$;

alter function public.finalize_pay_at_hotel_checkout_hold(uuid, text, text, text)
  rename to finalize_pay_at_hotel_checkout_hold_legacy;

revoke all on function public.finalize_pay_at_hotel_checkout_hold_legacy(uuid, text, text, text)
  from public, anon, authenticated, service_role;

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
begin
  perform public.assert_checkout_hold_has_required_consent(p_hold_token);

  return public.finalize_pay_at_hotel_checkout_hold_legacy(
    p_hold_token,
    p_guest_name,
    p_guest_email,
    p_guest_phone
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
    + v_edit_events_deleted;

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
    'orphaned_consent_records_deleted', v_orphaned_consent_records_deleted,
    'abandoned_holds_deleted', v_abandoned_holds_deleted,
    'job_runs_deleted', v_job_runs_deleted
  );
end;
$$;

revoke all on function public.record_checkout_hold_consent(
  uuid, text, text, text, boolean, boolean, text, text, text, text, text
) from public;
revoke all on function public.assert_checkout_hold_has_required_consent(uuid)
  from public, anon, authenticated;
revoke all on function public.copy_checkout_hold_consent_to_reservation()
  from public, anon, authenticated;
revoke all on function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) from public, anon, authenticated;
revoke all on function public.finalize_pay_at_hotel_checkout_hold(uuid, text, text, text)
  from public, anon, authenticated;

grant execute on function public.record_checkout_hold_consent(
  uuid, text, text, text, boolean, boolean, text, text, text, text, text
) to anon, authenticated;
grant execute on function public.finalize_paid_checkout_hold(
  uuid, text, text, text, text, numeric, text, text
) to service_role;
grant execute on function public.finalize_pay_at_hotel_checkout_hold(uuid, text, text, text)
  to service_role;

comment on table public.legal_policy_documents is
  'Versioned legal policy text approved for guest-facing terms, privacy, and cancellation documents.';
comment on table public.consent_records is
  'Append-only consent proof copied from checkout holds when a reservation is finalized.';
comment on function public.record_checkout_hold_consent(
  uuid, text, text, text, boolean, boolean, text, text, text, text, text
) is
  'Records guest identity, required PDPA consent, optional marketing consent, policy versions, IP, and user agent on an active checkout hold.';
comment on function public.run_hotel_retention_jobs() is
  'Daily worker that enforces configurable hotel retention across inventory, reservation audit history, orphaned consent records, abandoned holds, and background-job runs.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;
