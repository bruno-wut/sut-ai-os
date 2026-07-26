import { beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseServiceRoleClient, hasSupabaseServiceRoleConfig, select } = vi.hoisted(() => ({
  createSupabaseServiceRoleClient: vi.fn(),
  hasSupabaseServiceRoleConfig: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient,
  hasSupabaseServiceRoleConfig,
}));

import { GET } from "./route";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns healthy status when database ping succeeds", async () => {
    hasSupabaseServiceRoleConfig.mockReturnValue(true);
    select.mockReturnValue({ limit: vi.fn().mockResolvedValue({ error: null }) });
    createSupabaseServiceRoleClient.mockReturnValue({
      from: vi.fn(() => ({ select })),
    });

    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");

    const data = await response.json();
    expect(data.status).toBe("healthy");
    expect(data.services.database).toBe("connected");
  });

  it("returns degraded status when database config is missing", async () => {
    hasSupabaseServiceRoleConfig.mockReturnValue(false);

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("degraded");
    expect(data.services.database).toBe("not_configured");
  });

  it("returns degraded status when database query fails", async () => {
    hasSupabaseServiceRoleConfig.mockReturnValue(true);
    select.mockReturnValue({ limit: vi.fn().mockResolvedValue({ error: new Error("DB Error") }) });
    createSupabaseServiceRoleClient.mockReturnValue({
      from: vi.fn(() => ({ select })),
    });

    const response = await GET();
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.status).toBe("degraded");
    expect(data.services.database).toBe("error");
  });
});
