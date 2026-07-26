-- Distributed API abuse protection for serverless staging/production workers.
-- Raw client IPs and idempotency keys are hashed by the application before
-- reaching this table.

create table if not exists public.api_rate_limit_buckets (
  scope text not null,
  client_key text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 0,
  distinct_keys text[] not null default '{}'::text[],
  updated_at timestamptz not null default now(),
  primary key (scope, client_key),
  constraint api_rate_limit_buckets_count_nonnegative
    check (request_count >= 0)
);

alter table public.api_rate_limit_buckets enable row level security;
revoke all on table public.api_rate_limit_buckets
  from public, anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limit_buckets
  to service_role;

create index if not exists api_rate_limit_buckets_updated_at_idx
  on public.api_rate_limit_buckets (updated_at);

create or replace function public.consume_api_rate_limit(
  p_scope text,
  p_client_key text,
  p_limit integer,
  p_window_seconds integer,
  p_distinct_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_allowed boolean := true;
  v_count integer := 0;
  v_distinct_keys text[] := '{}'::text[];
  v_now timestamptz := clock_timestamp();
  v_window_started_at timestamptz := v_now;
  v_reset_at timestamptz;
  v_is_new_distinct_key boolean := false;
begin
  if nullif(btrim(coalesce(p_scope, '')), '') is null
     or nullif(btrim(coalesce(p_client_key, '')), '') is null
     or p_limit < 1
     or p_window_seconds < 1 then
    raise exception 'Valid rate-limit scope, client key, limit, and window are required.';
  end if;

  -- Serialize the first insert and all later updates for this logical bucket.
  perform pg_advisory_xact_lock(
    hashtextextended(btrim(p_scope) || ':' || btrim(p_client_key), 0)
  );

  select
    bucket.window_started_at,
    bucket.request_count,
    bucket.distinct_keys
  into
    v_window_started_at,
    v_count,
    v_distinct_keys
  from public.api_rate_limit_buckets bucket
  where bucket.scope = btrim(p_scope)
    and bucket.client_key = btrim(p_client_key)
  for update;

  if not found or v_window_started_at + make_interval(secs => p_window_seconds) <= v_now then
    v_window_started_at := v_now;
    v_count := 0;
    v_distinct_keys := '{}'::text[];
  end if;

  if nullif(btrim(coalesce(p_distinct_key, '')), '') is null then
    if v_count >= p_limit then
      v_allowed := false;
    else
      v_count := v_count + 1;
    end if;
  else
    v_is_new_distinct_key := not (btrim(p_distinct_key) = any(v_distinct_keys));

    if v_is_new_distinct_key and v_count >= p_limit then
      v_allowed := false;
    elsif v_is_new_distinct_key then
      v_distinct_keys := array_append(v_distinct_keys, btrim(p_distinct_key));
      v_count := v_count + 1;
    end if;
  end if;

  insert into public.api_rate_limit_buckets as bucket (
    scope,
    client_key,
    window_started_at,
    request_count,
    distinct_keys,
    updated_at
  ) values (
    btrim(p_scope),
    btrim(p_client_key),
    v_window_started_at,
    v_count,
    v_distinct_keys,
    v_now
  )
  on conflict (scope, client_key) do update set
    window_started_at = excluded.window_started_at,
    request_count = excluded.request_count,
    distinct_keys = excluded.distinct_keys,
    updated_at = excluded.updated_at;

  v_reset_at := v_window_started_at + make_interval(secs => p_window_seconds);

  return jsonb_build_object(
    'allowed', v_allowed,
    'limit', p_limit,
    'remaining', greatest(p_limit - v_count, 0),
    'reset_at', extract(epoch from v_reset_at)::bigint,
    'retry_after_seconds', case
      when v_allowed then null
      else greatest(ceil(extract(epoch from (v_reset_at - v_now)))::integer, 1)
    end
  );
end;
$$;

revoke all on function public.consume_api_rate_limit(text, text, integer, integer, text)
  from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, text, integer, integer, text)
  to service_role;

-- This security-definer RPC exposes only aggregate room-type capacity and is
-- the intended anonymous availability surface.
grant execute on function public.search_room_type_availability(date, date, uuid, text)
  to anon, authenticated, service_role;

