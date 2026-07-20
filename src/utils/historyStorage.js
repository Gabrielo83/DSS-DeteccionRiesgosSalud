import {
  MEDICAL_HISTORY_STORAGE_KEY,
  MEDICAL_HISTORY_UPDATED_EVENT,
} from "./storageKeys.js";
import { createProtectedOperationalStore } from "./protectedOperationalStore.js";

const IDB_STORE = "history";
const IDB_KEY = "records";

const store = createProtectedOperationalStore({
  storageKey: MEDICAL_HISTORY_STORAGE_KEY,
  eventName: MEDICAL_HISTORY_UPDATED_EVENT,
  legacyStore: IDB_STORE,
  legacyKey: IDB_KEY,
  emptyValue: {},
});

const readRawHistory = () => store.read();
const persistHistory = (records) => store.replace(records);

const dedupeEntries = (entries = []) => {
  const seen = new Set();
  const deduped = [];
  entries.forEach((item) => {
    if (!item) return;
    const key = item.id || item.reference;
    if (key) {
      if (seen.has(key)) return;
      seen.add(key);
    }
    deduped.push(item);
  });
  return deduped;
};

export const readEmployeeHistory = (employeeKey) => {
  if (!employeeKey) return [];
  const records = readRawHistory();
  const entries = records[employeeKey] ?? [];
  const deduped = dedupeEntries(entries);
  if (deduped.length !== entries.length) {
    records[employeeKey] = deduped;
    persistHistory(records);
  }
  // Orden cronológico ascendente por issued (más antiguo primero)
  return deduped.sort((a, b) => {
    const aDate = a?.issued ? new Date(a.issued).getTime() : 0;
    const bDate = b?.issued ? new Date(b.issued).getTime() : 0;
    return aDate - bDate;
  });
};

export const readAllHistory = () => {
  const records = readRawHistory();
  let mutated = false;
  Object.entries(records).forEach(([employeeKey, entries]) => {
    if (!Array.isArray(entries)) return;
    const deduped = dedupeEntries(entries);
    if (deduped.length !== entries.length) {
      records[employeeKey] = deduped;
      mutated = true;
    }
  });
  if (mutated) {
    persistHistory(records);
  }
  return records;
};

export const replaceAllHistory = (records = {}) => {
  if (!records || typeof records !== "object" || Array.isArray(records)) {
    persistHistory({});
    return;
  }
  persistHistory(records);
};

export const appendEmployeeHistory = (employeeKey, record) => {
  if (!employeeKey || !record) return;
  const records = readRawHistory();
  const existing = records[employeeKey] ?? [];
  const normalizedId = record.id || record.reference;
  const next = [];
  let inserted = false;
  existing.forEach((item) => {
    if (!item) return;
    const itemKey = item.id || item.reference;
    if (normalizedId && itemKey === normalizedId) {
      // merge
      next.push({ ...item, ...record, id: normalizedId });
      inserted = true;
    } else {
      next.push(item);
    }
  });
  if (!inserted) {
    next.push({ ...record, id: normalizedId });
  }
  records[employeeKey] = next;
  persistHistory(records);
};

export const mergeHistoryPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("El historial importado debe ser un objeto valido.");
  }
  const current = readRawHistory();
  let recordsAdded = 0;
  Object.entries(payload).forEach(([employeeKey, entries]) => {
    if (!employeeKey || !Array.isArray(entries)) return;
    const safeEntries = entries.filter(
      (entry) => entry && typeof entry === "object",
    );
    if (!safeEntries.length) return;
    current[employeeKey] = [...(current[employeeKey] || []), ...safeEntries];
    recordsAdded += safeEntries.length;
  });
  persistHistory(current);
  return { employees: Object.keys(payload).length, records: recordsAdded };
};

export const importHistoryFromJSON = (text) => {
  if (!text) throw new Error("No se encontro informacion para importar.");
  const payload = JSON.parse(text);
  return mergeHistoryPayload(payload);
};

const parseCsvHistory = (text) => {
  const rows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);
  if (rows.length < 2) {
    throw new Error("El CSV debe incluir encabezado y al menos una fila.");
  }
  const headers = rows[0].split(",").map((header) => header.trim());
  const required = ["employeeId", "title", "status"];
  const missing = required.filter(
    (header) => !headers.includes(header),
  );
  if (missing.length) {
    throw new Error(
      `CSV incompleto. Faltan columnas: ${missing.join(", ")}`,
    );
  }
  const getValue = (cells, name) =>
    cells[headers.indexOf(name)]?.trim() ?? "";

  const payload = {};
  rows.slice(1).forEach((row) => {
    const cells = row.split(",").map((cell) => cell.trim());
    if (!cells.length) return;
    const employeeKey = getValue(cells, "employeeId");
    if (!employeeKey) return;
    const record = {
      id: getValue(cells, "reference") || `CSV-${Date.now()}`,
      title: getValue(cells, "title") || "Sin titulo",
      issued: getValue(cells, "issued") || "",
      days: getValue(cells, "days") || "",
      status: getValue(cells, "status") || "Pendiente",
      document: getValue(cells, "document") || "",
      institution: getValue(cells, "institution") || "",
      notes: getValue(cells, "notes") || "",
      reviewer: getValue(cells, "reviewer") || "",
    };
    if (!payload[employeeKey]) payload[employeeKey] = [];
    payload[employeeKey].push(record);
  });
  return payload;
};

export const importHistoryFromCSV = (text) => {
  const payload = parseCsvHistory(text);
  return mergeHistoryPayload(payload);
};

export const exportHistoryAsJSON = () =>
  JSON.stringify(readRawHistory(), null, 2);

export const clearHistoryCache = () => store.clear();
