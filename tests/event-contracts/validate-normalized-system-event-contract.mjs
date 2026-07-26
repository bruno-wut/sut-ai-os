import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const schemaPath = path.join(repositoryRoot, "packages/event-contracts/normalized-system-event.schema.json");
const envelopeFields = ["schemaVersion", "eventId", "correlationId", "source", "type", "severity", "occurredAt", "payload"];
const eventTypePattern = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)+$/;
const rfc3339Pattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

const isRfc3339DateTime = (value) => {
  if (typeof value !== "string") return false;
  const match = value.match(rfc3339Pattern);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText, secondText, zone] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  if (month < 1 || month > 12 || hour > 23 || minute > 59 || second > 59) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return false;
  if (zone !== "Z") {
    const [offsetHour, offsetMinute] = zone.slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) return false;
  }
  return true;
};

const validateEvent = (event) => {
  if (!isObject(event)) return false;
  if (Object.keys(event).length !== envelopeFields.length || Object.keys(event).some((key) => !envelopeFields.includes(key))) return false;
  if (envelopeFields.some((field) => !(field in event))) return false;
  if (event.schemaVersion !== "1.0.0") return false;
  if (typeof event.eventId !== "string" || event.eventId.length === 0) return false;
  if (typeof event.correlationId !== "string" || event.correlationId.length === 0) return false;
  if (!isObject(event.source) || Object.keys(event.source).length !== 2 || !("system" in event.source) || !("component" in event.source)) return false;
  if (typeof event.source.system !== "string" || event.source.system.length === 0) return false;
  if (typeof event.source.component !== "string" || event.source.component.length === 0) return false;
  if (typeof event.type !== "string" || !eventTypePattern.test(event.type)) return false;
  if (!new Set(["info", "warning", "error", "critical"]).has(event.severity)) return false;
  if (!isRfc3339DateTime(event.occurredAt)) return false;
  return isObject(event.payload);
};

const expect = (condition, description) => {
  if (!condition) throw new Error(description);
};

const validEvent = () => ({
  schemaVersion: "1.0.0",
  eventId: "evt-001",
  correlationId: "corr-001",
  source: { system: "reservation", component: "availability" },
  type: "inventory.availability.changed",
  severity: "info",
  occurredAt: "2026-07-27T00:00:00Z",
  payload: { availableRooms: 12 }
});

try {
  const schema = JSON.parse(await readFile(schemaPath, "utf8"));
  expect(schema.type === "object" && schema.additionalProperties === false, "schema must define a closed object envelope");
  expect(JSON.stringify(schema.required) === JSON.stringify(envelopeFields), "schema must require the exact version 1 envelope fields");
  expect(schema.properties?.schemaVersion?.const === "1.0.0", "schema must fix schemaVersion at 1.0.0");
  expect(schema.properties?.type?.pattern === "^[a-z][a-z0-9]*(?:\\.[a-z][a-z0-9]*)+$", "schema must declare the event-type pattern");

  expect(validateEvent(validEvent()), "valid closed envelope must succeed");
  for (const field of envelopeFields) {
    const event = validEvent();
    delete event[field];
    expect(!validateEvent(event), `missing ${field} must fail`);
  }
  expect(!validateEvent({ ...validEvent(), unexpected: true }), "unexpected envelope field must fail");
  for (const pathToEmpty of [["eventId"], ["correlationId"], ["source", "system"], ["source", "component"]]) {
    const event = validEvent();
    if (pathToEmpty.length === 1) event[pathToEmpty[0]] = "";
    else event[pathToEmpty[0]][pathToEmpty[1]] = "";
    expect(!validateEvent(event), `${pathToEmpty.join(".")} must reject an empty value`);
  }
  for (const [field, value] of [["type", "Inventory.changed"], ["severity", "urgent"], ["occurredAt", "2026-02-30T00:00:00Z"], ["payload", []]]) {
    const event = validEvent();
    event[field] = value;
    expect(!validateEvent(event), `${field} invalid case must fail`);
  }

  process.stdout.write(`${JSON.stringify({ name: "normalized-system-event-contract", passed: true, details: "one valid event and all documented invalid cases have the expected result" })}\n`);
} catch (error) {
  process.stdout.write(`${JSON.stringify({ name: "normalized-system-event-contract", passed: false, details: error.message })}\n`);
  process.exitCode = 1;
}
