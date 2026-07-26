import { describe, expect, it } from "vitest";

import { buildReservationEmail } from "./email";

describe("buildReservationEmail", () => {
  const payload = {
    attempt_number: 1,
    booking_lookup_path: "/lookup",
    booking_reference_id: "SUT-TEST123",
    check_in_date: "2030-01-10",
    check_out_date: "2030-01-12",
    currency: "THB",
    guest_name: "Ananda Sukjai",
    adults: 2,
    children: 1,
    amount_paid: 7200,
    payment_collected: true,
    provider_message_id: "hib-notification-test",
    reservation_number: "WEB-20300110-00000001",
    room_image_url: "/images/grand-suite-room.jpg",
    room_type: "Grand Suite",
    rooms_requested: 1,
  };

  it("builds a confirmed reservation message with its stable idempotency key", () => {
    const email = buildReservationEmail(
      "reservation_confirmed",
      payload,
      "https://hotel.example",
    );

    expect(email.idempotencyKey).toBe("hib-notification-test");
    expect(email.subject).toBe("Sri U-Thong Grand Hotel | Your reservation is confirmed [SUT-TEST123]");
    expect(email.text).toContain("https://hotel.example/lookup?reference=SUT-TEST123");
    expect(email.text).toContain("Paid in full via secure online payment");
    expect(email.text).toContain("VAT (7%)");
    expect(email.text).toContain("Asia/Bangkok (GMT+7)");
    expect(email.text).toContain("THB");
    expect(email.html).toContain("Dear Ananda");
    expect(email.html).toContain("Grand Suite");
    expect(email.html).toContain("https://hotel.example/images/grand-suite-room.jpg");
    expect(email.html).toContain("View booking status");
    expect(email.html).toContain("Payment details");
    expect(email.html).toContain("1 day before arrival");
    expect(email.html).not.toContain("5-10 years");
    expect(email.html).toContain("Privacy Policy");
    expect(email.html).not.toContain("undefined");
  });

  it("states when a cancelled booking is outside the refund window", () => {
    const email = buildReservationEmail(
      "reservation_cancelled",
      {
        ...payload,
        refund_eligible: false,
        refund_max_amount: 0,
        refund_status: "not_required",
      },
      "https://hotel.example",
    );

    expect(email.subject).toBe("Sri U-Thong Grand Hotel | Reservation cancelled [SUT-TEST123]");
    expect(email.text).toContain("past the cancellation window and is non-refundable");
    expect(email.text).toContain("No refund will be issued");
    expect(email.html).toContain("Your reservation has been cancelled");
    expect(email.html).not.toContain("undefined");
  });

  it("builds a refund processed message with the exact amount", () => {
    const email = buildReservationEmail(
      "reservation_refund_processed",
      {
        ...payload,
        refund_amount: 3600,
        refund_status: "succeeded",
      },
      "https://hotel.example",
    );

    expect(email.subject).toBe("Sri U-Thong Grand Hotel | Refund processed [SUT-TEST123]");
    expect(email.text).toContain("3,600");
    expect(email.text).toContain("original Stripe payment method");
  });
});
