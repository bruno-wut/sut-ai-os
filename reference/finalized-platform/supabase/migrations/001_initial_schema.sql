-- Hotel Inventory Bridge: foundational relational schema
-- Business operations, RLS policies, and scheduled jobs are added in later migrations.

create extension if not exists pgcrypto with schema extensions;

create type public.reservation_sync_status as enum (
  'Pending',
  'Synced',
  'Cancelled'
);

create type public.checkout_hold_status as enum (
  'active',
  'converted',
  'expired',
  'cancelled'
);

create type public.assignment_status as enum (
  'active',
  'moved',
  'cancelled'
);

create type public.reservation_assignment_status as enum (
  'pending',
  'assigned',
  'shuffle_required'
);

create type public.inventory_generation_status as enum (
  'running',
  'completed',
  'failed'
);

create type public.shuffle_plan_status as enum (
  'proposed',
  'required',
  'completed',
  'cancelled'
);

create type public.notification_kind as enum (
  'reservation_processing',
  'reservation_confirmed',
  'pending_staff_alert',
  'sla_escalation',
  'background_job_failure',
  'inventory_coverage_gap'
);

create type public.notification_channel as enum (
  'email',
  'webhook_sms'
);

create type public.notification_delivery_status as enum (
  'pending',
  'processing',
  'sent',
  'failed',
  'cancelled'
);

create table public.hotel_settings (
  id uuid primary key default gen_random_uuid(),
  hotel_name text not null default 'Sri U-Thong Grand Hotel',
  timezone text not null default 'Asia/Bangkok',
  operational_day_rollover time without time zone not null default time '04:00',
  inventory_horizon_days integer not null default 365,
  checkout_hold_minutes integer not null default 15,
  pending_staff_alert_minutes integer not null default 120,
  pending_warning_minutes integer not null default 120,
  pending_escalation_minutes integer not null default 240,
  audit_retention_months integer not null default 24,
  currency text not null default 'THB',
  management_email text,
  staff_alert_email text,
  management_webhook_url text,
  setup_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint hotel_settings_name_not_blank check (btrim(hotel_name) <> ''),
  constraint hotel_settings_timezone_not_blank check (btrim(timezone) <> ''),
  constraint hotel_settings_inventory_horizon_positive check (inventory_horizon_days > 0),
  constraint hotel_settings_hold_minutes_positive check (checkout_hold_minutes > 0),
  constraint hotel_settings_sla_order check (
    pending_staff_alert_minutes > 0
    and pending_warning_minutes >= pending_staff_alert_minutes
    and pending_escalation_minutes > pending_warning_minutes
  ),
  constraint hotel_settings_audit_retention_range check (
    audit_retention_months between 12 and 24
  ),
  constraint hotel_settings_currency_format check (currency ~ '^[A-Z]{3}$')
);

create table public.inventory_generation_runs (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  range_start date not null,
  range_end_exclusive date not null,
  status public.inventory_generation_status not null default 'running',
  expected_rows integer not null default 0,
  generated_rows integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint inventory_generation_runs_dates_valid check (range_end_exclusive > range_start),
  constraint inventory_generation_runs_counts_nonnegative check (
    expected_rows >= 0 and generated_rows >= 0
  ),
  constraint inventory_generation_runs_completion_consistency check (
    (status = 'running' and completed_at is null and error_message is null)
    or (status = 'completed' and completed_at is not null and error_message is null)
    or (status = 'failed' and completed_at is not null and error_message is not null)
  )
);

create index inventory_generation_runs_hotel_started_idx
  on public.inventory_generation_runs (hotel_id, started_at desc);

create table public.room_types (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  code text not null,
  name text not null,
  base_nightly_rate numeric(12, 2) not null,
  image_url text not null default '/images/grand-superior-room.jpg',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint room_types_code_not_blank check (btrim(code) <> ''),
  constraint room_types_name_not_blank check (btrim(name) <> ''),
  constraint room_types_image_url_not_blank check (btrim(image_url) <> ''),
  constraint room_types_image_url_format check (
    image_url ~ '^/images/[A-Za-z0-9._/-]+$'
    or image_url ~ '^https://imagedelivery[.]net/[^[:space:]]+$'
  ),
  constraint room_types_rate_nonnegative check (base_nightly_rate >= 0),
  constraint room_types_hotel_code_unique unique (hotel_id, code),
  constraint room_types_hotel_id_id_unique unique (hotel_id, id),
  constraint room_types_hotel_id_id_name_unique unique (hotel_id, id, name)
);

create unique index room_types_hotel_name_unique
  on public.room_types (hotel_id, lower(name));

create table public.physical_rooms (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  room_type_id uuid not null,
  room_number text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint physical_rooms_number_not_blank check (btrim(room_number) <> ''),
  constraint physical_rooms_hotel_number_unique unique (hotel_id, room_number),
  constraint physical_rooms_hotel_id_id_unique unique (hotel_id, id),
  constraint physical_rooms_identity_unique unique (
    hotel_id,
    id,
    room_type_id,
    room_number
  ),
  constraint physical_rooms_room_type_fk
    foreign key (hotel_id, room_type_id)
    references public.room_types(hotel_id, id)
    on delete restrict
);

create index physical_rooms_room_type_idx
  on public.physical_rooms (hotel_id, room_type_id)
  where is_active;

create table public.group_blocks (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  name text not null,
  promo_code text not null,
  valid_from date not null,
  valid_to_exclusive date not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint group_blocks_name_not_blank check (btrim(name) <> ''),
  constraint group_blocks_promo_code_not_blank check (btrim(promo_code) <> ''),
  constraint group_blocks_dates_valid check (valid_to_exclusive > valid_from),
  constraint group_blocks_hotel_id_id_unique unique (hotel_id, id)
);

create unique index group_blocks_hotel_promo_code_unique
  on public.group_blocks (hotel_id, upper(promo_code));

create index group_blocks_active_dates_idx
  on public.group_blocks (hotel_id, valid_from, valid_to_exclusive)
  where is_active;

create table public.physical_room_allotments (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  room_id uuid not null,
  room_type_id uuid not null,
  date date not null,
  room_number text not null,
  room_type text not null,
  nightly_price numeric(12, 2) not null,
  is_available boolean not null default true,
  is_booked boolean not null default false,
  hold_expires_at timestamptz,
  hold_id uuid,
  booked_reservation_id uuid,
  group_block_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint physical_room_allotments_room_number_not_blank check (btrim(room_number) <> ''),
  constraint physical_room_allotments_room_type_not_blank check (btrim(room_type) <> ''),
  constraint physical_room_allotments_price_nonnegative check (nightly_price >= 0),
  constraint physical_room_allotments_date_room_number_unique unique (date, room_number),
  constraint physical_room_allotments_date_room_unique unique (date, room_id),
  constraint physical_room_allotments_room_fk
    foreign key (hotel_id, room_id, room_type_id, room_number)
    references public.physical_rooms(hotel_id, id, room_type_id, room_number)
    on update cascade
    on delete restrict,
  constraint physical_room_allotments_room_type_fk
    foreign key (hotel_id, room_type_id, room_type)
    references public.room_types(hotel_id, id, name)
    on update cascade
    on delete restrict,
  constraint physical_room_allotments_group_block_fk
    foreign key (hotel_id, group_block_id)
    references public.group_blocks(hotel_id, id)
    on delete restrict,
  constraint physical_room_allotments_group_block_private check (
    group_block_id is null or not is_available
  ),
  constraint physical_room_allotments_booking_consistency check (
    (is_booked and booked_reservation_id is not null and hold_id is null and hold_expires_at is null)
    or
    (not is_booked and booked_reservation_id is null)
  ),
  constraint physical_room_allotments_hold_consistency check (
    (hold_id is null and hold_expires_at is null)
    or
    (hold_id is not null and hold_expires_at is not null and not is_booked)
  )
);

create index physical_room_allotments_search_idx
  on public.physical_room_allotments (hotel_id, room_type_id, date, room_id)
  where is_available and not is_booked;

create index physical_room_allotments_expiring_holds_idx
  on public.physical_room_allotments (hold_expires_at)
  where hold_id is not null;

create table public.web_reservations (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete restrict,
  reservation_number text not null,
  stripe_session_id text not null,
  stripe_payment_intent_id text,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  check_in_date date not null,
  check_out_date date not null,
  room_type_id uuid not null,
  room_type text not null,
  rooms_requested integer not null default 1,
  adults integer not null default 1,
  children integer not null default 0,
  promo_code text,
  assignment_status public.reservation_assignment_status not null default 'pending',
  assignments_finalized_at timestamptz,
  total_paid numeric(12, 2) not null,
  currency text not null default 'THB',
  sync_status public.reservation_sync_status not null default 'Pending',
  room_shuffle_required boolean not null default false,
  payment_received_at timestamptz not null default now(),
  synced_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint web_reservations_number_unique unique (reservation_number),
  constraint web_reservations_stripe_session_unique unique (stripe_session_id),
  constraint web_reservations_stripe_payment_intent_unique unique (stripe_payment_intent_id),
  constraint web_reservations_dates_valid check (check_out_date > check_in_date),
  constraint web_reservations_room_type_not_blank check (btrim(room_type) <> ''),
  constraint web_reservations_rooms_positive check (rooms_requested > 0),
  constraint web_reservations_adults_positive check (adults > 0),
  constraint web_reservations_children_nonnegative check (children >= 0),
  constraint web_reservations_total_nonnegative check (total_paid >= 0),
  constraint web_reservations_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint web_reservations_assignment_consistency check (
    (assignment_status = 'pending' and assignments_finalized_at is null)
    or (assignment_status in ('assigned', 'shuffle_required') and assignments_finalized_at is not null)
  ),
  constraint web_reservations_sync_timestamps check (
    (sync_status = 'Pending' and synced_at is null and cancelled_at is null)
    or (sync_status = 'Synced' and synced_at is not null and cancelled_at is null)
    or (sync_status = 'Cancelled' and cancelled_at is not null)
  ),
  constraint web_reservations_room_type_fk
    foreign key (hotel_id, room_type_id, room_type)
    references public.room_types(hotel_id, id, name)
    on update cascade
    on delete restrict
);

create index web_reservations_pending_sla_idx
  on public.web_reservations (created_at)
  where sync_status = 'Pending';

create index web_reservations_guest_email_idx
  on public.web_reservations (lower(guest_email));

create table public.checkout_holds (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  room_type_id uuid not null,
  public_token uuid not null default gen_random_uuid(),
  idempotency_key text not null,
  stripe_session_id text,
  check_in_date date not null,
  check_out_date date not null,
  rooms_requested integer not null,
  adults integer not null default 1,
  children integer not null default 0,
  promo_code text,
  total_amount numeric(12, 2) not null,
  currency text not null default 'THB',
  status public.checkout_hold_status not null default 'active',
  expires_at timestamptz not null,
  converted_reservation_id uuid references public.web_reservations(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint checkout_holds_public_token_unique unique (public_token),
  constraint checkout_holds_idempotency_key_unique unique (idempotency_key),
  constraint checkout_holds_stripe_session_unique unique (stripe_session_id),
  constraint checkout_holds_dates_valid check (check_out_date > check_in_date),
  constraint checkout_holds_rooms_positive check (rooms_requested > 0),
  constraint checkout_holds_adults_positive check (adults > 0),
  constraint checkout_holds_children_nonnegative check (children >= 0),
  constraint checkout_holds_total_nonnegative check (total_amount >= 0),
  constraint checkout_holds_currency_format check (currency ~ '^[A-Z]{3}$'),
  constraint checkout_holds_expiry_after_creation check (expires_at > created_at),
  constraint checkout_holds_conversion_consistency check (
    (status = 'converted' and converted_reservation_id is not null)
    or (status <> 'converted' and converted_reservation_id is null)
  ),
  constraint checkout_holds_room_type_fk
    foreign key (hotel_id, room_type_id)
    references public.room_types(hotel_id, id)
    on delete restrict
);

create index checkout_holds_expiry_idx
  on public.checkout_holds (expires_at)
  where status = 'active';

create table public.checkout_hold_room_nights (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references public.checkout_holds(id) on delete cascade,
  allotment_id uuid not null references public.physical_room_allotments(id) on delete restrict,
  room_position integer not null,
  stay_date date not null,
  room_id uuid not null references public.physical_rooms(id) on delete restrict,
  nightly_price numeric(12, 2) not null,
  created_at timestamptz not null default now(),
  released_at timestamptz,
  constraint checkout_hold_room_nights_position_positive check (room_position > 0),
  constraint checkout_hold_room_nights_price_nonnegative check (nightly_price >= 0),
  constraint checkout_hold_room_nights_hold_allotment_unique unique (hold_id, allotment_id),
  constraint checkout_hold_room_nights_hold_date_position_unique unique (
    hold_id,
    stay_date,
    room_position
  )
);

create index checkout_hold_room_nights_allotment_idx
  on public.checkout_hold_room_nights (allotment_id);

create table public.reservation_room_nights (
  id uuid primary key default gen_random_uuid(),
  reservation_id uuid not null references public.web_reservations(id) on delete cascade,
  allotment_id uuid not null references public.physical_room_allotments(id) on delete restrict,
  stay_date date not null,
  room_position integer not null,
  room_id uuid not null references public.physical_rooms(id) on delete restrict,
  room_type_id uuid not null references public.room_types(id) on delete restrict,
  nightly_price numeric(12, 2) not null,
  status public.assignment_status not null default 'active',
  assigned_at timestamptz not null default now(),
  released_at timestamptz,
  superseded_by_id uuid references public.reservation_room_nights(id) on delete set null,
  constraint reservation_room_nights_position_positive check (room_position > 0),
  constraint reservation_room_nights_price_nonnegative check (nightly_price >= 0),
  constraint reservation_room_nights_release_consistency check (
    (status = 'active' and released_at is null)
    or (status <> 'active' and released_at is not null)
  )
);

create unique index reservation_room_nights_active_allotment_unique
  on public.reservation_room_nights (allotment_id)
  where status = 'active';

create unique index reservation_room_nights_active_position_unique
  on public.reservation_room_nights (reservation_id, stay_date, room_position)
  where status = 'active';

create index reservation_room_nights_reservation_idx
  on public.reservation_room_nights (reservation_id, stay_date, room_position);

create table public.room_shuffle_plans (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  hold_id uuid references public.checkout_holds(id) on delete set null,
  reservation_id uuid references public.web_reservations(id) on delete cascade,
  status public.shuffle_plan_status not null default 'proposed',
  summary text not null,
  generated_at timestamptz not null default now(),
  completed_at timestamptz,
  completed_by uuid,
  constraint room_shuffle_plans_owner_required check (
    hold_id is not null or reservation_id is not null
  ),
  constraint room_shuffle_plans_summary_not_blank check (btrim(summary) <> ''),
  constraint room_shuffle_plans_completion_consistency check (
    (status = 'completed' and completed_at is not null and completed_by is not null)
    or (status <> 'completed' and completed_at is null and completed_by is null)
  )
);

create index room_shuffle_plans_open_idx
  on public.room_shuffle_plans (hotel_id, generated_at)
  where status in ('proposed', 'required');

create table public.room_shuffle_steps (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.room_shuffle_plans(id) on delete cascade,
  step_order integer not null,
  affected_reservation_id uuid not null references public.web_reservations(id) on delete restrict,
  from_room_id uuid not null references public.physical_rooms(id) on delete restrict,
  to_room_id uuid not null references public.physical_rooms(id) on delete restrict,
  from_date date not null,
  to_date_exclusive date not null,
  instruction text not null,
  completed_at timestamptz,
  completed_by uuid,
  constraint room_shuffle_steps_order_positive check (step_order > 0),
  constraint room_shuffle_steps_plan_order_unique unique (plan_id, step_order),
  constraint room_shuffle_steps_rooms_different check (from_room_id <> to_room_id),
  constraint room_shuffle_steps_dates_valid check (to_date_exclusive > from_date),
  constraint room_shuffle_steps_instruction_not_blank check (btrim(instruction) <> ''),
  constraint room_shuffle_steps_completion_consistency check (
    (completed_at is null and completed_by is null)
    or (completed_at is not null and completed_by is not null)
  )
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  hotel_id uuid not null references public.hotel_settings(id) on delete cascade,
  reservation_id uuid references public.web_reservations(id) on delete cascade,
  kind public.notification_kind not null,
  channel public.notification_channel not null,
  recipient text not null,
  payload jsonb not null default '{}'::jsonb,
  idempotency_key text not null,
  status public.notification_delivery_status not null default 'pending',
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  processing_started_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_events_recipient_not_blank check (btrim(recipient) <> ''),
  constraint notification_events_idempotency_key_unique unique (idempotency_key),
  constraint notification_events_attempts_nonnegative check (attempts >= 0),
  constraint notification_events_sent_consistency check (
    (status = 'sent' and sent_at is not null)
    or (status <> 'sent' and sent_at is null)
  )
);

create index notification_events_delivery_queue_idx
  on public.notification_events (next_attempt_at, created_at)
  where status in ('pending', 'failed');

create view public.inventory_coverage_gaps
with (security_invoker = true)
as
select
  hs.id as hotel_id,
  pr.id as room_id,
  pr.room_type_id,
  pr.room_number,
  expected_date::date as missing_date
from public.hotel_settings hs
cross join lateral generate_series(
  (
    (now() at time zone hs.timezone)
    - (hs.operational_day_rollover - time '00:00')
  )::date,
  (
    (now() at time zone hs.timezone)
    - (hs.operational_day_rollover - time '00:00')
  )::date + hs.inventory_horizon_days - 1,
  interval '1 day'
) as expected_date
join public.physical_rooms pr
  on pr.hotel_id = hs.id
 and pr.is_active
left join public.physical_room_allotments pra
  on pra.hotel_id = hs.id
 and pra.room_id = pr.id
 and pra.date = expected_date::date
where hs.setup_completed_at is not null
  and pra.id is null;

create view public.web_reservation_details
with (security_invoker = true)
as
select
  wr.*,
  coalesce(
    array_agg(distinct pr.room_number order by pr.room_number)
      filter (where rrn.status = 'active'),
    '{}'::text[]
  ) as assigned_room_numbers
from public.web_reservations wr
left join public.reservation_room_nights rrn
  on rrn.reservation_id = wr.id
 and rrn.status = 'active'
left join public.physical_rooms pr
  on pr.id = rrn.room_id
group by wr.id;

alter table public.physical_room_allotments
  add constraint physical_room_allotments_hold_fk
  foreign key (hold_id)
  references public.checkout_holds(id)
  on delete set null;

alter table public.physical_room_allotments
  add constraint physical_room_allotments_reservation_fk
  foreign key (booked_reservation_id)
  references public.web_reservations(id)
  on delete restrict;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger hotel_settings_set_updated_at
before update on public.hotel_settings
for each row execute function public.set_updated_at();

create trigger room_types_set_updated_at
before update on public.room_types
for each row execute function public.set_updated_at();

create trigger group_blocks_set_updated_at
before update on public.group_blocks
for each row execute function public.set_updated_at();

create trigger physical_rooms_set_updated_at
before update on public.physical_rooms
for each row execute function public.set_updated_at();

create trigger physical_room_allotments_set_updated_at
before update on public.physical_room_allotments
for each row execute function public.set_updated_at();

create trigger web_reservations_set_updated_at
before update on public.web_reservations
for each row execute function public.set_updated_at();

create trigger checkout_holds_set_updated_at
before update on public.checkout_holds
for each row execute function public.set_updated_at();

create trigger notification_events_set_updated_at
before update on public.notification_events
for each row execute function public.set_updated_at();

comment on table public.physical_room_allotments is
  'One row per physical room and stay date; the authoritative online allotment ledger.';

comment on column public.physical_room_allotments.hold_expires_at is
  'Denormalized active hold expiry used by availability searches; cleared after payment or expiry.';

comment on table public.group_blocks is
  'Promo-code-controlled inventory groups; linked allotments remain hidden from public searches.';

comment on column public.physical_room_allotments.group_block_id is
  'When set, the room-night is available only to a matching active group-block promo code.';

comment on table public.inventory_generation_runs is
  'Audit trail for 365-day inventory generation and regeneration attempts.';

comment on view public.inventory_coverage_gaps is
  'Missing expected room-date rows; availability services must treat any matching gap as an operational error, never sold out.';

comment on table public.reservation_room_nights is
  'Normalized source of truth for multi-room, per-night assignments and Hotel Tetris movements.';

comment on view public.web_reservation_details is
  'Reservation projection with current room numbers derived from normalized active assignments.';

comment on table public.room_shuffle_steps is
  'Ordered, human-readable room migration instructions generated by the defragmentation engine.';

comment on table public.notification_events is
  'Transactional outbox for guest messages and deduplicated SLA escalation delivery.';
