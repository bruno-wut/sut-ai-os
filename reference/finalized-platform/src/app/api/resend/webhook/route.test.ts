import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, verify } = vi.hoisted(() => ({
  rpc: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class Resend {
    webhooks = { verify };
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ rpc }),
}));

import { POST } from "./route";

function request() {
  return new Request("https://secure.sriuthonghotels.com/api/resend/webhook", {
    body: "{}",
    headers: {
      "svix-id": "msg_test",
      "svix-signature": "v1,test",
      "svix-timestamp": "1700000000",
    },
    method: "POST",
  });
}

describe("Resend webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    verify.mockReturnValue({
      created_at: "2030-01-01T00:00:00.000Z",
      data: {
        bounce: { message: "Mailbox does not exist", subType: "General", type: "Permanent" },
        created_at: "2030-01-01T00:00:00.000Z",
        email_id: "re_123",
        from: "reservations@mail.sriuthong.com",
        subject: "Booking confirmed",
        to: ["guest@example.com"],
      },
      type: "email.bounced",
    });
    rpc.mockResolvedValue({
      data: { duplicate: false, ignored: false, matched: true, ok: true },
      error: null,
    });
  });

  it("verifies and persists a permanent bounce as a suppression", async () => {
    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith(
      "record_resend_email_event",
      expect.objectContaining({
        p_should_suppress: true,
        p_webhook_event_id: "msg_test",
      }),
    );
  });

  it("rejects an invalid signature without writing", async () => {
    verify.mockImplementation(() => {
      throw new Error("invalid");
    });

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(rpc).not.toHaveBeenCalled();
  });
});
