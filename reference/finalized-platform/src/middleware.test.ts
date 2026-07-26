import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { updateSupabaseSession } = vi.hoisted(() => ({
  updateSupabaseSession: vi.fn(async (request?: NextRequest, headers?: Headers) => {
    void request;
    void headers;
    return NextResponse.next();
  }),
}));

vi.mock("@/lib/supabase/proxy", () => ({
  updateSupabaseSession,
}));

import { middleware } from "@/middleware";

function setStagingEnv() {
  process.env.STAGING_PREVIEW_ENABLED = "true";
  process.env.STAGING_PREVIEW_HOSTNAME = "staging-preview-7q2x.sriuthonghotels.com";
  process.env.STAGING_PREVIEW_USERNAME = "preview";
  process.env.STAGING_PREVIEW_PASSWORD = "preview-password";
}

describe("root middleware staging preview protection", () => {
  const previousEnv = { ...process.env };

  beforeEach(() => {
    updateSupabaseSession.mockClear();
    process.env = { ...previousEnv };
    setStagingEnv();
  });

  afterEach(() => {
    process.env = { ...previousEnv };
  });

  it("blocks unauthenticated requests on the staging hostname", async () => {
    const response = await middleware(
      new NextRequest("https://staging-preview-7q2x.sriuthonghotels.com/book"),
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Sri U-Thong Staging");
    expect(updateSupabaseSession).not.toHaveBeenCalled();
  });

  it("allows authenticated staging requests and tags them as non-indexable", async () => {
    const headerValue = `Basic ${Buffer.from("preview:preview-password", "utf8").toString("base64")}`;

    const response = await middleware(
      new NextRequest("https://staging-preview-7q2x.sriuthonghotels.com/en/staff/reservations", {
        headers: { authorization: headerValue },
      }),
    );

    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(updateSupabaseSession).toHaveBeenCalledTimes(1);
  });

  it("passes the locale from a localized path to the application", async () => {
    const headerValue = `Basic ${Buffer.from("preview:preview-password", "utf8").toString("base64")}`;

    await middleware(
      new NextRequest("https://staging-preview-7q2x.sriuthonghotels.com/th/book", {
        headers: { authorization: headerValue },
      }),
    );

    const forwardedHeaders = updateSupabaseSession.mock.calls[0]?.[1] as Headers;
    expect(forwardedHeaders.get("x-sut-locale")).toBe("th");
  });

  it("allows Stripe to reach the signature-protected webhook without preview credentials", async () => {
    const response = await middleware(
      new NextRequest("https://staging-preview-7q2x.sriuthonghotels.com/api/stripe/webhook", {
        method: "POST",
      }),
    );

    expect(response.status).not.toBe(401);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(updateSupabaseSession).toHaveBeenCalledTimes(1);
  });

  it("allows Resend to reach the signature-protected webhook without preview credentials", async () => {
    const response = await middleware(
      new NextRequest("https://staging-preview-7q2x.sriuthonghotels.com/api/resend/webhook", {
        method: "POST",
      }),
    );

    expect(response.status).not.toBe(401);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(updateSupabaseSession).toHaveBeenCalledTimes(1);
  });

  it("does not challenge non-staging hosts", async () => {
    const response = await middleware(new NextRequest("https://secure.sriuthonghotels.com/en/book"));

    expect(response.status).not.toBe(401);
    expect(updateSupabaseSession).toHaveBeenCalledTimes(1);
  });
});
