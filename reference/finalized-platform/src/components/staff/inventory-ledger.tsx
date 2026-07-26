"use client";

import { CalendarRange } from "lucide-react";
import { type KeyboardEvent, useActionState, useMemo, useState } from "react";

import type { InventoryRoomType } from "@/lib/staff-inventory-data";
import { useLocale } from "@/components/localization/locale-provider";
import { updateInventoryDay } from "@/app/(staff)/staff/inventory/actions";

function focusInventoryCell(rowIndex: number, columnIndex: number) {
  document.querySelector<HTMLButtonElement>(
    `[data-ledger-row="${rowIndex}"][data-ledger-column="${columnIndex}"]`,
  )?.focus();
}

export function InventoryLedger({ canEdit, connected, reconciliationIssueCount, roomTypes }: Readonly<{
  canEdit: boolean;
  connected: boolean;
  reconciliationIssueCount: number;
  roomTypes: readonly InventoryRoomType[];
}>) {
  const { dictionary } = useLocale();
  const copy = dictionary.inventoryLedger;

  const dates = roomTypes[0]?.days ?? [];
  const allocatedTotal = useMemo(() => roomTypes.reduce((sum, type) => sum + type.webRooms, 0), [roomTypes]);
  const [selected, setSelected] = useState<{ roomType: InventoryRoomType; dayIndex: number } | null>(null);
  const [updateState, updateAction, updatePending] = useActionState(updateInventoryDay, { error: null, success: null });

  function handleCellKeyDown(event: KeyboardEvent<HTMLButtonElement>, rowIndex: number, columnIndex: number) {
    if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    const nextRow = event.key === "ArrowUp"
      ? Math.max(0, rowIndex - 1)
      : event.key === "ArrowDown"
        ? Math.min(roomTypes.length - 1, rowIndex + 1)
        : rowIndex;
    const nextColumn = event.key === "ArrowLeft"
      ? Math.max(0, columnIndex - 1)
      : event.key === "ArrowRight"
        ? Math.min(dates.length - 1, columnIndex + 1)
        : columnIndex;
    focusInventoryCell(nextRow, nextColumn);
  }

  return (
    <>
      <div aria-live="polite" className="ledger-toolbar">
        <div className="date-navigator">
          <div><CalendarRange aria-hidden="true" size={16} /><strong>{dates.length ? `${dates[0].label} - ${dates[dates.length - 1].label}` : copy.noDates}</strong></div>
        </div>
        <span className="preview-kicker">{connected ? copy.current : copy.unavailable}</span>
      </div>

      <section className="inventory-table-wrap" aria-label={copy.tableLabel}>
        <table aria-label={copy.gridLabel} className="inventory-table" role="grid">
          <thead><tr role="row"><th scope="col">{copy.colRoomType}</th>{dates.map((date) => <th scope="col" key={date.date}><span>{date.label}</span></th>)}</tr></thead>
          <tbody>
            {roomTypes.map((type, rowIndex) => (
              <tr key={type.id} role="row">
                <th scope="row"><strong>{type.name}</strong><span>{copy.webPhysical(type.webRooms, type.physicalRooms)}</span></th>
                {type.days.map((day, columnIndex) => {
                  const closed = !day.openForSale;
                  return (
                    <td key={day.date} role="gridcell">
                      <button
                        aria-label={closed ? `${type.name} ${day.label}: ${copy.closed}` : `${type.name} ${day.label}: ${day.available} ${copy.available}`}
                        aria-pressed={closed}
                        className={`inventory-cell${closed ? " is-closed" : ""}`}
                        data-ledger-column={columnIndex}
                        data-ledger-row={rowIndex}
                        onKeyDown={(event) => handleCellKeyDown(event, rowIndex, columnIndex)}
                        onClick={() => canEdit && setSelected({ dayIndex: columnIndex, roomType: type })}
                        type="button"
                      >
                        <strong>{closed ? copy.closed : day.available}</strong>
                        <span>{closed ? copy.webOffSold : copy.available}</span>
                        <small>THB {day.nightlyRate.toLocaleString()}</small>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {canEdit && selected ? (
        <section aria-label="Edit inventory" className="staff-panel inventory-editor">
          <header className="staff-panel__header">
            <h2>Edit {selected.roomType.name} · {selected.roomType.days[selected.dayIndex].label}</h2>
            <button className="button button--secondary" onClick={() => setSelected(null)} type="button">Close</button>
          </header>
          <form action={updateAction} className="inventory-editor__form">
            <input name="roomTypeId" type="hidden" value={selected.roomType.id} />
            <input name="date" type="hidden" value={selected.roomType.days[selected.dayIndex].date} />
            <label>Nightly rate (THB)<input defaultValue={selected.roomType.days[selected.dayIndex].nightlyRate} min="0" name="nightlyRate" required step="1" type="number" /></label>
            <label>Website sale status<select defaultValue={String(selected.roomType.days[selected.dayIndex].openForSale)} name="isAvailable"><option value="true">Open for sale</option><option value="false">Closed</option></select></label>
            <label>Audit reason<input minLength={10} name="reason" placeholder="Reason for this inventory change" required type="text" /></label>
            <button className="button button--primary" disabled={updatePending} type="submit">{updatePending ? "Saving..." : "Save inventory"}</button>
          </form>
          {updateState.error ? <p className="setup-panel__error" role="alert">{updateState.error}</p> : null}
          {updateState.success ? <p className="setup-panel__success" role="status">{updateState.success}</p> : null}
        </section>
      ) : null}

      <section aria-label="Physical room allocation" className="staff-panel physical-allocation">
        <header className="staff-panel__header"><h2>Physical room allocation</h2><span>Booked, held, open, and closed by room</span></header>
        {reconciliationIssueCount ? <p className="setup-panel__error" role="alert">{reconciliationIssueCount} allocation record(s) do not match active reservation nights.</p> : <p className="setup-panel__success" role="status">All booked allotments reconcile with reservation nights.</p>}
        <div aria-label="Physical room allocation table" className="data-table-wrap" role="region" tabIndex={0}>
          <table className="data-table"><thead><tr><th scope="col">Room</th>{dates.map((date) => <th key={date.date} scope="col">{date.label}</th>)}</tr></thead><tbody>
            {roomTypes.flatMap((type) => type.physicalRoomStatuses.map((room) => (
              <tr key={room.id}><th scope="row">{room.roomNumber}<small>{type.name}</small></th>{room.days.map((day) => <td key={day.date}><span className={`status-pill status-pill--${day.status.toLowerCase()}`}>{day.status}</span></td>)}</tr>
            ))) }
          </tbody></table>
        </div>
      </section>

      <div className="ledger-legend"><span><i className="legend-dot legend-dot--open" />{copy.legendOpen}</span><span><i className="legend-dot legend-dot--closed" />{copy.legendClosed}</span><span>{copy.legendAllocated(allocatedTotal)}</span></div>
      {!roomTypes.length ? <div className="table-empty">{copy.empty}</div> : null}
    </>
  );
}
