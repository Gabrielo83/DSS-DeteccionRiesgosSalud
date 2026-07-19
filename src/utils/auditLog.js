import {
  AUDIT_LOG_STORAGE_KEY,
  AUDIT_LOG_UPDATED_EVENT,
} from "./storageKeys.js";
import { isFirebaseProvider } from "../services/appMode.js";
import { logAppEvent } from "../services/observability.js";

const MAX_AUDIT_EVENTS = 300;

const isBrowser = () => typeof window !== "undefined";

export const readAuditLog = () => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(AUDIT_LOG_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.warn("No se pudo leer el log de auditoria:", error);
    return [];
  }
};

export const appendAuditLog = (eventType, detail = {}) => {
  if (!isBrowser() || !eventType) return null;
  const event = {
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    eventType,
    timestamp: new Date().toISOString(),
    user: detail.user || "anonimo",
    role: detail.role || "sin-rol",
    entityId: detail.entityId || null,
    metadata: detail.metadata || {},
  };
  const next = [event, ...readAuditLog()].slice(0, MAX_AUDIT_EVENTS);
  window.localStorage.setItem(AUDIT_LOG_STORAGE_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event(AUDIT_LOG_UPDATED_EVENT));
  logAppEvent(eventType, {
    role: event.role,
    entityId: event.entityId || "",
  });
  if (isFirebaseProvider()) {
    import("../services/firebase/auditRepository.js")
      .then(({ writeAuditEvent }) => writeAuditEvent(event))
      .catch((error) => {
        console.warn("No se pudo persistir auditoria remota:", error);
      });
  }
  return event;
};
