import { afterEach, describe, expect, it, vi } from "vitest";

import {
  consumeBookingLookupRateLimit,
  consumeCheckoutHoldRateLimit,
  getClientIpAddress,
} from "@/lib/checkout-abuse-protection";

describe("getClientIpAddress & IP Header Anti-Spoofing (T-03)", () => {
  it("prioritizes direct Cloudflare header over X-Forwarded-For to prevent IP spoofing", () => {
    const request = new Request("https://example.com/api/checkout/hold", {
      headers: {
        "cf-connecting-ip": "203.0.113.195",
        "x-forwarded-for": "198.51.100.1, 127.0.0.1",
      },
    });

    expect(getClientIpAddress(request)).toBe("203.0.113.195");
  });

  it("prevents rate limit bypass via X-Forwarded-For header rotation when behind Cloudflare", async () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, NODE_ENV: "test" };

    // Simulate an attacker attempting to bypass rate limits by rotating X-Forwarded-For headers while retaining the true Cloudflare IP
    const trueCloudflareIp = "203.0.113.88";
    
    // First requests up to the rate limit threshold (5 attempts per IP window)
    for (let i = 0; i < 5; i++) {
      const req = new Request("https://example.com/api/checkout/hold", {
        headers: {
          "cf-connecting-ip": trueCloudflareIp,
          "x-forwarded-for": `198.51.100.${i + 10}`,
        },
      });
      const clientIp = getClientIpAddress(req);
      expect(clientIp).toBe(trueCloudflareIp);
      await consumeCheckoutHoldRateLimit(clientIp, `key-${i}`);
    }

    // 6th attempt with a newly spoofed X-Forwarded-For header
    const spoofedRequest = new Request("https://example.com/api/checkout/hold", {
      headers: {
        "cf-connecting-ip": trueCloudflareIp,
        "x-forwarded-for": "1.2.3.4",
      },
    });

    const clientIp = getClientIpAddress(spoofedRequest);
    expect(clientIp).toBe(trueCloudflareIp); // Must ignore 1.2.3.4

    const decision = await consumeCheckoutHoldRateLimit(clientIp, "key-6");
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
    expect(decision.remaining).toBe(0);

    process.env = originalEnv;
  });

  it("prioritizes x-real-ip when cf-connecting-ip is absent", () => {
    const request = new Request("https://example.com/api/checkout/hold", {
      headers: {
        "x-real-ip": "198.51.100.42",
        "x-forwarded-for": "198.51.100.1",
      },
    });

    expect(getClientIpAddress(request)).toBe("198.51.100.42");
  });

  it("falls back to x-forwarded-for when direct headers are absent", () => {
    const request = new Request("https://example.com/api/checkout/hold", {
      headers: {
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
      },
    });

    expect(getClientIpAddress(request)).toBe("198.51.100.1");
  });

  it("returns fallback IP 127.0.0.1 when no IP headers are present", () => {
    const request = new Request("https://example.com/api/checkout/hold");
    expect(getClientIpAddress(request)).toBe("127.0.0.1");
  });
});

describe("Distributed Rate Limiting (S-04)", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  it("fails closed in production mode when database rate limiter is unavailable", async () => {
    process.env = { ...originalEnv, CHECKOUT_HOLD_LIVE_ENABLED: "true", NODE_ENV: "production" };

    const decision = await consumeCheckoutHoldRateLimit("198.51.100.100");

    expect(decision.remaining).toBe(0);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("fails closed for booking lookup in production mode when database rate limiter is unavailable", async () => {
    process.env = { ...originalEnv, CHECKOUT_HOLD_LIVE_ENABLED: "true", NODE_ENV: "production" };

    const decision = await consumeBookingLookupRateLimit("198.51.100.101");

    expect(decision.remaining).toBe(0);
    expect(decision.retryAfterSeconds).toBeGreaterThan(0);
  });
});
