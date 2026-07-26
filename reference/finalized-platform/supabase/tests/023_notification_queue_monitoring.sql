-- Regression coverage for notification retries, stale leases, dead letters, and
-- live system-health counters. All fixtures are transactional and roll back.

begin;

do $$
declare
  v_hotel_id uuid;
  v_staff_user_id uuid := gen_random_uuid();
  v_retry_event_id uuid;
  v_claim jsonb;
  v_retry_result jsonb;
  v_reclaim jsonb;
  v_processing_event_id uuid;
  v_health public.system_health_summary%rowtype;
begin
  insert into public.hotel_settings (
    setup_completed_at,
    notification_lease_seconds,
    notification_max_attempts
  )
  values (now(), 60, 3)
  returning id into v_hotel_id;

  insert into auth.users (id) values (v_staff_user_id);
  insert into public.staff_profiles (user_id, hotel_id, role, full_name)
  values (v_staff_user_id, v_hotel_id, 'manager', 'System Health Test Manager');
  perform set_config('request.jwt.claim.sub', v_staff_user_id::text, true);

  insert into public.notification_events (
    hotel_id,
    kind,
    channel,
    recipient,
    payload,
    idempotency_key
  ) values (
    v_hotel_id,
    'reservation_processing',
    'email',
    'retry@example.com',
    jsonb_build_object('reservation_number', 'RETRY-1'),
    'notification-retry-test-' || gen_random_uuid()::text
  )
  returning id into v_retry_event_id;

  select to_jsonb(claimed.*)
  into v_claim
  from public.claim_notification_batch(1) as claimed;

  if (v_claim->>'event_id')::uuid <> v_retry_event_id
     or (v_claim->>'attempt_number')::integer <> 1 then
    raise exception 'First notification claim did not return the seeded event.';
  end if;

  v_retry_result := public.fail_notification_delivery(
    v_retry_event_id,
    (v_claim->>'lease_id')::uuid,
    (v_claim->>'attempt_number')::integer,
    'Provider timeout on first attempt',
    null
  );

  if coalesce((v_retry_result->>'ok')::boolean, false) is not true
     or (v_retry_result->>'retry_after_seconds')::integer <> 30 then
    raise exception 'First retry backoff was not recorded as 30 seconds.';
  end if;

  update public.notification_events
  set next_attempt_at = now() - interval '1 second'
  where id = v_retry_event_id;

  select to_jsonb(claimed.*)
  into v_claim
  from public.claim_notification_batch(1) as claimed;

  v_retry_result := public.fail_notification_delivery(
    v_retry_event_id,
    (v_claim->>'lease_id')::uuid,
    (v_claim->>'attempt_number')::integer,
    'Provider timeout on second attempt',
    null
  );

  if (v_retry_result->>'retry_after_seconds')::integer <> 60 then
    raise exception 'Second retry backoff was not recorded as 60 seconds.';
  end if;

  update public.notification_events
  set next_attempt_at = now() - interval '1 second'
  where id = v_retry_event_id;

  select to_jsonb(claimed.*)
  into v_claim
  from public.claim_notification_batch(1) as claimed;

  perform public.fail_notification_delivery(
    v_retry_event_id,
    (v_claim->>'lease_id')::uuid,
    (v_claim->>'attempt_number')::integer,
    'Provider timeout on third attempt',
    null
  );

  if exists (
    select 1
    from public.claim_notification_batch(5)
    where event_id = v_retry_event_id
  ) then
    raise exception 'Dead-letter notification was still claimable after max attempts.';
  end if;

  if (
    select count(*)
    from public.dead_letter_notification_events dl
    where dl.id = v_retry_event_id
  ) <> 1 then
    raise exception 'Dead-letter notification view did not surface exhausted retries.';
  end if;

  insert into public.notification_events (
    hotel_id,
    kind,
    channel,
    recipient,
    payload,
    idempotency_key
  ) values (
    v_hotel_id,
    'reservation_confirmed',
    'email',
    'stale@example.com',
    jsonb_build_object('reservation_number', 'STALE-1'),
    'notification-stale-test-' || gen_random_uuid()::text
  )
  returning id into v_processing_event_id;

  select to_jsonb(claimed.*)
  into v_claim
  from public.claim_notification_batch(1) as claimed;

  update public.notification_events
  set processing_leased_until = now() - interval '1 second'
  where id = v_processing_event_id;

  select to_jsonb(claimed.*)
  into v_reclaim
  from public.claim_notification_batch(1) as claimed;

  if (v_reclaim->>'event_id')::uuid <> v_processing_event_id
     or (v_reclaim->>'attempt_number')::integer <> 2 then
    raise exception 'Expired processing lease was not reclaimed as a fresh attempt.';
  end if;

  perform public.complete_notification_delivery(
    v_processing_event_id,
    (v_reclaim->>'lease_id')::uuid,
    (v_reclaim->>'attempt_number')::integer,
    'provider-delivery-stale-test'
  );

  insert into public.notification_events (
    hotel_id,
    kind,
    channel,
    recipient,
    payload,
    idempotency_key
  ) values (
    v_hotel_id,
    'pending_staff_alert',
    'email',
    'ready@example.com',
    jsonb_build_object('reservation_number', 'READY-1'),
    'notification-ready-test-' || gen_random_uuid()::text
  );

  insert into public.notification_events (
    hotel_id,
    kind,
    channel,
    recipient,
    payload,
    idempotency_key,
    status,
    attempts,
    next_attempt_at,
    last_error
  ) values (
    v_hotel_id,
    'sla_escalation',
    'email',
    'retrying@example.com',
    jsonb_build_object('reservation_number', 'RETRYING-1'),
    'notification-retrying-test-' || gen_random_uuid()::text,
    'failed',
    1,
    now() + interval '5 minutes',
    'Waiting to retry'
  );

  insert into public.notification_events (
    hotel_id,
    kind,
    channel,
    recipient,
    payload,
    idempotency_key,
    status,
    attempts,
    next_attempt_at,
    processing_started_at,
    processing_lease_id,
    processing_leased_until
  ) values (
    v_hotel_id,
    'background_job_failure',
    'email',
    'processing@example.com',
    jsonb_build_object('job_name', 'hotel_operational_jobs'),
    'notification-processing-test-' || gen_random_uuid()::text,
    'processing',
    1,
    now(),
    now(),
    gen_random_uuid(),
    now() + interval '10 minutes'
  );

  insert into public.notification_events (
    hotel_id,
    kind,
    channel,
    recipient,
    payload,
    idempotency_key,
    status,
    attempts,
    next_attempt_at,
    processing_started_at,
    processing_lease_id,
    processing_leased_until
  ) values (
    v_hotel_id,
    'background_job_failure',
    'email',
    'stale-processing@example.com',
    jsonb_build_object('job_name', 'hotel_operational_jobs'),
    'notification-stale-processing-test-' || gen_random_uuid()::text,
    'processing',
    1,
    now(),
    now() - interval '2 minutes',
    gen_random_uuid(),
    now() - interval '1 minute'
  );

  insert into public.background_job_runs (
    job_name,
    status,
    error_message,
    started_at,
    completed_at,
    metrics
  ) values (
    'hotel_operational_jobs',
    'failed',
    'Notification provider unavailable',
    now() - interval '2 hours',
    now() - interval '119 minutes',
    '{}'::jsonb
  );

  insert into public.background_job_runs (
    job_name,
    status,
    started_at,
    completed_at,
    metrics
  ) values (
    'hotel_operational_jobs',
    'completed',
    now() - interval '2 minutes',
    now() - interval '1 minute',
    jsonb_build_object('expired_holds_released', 1)
  );

  select *
  into v_health
  from public.system_health_summary;

  if v_health.latest_run_status <> 'completed'
     or v_health.operational_job_is_stale
     or v_health.failures_last_24_hours <> 1
     or v_health.notification_ready_to_claim_count <> 1
     or v_health.notification_processing_count <> 2
     or v_health.notification_stale_processing_count <> 1
     or v_health.notification_retrying_count <> 1
     or v_health.notification_dead_letter_count <> 1 then
    raise exception 'System health summary counters did not reflect live queue and worker state.';
  end if;

  if (
    select count(*)
    from public.recent_failed_background_jobs
    where job_name = 'hotel_operational_jobs'
  ) <> 1 then
    raise exception 'Recent failed background jobs view did not expose the latest failure.';
  end if;
end;
$$;

rollback;
