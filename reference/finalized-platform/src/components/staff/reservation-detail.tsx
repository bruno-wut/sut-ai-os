"use client";

import { ArrowLeft, Ban, Check, CircleAlert, CircleDollarSign, Mail, Pencil, Phone, Settings2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import {
  cancelReservation,
  editReservation,
  markReservationEnteredInPms,
  overrideReservation,
} from "@/app/(staff)/staff/reservations/[id]/actions";
import { issueStripeRefund } from "@/app/(staff)/staff/reservations/[id]/stripe-actions";
import { formatThaiBaht } from "@/lib/fixtures";
import type { getDictionary } from "@/lib/i18n/dictionaries";
import type { DashboardReservation } from "@/lib/staff-dashboard-data";
import { useLocale } from "@/components/localization/locale-provider";

type Operation = "cancel" | "edit" | "override" | "refund" | null;
type ReservationActionResult = Promise<{ data?: unknown; error?: string; ok: boolean }>;
export type ReservationDetailActionHandlers = Readonly<{
  cancelReservation: (input: {
    expectedVersion: number;
    managerApprovalPin?: string;
    reason: string;
    reservationId: string;
  }) => ReservationActionResult;
  editReservation: (input: {
    expectedVersion: number;
    guestEmail: string;
    guestName: string;
    guestPhone?: string;
    internalNote?: string;
    reason: string;
    reservationId: string;
  }) => ReservationActionResult;
  issueStripeRefund: (input: {
    amount: number;
    note?: string;
    reason: "duplicate_charge" | "force_majeure" | "guest_requested" | "hotel_initiated" | "manager_override";
    reservationId: string;
  }) => ReservationActionResult;
  markReservationEnteredInPms: (reservationId: string) => ReservationActionResult;
  overrideReservation: (input: {
    checkInDate?: string;
    checkOutDate?: string;
    expectedVersion: number;
    internalNote?: string;
    nightlyRate?: number;
    reason: string;
    reservationId: string;
    roomId?: string;
  }) => ReservationActionResult;
}>;
type Notice =
  | Readonly<{ message: string; tone: "error" }>
  | Readonly<{ message: string; tone: "success" }>;
type StaffCopy = ReturnType<typeof getDictionary>["reservationDetail"];

function getResultPayload(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getBooleanValue(value: unknown) {
  return value === true;
}

function getNumberValue(value: unknown) {
  const numericValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getPaymentLabel(reservation: DashboardReservation, copy: StaffCopy) {
  if (reservation.paymentStatus === "refunded") return copy.refunded;
  if (reservation.paymentStatus === "collected") return copy.collected;
  if (reservation.paymentMode === "pay_at_hotel") return copy.payAtHotel;
  return copy.awaitingPayment;
}

function getStripeTransactionLabel(reservation: DashboardReservation) {
  return reservation.paymentMode === "stripe" ? reservation.stripeTransactionId ?? "-" : "-";
}

function getPaymentMethodLabel(reservation: DashboardReservation, copy: StaffCopy) {
  if (reservation.paymentMode === "pay_at_hotel") return "-";
  return reservation.stripePaymentMethodLabel ?? copy.stripe;
}

function refundStatusLabel(status: DashboardReservation["refundStatus"], copy: StaffCopy) {
  switch (status) {
    case "pending":
      return copy.refundPending;
    case "processing":
      return copy.refundProcessing;
    case "succeeded":
      return copy.refundSucceeded;
    case "failed":
      return copy.refundFailed;
    case "cancelled":
      return copy.refundCancelled;
    default:
      return copy.noRefundDue;
  }
}

const defaultActionHandlers: ReservationDetailActionHandlers = {
  cancelReservation,
  editReservation,
  issueStripeRefund,
  markReservationEnteredInPms,
  overrideReservation,
};

const formTranslations = {
  en: {
    editEyebrow: "Routine field edit",
    editHeading: "Edit reservation details",
    editDesc: "Contact and note changes stay within the dedicated reservation edit workflow and add field-level audit rows.",
    labelGuestName: "Guest name",
    labelGuestEmail: "Guest email",
    labelGuestPhone: "Guest phone",
    labelInternalNote: "Internal note",
    labelEditReason: "Reason for edit",
    btnKeepUnchanged: "Keep unchanged",
    btnSaveEdits: "Save field edits",
    saving: "Saving...",

    overrideEyebrow: "Manager override",
    overrideHeading: "Adjust room, dates, or rate",
    overrideDesc: "This operation rechecks inventory, increments the revision, and returns PMS sync to pending when a confirmed booking changes.",
    labelCheckIn: "Check-in date",
    labelCheckOut: "Check-out date",
    labelAssignedRoom: "Assigned room",
    keepCurrentAssign: "Keep current assignment",
    currentOption: " (current)",
    labelNightlyRate: "Nightly rate (THB)",
    labelOverrideReason: "Override reason",
    overrideWarning: "Collected Stripe payments are not changed automatically; material total changes stay flagged for review.",
    btnApplyOverride: "Apply manager override",
    applying: "Applying...",

    refundEyebrow: "Stripe refund",
    refundHeading: "Issue guest refund",
    refundDesc: "The maximum eligible refund is suggested below. Adjust the exact amount for cancellation penalties or approved exceptions before submitting.",
    labelRefundAmount: "Refund amount (THB)",
    labelRefundReason: "Refund reason",
    refundReasons: {
      guest_requested: "Guest requested",
      force_majeure: "Force majeure",
      manager_override: "Manager override",
      hotel_initiated: "Hotel initiated",
      duplicate_charge: "Duplicate charge",
    },
    refundWarning: "Stripe idempotency uses this reservation, and the ledger locks the refund before the provider call.",
    btnReviewLater: "Review later",
    btnIssueRefund: "Issue Stripe refund",
    issuing: "Issuing...",

    cancelEyebrow: "Destructive operation",
    cancelHeading: "Cancel this reservation?",
    cancelDescCollected: "Active room nights will be released and PMS cancellation will be queued. Collected payment will be evaluated against the cancellation window before refund review opens.",
    cancelDescNotCollected: "Active room nights will be released and PMS cancellation will be queued. No collected payment is attached.",
    cancelWarning: "A manager or administrator must approve this near-arrival cancellation with their PIN before the hotel releases these nights.",
    labelCancelReason: "Cancellation reason",
    labelManagerPin: "Manager/admin approval PIN",
    btnKeepReservation: "Keep reservation",
    btnCancelRooms: "Cancel and release rooms",
    cancelling: "Cancelling...",

    actionFailed: "The reservation action could not be completed.",
    actionSuccessSync: "Booking confirmed · confirmation notification queued",
    actionSuccessEditPms: "Reservation saved · PMS sync returned to pending",
    actionSuccessEdit: "Reservation saved",
    actionSuccessOverrideFlagged: (amount: string) => `Override applied · ${amount} flagged for payment review`,
    actionSuccessOverride: "Override applied · inventory rechecked · PMS sync pending",
    actionSuccessCancelRefund: "Reservation cancelled · room nights released · refund review required",
    actionSuccessCancel: "Reservation cancelled · room nights released",
    actionSuccessRefund: (amount: string, status: string) => `Refund submitted · ${amount} ${status}`,
  },
  th: {
    editEyebrow: "แก้ไขฟิลด์ข้อมูลการจอง",
    editHeading: "แก้ไขรายละเอียดการจอง",
    editDesc: "การแก้ไขข้อมูลการติดต่อและบันทึกเพิ่มเติมจะถูกเก็บบันทึกประวัติในระบบและเพิ่มแถวการตรวจสอบในระดับฟิลด์",
    labelGuestName: "ชื่อผู้เข้าพัก",
    labelGuestEmail: "อีเมลผู้เข้าพัก",
    labelGuestPhone: "เบอร์โทรศัพท์ผู้เข้าพัก",
    labelInternalNote: "บันทึกภายใน",
    labelEditReason: "เหตุผลในการแก้ไข",
    btnKeepUnchanged: "ยกเลิกการแก้ไข",
    btnSaveEdits: "บันทึกข้อมูล",
    saving: "กำลังบันทึก...",

    overrideEyebrow: "อนุมัติพิเศษโดยผู้จัดการ",
    overrideHeading: "ปรับปรุงห้องพัก วันที่ หรือราคาคืนพัก",
    overrideDesc: "การดำเนินการนี้จะทำการตรวจสอบสถานะห้องว่างใหม่ อัปเดตข้อมูล และส่งกลับไปยังสถานะรอเข้าระบบ PMS เสมือนว่ามีการเปลี่ยนแปลงจองใหม่",
    labelCheckIn: "วันที่เช็กอิน",
    labelCheckOut: "วันที่เช็กเอาต์",
    labelAssignedRoom: "ห้องพักที่จัดสรร",
    keepCurrentAssign: "ใช้การจัดสรรปัจจุบัน",
    currentOption: " (ปัจจุบัน)",
    labelNightlyRate: "ราคาห้องพักต่อคืน (บาท)",
    labelOverrideReason: "เหตุผลการปรับปรุงข้อมูล",
    overrideWarning: "ยอดชำระเงินเดิมผ่านทาง Stripe จะไม่มีการปรับเปลี่ยนอัตโนมัติ ยอดที่เปลี่ยนแปลงจะถูกส่งรอตรวจสอบความถูกต้อง",
    btnApplyOverride: "บันทึกการปรับปรุงข้อมูล",
    applying: "กำลังบันทึก...",

    refundEyebrow: "การคืนเงินผ่าน Stripe",
    refundHeading: "ดำเนินการคืนเงินให้ลูกค้า",
    refundDesc: "ยอดเงินคืนสูงสุดแนะนำระบุด้านล่าง กรุณาตรวจสอบยอดการปรับลดค่าธรรมเนียมก่อนดำเนินการส่งข้อมูล",
    labelRefundAmount: "จำนวนเงินคืน (บาท)",
    labelRefundReason: "เหตุผลในการคืนเงิน",
    refundReasons: {
      guest_requested: "ลูกค้าแจ้งขอคืนเงิน",
      force_majeure: "เหตุสุดวิสัย",
      manager_override: "ผู้จัดการอนุมัติเป็นกรณีพิเศษ",
      hotel_initiated: "ยกเลิกโดยโรงแรม",
      duplicate_charge: "เรียกเก็บเงินซ้ำซ้อน",
    },
    refundWarning: "การดำเนินการคืนเงินถูกผูกมัดเพื่อความปลอดภัยทางบัญชีและไม่สามารถทำรายการซ้ำซ้อนได้",
    btnReviewLater: "ยกเลิก",
    btnIssueRefund: "ยืนยันการคืนเงิน",
    issuing: "กำลังดำเนินการ...",

    cancelEyebrow: "การดำเนินการถาวร",
    cancelHeading: "ยกเลิกการจองนี้?",
    cancelDescCollected: "ห้องพักจะถูกปล่อยกลับเข้าสู่ระบบ และจัดคิวยกเลิกใน PMS ยอดเงินที่ได้รับจะถูกประเมินเทียบกับเงื่อนไขนโยบายยกเลิกเพื่อสรุปการคืนเงิน",
    cancelDescNotCollected: "ห้องพักจะถูกปล่อยกลับเข้าสู่ระบบ และจัดคิวยกเลิกใน PMS ไม่มียอดชำระเงินผูกกับรายการนี้",
    cancelWarning: "ผู้จัดการหรือผู้ดูแลระบบต้องทำการกรอกรหัส PIN เพื่ออนุมัติการยกเลิกการจองก่อนถึงกำหนดเข้าพักนี้ เพื่อให้โรงแรมปล่อยห้องพักขายต่อ",
    labelCancelReason: "เหตุผลในการยกเลิกการจอง",
    labelManagerPin: "รหัส PIN ของผู้จัดการเพื่ออนุมัติ",
    btnKeepReservation: "เก็บการจองไว้",
    btnCancelRooms: "ยืนยันยกเลิกและปล่อยห้องพัก",
    cancelling: "กำลังดำเนินการยกเลิก...",

    actionFailed: "ไม่สามารถทำรายการการจองนี้ได้สำเร็จ",
    actionSuccessSync: "ยืนยันการจองเรียบร้อยแล้ว · ส่งข้อมูลเข้าสู่คิวนำส่งอีเมลยืนยัน",
    actionSuccessEditPms: "บันทึกการจองเรียบร้อยแล้ว · ส่งสถานะกลับไปรอเข้า PMS ใหม่",
    actionSuccessEdit: "บันทึกการจองเรียบร้อยแล้ว",
    actionSuccessOverrideFlagged: (amount: string) => `ปรับปรุงข้อมูลสำเร็จ · ยอดปรับปรุง ${amount} รอตรวจสอบความถูกต้อง`,
    actionSuccessOverride: "ปรับปรุงข้อมูลสำเร็จ · ตรวจสอบสถานะห้องว่างและรอเข้า PMS อีกครั้ง",
    actionSuccessCancelRefund: "ยกเลิกการจองสำเร็จ · ปล่อยจำนวนห้องว่างเข้าสู่ระบบ · รอผู้จัดการอนุมัติเงินคืน",
    actionSuccessCancel: "ยกเลิกการจองสำเร็จ · ปล่อยจำนวนห้องว่างเข้าสู่ระบบเรียบร้อย",
    actionSuccessRefund: (amount: string, status: string) => `ส่งคำขอคืนเงินสำเร็จ · ยอดคืน ${amount} สถานะ: ${status}`,
  }
} as const;

export function ReservationDetail({
  reservation,
  actionHandlers,
  refreshOnSuccess = true,
}: Readonly<{
  actionHandlers?: Partial<ReservationDetailActionHandlers>;
  refreshOnSuccess?: boolean;
  reservation: DashboardReservation;
}>) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const resolvedActionHandlers = { ...defaultActionHandlers, ...actionHandlers };

  const { dictionary, locale } = useLocale();
  const copy = dictionary.reservationDetail;
  const fCopy = locale === "th" ? formTranslations.th : formTranslations.en;

  const isCancelled = reservation.status === "Cancelled";
  const isSynced = reservation.status === "Synced";
  const paymentCollected = reservation.paymentStatus === "collected";
  const refundMaxAmount = reservation.refundMaxAmount ?? Math.abs(reservation.paymentAdjustmentAmount ?? 0);
  const assignedRoom = reservation.assignedRoom ?? (reservation.assignment === "shuffle_required" ? copy.pendingReassign : copy.unassigned);
  const lateCancellationApprovalRequired = Boolean(reservation.lateCancellationApprovalRequired);

  function runReservationAction(action: () => Promise<{ data?: unknown; error?: string; ok: boolean }>, getSuccessMessage: (payload: Record<string, unknown>) => string) {
    startTransition(async () => {
      const result = await action();

      if (!result.ok) {
        setNotice({ message: result.error ?? fCopy.actionFailed, tone: "error" });
        return;
      }

      setOperation(null);
      setNotice({ message: getSuccessMessage(getResultPayload(result.data)), tone: "success" });
      if (refreshOnSuccess) {
        router.refresh();
      }
    });
  }

  function markSynced() {
    runReservationAction(
      () => resolvedActionHandlers.markReservationEnteredInPms(reservation.id),
      () => fCopy.actionSuccessSync,
    );
  }

  function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    runReservationAction(
      () =>
        resolvedActionHandlers.editReservation({
          expectedVersion: reservation.editVersion,
          guestEmail: String(data.get("guestEmail") ?? ""),
          guestName: String(data.get("guestName") ?? ""),
          guestPhone: String(data.get("guestPhone") ?? "").trim() || undefined,
          internalNote: String(data.get("internalNote") ?? ""),
          reason: String(data.get("reason") ?? ""),
          reservationId: reservation.id,
        }),
      (payload) =>
        getBooleanValue(payload.pms_update_required)
          ? fCopy.actionSuccessEditPms
          : fCopy.actionSuccessEdit,
    );
  }

  function submitOverride(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nightlyRateRaw = String(data.get("nightlyRate") ?? "").trim();

    runReservationAction(
      () =>
        resolvedActionHandlers.overrideReservation({
          checkInDate: String(data.get("checkInDate") ?? "").trim() || undefined,
          checkOutDate: String(data.get("checkOutDate") ?? "").trim() || undefined,
          expectedVersion: reservation.editVersion,
          internalNote: String(data.get("internalNote") ?? ""),
          nightlyRate: nightlyRateRaw ? Number(nightlyRateRaw) : undefined,
          reason: String(data.get("reason") ?? ""),
          reservationId: reservation.id,
          roomId: String(data.get("roomId") ?? "").trim() || undefined,
        }),
      (payload) => {
        if (getBooleanValue(payload.payment_adjustment_required)) {
          const adjustmentAmount = Math.abs(getNumberValue(payload.payment_adjustment_amount));
          return fCopy.actionSuccessOverrideFlagged(formatThaiBaht(adjustmentAmount));
        }

        return fCopy.actionSuccessOverride;
      },
    );
  }

  function submitCancel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);

    runReservationAction(
      () =>
        resolvedActionHandlers.cancelReservation({
          expectedVersion: reservation.editVersion,
          managerApprovalPin: String(data.get("managerApprovalPin") ?? "").trim() || undefined,
          reason: String(data.get("reason") ?? ""),
          reservationId: reservation.id,
        }),
      (payload) =>
        getBooleanValue(payload.payment_adjustment_required)
          ? fCopy.actionSuccessCancelRefund
          : fCopy.actionSuccessCancel,
    );
  }

  function submitRefund(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const amount = Number(data.get("amount"));
    const reason = String(data.get("reason") ?? "");

    runReservationAction(
      () =>
        resolvedActionHandlers.issueStripeRefund({
          amount,
          note: String(data.get("note") ?? "").trim() || undefined,
          reason: reason as "duplicate_charge" | "force_majeure" | "guest_requested" | "hotel_initiated" | "manager_override",
          reservationId: reservation.id,
        }),
      (payload) => fCopy.actionSuccessRefund(formatThaiBaht(getNumberValue(payload.amount_refunded) || amount), String(payload.refund_status ?? "processing")),
    );
  }

  return (
    <>
      <Link className="back-link" href="/staff/reservations"><ArrowLeft aria-hidden="true" size={16} />{copy.backToList}</Link>
      <header className="reservation-detail-header"><div><span className="preview-kicker">{reservation.source === "supabase" ? copy.currentReservation : copy.sampleReservation} · {copy.revision} {reservation.editVersion}</span><h1>{reservation.number}</h1><p>{reservation.guestName} · {reservation.stay}</p></div><div className="reservation-detail-header__actions"><div className="reservation-state-pair"><span><small>{copy.booking}</small><strong className={`status-pill status-pill--${isCancelled ? "cancelled" : isSynced ? "synced" : "pending"}`}>{isCancelled ? copy.cancelled : isSynced ? copy.confirmed : copy.pmsPending}</strong></span><span><small>{copy.payment}</small><strong className={`payment-badge payment-badge--${reservation.paymentStatus}`}>{getPaymentLabel(reservation, copy)}</strong></span></div><button className="button button--primary" disabled={isSynced || isCancelled || isPending} onClick={markSynced} type="button"><Check aria-hidden="true" size={16} />{isPending ? copy.confirming : isSynced ? copy.enteredInPms : copy.markEnteredInPms}</button></div></header>
      {notice ? <div className="operation-notice" role="status">{notice.tone === "success" ? <Check aria-hidden="true" size={16} /> : <CircleAlert aria-hidden="true" size={16} />}{notice.message}</div> : null}
      {reservation.isPiiAnonymized ? <div className="operation-notice" role="status"><CircleAlert aria-hidden="true" size={16} />{copy.piiAnonymized}</div> : null}
      {!isCancelled && reservation.assignment === "shuffle_required" ? <div className="shuffle-banner"><CircleAlert aria-hidden="true" size={20} /><div><strong>{copy.shuffleRequiredTitle}</strong><p>{copy.shuffleRequiredDesc}</p></div></div> : null}

      <section aria-label="Reservation operations" className="reservation-operations staff-panel">
        <div><span className="eyebrow">{copy.opsTitle}</span><h2>{copy.opsHeading}</h2><p>{copy.opsDesc}</p></div>
        <div className="reservation-operations__actions"><button className="button button--secondary" disabled={reservation.isPiiAnonymized || isCancelled || isPending} onClick={() => setOperation("edit")} type="button"><Pencil aria-hidden="true" size={15} />{copy.btnEdit}</button><button className="button button--secondary" disabled={reservation.isPiiAnonymized || !reservation.canOverride || isCancelled || isPending} onClick={() => setOperation("override")} type="button"><Settings2 aria-hidden="true" size={15} />{copy.btnAdjust}</button><button className="button button--secondary" disabled={!reservation.canIssueRefund || isPending} onClick={() => setOperation("refund")} type="button"><CircleDollarSign aria-hidden="true" size={15} />{copy.btnRefund}</button><button className="button button--danger-outline" disabled={reservation.isPiiAnonymized || isCancelled || isPending} onClick={() => setOperation("cancel")} type="button"><Ban aria-hidden="true" size={15} />{copy.btnCancel}</button></div>
        {reservation.overrideConstraintNote ? <p className="reservation-operations__hint">{reservation.overrideConstraintNote}</p> : null}
        {lateCancellationApprovalRequired ? (
          <p className="reservation-operations__hint">
            Near-arrival cancellations require a manager or administrator approval PIN before rooms can be released.
          </p>
        ) : null}
      </section>

      <div className="reservation-detail-grid">
        <section className="staff-panel detail-section"><header className="staff-panel__header"><h2>{copy.stayHeading}</h2><span>{copy.staySub}</span></header><dl className="detail-list"><div><dt>{copy.colRoomType}</dt><dd>{reservation.roomType}</dd></div>{reservation.bookingReferenceId ? <div><dt>{copy.colGuestRef}</dt><dd><code>{reservation.bookingReferenceId}</code></dd></div> : null}<div><dt>{copy.colStay}</dt><dd>{reservation.stay}</dd></div><div><dt>{copy.colAssignedRoom}</dt><dd>{assignedRoom}</dd></div><div><dt>{copy.colPaymentMode}</dt><dd>{reservation.paymentMode === "stripe" ? copy.stripe : copy.payAtHotel}</dd></div><div><dt>{copy.colPaymentMethod}</dt><dd>{getPaymentMethodLabel(reservation, copy)}</dd></div><div><dt>{copy.colStripeTx}</dt><dd><code className="transaction-id">{getStripeTransactionLabel(reservation)}</code></dd></div><div><dt>{copy.colBookingTotal}</dt><dd>{formatThaiBaht(reservation.total)}</dd></div><div><dt>{copy.colAmountDue}</dt><dd>{formatThaiBaht(reservation.amountDue)}</dd></div><div><dt>{copy.colRefundStatus}</dt><dd>{refundStatusLabel(reservation.refundStatus, copy)}</dd></div></dl>{reservation.paymentAdjustmentRequired ? <div className="override-warning"><CircleAlert aria-hidden="true" size={17} /><span>{copy.adjustFlagged(formatThaiBaht(Math.abs(reservation.paymentAdjustmentAmount ?? 0)))}</span></div> : null}{reservation.refundStatusNote ? <div className="override-warning"><CircleAlert aria-hidden="true" size={17} /><span>{reservation.refundStatusNote}</span></div> : null}{reservation.refundFailureMessage ? <div className="override-warning"><CircleAlert aria-hidden="true" size={17} /><span>{reservation.refundFailureMessage}</span></div> : null}</section>
        <section className="staff-panel detail-section"><header className="staff-panel__header"><h2>{copy.contactHeading}</h2><span>{copy.contactSub}</span></header><div className="contact-list"><span><Mail aria-hidden="true" size={16} />{reservation.guestEmail ?? copy.notAvailable}</span><span><Phone aria-hidden="true" size={16} />{reservation.guestPhone ?? copy.notAvailable}</span></div>{reservation.internalNote ? <div className="internal-note"><strong>{copy.internalNote}</strong><p>{reservation.internalNote}</p></div> : null}</section>
        {!isCancelled && reservation.assignment === "shuffle_required" ? <section className="staff-panel detail-section detail-section--wide"><header className="staff-panel__header"><h2>{copy.reassignHeading}</h2><span>{copy.reassignSub}</span></header><p>{copy.reassignDesc}</p></section> : null}
        <section className="staff-panel detail-section detail-section--wide"><header className="staff-panel__header"><h2>{copy.auditHeading}</h2><span>{copy.auditSub}</span></header><div className="audit-table-wrap"><table className="audit-table"><thead><tr><th>{copy.auditThAction}</th><th>{copy.auditThField}</th><th>{copy.auditThBefore}</th><th>{copy.auditThAfter}</th><th>{copy.auditThReason}</th><th>{copy.auditThActor}</th></tr></thead><tbody>{reservation.auditTrail.map((entry) => <tr key={entry.id}><td><strong>{entry.action}</strong></td><td>{entry.field}</td><td>{entry.before}</td><td>{entry.after}</td><td>{entry.reason}</td><td>{entry.actor}<small>{entry.time}</small></td></tr>)}</tbody></table></div></section>
      </div>

      {operation ? (
        <div className="dialog-backdrop" role="presentation">
          <section aria-labelledby="operation-title" aria-modal="true" className={`operation-dialog${operation === "cancel" ? " operation-dialog--danger" : ""}`} role={operation === "cancel" ? "alertdialog" : "dialog"}>
            <button aria-label="Close dialog" className="dialog-close" disabled={isPending} onClick={() => setOperation(null)} type="button"><X aria-hidden="true" size={18} /></button>
            
            {operation === "edit" ? (
              <form onSubmit={submitEdit}>
                <p className="eyebrow">{fCopy.editEyebrow}</p>
                <h2 id="operation-title">{fCopy.editHeading}</h2>
                <p>{fCopy.editDesc}</p>
                <div className="operation-form-grid">
                  <label className="field"><span className="field__label">{fCopy.labelGuestName}</span><input className="field__control" defaultValue={reservation.guestName} name="guestName" required /></label>
                  <label className="field"><span className="field__label">{fCopy.labelGuestEmail}</span><input className="field__control" defaultValue={reservation.guestEmail ?? ""} name="guestEmail" required type="email" /></label>
                  <label className="field"><span className="field__label">{fCopy.labelGuestPhone}</span><input className="field__control" defaultValue={reservation.guestPhone ?? ""} name="guestPhone" /></label>
                  <label className="field operation-form-grid__wide"><span className="field__label">{fCopy.labelInternalNote}</span><textarea className="field__control" defaultValue={reservation.internalNote ?? ""} name="internalNote" rows={3} /></label>
                  <label className="field operation-form-grid__wide"><span className="field__label">{fCopy.labelEditReason}</span><input className="field__control" name="reason" required /></label>
                </div>
                <div className="operation-dialog__actions">
                  <button className="button button--secondary" disabled={isPending} onClick={() => setOperation(null)} type="button">{fCopy.btnKeepUnchanged}</button>
                  <button className="button button--primary" disabled={isPending} type="submit">{isPending ? fCopy.saving : fCopy.btnSaveEdits}</button>
                </div>
              </form>
            ) : null}

            {operation === "override" ? (
              <form onSubmit={submitOverride}>
                <p className="eyebrow">{fCopy.overrideEyebrow}</p>
                <h2 id="operation-title">{fCopy.overrideHeading}</h2>
                <p>{fCopy.overrideDesc}</p>
                <div className="operation-form-grid">
                  <label className="field"><span className="field__label">{fCopy.labelCheckIn}</span><input className="field__control" defaultValue={reservation.checkInDate ?? ""} name="checkInDate" required type="date" /></label>
                  <label className="field"><span className="field__label">{fCopy.labelCheckOut}</span><input className="field__control" defaultValue={reservation.checkOutDate ?? ""} name="checkOutDate" required type="date" /></label>
                  <label className="field"><span className="field__label">{fCopy.labelAssignedRoom}</span><select className="field__control" defaultValue={reservation.assignedRoomId ?? ""} name="roomId">{!reservation.assignedRoomId ? <option value="">{fCopy.keepCurrentAssign}</option> : null}{reservation.overrideRoomOptions.map((room) => <option key={room.id} value={room.id}>{room.roomNumber}{room.id === reservation.assignedRoomId ? fCopy.currentOption : ""}</option>)}</select></label>
                  <label className="field"><span className="field__label">{fCopy.labelNightlyRate}</span><input className="field__control" defaultValue={reservation.currentNightlyRate ?? ""} min="0" name="nightlyRate" type="number" /></label>
                  <label className="field operation-form-grid__wide"><span className="field__label">{fCopy.labelInternalNote}</span><textarea className="field__control" defaultValue={reservation.internalNote ?? ""} name="internalNote" rows={3} /></label>
                  <label className="field operation-form-grid__wide"><span className="field__label">{fCopy.labelOverrideReason}</span><input className="field__control" name="reason" required /></label>
                </div>
                <div className="override-warning"><CircleAlert aria-hidden="true" size={17} /><span>{fCopy.overrideWarning}</span></div>
                <div className="operation-dialog__actions">
                  <button className="button button--secondary" disabled={isPending} onClick={() => setOperation(null)} type="button">{fCopy.btnKeepUnchanged}</button>
                  <button className="button button--primary" disabled={isPending} type="submit">{isPending ? fCopy.applying : fCopy.btnApplyOverride}</button>
                </div>
              </form>
            ) : null}

            {operation === "refund" ? (
              <form onSubmit={submitRefund}>
                <p className="eyebrow">{fCopy.refundEyebrow}</p>
                <h2 id="operation-title">{fCopy.refundHeading}</h2>
                <p>{fCopy.refundDesc}</p>
                <div className="operation-form-grid">
                  <label className="field"><span className="field__label">{fCopy.labelRefundAmount}</span><input className="field__control" defaultValue={refundMaxAmount || ""} max={refundMaxAmount || undefined} min="1" name="amount" required step="1" type="number" /></label>
                  <label className="field"><span className="field__label">{fCopy.labelRefundReason}</span><select className="field__control" defaultValue="guest_requested" name="reason" required><option value="guest_requested">{fCopy.refundReasons.guest_requested}</option><option value="force_majeure">{fCopy.refundReasons.force_majeure}</option><option value="manager_override">{fCopy.refundReasons.manager_override}</option><option value="hotel_initiated">{fCopy.refundReasons.hotel_initiated}</option><option value="duplicate_charge">{fCopy.refundReasons.duplicate_charge}</option></select></label>
                  <label className="field operation-form-grid__wide"><span className="field__label">{fCopy.labelInternalNote}</span><textarea className="field__control" name="note" rows={3} /></label>
                </div>
                <div className="override-warning"><CircleAlert aria-hidden="true" size={17} /><span>{fCopy.refundWarning}</span></div>
                <div className="operation-dialog__actions">
                  <button className="button button--secondary" disabled={isPending} onClick={() => setOperation(null)} type="button">{fCopy.btnReviewLater}</button>
                  <button className="button button--primary" disabled={isPending} type="submit">{isPending ? fCopy.issuing : fCopy.btnIssueRefund}</button>
                </div>
              </form>
            ) : null}

            {operation === "cancel" ? (
              <form onSubmit={submitCancel}>
                <div className="danger-dialog__icon"><Ban aria-hidden="true" size={23} /></div>
                <p className="eyebrow">{fCopy.cancelEyebrow}</p>
                <h2 id="operation-title">{fCopy.cancelHeading}</h2>
                <p>{paymentCollected ? fCopy.cancelDescCollected : fCopy.cancelDescNotCollected}</p>
                {lateCancellationApprovalRequired ? <div className="override-warning"><CircleAlert aria-hidden="true" size={17} /><span>{fCopy.cancelWarning}</span></div> : null}
                <label className="field"><span className="field__label">{fCopy.labelCancelReason}</span><textarea className="field__control" name="reason" required rows={3} /></label>
                {lateCancellationApprovalRequired ? <label className="field"><span className="field__label">{fCopy.labelManagerPin}</span><input className="field__control" inputMode="numeric" maxLength={12} minLength={4} name="managerApprovalPin" pattern="[0-9]{4,12}" required type="password" /></label> : null}
                <div className="operation-dialog__actions">
                  <button className="button button--secondary" disabled={isPending} onClick={() => setOperation(null)} type="button">{fCopy.btnKeepReservation}</button>
                  <button className="button button--danger" disabled={isPending} type="submit">{isPending ? fCopy.cancelling : fCopy.btnCancelRooms}</button>
                </div>
              </form>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
