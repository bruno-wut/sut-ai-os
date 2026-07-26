import { z } from "zod";

export const checkoutHoldResultSchema = z.object({
  allocation_mode: z.string(),
  consent_recorded: z.boolean(),
  currency: z.string(),
  expires_at: z.string(),
  hold_token: z.string(),
  night_count: z.number(),
  ok: z.boolean(),
  payment_mode: z.enum(["stripe", "pay_at_hotel"]),
  rooms_requested: z.number(),
  status: z.string(),
  total_amount: z.number(),
  booking_reference_id: z.string().optional(),
});

export const finalizationResultSchema = z.object({
  idempotent: z.boolean().optional(),
  ok: z.boolean().optional(),
  reservation_id: z.string().optional(),
});

export const reservationStatusRowSchema = z.object({
  booking_reference_id: z.string().nullable(),
  check_in_date: z.string(),
  check_out_date: z.string(),
  hotel_id: z.string(),
  payment_mode: z.enum(["stripe", "pay_at_hotel"]),
  payment_status: z.enum(["not_collected", "collected", "refunded"]),
  reservation_number: z.string(),
  room_type: z.string(),
  rooms_requested: z.number(),
  sync_status: z.enum(["Pending", "Synced", "Cancelled"]),
  updated_at: z.string(),
});

export const hotelContactRowSchema = z.object({
  hotel_name: z.string(),
  public_contact_address: z.string(),
  public_contact_phone: z.string(),
});

export type ReservationStatusRow = z.infer<typeof reservationStatusRowSchema>;
export type HotelContactRow = z.infer<typeof hotelContactRowSchema>;

export const lookupResultSchema = z.object({
  bookingReferenceId: z.string(),
  reservationNumber: z.string(),
  status: z.enum(["pending", "confirmed", "completed", "cancelled"]),
  statusLabel: z.string(),
  roomCategory: z.string(),
  rooms: z.number(),
  checkInDate: z.string(),
  checkOutDate: z.string(),
  paymentMode: z.enum(["stripe", "pay_at_hotel"]),
  paymentSummary: z.string(),
  updatedAt: z.string(),
  hotel: z.object({
    name: z.string(),
    phone: z.string(),
    address: z.string(),
  }),
});

export const webReservationSummaryRowSchema = z.object({
  amount_due: z.union([z.number(), z.string()]).optional(),
  booking_reference_id: z.string().nullable().optional(),
  check_in_date: z.string(),
  check_out_date: z.string(),
  created_at: z.string(),
  guest_email: z.string().optional(),
  guest_name: z.string().nullable().optional(),
  guest_phone: z.string().optional(),
  id: z.string(),
  payment_mode: z.enum(["stripe", "pay_at_hotel"]).optional(),
  payment_status: z.enum(["collected", "not_collected", "refunded"]).optional(),
  refund_max_amount: z.union([z.number(), z.string()]).optional(),
  refund_status: z.enum(["cancelled", "failed", "not_required", "pending", "processing", "succeeded"]).optional(),
  refund_status_note: z.string().nullable().optional(),
  reservation_number: z.string(),
  room_shuffle_required: z.boolean(),
  room_type: z.string(),
  rooms_requested: z.number(),
  stripe_payment_intent_id: z.string().nullable().optional(),
  stripe_payment_method_brand: z.string().nullable().optional(),
  stripe_payment_method_last4: z.string().nullable().optional(),
  stripe_payment_method_type: z.string().nullable().optional(),
  sync_status: z.enum(["Cancelled", "Pending", "Synced"]),
  total_paid: z.union([z.number(), z.string()]).optional(),
});

export const webReservationDetailRowSchema = webReservationSummaryRowSchema.extend({
  edit_version: z.number(),
  hotel_id: z.string(),
  internal_note: z.string().nullable().optional(),
  payment_adjustment_amount: z.union([z.number(), z.string()]).optional(),
  payment_adjustment_required: z.boolean().optional(),
  room_type_id: z.string(),
});
