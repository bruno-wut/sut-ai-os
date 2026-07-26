import { NextResponse, type NextRequest } from "next/server";

import { isLocale, localeFromPathname, stripLocaleFromPathname } from "@/lib/i18n/config";
import { applyStagingRobotsHeader, buildStagingAuthChallenge, isAuthorizedStagingRequest, shouldProtectStagingHost } from "@/lib/staging-preview-auth";
import { updateSupabaseSession } from "@/lib/supabase/proxy";

const unlocalizedGuestPaths = new Set([
  "/",
  "/book",
  "/checkout",
  "/confirmation",
  "/lookup",
  "/login",
]);

const unlocalizedGuestPrefixes = ["/legal", "/staff", "/test"];

function shouldLocalizeToDefault(pathname: string) {
  return unlocalizedGuestPaths.has(pathname) || unlocalizedGuestPrefixes.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function copyCookies(from: NextResponse, to: NextResponse) {
  for (const cookie of from.cookies.getAll()) {
    to.cookies.set(cookie);
  }
}

export async function middleware(request: NextRequest) {
  const isStagingRequest = shouldProtectStagingHost(request, {
    STAGING_PREVIEW_ENABLED: process.env.STAGING_PREVIEW_ENABLED,
    STAGING_PREVIEW_HOSTNAME: process.env.STAGING_PREVIEW_HOSTNAME,
  });
  const isStripeWebhook = request.nextUrl.pathname === "/api/stripe/webhook";
  const isResendWebhook = request.nextUrl.pathname === "/api/resend/webhook";
  const isNotificationWorker = request.nextUrl.pathname === "/api/notifications/process";
  const isHealthCheck = request.nextUrl.pathname === "/api/health";
  const isDebugEnv = request.nextUrl.pathname === "/api/debug-env";

  if (isStagingRequest && !isStripeWebhook && !isResendWebhook && !isNotificationWorker && !isHealthCheck && !isDebugEnv && !isAuthorizedStagingRequest(request, {
    STAGING_PREVIEW_PASSWORD: process.env.STAGING_PREVIEW_PASSWORD,
    STAGING_PREVIEW_USERNAME: process.env.STAGING_PREVIEW_USERNAME,
  })) {
    return buildStagingAuthChallenge();
  }

  const requestHeaders = new Headers(request.headers);
  if (shouldLocalizeToDefault(request.nextUrl.pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/en${request.nextUrl.pathname === "/" ? "" : request.nextUrl.pathname}`;
    const response = NextResponse.redirect(redirectUrl);
    return isStagingRequest ? applyStagingRobotsHeader(response) : response;
  }

  const locale = localeFromPathname(request.nextUrl.pathname);
  requestHeaders.set("x-sut-locale", locale);
  const sessionResponse = await updateSupabaseSession(request, requestHeaders);

  const firstSegment = request.nextUrl.pathname.split("/")[1];
  if (!isLocale(firstSegment) || sessionResponse.headers.has("location")) {
    return isStagingRequest ? applyStagingRobotsHeader(sessionResponse) : sessionResponse;
  }

  const rewriteUrl = request.nextUrl.clone();
  const applicationPath = stripLocaleFromPathname(request.nextUrl.pathname);
  const legalAlias = {
    "/privacy": "/legal/privacy",
    "/terms": "/legal/terms",
    "/cancellation": "/legal/cancellation",
  }[applicationPath];
  rewriteUrl.pathname = legalAlias ?? (applicationPath === "/" ? "/book" : applicationPath);
  rewriteUrl.searchParams.set("lang", locale);
  const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
  copyCookies(sessionResponse, response);
  return isStagingRequest ? applyStagingRobotsHeader(response) : response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
