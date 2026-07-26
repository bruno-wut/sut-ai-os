-- Hotel Inventory Bridge: durable, privacy-bounded Stripe webhook receipt and
-- outcome ledger. Rows are append-only; application access is RPC-only.

set lock_timeout = '5s';
set statement_timeout = '60s';

create table public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  stripe_event_id text not null,
  event_type text not null,
  checkout_session_id text,
  hold_token uuid,
  received_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  constraint stripe_webhook_events_event_id_unique unique (stripe_event_id),
  constraint stripe_webhook_events_event_id_format
    check (stripe_event_id ~ '^evt_[A-Za-z0-9_]{6,250}$'),
  constraint stripe_webhook_events_event_type_format
    check (event_type ~ '^[a-z0-9_.]{1,100}$'),
  constraint stripe_webhook_events_session_id_format
    check (
      checkout_session_id is null
      or checkout_session_id ~ '^cs_(test_|live_)?[A-Za-z0-9_]{6,250}$'
    ),
  constraint stripe_webhook_events_context_object
    check (jsonb_typeof(context) = 'object'),
  constraint stripe_webhook_events_context_size
    check (pg_column_size(context) <= 4096),
  constraint stripe_webhook_events_context_keys
    check (
      context - array[
        'livemode',
        'payment_status',
        'checkout_status',
        'currency',
        'amount_total_minor',
        'request_id'
      ] = '{}'::jsonb
    )
);

create table public.stripe_webhook_event_outcomes (
  id bigint generated always as identity primary key,
  webhook_event_id uuid not null
    references public.stripe_webhook_events(id) on delete cascade,
  processing_state text not null,
  review_code text,
  recorded_at timestamptz not null default now(),
  context jsonb not null default '{}'::jsonb,
  constraint stripe_webhook_event_outcomes_state
    check (processing_state in ('received', 'processed', 'manual_review', 'ignored')),
  constraint stripe_webhook_event_outcomes_review_code
    check (
      review_code is null
      or review_code ~ '^[A-Z0-9_]{1,80}$'
    ),
  constraint stripe_webhook_event_outcomes_review_required
    check (
      (processing_state = 'manual_review' and review_code is not null)
      or (processing_state <> 'manual_review')
    ),
  constraint stripe_webhook_event_outcomes_context_object
    check (jsonb_typeof(context) = 'object'),
  constraint stripe_webhook_event_outcomes_context_size
    check (pg_column_size(context) <= 4096),
  constraint stripe_webhook_event_outcomes_context_keys
    check (
      context - array[
        'idempotent',
        'reservation_id',
        'http_acknowledged',
        'retryable'
      ] = '{}'::jsonb
    ),
  constraint stripe_webhook_event_outcomes_unique_entry
    unique nulls not distinct (webhook_event_id, processing_state, review_code)
);

create index stripe_webhook_events_hotel_received_idx
  on public.stripe_webhook_events (hotel_id, received_at);

create index stripe_webhook_events_checkout_session_idx
  on public.stripe_webhook_events (checkout_session_id)
  where checkout_session_id is not null;

create index stripe_webhook_events_hold_token_idx
  on public.stripe_webhook_events (hold_token)
  where hold_token is not null;

create index stripe_webhook_event_outcomes_event_recorded_idx
  on public.stripe_webhook_event_outcomes (webhook_event_id, recorded_at);

alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_event_outcomes enable row level security;

revoke all on table public.stripe_webhook_events
  from public, anon, authenticated;
revoke all on table public.stripe_webhook_event_outcomes
  from public, anon, authenticated;
revoke all on sequence public.stripe_webhook_event_outcomes_id_seq
  from public, anon, authenticated;

create or replace function public.record_stripe_webhook_event(
  p_hotel_id uuid,
  p_stripe_event_id text,
  p_event_type text,
  p_processing_state text,
  p_checkout_session_id text default null,
  p_hold_token uuid default null,
  p_review_code text default null,
  p_event_context jsonb default '{}'::jsonb,
  p_outcome_context jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid;
  v_existing public.stripe_webhook_events%rowtype;
  v_valid_hold_token uuid;
  v_outcome_id bigint;
begin
  if p_hotel_id is null
     or not exists (
       select 1 from public.hotel_settings hs where hs.id = p_hotel_id
     ) then
    raise exception using errcode = '22023', message = 'INVALID_HOTEL';
  end if;

  if p_stripe_event_id is null
     or p_stripe_event_id !~ '^evt_[A-Za-z0-9_]{6,250}$'
     or p_event_type is null
     or p_event_type !~ '^[a-z0-9_.]{1,100}$'
     or p_processing_state not in ('received', 'processed', 'manual_review', 'ignored')
     or (
       p_checkout_session_id is not null
       and p_checkout_session_id !~ '^cs_(test_|live_)?[A-Za-z0-9_]{6,250}$'
     )
     or (
       p_review_code is not null
       and p_review_code !~ '^[A-Z0-9_]{1,80}$'
     )
     or (p_processing_state = 'manual_review' and p_review_code is null) then
    raise exception using errcode = '22023', message = 'INVALID_WEBHOOK_LEDGER_INPUT';
  end if;

  if jsonb_typeof(coalesce(p_event_context, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_event_context, '{}'::jsonb)) > 4096
     or coalesce(p_event_context, '{}'::jsonb) - array[
       'livemode', 'payment_status', 'checkout_status', 'currency',
       'amount_total_minor', 'request_id'
     ] <> '{}'::jsonb
     or jsonb_typeof(coalesce(p_outcome_context, '{}'::jsonb)) <> 'object'
     or pg_column_size(coalesce(p_outcome_context, '{}'::jsonb)) > 4096
     or coalesce(p_outcome_context, '{}'::jsonb) - array[
       'idempotent', 'reservation_id', 'http_acknowledged', 'retryable'
     ] <> '{}'::jsonb then
    raise exception using errcode = '22023', message = 'INVALID_WEBHOOK_LEDGER_CONTEXT';
  end if;

  select ch.public_token
  into v_valid_hold_token
  from public.checkout_holds ch
  where ch.hotel_id = p_hotel_id
    and ch.public_token = p_hold_token;

  insert into public.stripe_webhook_events (
    hotel_id,
    stripe_event_id,
    event_type,
    checkout_session_id,
    hold_token,
    context
  )
  values (
    p_hotel_id,
    p_stripe_event_id,
    p_event_type,
    p_checkout_session_id,
    v_valid_hold_token,
    coalesce(p_event_context, '{}'::jsonb)
  )
  on conflict (stripe_event_id) do nothing
  returning id into v_event_id;

  if v_event_id is null then
    select swe.*
    into v_existing
    from public.stripe_webhook_events swe
    where swe.stripe_event_id = p_stripe_event_id;

    if v_existing.hotel_id <> p_hotel_id
       or v_existing.event_type <> p_event_type
       or v_existing.checkout_session_id is distinct from p_checkout_session_id
       or v_existing.hold_token is distinct from v_valid_hold_token then
      raise exception using errcode = 'P0001', message = 'STRIPE_EVENT_ID_CONFLICT';
    end if;

    v_event_id := v_existing.id;
  end if;

  insert into public.stripe_webhook_event_outcomes (
    webhook_event_id,
    processing_state,
    review_code,
    context
  )
  values (
    v_event_id,
    p_processing_state,
    p_review_code,
    coalesce(p_outcome_context, '{}'::jsonb)
  )
  on conflict (webhook_event_id, processing_state, review_code) do nothing
  returning id into v_outcome_id;

  return jsonb_build_object(
    'ok', true,
    'event_id', v_event_id,
    'state', p_processing_state,
    'idempotent', v_outcome_id is null
  );
end;
$$;

revoke all on function public.record_stripe_webhook_event(
  uuid, text, text, text, text, uuid, text, jsonb, jsonb
) from public, anon, authenticated;

grant execute on function public.record_stripe_webhook_event(
  uuid, text, text, text, text, uuid, text, jsonb, jsonb
) to service_role;

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
  v_stripe_webhook_events_deleted integer := 0;
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

  delete from public.stripe_webhook_events swe
  using public.hotel_settings hs
  where hs.id = swe.hotel_id
    and swe.received_at < now() - make_interval(months => hs.audit_retention_months);
  get diagnostics v_stripe_webhook_events_deleted = row_count;

  update public.web_reservations wr
  set guest_name = null, guest_email = null, guest_phone = null,
      consent_ip_address = null, consent_user_agent = null, updated_at = now()
  from public.hotel_settings hs
  where hs.id = wr.hotel_id
    and wr.check_out_date < (now() - make_interval(months => hs.booking_pii_retention_months))::date
    and (wr.guest_name is not null or wr.guest_email is not null
      or wr.guest_phone is not null or wr.consent_ip_address is not null
      or wr.consent_user_agent is not null);
  get diagnostics v_reservation_pii_scrubbed = row_count;

  update public.consent_records cr
  set guest_email = null, consent_ip_address = null, consent_user_agent = null
  from public.hotel_settings hs
  where hs.id = cr.hotel_id
    and cr.accepted_at < now() - make_interval(months => hs.booking_pii_retention_months)
    and (cr.guest_email is not null or cr.consent_ip_address is not null
      or cr.consent_user_agent is not null);
  get diagnostics v_consent_pii_scrubbed = row_count;

  update public.checkout_holds ch
  set customer_name = null, customer_email = null, customer_phone = null,
      terms_version = null, privacy_policy_version = null,
      cancellation_policy_version = null, pdpa_consent = false,
      marketing_consent = false, consent_timestamp = null,
      consent_ip_address = null, consent_user_agent = null, updated_at = now()
  from public.hotel_settings hs
  where hs.id = ch.hotel_id
    and ch.created_at < now() - make_interval(months => hs.booking_pii_retention_months)
    and (ch.status <> 'active' or ch.converted_reservation_id is not null)
    and (ch.customer_name is not null or ch.customer_email is not null
      or ch.customer_phone is not null or ch.consent_ip_address is not null
      or ch.consent_user_agent is not null);
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

  v_total_audit_events_deleted := v_inventory_events_deleted
    + v_sync_events_deleted + v_payment_events_deleted + v_edit_events_deleted
    + v_notification_events_deleted + v_stripe_webhook_events_deleted;

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
    'stripe_webhook_events_deleted', v_stripe_webhook_events_deleted,
    'reservation_pii_scrubbed', v_reservation_pii_scrubbed,
    'consent_pii_scrubbed', v_consent_pii_scrubbed,
    'checkout_hold_pii_scrubbed', v_checkout_hold_pii_scrubbed,
    'orphaned_consent_records_deleted', v_orphaned_consent_records_deleted,
    'abandoned_holds_deleted', v_abandoned_holds_deleted,
    'job_runs_deleted', v_job_runs_deleted
  );
end;
$$;

revoke all on function public.run_hotel_retention_jobs()
  from public, anon, authenticated;
grant execute on function public.run_hotel_retention_jobs()
  to service_role;

comment on table public.stripe_webhook_events is
  'Append-only Stripe event receipt ledger. Stores identifiers and bounded non-PII context only; never raw payloads, signatures, guest details, card data, or secrets.';
comment on table public.stripe_webhook_event_outcomes is
  'Append-only processing outcome ledger for Stripe events, including durable terminal manual-review decisions.';
comment on column public.stripe_webhook_events.hold_token is
  'Checkout hold public token only when it matches this hotel; invalid or unknown tokens are recorded as null.';
comment on function public.record_stripe_webhook_event(
  uuid, text, text, text, text, uuid, text, jsonb, jsonb
) is
  'Service-role-only idempotent RPC that records a Stripe event receipt and append-only processing/manual-review outcome using allowlisted, non-PII context.';
comment on function public.run_hotel_retention_jobs() is
  'Authoritative daily retention worker (supersedes migration 018). Preserves all prior cleanup and adds Stripe webhook ledger pruning under audit_retention_months.';

notify pgrst, 'reload schema';

reset lock_timeout;
reset statement_timeout;;
