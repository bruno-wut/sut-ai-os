import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { localeFromPathname, stripLocaleFromPathname } from "@/lib/i18n/config";
import { createTimeoutFetch } from "@/lib/supabase/server";

const protectedPaths = ["/staff", "/dashboard", "/settings"];

function hasSupabaseRuntimeConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
      !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("your-project"),
  );
}

function loginRedirect(request: NextRequest, reason?: string) {
  const loginUrl = request.nextUrl.clone();
  const locale = localeFromPathname(request.nextUrl.pathname);
  loginUrl.pathname = `/${locale}/login`;
  loginUrl.search = "";
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);

  if (reason) {
    loginUrl.searchParams.set("reason", reason);
  }

  return NextResponse.redirect(loginUrl);
}

export async function updateSupabaseSession(request: NextRequest, requestHeaders = new Headers(request.headers)) {
  const applicationPath = stripLocaleFromPathname(request.nextUrl.pathname);
  const isProtected = protectedPaths.some(
    (path) => applicationPath === path || applicationPath.startsWith(`${path}/`),
  );

  if (!isProtected) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!hasSupabaseRuntimeConfig()) {
    return loginRedirect(request, "configuration_required");
  }

  let response = NextResponse.next({ request: { headers: requestHeaders } });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: {
        fetch: createTimeoutFetch(10_000),
      },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request: { headers: requestHeaders } });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return loginRedirect(request);
  }

  const { data: staffProfile, error } = await supabase
    .from("staff_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !staffProfile) {
    return loginRedirect(request, "staff_required");
  }

  return response;
}
