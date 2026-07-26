import { describe, expect, it, vi } from "vitest";

const { fetchHandler } = vi.hoisted(() => ({
  fetchHandler: vi.fn(async (request: Request) => {
    void request;
    return new Response(JSON.stringify({ claimed: 0, sent: 0 }), { status: 200 });
  }),
}));

vi.mock("../.open-next/worker.js", () => ({
  default: { fetch: fetchHandler },
}));

import worker from "../cloudflare-worker";

describe("Cloudflare scheduled notification trigger", () => {
  it("invokes the internal notification worker with the configured bearer secret", async () => {
    let scheduledWork: Promise<unknown> | undefined;

    await worker.scheduled(
      {},
      { CRON_SECRET: "cron-test-secret" },
      {
        waitUntil(promise) {
          scheduledWork = promise;
        },
      },
    );

    await scheduledWork;
    expect(fetchHandler).toHaveBeenCalledTimes(1);

    const request = fetchHandler.mock.calls[0]?.[0] as Request;
    expect(request.url).toBe("https://worker.internal/api/notifications/process");
    expect(request.method).toBe("POST");
    expect(request.headers.get("authorization")).toBe("Bearer cron-test-secret");
  });
});
