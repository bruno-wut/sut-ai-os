import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

export const DEFAULT_SUPABASE_TIMEOUT_MS = 15_000;

export function createTimeoutFetch(timeoutMs = DEFAULT_SUPABASE_TIMEOUT_MS): typeof fetch {
  return (input: RequestInfo | URL, init?: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    if (init?.signal) {
      if (init.signal.aborted) {
        controller.abort();
      } else {
        init.signal.addEventListener("abort", () => controller.abort());
      }
    }

    return fetch(input, {
      ...init,
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timer);
    });
  };
}

export function hasSupabaseConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project"),
  );
}

export function hasSupabaseServiceRoleConfig() {
  return Boolean(hasSupabaseConfig() && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export async function createSupabaseServerClient(timeoutMs = DEFAULT_SUPABASE_TIMEOUT_MS) {
  const cookieStore = await cookies();

  if (!hasSupabaseConfig()) {
    return null;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        fetch: createTimeoutFetch(timeoutMs),
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components cannot persist refreshed cookies; middleware handles that.
          }
        },
      },
    },
  );
}

export function createSupabaseServiceRoleClient(timeoutMs = DEFAULT_SUPABASE_TIMEOUT_MS) {
  if (!hasSupabaseServiceRoleConfig()) {
    return null;
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      global: {
        fetch: createTimeoutFetch(timeoutMs),
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
