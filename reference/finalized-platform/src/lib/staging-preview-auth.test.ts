import { describe, expect, it } from "vitest";

import {
  applyStagingRobotsHeader,
  buildStagingAuthChallenge,
  isAuthorizedStagingRequest,
  shouldProtectStagingHost,
  type StagingPreviewEnv,
} from "@/lib/staging-preview-auth";

function createEnv(overrides: Partial<StagingPreviewEnv> = {}): StagingPreviewEnv {
  return {
    STAGING_PREVIEW_ENABLED: "true",
    STAGING_PREVIEW_HOSTNAME: "staging-preview-7q2x.sriuthonghotels.com",
    STAGING_PREVIEW_PASSWORD: "preview-password",
    STAGING_PREVIEW_USERNAME: "preview",
    ...overrides,
  };
}

describe("staging preview auth", () => {
  it("protects only the configured staging hostname when enabled", () => {
    const env = createEnv();

    expect(
      shouldProtectStagingHost(new Request("https://staging-preview-7q2x.sriuthonghotels.com/book"), env),
    ).toBe(true);
    expect(shouldProtectStagingHost(new Request("https://secure.sriuthonghotels.com/book"), env)).toBe(false);
    expect(
      shouldProtectStagingHost(
        new Request("https://staging-preview-7q2x.sriuthonghotels.com/book"),
        createEnv({ STAGING_PREVIEW_ENABLED: "false" }),
      ),
    ).toBe(false);
  });

  it("accepts the expected basic auth header", () => {
    const env = createEnv();
    const headerValue = `Basic ${Buffer.from("preview:preview-password", "utf8").toString("base64")}`;

    expect(
      isAuthorizedStagingRequest(
        new Request("https://staging-preview-7q2x.sriuthonghotels.com/book", {
          headers: { authorization: headerValue },
        }),
        env,
      ),
    ).toBe(true);

    expect(
      isAuthorizedStagingRequest(
        new Request("https://staging-preview-7q2x.sriuthonghotels.com/book", {
          headers: { authorization: "Basic wrong" },
        }),
        env,
      ),
    ).toBe(false);
  });

  it("returns a cache-busting auth challenge", () => {
    const response = buildStagingAuthChallenge();

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Sri U-Thong Staging");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
  });

  it("marks staging responses as non-indexable", async () => {
    const response = applyStagingRobotsHeader(new Response("ok", { status: 200 }));

    expect(response.status).toBe(200);
    expect(response.headers.get("x-robots-tag")).toContain("noindex");
    expect(await response.text()).toBe("ok");
  });
});
