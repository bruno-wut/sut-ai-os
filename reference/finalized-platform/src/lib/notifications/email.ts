import { z } from "zod";

import { calculateBookingPrice } from "@/lib/booking/pricing";
import { HOTEL_FACTS } from "@/lib/hotel-facts";

const deliverySchema = z.object({
  adults: z.number().int().positive().optional(),
  amount_due: z.coerce.number().nonnegative().optional(),
  amount_paid: z.coerce.number().nonnegative().optional(),
  attempt_number: z.number().int().positive(),
  booking_lookup_path: z.string().startsWith("/").default("/lookup"),
  booking_reference_id: z.string().min(1).max(100),
  check_in_date: z.string().min(1).max(40),
  check_out_date: z.string().min(1).max(40),
  children: z.number().int().nonnegative().optional(),
  currency: z.string().length(3),
  guest_name: z.string().min(1).max(200).optional(),
  payment_collected: z.boolean(),
  provider_message_id: z.string().min(1).max(256),
  refund_amount: z.coerce.number().nonnegative().optional(),
  refund_eligible: z.boolean().optional(),
  refund_max_amount: z.coerce.number().nonnegative().optional(),
  refund_status: z.string().max(80).optional(),
  reservation_number: z.string().min(1).max(100),
  room_image_url: z.string().min(1).max(2_048).optional(),
  room_type: z.string().min(1).max(200).optional(),
  rooms_requested: z.number().int().positive(),
});

const HOTEL = HOTEL_FACTS;

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
    weekday: "short",
    year: "numeric",
  }).format(date);
}

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-GB", {
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
    style: "currency",
  }).format(value);
}

function guestSummary(adults = 1, children = 0) {
  const parts = [`${adults} ${adults === 1 ? "adult" : "adults"}`];
  if (children) parts.push(`${children} ${children === 1 ? "child" : "children"}`);
  return parts.join(", ");
}

function amountBreakdown(total: number) {
  return calculateBookingPrice(total);
}

function row(label: string, value: string, emphasize = false) {
  return `<tr class="email-row"><td style="padding:${emphasize ? "18px 0" : "14px 0"};color:${emphasize ? "#17231f" : "#5f6d68"};font-size:${emphasize ? "15px" : "14px"};${emphasize ? "font-weight:bold;" : ""}">${escapeHtml(label)}</td><td align="right" class="email-row-value" style="padding:${emphasize ? "18px 0" : "14px 0"};color:#17231f;font-size:${emphasize ? "15px" : "14px"};font-weight:${emphasize ? "bold" : "600"};">${escapeHtml(value)}</td></tr>`;
}

function buildSimpleStatusEmail(args: {
  body: readonly string[];
  ctaUrl: URL;
  delivery: z.infer<typeof deliverySchema>;
  heading: string;
  preheader: string;
  subject: string;
}) {
  const logoUrl = new URL("/images/sri-u-thong-wordmark.png", args.ctaUrl).toString();
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(args.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f7f4ec;color:#1d2926;font-family:Arial,'Helvetica Neue',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(args.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f4ec;">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:640px;background:#fffdf8;border:1px solid #e8e0d3;border-radius:18px;overflow:hidden;">
          <tr><td style="padding:30px 36px 18px;border-bottom:1px solid #ece4d6;"><img src="${escapeHtml(logoUrl)}" width="180" alt="${escapeHtml(HOTEL.name)}" style="display:block;width:180px;max-width:65%;height:auto;border:0;"></td></tr>
          <tr><td style="padding:34px 36px 18px;"><p style="margin:0 0 12px;color:#9a702b;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">Booking update</p><h1 style="margin:0;color:#17231f;font-family:Georgia,'Times New Roman',serif;font-size:36px;line-height:1.08;">${escapeHtml(args.heading)}</h1></td></tr>
          <tr><td style="padding:0 36px 8px;color:#5f6d68;font-size:15px;line-height:1.7;">${args.body.map((item) => `<p style="margin:0 0 14px;">${escapeHtml(item)}</p>`).join("")}</td></tr>
          <tr><td style="padding:8px 36px 24px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #ece4d6;border-bottom:1px solid #ece4d6;">${row("Booking reference", args.delivery.booking_reference_id, true)}${row("Reservation number", args.delivery.reservation_number)}${row("Stay dates", `${formatDate(args.delivery.check_in_date)} to ${formatDate(args.delivery.check_out_date)}`)}${row("Rooms", String(args.delivery.rooms_requested))}</table></td></tr>
          <tr><td style="padding:0 36px 34px;"><a href="${escapeHtml(args.ctaUrl.toString())}" style="display:inline-block;background:#17231f;color:#fffdf8;text-decoration:none;border-radius:6px;padding:13px 18px;font-weight:bold;">View booking status</a></td></tr>
          <tr><td style="padding:22px 36px;background:#f7f1e5;color:#6c7a73;font-size:13px;line-height:1.7;">${escapeHtml(HOTEL.name)}<br>${escapeHtml(HOTEL.address)}<br>${escapeHtml(HOTEL.phone)} · ${escapeHtml(HOTEL.email)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    html,
    idempotencyKey: args.delivery.provider_message_id,
    subject: args.subject,
    text: [
      args.heading,
      "",
      ...args.body,
      "",
      `Booking reference: ${args.delivery.booking_reference_id}`,
      `Reservation number: ${args.delivery.reservation_number}`,
      `Stay dates: ${formatDate(args.delivery.check_in_date)} to ${formatDate(args.delivery.check_out_date)}`,
      `View booking status: ${args.ctaUrl.toString()}`,
      "",
      HOTEL.name,
      HOTEL.address,
      HOTEL.phone,
      HOTEL.email,
    ].join("\n"),
  };
}

export function buildReservationEmail(kind: string, payload: unknown, appUrl: string) {
  const delivery = deliverySchema.parse(payload);
  const lookupUrl = new URL(delivery.booking_lookup_path, appUrl);
  lookupUrl.searchParams.set("reference", delivery.booking_reference_id);

  if (kind === "reservation_cancelled") {
    const refundCopy = delivery.payment_collected
      ? delivery.refund_eligible
        ? `Your cancellation is within the standard refund window. Our team is reviewing the eligible refund amount up to ${formatMoney(delivery.refund_max_amount ?? 0, delivery.currency)}.`
        : "As per our booking terms, this reservation is past the cancellation window and is non-refundable. No refund will be issued."
      : "No online payment was collected for this reservation, so no refund is due.";

    return buildSimpleStatusEmail({
      body: [
        "Your reservation has been cancelled and the reserved room nights have been released.",
        refundCopy,
        "For questions, please contact front desk operations using the hotel contact details below.",
      ],
      ctaUrl: lookupUrl,
      delivery,
      heading: "Your reservation has been cancelled",
      preheader: `Reservation ${delivery.booking_reference_id} has been cancelled.`,
      subject: `${HOTEL.name} | Reservation cancelled [${delivery.booking_reference_id}]`,
    });
  }

  if (kind === "reservation_refund_processed") {
    const refundAmount = formatMoney(delivery.refund_amount ?? 0, delivery.currency);

    return buildSimpleStatusEmail({
      body: [
        `A refund of ${refundAmount} has been submitted to the original Stripe payment method.`,
        "The card issuer, bank, or payment network controls when the credit appears on the guest statement.",
      ],
      ctaUrl: lookupUrl,
      delivery,
      heading: "Your refund has been processed",
      preheader: `Refund processed for reservation ${delivery.booking_reference_id}.`,
      subject: `${HOTEL.name} | Refund processed [${delivery.booking_reference_id}]`,
    });
  }

  const confirmed = kind === "reservation_confirmed";
  const subject = confirmed
    ? `${HOTEL.name} | Your reservation is confirmed [${delivery.booking_reference_id}]`
    : `${HOTEL.name} | We received your reservation [${delivery.booking_reference_id}]`;
  const amount = delivery.payment_collected ? delivery.amount_paid : delivery.amount_due;
  const amountSummary = amount === undefined ? null : amountBreakdown(amount);
  const guestName = delivery.guest_name ?? "Guest";
  const firstName = delivery.guest_name?.trim().split(/\s+/)[0] || "there";
  const roomType = delivery.room_type ?? "Reserved room";
  const checkIn = formatDate(delivery.check_in_date);
  const checkOut = formatDate(delivery.check_out_date);
  const roomImageUrl = new URL(
    delivery.room_image_url ?? "/images/grand-superior-room.jpg",
    appUrl,
  ).toString();
  const logoUrl = new URL("/images/sri-u-thong-wordmark.png", appUrl).toString();
  const statusHeading = confirmed ? "Your reservation is confirmed" : "Your reservation is being prepared";
  const statusCopy = confirmed
    ? "Everything is in place for your arrival in Suphanburi. Your stay details are gathered below for quick review."
    : "We have received your booking and our reservations team is confirming the final details for your stay.";
  const guests = guestSummary(delivery.adults, delivery.children);
  const paymentStatus = delivery.payment_collected
    ? "Paid in full via secure online payment"
    : "Pay at hotel guarantee only";
  const checkInDetail = `${checkIn} from 12:00 PM Asia/Bangkok (GMT+7)`;
  const checkOutDetail = `${checkOut} by 12:00 PM Asia/Bangkok (GMT+7)`;
  const amountLabel = amount === undefined ? null : formatMoney(amount, delivery.currency);
  const financialRows = amountSummary
    ? [
        row("Base subtotal", formatMoney(amountSummary.baseSubtotal, delivery.currency)),
        row("VAT (7%)", formatMoney(amountSummary.vat, delivery.currency)),
        row("Hotel service charge (10%)", formatMoney(amountSummary.serviceCharge, delivery.currency)),
        row("Grand total", formatMoney(amountSummary.grandTotal, delivery.currency), true),
      ].join("")
    : row("Settlement", paymentStatus, true);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>${escapeHtml(subject)}</title>
  <style>
    @media screen and (max-width: 640px) {
      .email-shell {
        border-radius: 0 !important;
      }
      .email-pad {
        padding-left: 20px !important;
        padding-right: 20px !important;
      }
      .email-hero {
        padding-top: 28px !important;
        padding-bottom: 24px !important;
      }
      .email-heading {
        font-size: 34px !important;
        line-height: 1.1 !important;
        color: #17231f !important;
      }
      .email-card-title {
        font-size: 20px !important;
      }
      .email-image {
        border-radius: 14px !important;
      }
      .email-stack,
      .email-stack tbody,
      .email-stack tr,
      .email-stack td {
        display: block !important;
        width: 100% !important;
        border-left: 0 !important;
      }
      .email-stack td {
        padding-left: 0 !important;
        padding-right: 0 !important;
      }
      .email-stack td + td {
        padding-top: 18px !important;
      }
      .email-button a {
        display: block !important;
        width: 100% !important;
        box-sizing: border-box !important;
      }
      .email-row td {
        display: block !important;
        width: 100% !important;
        text-align: left !important;
      }
      .email-row td + td {
        padding-top: 0 !important;
      }
      .email-row-value {
        padding-top: 0 !important;
      }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#efe8dc;color:#1d2926;font-family:Arial,'Helvetica Neue',sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(statusCopy)} Booking reference ${escapeHtml(delivery.booking_reference_id)}.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:linear-gradient(180deg,#efe8dc 0%,#f7f4ec 100%);">
    <tr>
      <td align="center" style="padding:28px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="max-width:680px;background:#fffdf8;border:1px solid #e8e0d3;border-radius:22px;overflow:hidden;box-shadow:0 16px 44px rgba(23,35,31,.08);">
          <tr>
            <td class="email-pad" style="padding:32px 40px 24px;background:#fffdf8;border-bottom:1px solid #ece4d6;">
              <img src="${escapeHtml(logoUrl)}" width="184" alt="${escapeHtml(HOTEL.name)}" style="display:block;width:184px;max-width:60%;height:auto;border:0;">
            </td>
          </tr>
          <tr>
            <td class="email-pad email-hero" bgcolor="#fff9f0" style="padding:40px 40px 30px;background:#fff9f0;">
              <p style="margin:0 0 14px;color:#6a756f;font-size:17px;line-height:1.5;">Dear ${escapeHtml(firstName)},</p>
              <h1 class="email-heading" style="margin:0 0 14px;color:#17231f;font-family:Georgia,'Times New Roman',serif;font-size:42px;line-height:1.06;font-weight:700;letter-spacing:-0.6px;">${escapeHtml(statusHeading)}</h1>
              <p style="margin:0 0 24px;color:#5f6d68;font-size:16px;line-height:1.7;">${escapeHtml(statusCopy)}</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f7f1e5;border:1px solid #ebdfc9;border-radius:12px;">
                <tr>
                  <td style="padding:16px 18px;color:#857562;font-size:11px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;">Booking reference</td>
                  <td align="right" style="padding:16px 18px;color:#9a702b;font-size:18px;font-weight:bold;">${escapeHtml(delivery.booking_reference_id)}</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:0 40px 34px;">
              <img src="${escapeHtml(roomImageUrl)}" width="600" alt="${escapeHtml(roomType)}" class="email-image" style="display:block;width:100%;height:auto;max-height:360px;object-fit:cover;border:0;border-radius:16px;">
              <p style="margin:16px 0 0;color:#17231f;font-family:Georgia,'Times New Roman',serif;font-size:24px;line-height:1.25;">${escapeHtml(roomType)}</p>
              <p style="margin:6px 0 0;color:#6c7a73;font-size:14px;line-height:1.5;">${delivery.rooms_requested} ${delivery.rooms_requested === 1 ? "room" : "rooms"} reserved for ${escapeHtml(guests)}</p>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:0 40px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="email-stack">
                <tr>
                  <td width="50%" valign="top" style="padding:22px 20px 22px 0;border-top:1px solid #ece4d6;border-bottom:1px solid #ece4d6;">
                    <p style="margin:0 0 8px;color:#9a702b;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.4px;">Check-in</p>
                    <p style="margin:0;color:#17231f;font-size:18px;line-height:1.45;font-weight:bold;">${escapeHtml(checkIn)}</p>
                    <p style="margin:6px 0 0;color:#6c7a73;font-size:13px;line-height:1.6;">From 12:00 PM<br>Asia/Bangkok (GMT+7)</p>
                  </td>
                  <td width="50%" valign="top" style="padding:22px 0 22px 20px;border-top:1px solid #ece4d6;border-bottom:1px solid #ece4d6;border-left:1px solid #ece4d6;">
                    <p style="margin:0 0 8px;color:#9a702b;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.4px;">Check-out</p>
                    <p style="margin:0;color:#17231f;font-size:18px;line-height:1.45;font-weight:bold;">${escapeHtml(checkOut)}</p>
                    <p style="margin:6px 0 0;color:#6c7a73;font-size:13px;line-height:1.6;">By 12:00 PM<br>Asia/Bangkok (GMT+7)</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:0 40px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fff;border:1px solid #ece4d6;border-radius:14px;">
                <tr>
                  <td class="email-card-title" style="padding:20px 22px 6px;color:#17231f;font-family:Georgia,'Times New Roman',serif;font-size:22px;">Stay summary</td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      ${row("Guest", guestName)}
                      ${row("Reservation number", delivery.reservation_number)}
                      ${row("Reservation type", roomType)}
                      ${row("Stay window", `${checkIn} to ${checkOut}`)}
                      ${row("Guest count", guests)}
                      ${row("Settlement status", paymentStatus)}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:0 40px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f8f5ee;border:1px solid #ece4d6;border-radius:14px;">
                <tr>
                  <td class="email-card-title" style="padding:20px 22px 6px;color:#17231f;font-family:Georgia,'Times New Roman',serif;font-size:22px;">Payment details</td>
                </tr>
                <tr>
                  <td style="padding:0 22px 12px;color:#6c7a73;font-size:13px;line-height:1.6;">All charges shown in this confirmation are listed in Thai Baht (THB).</td>
                </tr>
                <tr>
                  <td style="padding:0 22px 18px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                      ${financialRows}
                      ${amountLabel ? row("Booked amount", amountLabel) : ""}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" class="email-pad" style="padding:10px 40px 34px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td align="center" bgcolor="#1f4b42" class="email-button" style="border-radius:9px;">
                    <a href="${escapeHtml(lookupUrl.toString())}" style="display:inline-block;padding:16px 30px;color:#fff;font-size:15px;line-height:1;text-decoration:none;font-weight:bold;">View booking status</a>
                  </td>
                </tr>
              </table>
              <p style="margin:14px 0 0;color:#6c7a73;font-size:12px;line-height:1.6;">Use the booking email address and reference shown above to securely track the latest reservation status.</p>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:0 40px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#fbf7ee;border-left:4px solid #b58a3a;border-radius:12px;">
                <tr>
                  <td style="padding:18px 18px 16px;">
                    <p style="margin:0 0 8px;color:#17231f;font-size:14px;font-weight:bold;">Modification and stay policy</p>
                    <p style="margin:0;color:#5f6d68;font-size:13px;line-height:1.7;">Cancellations or rescheduling requests should be made at least 1 day before arrival. Moving to higher-rate dates may require an additional payment, while lower-rate date changes do not create a partial refund. Upon check-in, the hotel may authorize accommodation charges and anticipated incidentals against your card.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" style="padding:0 40px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f5eee1;border:1px solid #e2d3b4;border-radius:16px;">
                <tr>
                  <td style="padding:22px 22px 20px;">
                    <p style="margin:0 0 8px;color:#9a702b;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;">Arrival reminder</p>
                    <p style="margin:0;color:#17231f;font-size:15px;line-height:1.6;font-weight:bold;">Please bring a valid passport or national photo ID that matches the guest name on this confirmation.</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="email-pad" bgcolor="#f7f1e5" style="padding:26px 40px 30px;background:#f7f1e5;border-top:1px solid #ece4d6;color:#5f6d68;">
              <p style="margin:0 0 10px;color:#17231f;font-family:Georgia,'Times New Roman',serif;font-size:18px;">${escapeHtml(HOTEL.name)}</p>
              <p style="margin:0;color:#5f6d68;font-size:12px;line-height:1.75;">${escapeHtml(HOTEL.address)}<br><a href="${escapeHtml(HOTEL.phoneHref)}" style="color:#17231f;text-decoration:none;">${escapeHtml(HOTEL.phone)}</a> | <a href="mailto:${escapeHtml(HOTEL.email)}" style="color:#17231f;text-decoration:underline;">${escapeHtml(HOTEL.email)}</a></p>
              <p style="margin:16px 0 0;color:#6c7a73;font-size:11px;line-height:1.7;">This operational message was sent because a reservation was made with this email address. We handle personal data in compliance with Thailand's PDPA. Review our <a href="${escapeHtml(HOTEL.privacyUrl)}" style="color:#17231f;text-decoration:underline;">Privacy Policy</a>.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return {
    html,
    idempotencyKey: delivery.provider_message_id,
    subject,
    text: [
      confirmed
        ? `${HOTEL.name} has confirmed your reservation.`
        : `${HOTEL.name} has received your reservation and is preparing the final confirmation.`,
      "",
      `Booking reference: ${delivery.booking_reference_id}`,
      `Reservation number: ${delivery.reservation_number}`,
      `Guest: ${guestName}`,
      `Room type: ${roomType}`,
      `Rooms: ${delivery.rooms_requested}`,
      `Guests: ${guests}`,
      `Check-in: ${checkInDetail}`,
      `Check-out: ${checkOutDetail}`,
      `Settlement status: ${paymentStatus}`,
      ...(amountSummary
        ? [
            `Base subtotal: ${formatMoney(amountSummary.baseSubtotal, delivery.currency)}`,
            `VAT (7%): ${formatMoney(amountSummary.vat, delivery.currency)}`,
            `Hotel service charge (10%): ${formatMoney(amountSummary.serviceCharge, delivery.currency)}`,
            `Grand total: ${formatMoney(amountSummary.grandTotal, delivery.currency)}`,
          ]
        : []),
      "",
      "Modification and stay policy:",
      "Cancellations or rescheduling requests should be made at least 1 day before arrival. Moving to higher-rate dates may require an additional payment, while lower-rate date changes do not create a partial refund.",
      "Upon check-in, the hotel may authorize accommodation charges and anticipated incidentals against your card.",
      "",
      "Arrival reminder:",
      "Please bring a valid passport or national photo ID that matches the guest name on this confirmation.",
      "",
      `View booking status: ${lookupUrl.toString()}`,
      `Privacy Policy: ${HOTEL.privacyUrl}`,
      "",
      HOTEL.name,
      HOTEL.address,
      HOTEL.phone,
      HOTEL.email,
    ].join("\n"),
  };
}
