-- Regression coverage for provider outcomes, webhook idempotency, suppression,
-- and audited dead-letter recovery. All fixtures roll back.

begin;

do $$
declare
  v_hotel_id uuid;
  v_manager_id uuid := gen_random_uuid();
  v_event_id uuid;
  v_dead_letter_id uuid;
  v_claim jsonb;
  v_result jsonb;
begin
  insert into public.hotel_settings (setup_completed_at, notification_max_attempts)
  values (now(), 3)
  returning id into v_hotel_id;

  insert into auth.users (id) values (v_manager_id);
  insert into public.staff_profiles (user_id, hotel_id, role, full_name)
  values (v_manager_id, v_hotel_id, 'manager', 'Notification Test Manager');
  perform set_config('request.jwt.claim.sub', v_manager_id::text, true);

  insert into public.notification_events (
    hotel_id, kind, channel, recipient, payload, idempotency_key
  ) values (
    v_hotel_id,
    'reservation_confirmed',
    'email',
    'bounce@example.com',
    '{}'::jsonb,
    'provider-outcome-' || gen_random_uuid()::text
  )
  returning id into v_event_id;

  select to_jsonb(claimed.*)
  into v_claim
  from public.claim_notification_batch(1) claimed;

  perform public.complete_notification_delivery(
    v_event_id,
    (v_claim->>'lease_id')::uuid,
    (v_claim->>'attempt_number')::integer,
    're_provider_outcome_test'
  );

  v_result := public.record_resend_email_event(
    'webhook-event-test',
    're_provider_outcome_test',
    'email.bounced',
    now(),
    'bounce@example.com',
    jsonb_build_object('bounce_type', 'Permanent'),
    true,
    'Mailbox does not exist'
  );

  if not coalesce((v_result->>'matched')::boolean, false) then
    raise exception 'Provider webhook did not match its notification.';
  end if;

  if not exists (
    select 1 from public.email_suppressions es
    where es.hotel_id = v_hotel_id
      and es.email = 'bounce@example.com'
      and es.cleared_at is null
  ) then
    raise exception 'Permanent bounce did not create a suppression.';
  end if;

  if not public.notification_recipient_is_suppressed(v_event_id) then
    raise exception 'Suppression check did not block the recipient.';
  end if;

  v_result := public.record_resend_email_event(
    'webhook-event-test',
    're_provider_outcome_test',
    'email.bounced',
    now(),
    'bounce@example.com',
    '{}'::jsonb,
    true,
    'Mailbox does not exist'
  );

  if not coalesce((v_result->>'duplicate')::boolean, false) then
    raise exception 'Duplicate webhook was not handled idempotently.';
  end if;

  insert into public.notification_events (
    hotel_id, kind, channel, recipient, payload, idempotency_key,
    status, attempts, next_attempt_at, last_error
  ) values (
    v_hotel_id,
    'reservation_processing',
    'email',
    'retry@example.com',
    '{}'::jsonb,
    'dead-letter-recovery-' || gen_random_uuid()::text,
    'failed',
    3,
    now(),
    'Provider unavailable'
  )
  returning id into v_dead_letter_id;

  v_result := public.requeue_dead_letter_notification(
    v_dead_letter_id,
    'Manager confirmed the original message was never accepted.'
  );

  if not coalesce((v_result->>'ok')::boolean, false)
     or not exists (
       select 1 from public.notification_events ne
       where ne.id = v_dead_letter_id
         and ne.status = 'pending'
         and ne.attempts = 0
         and ne.provider_message_id like 'hib-replay-%'
         and ne.dead_letter_resolved_by = v_manager_id
     ) then
    raise exception 'Dead-letter recovery was not audited and requeued.';
  end if;
end;
$$;

rollback;
