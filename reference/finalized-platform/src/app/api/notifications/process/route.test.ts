import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildReservationEmail, rpc, send } = vi.hoisted(() => ({
  buildReservationEmail: vi.fn(),
  rpc: vi.fn(),
  send: vi.fn(),
}));

vi.mock("resend", () => ({
  Resend: class Resend {
    emails = { send };
  },
}));

vi.mock("@/lib/notifications/email", () => ({
  buildReservationEmail,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: () => ({ rpc }),
}));

import { POST } from "./route";

function notificationRequest() {
  return new Request("http://localhost/api/notifications/process", {
    headers: { authorization: "Bearer cron-secret-at-least-24-characters" },
    method: "POST",
  });
}

function claimedEvent() {
  return {
    attempt_number: 1,
    channel: "email",
    delivery_payload: { reservation_number: "WEB-TEST-1" },
    event_id: "11111111-1111-4111-8111-111111111111",
    kind: "reservation_processing",
    lease_id: "22222222-2222-4222-8222-222222222222",
    provider_message_id: "hib-notification-1111",
    recipient: "guest@example.com",
  };
}

describe("Notification worker route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret-at-least-24-characters";
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Reservations <reservations@example.com>";
    process.env.EMAIL_REPLY_TO = "frontdesk@example.com";
    process.env.NEXT_PUBLIC_APP_URL = "https://example.com";

    buildReservationEmail.mockReturnValue({
      idempotencyKey: "hib-notification-1111",
      subject: "Reservation received",
      text: "Reservation received",
    });
  });

  it("marks successfully persisted deliveries as sent", async () => {
    rpc
      .mockResolvedValueOnce({ data: [claimedEvent()], error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: { ok: true, stale_lease: false }, error: null });
    send.mockResolvedValue({ data: { id: "re_123" }, error: null });

    const response = await POST(notificationRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ claimed: 1, failed: 0, sent: 1, stale: 0 });
  });

  it("records delivery failures for retry when the provider send fails", async () => {
    rpc
      .mockResolvedValueOnce({ data: [claimedEvent()], error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: { ok: true, stale_lease: false }, error: null });
    send.mockRejectedValue(new Error("timeout"));

    const response = await POST(notificationRequest());

    expect(response.status).toBe(207);
    expect(await response.json()).toEqual({ claimed: 1, failed: 1, sent: 0, stale: 0 });
    expect(rpc.mock.calls[2]?.[0]).toBe("fail_notification_delivery");
  });

  it("dead-letters permanent provider errors instead of retrying them", async () => {
    rpc
      .mockResolvedValueOnce({ data: [claimedEvent()], error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: { ok: true, stale_lease: false }, error: null });
    send.mockResolvedValue({
      data: null,
      error: { message: "Invalid sender", name: "invalid_from_address", statusCode: 422 },
      headers: null,
    });

    const response = await POST(notificationRequest());

    expect(response.status).toBe(207);
    expect(rpc.mock.calls[2]?.[0]).toBe("dead_letter_notification_delivery");
  });

  it("treats stale completion as non-success instead of counting it as sent", async () => {
    rpc
      .mockResolvedValueOnce({ data: [claimedEvent()], error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: { ok: false, stale_lease: true }, error: null });
    send.mockResolvedValue({ data: { id: "re_123" }, error: null });

    const response = await POST(notificationRequest());

    expect(response.status).toBe(207);
    expect(await response.json()).toEqual({ claimed: 1, failed: 0, sent: 0, stale: 1 });
  });

  it("returns 503 when retry persistence fails after a provider error", async () => {
    rpc
      .mockResolvedValueOnce({ data: [claimedEvent()], error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "db unavailable" } });
    send.mockRejectedValue(new Error("timeout"));

    const response = await POST(notificationRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      claimed: 1,
      code: "NOTIFICATION_FAILURE_UPDATE_FAILED",
      error: "Notification retry state could not be recorded.",
      failed: 0,
      sent: 0,
      stale: 0,
    });
  });

  it("returns 503 when completion persistence fails after a provider success", async () => {
    rpc
      .mockResolvedValueOnce({ data: [claimedEvent()], error: null })
      .mockResolvedValueOnce({ data: false, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "db unavailable" } });
    send.mockResolvedValue({ data: { id: "re_123" }, error: null });

    const response = await POST(notificationRequest());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      claimed: 1,
      code: "NOTIFICATION_COMPLETION_FAILED",
      error: "Notification completion state could not be recorded.",
      failed: 0,
      sent: 0,
      stale: 0,
    });
  });

  it("cancels suppressed recipients without calling Resend", async () => {
    rpc
      .mockResolvedValueOnce({ data: [claimedEvent()], error: null })
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({ data: { ok: true, stale_lease: false }, error: null });

    const response = await POST(notificationRequest());

    expect(response.status).toBe(207);
    expect(send).not.toHaveBeenCalled();
    expect(rpc.mock.calls[2]?.[0]).toBe("cancel_notification_delivery");
  });
});
