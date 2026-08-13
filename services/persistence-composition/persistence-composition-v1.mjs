import { createPersistencePort } from "../../packages/persistence-port/src/persistence-port-v1.mjs";

const CONFIG_FIELDS = Object.freeze(["schemaVersion", "adapterId"]);
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, fields) {
  return isPlainObject(value) && Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sameHistoryIdentity(existing, candidate) {
  return existing.dataCategory === candidate.dataCategory && existing.artifactClass === candidate.artifactClass && existing.retentionAction === candidate.retentionAction;
}

function isProtectedAuditRecord(record) {
  return record.dataCategory === "required_audit_evidence" || record.artifactClass === "audit_evidence";
}

function createMapAdapter() {
  const histories = new Map();
  return Object.freeze({
    adapterId: "reference-map-v1",
    mode: "fixture_only",
    execute(operation, record) {
      const history = histories.get(record.recordId) ?? [];
      const current = history.at(-1) ?? null;
      if (operation === "read") return current === null ? { ok: true, status: "not_found", record: null } : { ok: true, status: "found", record: clone(current) };
      if (operation === "write") {
        if (current !== null) return { ok: false, reasonCode: "RECORD_ALREADY_EXISTS" };
        const stored = { ...clone(record), revision: 1 };
        histories.set(stored.recordId, [stored]);
        return { ok: true, status: "written", record: clone(stored) };
      }
      if (operation === "append") {
        if (current !== null && !sameHistoryIdentity(current, record)) return { ok: false, reasonCode: "RECORD_IDENTITY_CONFLICT" };
        const stored = { ...clone(record), revision: current === null ? 1 : current.revision + 1 };
        histories.set(stored.recordId, [...history, stored]);
        return { ok: true, status: "appended", record: clone(stored) };
      }
      if (current === null) return { ok: true, status: "not_found", record: null };
      if (!sameHistoryIdentity(current, record)) return { ok: false, reasonCode: "RECORD_IDENTITY_CONFLICT" };
      if (isProtectedAuditRecord(current)) return { ok: false, reasonCode: "PROTECTED_RECORD_DELETE_FORBIDDEN" };
      histories.delete(record.recordId);
      return { ok: true, status: "deleted", record: clone(current) };
    }
  });
}

function createJournalAdapter() {
  const journal = [];
  function current(recordId) {
    for (let index = journal.length - 1; index >= 0; index -= 1) {
      const entry = journal[index];
      if (entry.record.recordId === recordId) return entry.deleted ? null : entry.record;
    }
    return null;
  }
  return Object.freeze({
    adapterId: "reference-journal-v1",
    mode: "fixture_only",
    execute(operation, record) {
      const existing = current(record.recordId);
      if (operation === "read") return existing === null ? { ok: true, status: "not_found", record: null } : { ok: true, status: "found", record: clone(existing) };
      if (operation === "write") {
        if (existing !== null) return { ok: false, reasonCode: "RECORD_ALREADY_EXISTS" };
        const stored = { ...clone(record), revision: 1 };
        journal.push({ deleted: false, record: stored });
        return { ok: true, status: "written", record: clone(stored) };
      }
      if (operation === "append") {
        if (existing !== null && !sameHistoryIdentity(existing, record)) return { ok: false, reasonCode: "RECORD_IDENTITY_CONFLICT" };
        const stored = { ...clone(record), revision: existing === null ? 1 : existing.revision + 1 };
        journal.push({ deleted: false, record: stored });
        return { ok: true, status: "appended", record: clone(stored) };
      }
      if (existing === null) return { ok: true, status: "not_found", record: null };
      if (!sameHistoryIdentity(existing, record)) return { ok: false, reasonCode: "RECORD_IDENTITY_CONFLICT" };
      if (isProtectedAuditRecord(existing)) return { ok: false, reasonCode: "PROTECTED_RECORD_DELETE_FORBIDDEN" };
      journal.push({ deleted: true, record: clone(existing) });
      return { ok: true, status: "deleted", record: clone(existing) };
    }
  });
}

function unavailableAdapter(reasonCode) {
  return Object.freeze({
    adapterId: "unavailable-reference-v1",
    mode: "fixture_only",
    execute() { return { ok: false, reasonCode }; }
  });
}

/** Select a committed fixture-only adapter outside the provider-neutral core. */
export function composePersistencePort(configuration) {
  try {
    if (!exactKeys(configuration, CONFIG_FIELDS)) {
      return createPersistencePort(unavailableAdapter("ADAPTER_CONFIGURATION_MISSING"));
    }
    if (configuration.schemaVersion !== "1.0.0" || typeof configuration.adapterId !== "string" || !IDENTIFIER.test(configuration.adapterId)) return createPersistencePort(unavailableAdapter("UNSUPPORTED_ADAPTER_CONFIGURATION"));
    if (configuration.adapterId === "reference-map-v1") return createPersistencePort(createMapAdapter());
    if (configuration.adapterId === "reference-journal-v1") return createPersistencePort(createJournalAdapter());
    return createPersistencePort(unavailableAdapter("UNSUPPORTED_ADAPTER_CONFIGURATION"));
  } catch {
    return createPersistencePort(unavailableAdapter("ADAPTER_CONFIGURATION_MISSING"));
  }
}
