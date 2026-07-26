import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

type RateLimitWindowState = {
  count: number;
  resetAt: number;
};

type NewKeyWindowState = RateLimitWindowState & {
  seenKeys: Set<string>;
};

type ClientRateState = {
  attempts: RateLimitWindowState;
  newKeys: NewKeyWindowState;
  lastSeenAt: number;
};

type BookingLookupRateState = {
  attempts: RateLimitWindowState;
  lastSeenAt: number;
};

export type RateLimitDecision = {
  limit: number;
  policy: string;
  remaining: number;
  resetAt: number;
  retryAfterSeconds?: number;
};

type SharedRateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset_at: number;
  retry_after_seconds: number | null;
};

const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const ATTEMPT_LIMIT = 10;
const NEW_KEY_WINDOW_MS = 60 * 60 * 1000;
const NEW_KEY_LIMIT = 5;
const BOOKING_LOOKUP_WINDOW_MS = 10 * 60 * 1000;
const BOOKING_LOOKUP_LIMIT = 20;
const STATE_TTL_MS = 2 * 60 * 60 * 1000;

const globalState = globalThis as typeof globalThis & {
  __bookingLookupRateLimitState__?: Map<string, BookingLookupRateState>;
  __checkoutHoldRateLimitState__?: Map<string, ClientRateState>;
};

const clientStateStore = globalState.__checkoutHoldRateLimitState__ ?? new Map<string, ClientRateState>();
const bookingLookupStateStore =
  globalState.__bookingLookupRateLimitState__ ?? new Map<string, BookingLookupRateState>();

if (!globalState.__checkoutHoldRateLimitState__) {
  globalState.__checkoutHoldRateLimitState__ = clientStateStore;
}

if (!globalState.__bookingLookupRateLimitState__) {
  globalState.__bookingLookupRateLimitState__ = bookingLookupStateStore;
}

function createWindowState(now: number, windowMs: number): RateLimitWindowState {
  return {
    count: 0,
    resetAt: now + windowMs,
  };
}

function createClientState(now: number): ClientRateState {
  return {
    attempts: createWindowState(now, ATTEMPT_WINDOW_MS),
    lastSeenAt: now,
    newKeys: {
      ...createWindowState(now, NEW_KEY_WINDOW_MS),
      seenKeys: new Set<string>(),
    },
  };
}

function resetWindowIfNeeded(window: RateLimitWindowState, now: number, windowMs: number) {
  if (window.resetAt <= now) {
    window.count = 0;
    window.resetAt = now + windowMs;
  }
}

function resetNewKeyWindowIfNeeded(window: NewKeyWindowState, now: number) {
  if (window.resetAt <= now) {
    window.count = 0;
    window.resetAt = now + NEW_KEY_WINDOW_MS;
    window.seenKeys.clear();
  }
}

function cleanupExpiredState(now: number) {
  for (const [key, state] of clientStateStore.entries()) {
    if (state.lastSeenAt + STATE_TTL_MS <= now) {
      clientStateStore.delete(key);
    }
  }

  for (const [key, state] of bookingLookupStateStore.entries()) {
    if (state.lastSeenAt + STATE_TTL_MS <= now) {
      bookingLookupStateStore.delete(key);
    }
  }
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function allowedOriginsForRequest(request: Request): Set<string> {
  const allowed = new Set<string>();
  const requestOrigin = normalizeOrigin(request.url);

  if (requestOrigin) {
    allowed.add(requestOrigin);
  }

  const configuredAppOrigin = normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL ?? "");

  if (configuredAppOrigin) {
    allowed.add(configuredAppOrigin);
  }

  const configuredExtraOrigins = (process.env.CHECKOUT_HOLD_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((value) => normalizeOrigin(value.trim()))
    .filter((value): value is string => Boolean(value));

  for (const origin of configuredExtraOrigins) {
    allowed.add(origin);
  }

  return allowed;
}

export function getClientIpAddress(request: Request): string {
  const direct =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    request.headers.get("fly-client-ip");

  if (direct?.trim()) {
    return direct.trim();
  }

  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();

    if (first) {
      return first;
    }
  }

  // Fallback for direct workers.dev requests or local test harnesses where Cloudflare edge headers may be missing
  return "127.0.0.1";
}

export function checkoutOriginIsAllowed(request: Request): boolean {
  const originHeader = request.headers.get("origin");

  if (!originHeader) {
    return false;
  }

  const normalizedOrigin = normalizeOrigin(originHeader);

  if (!normalizedOrigin) {
    return false;
  }

  return allowedOriginsForRequest(request).has(normalizedOrigin);
}

export function checkoutFetchMetadataIsAllowed(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");

  if (!site) {
    return false;
  }

  return site === "same-origin" || site === "same-site" || site === "none";
}

function consumeCheckoutHoldRateLimitInMemory(clientIp: string, idempotencyKey?: string | null): RateLimitDecision {
  const now = Date.now();

  cleanupExpiredState(now);

  const state = clientStateStore.get(clientIp) ?? createClientState(now);
  state.lastSeenAt = now;

  resetWindowIfNeeded(state.attempts, now, ATTEMPT_WINDOW_MS);
  resetNewKeyWindowIfNeeded(state.newKeys, now);

  if (state.attempts.count >= ATTEMPT_LIMIT) {
    clientStateStore.set(clientIp, state);

    return {
      limit: ATTEMPT_LIMIT,
      policy: `${ATTEMPT_LIMIT};w=${Math.floor(ATTEMPT_WINDOW_MS / 1000)}`,
      remaining: 0,
      resetAt: state.attempts.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((state.attempts.resetAt - now) / 1000)),
    };
  }

  state.attempts.count += 1;

  const normalizedKey = idempotencyKey?.trim() || null;
  const isNewKey = normalizedKey ? !state.newKeys.seenKeys.has(normalizedKey) : false;

  if (normalizedKey && isNewKey) {
    if (state.newKeys.count >= NEW_KEY_LIMIT) {
      clientStateStore.set(clientIp, state);

      return {
        limit: NEW_KEY_LIMIT,
        policy: `${NEW_KEY_LIMIT};w=${Math.floor(NEW_KEY_WINDOW_MS / 1000)}`,
        remaining: 0,
        resetAt: state.newKeys.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((state.newKeys.resetAt - now) / 1000)),
      };
    }

    state.newKeys.count += 1;
    state.newKeys.seenKeys.add(normalizedKey);
  }

  clientStateStore.set(clientIp, state);

  return {
    limit: NEW_KEY_LIMIT,
    policy: `${NEW_KEY_LIMIT};w=${Math.floor(NEW_KEY_WINDOW_MS / 1000)}`,
    remaining: Math.max(0, NEW_KEY_LIMIT - state.newKeys.count),
    resetAt: state.newKeys.resetAt,
  };
}

function consumeBookingLookupRateLimitInMemory(clientIp: string): RateLimitDecision {
  const now = Date.now();

  cleanupExpiredState(now);

  const state =
    bookingLookupStateStore.get(clientIp) ??
    {
      attempts: createWindowState(now, BOOKING_LOOKUP_WINDOW_MS),
      lastSeenAt: now,
    };

  state.lastSeenAt = now;
  resetWindowIfNeeded(state.attempts, now, BOOKING_LOOKUP_WINDOW_MS);

  if (state.attempts.count >= BOOKING_LOOKUP_LIMIT) {
    bookingLookupStateStore.set(clientIp, state);

    return {
      limit: BOOKING_LOOKUP_LIMIT,
      policy: `${BOOKING_LOOKUP_LIMIT};w=${Math.floor(BOOKING_LOOKUP_WINDOW_MS / 1000)}`,
      remaining: 0,
      resetAt: state.attempts.resetAt,
      retryAfterSeconds: Math.max(1, Math.ceil((state.attempts.resetAt - now) / 1000)),
    };
  }

  state.attempts.count += 1;
  bookingLookupStateStore.set(clientIp, state);

  return {
    limit: BOOKING_LOOKUP_LIMIT,
    policy: `${BOOKING_LOOKUP_LIMIT};w=${Math.floor(BOOKING_LOOKUP_WINDOW_MS / 1000)}`,
    remaining: Math.max(0, BOOKING_LOOKUP_LIMIT - state.attempts.count),
    resetAt: state.attempts.resetAt,
  };
}

async function hashRateLimitValue(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);

  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function consumeSharedRateLimit(input: {
  clientIp: string;
  distinctKey?: string | null;
  limit: number;
  policy: string;
  scope: string;
  windowSeconds: number;
}): Promise<RateLimitDecision | null> {
  const supabase = createSupabaseServiceRoleClient();

  if (!supabase) return null;

  try {
    const clientKey = await hashRateLimitValue(input.clientIp);
    const distinctKey = input.distinctKey ? await hashRateLimitValue(input.distinctKey) : null;
    const { data, error } = await supabase.rpc("consume_api_rate_limit", {
      p_client_key: clientKey,
      p_distinct_key: distinctKey,
      p_limit: input.limit,
      p_scope: input.scope,
      p_window_seconds: input.windowSeconds,
    });

    if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;

    const result = data as Partial<SharedRateLimitResult>;
    const resetAtSeconds = Number(result.reset_at);

    if (
      typeof result.allowed !== "boolean" ||
      !Number.isFinite(resetAtSeconds) ||
      typeof result.limit !== "number" ||
      typeof result.remaining !== "number"
    ) {
      return null;
    }

    return {
      limit: result.limit,
      policy: input.policy,
      remaining: result.remaining,
      resetAt: resetAtSeconds * 1000,
      ...(result.allowed
        ? {}
        : { retryAfterSeconds: Math.max(1, Number(result.retry_after_seconds) || 1) }),
    };
  } catch {
    return null;
  }
}

export async function consumeCheckoutHoldRateLimit(
  clientIp: string,
  idempotencyKey?: string | null,
): Promise<RateLimitDecision> {
  const attempts = await consumeSharedRateLimit({
    clientIp,
    limit: ATTEMPT_LIMIT,
    policy: `${ATTEMPT_LIMIT};w=${Math.floor(ATTEMPT_WINDOW_MS / 1000)}`,
    scope: "checkout-hold-attempts",
    windowSeconds: Math.floor(ATTEMPT_WINDOW_MS / 1000),
  });

  if (!attempts) {
    if (process.env.NODE_ENV === "production") {
      return {
        limit: ATTEMPT_LIMIT,
        policy: `${ATTEMPT_LIMIT};w=${Math.floor(ATTEMPT_WINDOW_MS / 1000)}`,
        remaining: 0,
        resetAt: Date.now() + ATTEMPT_WINDOW_MS,
        retryAfterSeconds: Math.floor(ATTEMPT_WINDOW_MS / 1000),
      };
    }
    return consumeCheckoutHoldRateLimitInMemory(clientIp, idempotencyKey);
  }

  if (attempts.retryAfterSeconds || !idempotencyKey?.trim()) return attempts;

  const newKeys = await consumeSharedRateLimit({
    clientIp,
    distinctKey: idempotencyKey.trim(),
    limit: NEW_KEY_LIMIT,
    policy: `${NEW_KEY_LIMIT};w=${Math.floor(NEW_KEY_WINDOW_MS / 1000)}`,
    scope: "checkout-hold-new-keys",
    windowSeconds: Math.floor(NEW_KEY_WINDOW_MS / 1000),
  });

  if (!newKeys && process.env.NODE_ENV === "production") {
    return {
      limit: NEW_KEY_LIMIT,
      policy: `${NEW_KEY_LIMIT};w=${Math.floor(NEW_KEY_WINDOW_MS / 1000)}`,
      remaining: 0,
      resetAt: Date.now() + NEW_KEY_WINDOW_MS,
      retryAfterSeconds: Math.floor(NEW_KEY_WINDOW_MS / 1000),
    };
  }

  return newKeys ?? attempts;
}

export async function consumeBookingLookupRateLimit(clientIp: string): Promise<RateLimitDecision> {
  const decision = await consumeSharedRateLimit({
    clientIp,
    limit: BOOKING_LOOKUP_LIMIT,
    policy: `${BOOKING_LOOKUP_LIMIT};w=${Math.floor(BOOKING_LOOKUP_WINDOW_MS / 1000)}`,
    scope: "booking-lookup-attempts",
    windowSeconds: Math.floor(BOOKING_LOOKUP_WINDOW_MS / 1000),
  });

  if (!decision && process.env.NODE_ENV === "production") {
    return {
      limit: BOOKING_LOOKUP_LIMIT,
      policy: `${BOOKING_LOOKUP_LIMIT};w=${Math.floor(BOOKING_LOOKUP_WINDOW_MS / 1000)}`,
      remaining: 0,
      resetAt: Date.now() + BOOKING_LOOKUP_WINDOW_MS,
      retryAfterSeconds: Math.floor(BOOKING_LOOKUP_WINDOW_MS / 1000),
    };
  }

  return decision ?? consumeBookingLookupRateLimitInMemory(clientIp);
}

export function checkoutRateLimitHeaders(decision: RateLimitDecision): Record<string, string> {
  const headers: Record<string, string> = {
    "RateLimit-Limit": String(decision.limit),
    "RateLimit-Policy": decision.policy,
    "RateLimit-Remaining": String(decision.remaining),
    "RateLimit-Reset": String(Math.max(0, Math.ceil((decision.resetAt - Date.now()) / 1000))),
  };

  if (decision.retryAfterSeconds) {
    headers["Retry-After"] = String(decision.retryAfterSeconds);
  }

  return headers;
}
