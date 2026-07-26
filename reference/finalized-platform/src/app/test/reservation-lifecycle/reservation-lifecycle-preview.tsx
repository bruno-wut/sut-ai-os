"use client";

import { useState } from "react";

import { ReservationDetail, type ReservationDetailActionHandlers } from "@/components/staff/reservation-detail";
import type { DashboardReservation } from "@/lib/staff-dashboard-data";

const baseReservation = {
  amountDue: 8_700,
  assignment: "shuffle_required",
  assignedRoom: "Pending reassignment",
  assignedRoomId: undefined,
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
  checkOutDate: "2026-07-24",
  created: "1 hr 42 min ago",
  currentNightlyRate: 1_450,
  editVersion: 2,
  guestEmail: "ploy@example.com",
  guestName: "Ploy K.",
  guestPhone: "+66 81 222 3333",
  id: "reservation-lifecycle-preview",
  internalNote: "",
  number: "WEB-260720-013",
  overrideRoomOptions: [
    { id: "preview-room-204", roomNumber: "204" },
    { id: "preview-room-206", roomNumber: "206" },
  ],
  paymentAdjustmentAmount: 0,
  paymentAdjustmentRequired: false,
  paymentMode: "pay_at_hotel",
  paymentStatus: "not_collected",
  roomType: "Superior Room x 2",
  source: "fixture",
  status: "Pending",
  stay: "2026-07-21 to 2026-07-24",
  total: 8_700,
} satisfies DashboardReservation;

export function ReservationLifecyclePreview() {
  const [reservation, setReservation] = useState<DashboardReservation>(baseReservation);

  const actionHandlers: Partial<ReservationDetailActionHandlers> = {
    async markReservationEnteredInPms() {
      setReservation((current) => ({
        ...current,
        editVersion: current.editVersion + 1,
        status: "Synced",
      }));

      return { ok: true };
    },
    async editReservation(input) {
      setReservation((current) => ({
        ...current,
        auditTrail: [
          {
            action: "Edited",
            actor: "Front desk",
            after: input.guestName,
            before: current.guestName,
            field: "Guest name",
            id: `audit-${current.editVersion + 1}-guest-name`,
            reason: input.reason,
            time: "20 Jul 11:02",
          },
          ...current.auditTrail,
        ],
        editVersion: current.editVersion + 1,
        guestEmail: input.guestEmail,
        guestName: input.guestName,
        guestPhone: input.guestPhone ?? current.guestPhone,
        internalNote: input.internalNote ?? "",
      }));

      return { ok: true };
    },
    async overrideReservation(input) {
      const nextRoom = input.roomId === "preview-room-204" ? "204" : input.roomId === "preview-room-206" ? "206" : "204";

      setReservation((current) => ({
        ...current,
        assignedRoom: nextRoom,
        assignedRoomId: input.roomId ?? "preview-room-204",
        assignment: "assigned",
        auditTrail: [
          {
            action: "Manager override",
            actor: "Manager",
            after: "THB 9,000",
            before: "THB 8,700",
            field: "Booking total",
            id: `audit-${current.editVersion + 1}-booking-total`,
            reason: input.reason,
            time: "20 Jul 11:06",
          },
          {
            action: "Manager override",
            actor: "Manager",
            after: nextRoom,
            before: current.assignedRoom,
            field: "Assigned room",
            id: `audit-${current.editVersion + 1}-room`,
            reason: input.reason,
            time: "20 Jul 11:06",
          },
          ...current.auditTrail,
        ],
        currentNightlyRate: input.nightlyRate ?? current.currentNightlyRate,
        editVersion: current.editVersion + 1,
        internalNote: input.internalNote ?? current.internalNote,
        paymentAdjustmentAmount: 300,
        paymentAdjustmentRequired: true,
        total: 9_000,
      }));

      return {
        data: {
          payment_adjustment_amount: 300,
          payment_adjustment_required: true,
        },
        ok: true,
      };
    },
    async cancelReservation(input) {
      setReservation((current) => ({
        ...current,
        auditTrail: [
          {
            action: "Cancelled",
            actor: "Front desk",
            after: "Cancelled",
            before: current.status,
            field: "Reservation status",
            id: `audit-${current.editVersion + 1}-cancel`,
            reason: input.reason,
            time: "20 Jul 11:09",
          },
          ...current.auditTrail,
        ],
        editVersion: current.editVersion + 1,
        status: "Cancelled",
      }));

      return {
        data: {
          payment_adjustment_required: false,
        },
        ok: true,
      };
    },
  };

  return (
    <main>
      <ReservationDetail
        actionHandlers={actionHandlers}
        refreshOnSuccess={false}
        reservation={reservation}
      />
    </main>
  );
}
