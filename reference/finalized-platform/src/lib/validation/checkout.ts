import { z } from "zod";

import { isGuestRoomBookingKey } from "@/lib/guest-room-catalog";
import { getBangkokDateString } from "@/lib/hotel-dates";

const requiredTrimmedText = (field: string, maximum: number) =>
  z
    .string({ error: `${field} is required.` })
    .trim()
    .min(1, `${field} is required.`)
    .max(maximum, `${field} is too long.`);

export const checkoutGuestSchema = z.object({
  guestName: requiredTrimmedText("Full name", 200)
    .refine(
      (name) => !/[<>]/.test(name) && !/[\u0000-\u001F\u007F]/.test(name),
      "Full name cannot contain markup or control characters.",
    ),
  guestEmail: z
    .string({ error: "Email is required." })
    .trim()
    .min(1, "Email is required.")
    .email("Enter a valid email address.")
    .max(320, "Email is too long.")
    .transform((email) => email.toLowerCase()),
  guestPhone: requiredTrimmedText("Phone number", 50).refine(
    (phone) => /^[+()\d.\s-]{7,50}$/.test(phone),
    "Enter a valid phone number.",
  ),
});

const hotelDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid hotel date.")
  .refine((value) => {
    const [year, month, day] = value.split("-").map(Number);
    const parsed = new Date(Date.UTC(year, month - 1, day));

    return (
      parsed.getUTCFullYear() === year &&
      parsed.getUTCMonth() === month - 1 &&
      parsed.getUTCDate() === day
    );
  }, "Use a valid hotel date.");

export const checkoutHoldRequestSchema = checkoutGuestSchema
  .extend({
    checkIn: hotelDateSchema,
    checkOut: hotelDateSchema,
    roomCategory: z
      .string()
      .trim()
      .min(1, "Select a valid room type.")
      .max(120, "Select a valid room type.")
      .refine(isGuestRoomBookingKey, "Select a valid room type."),
    rooms: z.coerce.number().int().min(1).max(10),
    adults: z.coerce.number().int().min(1).max(40),
    children: z.coerce.number().int().min(0).max(40),
    locale: z.enum(["en", "th"]).optional().default("en"),
    promoCode: z
      .string()
      .trim()
      .max(50, "Promo code is too long.")
      .transform((value) => value || null)
      .nullable()
      .optional()
      .default(null),
    paymentMode: z.enum(["stripe", "pay_at_hotel"]),
    pdpaConsent: z.literal(true, {
      error: "Accept the booking terms and privacy notice to continue.",
    }),
    marketingConsent: z.boolean().optional().default(false),
    termsVersion: requiredTrimmedText("Terms version", 100),
    privacyPolicyVersion: requiredTrimmedText("Privacy policy version", 100),
    cancellationPolicyVersion: requiredTrimmedText("Cancellation policy version", 100),
    idempotencyKey: z
      .string()
      .trim()
      .min(16, "A valid retry key is required.")
      .max(128, "Retry key is too long."),
  })
  .superRefine((value, context) => {
    const todayInBangkok = getBangkokDateString();

    if (value.checkIn < todayInBangkok) {
      context.addIssue({
        code: "custom",
        message: "Check-in cannot be earlier than the hotel's Bangkok date.",
        path: ["checkIn"],
      });
    }

    if (value.checkOut <= value.checkIn) {
      context.addIssue({
        code: "custom",
        message: "Check-out must be later than check-in.",
        path: ["checkOut"],
      });
    }
  });

export type CheckoutGuest = z.infer<typeof checkoutGuestSchema>;
export type CheckoutHoldRequest = z.infer<typeof checkoutHoldRequestSchema>;
