"use client";

import { ReservationDetail, type ReservationDetailActionHandlers } from "@/components/staff/reservation-detail";
import type { DashboardReservation } from "@/lib/staff-dashboard-data";

const testReservation = {
  amountDue: 0,
  assignment: "assigned",
  assignedRoom: "204",
  assignedRoomId: "preview-room-204",
  auditTrail: [
    {
      action: "Created",
      actor: "Booking system",
      after: "Confirmed web booking",
      before: "-",
      field: "Reservation",
      id: "created",
      reason: "Guest checkout",
      time: "20 Jul 10:42",
    },
  ],
  canIssueRefund: false,
  canOverride: true,
  checkInDate: "2026-07-21",
  checkOutDate: "2026-07-23",
  created: "Just now",
  currentNightlyRate: 1850,
  editVersion: 4,
  guestEmail: "preview@example.com",
  guestName: "Conflict Preview Guest",
  guestPhone: "+66 81 234 5678",
  id: "version-conflict-preview",
  internalNote: "Preview note",
  number: "WEB-TEST-VERSION-CONFLICT",
  overrideRoomOptions: [
    { id: "preview-room-204", roomNumber: "204" },
    { id: "preview-room-206", roomNumber: "206" },
  ],
  paymentMode: "stripe",
  paymentStatus: "collected",
  roomType: "Deluxe Room x 1",
  source: "fixture",
  status: "Pending",
  stay: "2026-07-21 to 2026-07-23",
  total: 3700,
} satisfies DashboardReservation;

const versionConflictActionHandlers: Partial<ReservationDetailActionHandlers> = {
  async editReservation() {
    return {
      error: "This reservation changed in another session. Refresh the page and try again.",
      ok: false,
    };
  },
};

export function ReservationVersionConflictPreview() {
  return (
    <main>
      <ReservationDetail
        actionHandlers={versionConflictActionHandlers}
        refreshOnSuccess={false}
        reservation={testReservation}
      />
    </main>
  );
}
