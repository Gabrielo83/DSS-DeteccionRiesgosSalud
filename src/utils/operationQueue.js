import {
  OPERATION_QUEUE_STORAGE_KEY,
  OPERATION_QUEUE_UPDATED_EVENT,
} from "./storageKeys.js";
import { readEntity, saveEntity } from "./indexedDbClient.js";
import { syncOperation } from "../services/syncHandler.js";
import { appendAuditLog } from "./auditLog.js";
import {
  deleteOfflineAttachment,
  readOfflineAttachment,
  saveOfflineAttachment,
} from "./offlineAttachmentStorage.js";

const IDB_STORE = "queue";
const IDB_KEY = "queue";

const isBrowser = () => typeof window !== "undefined";
const nowIso = () => new Date().toISOString();
const hasNavigator = () => typeof navigator !== "undefined";
const QUEUE_SCHEMA_VERSION = 2;
const BASE_RETRY_DELAY_MS = 5000;
const MAX_RETRY_DELAY_MS = 5 * 60 * 1000;
const MAX_RETRY_COUNT = 8;
const pendingAttachmentWrites = new Map();
const RECOVERABLE_ASSET_ERRORS = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "chunkloaderror",
];

export const calculateRetryDelay = (retryCount) =>
  Math.min(
    BASE_RETRY_DELAY_MS * 2 ** Math.max(0, Number(retryCount || 1) - 1),
    MAX_RETRY_DELAY_MS,
  );

const getOperationFileMeta = (operation) => {
  if (operation.type === "submitCertificate") {
    return operation.payload?.certificate?.certificateFileMeta || null;
  }
  if (operation.type === "saveDraft") {
    return operation.payload?.payload?.certificateFile || null;
  }
  return null;
};

const withOperationFileMeta = (operation, fileMeta) => {
  if (operation.type === "submitCertificate") {
    return {
      ...operation,
      payload: {
        ...operation.payload,
        certificate: {
          ...operation.payload?.certificate,
          certificateFileMeta: fileMeta,
        },
      },
    };
  }
  if (operation.type === "saveDraft") {
    return {
      ...operation,
      payload: {
        ...operation.payload,
        payload: {
          ...operation.payload?.payload,
          certificateFile: fileMeta,
        },
      },
    };
  }
  return operation;
};

const detachOperationFile = (operation) => {
  const fileMeta = getOperationFileMeta(operation);
  const dataUrl = fileMeta?.previewUrl;
  if (!dataUrl || !String(dataUrl).startsWith("data:")) return operation;

  const attachmentKey = `operation:${operation.id}`;
  const writePromise = saveOfflineAttachment(attachmentKey, {
    dataUrl,
    name: fileMeta.name,
    type: fileMeta.type || fileMeta.contentType,
    size: fileMeta.size,
  }).catch((error) => {
    console.warn("No se pudo preservar el adjunto offline:", error);
    return null;
  });
  pendingAttachmentWrites.set(attachmentKey, writePromise);
  writePromise.finally(() => {
    if (pendingAttachmentWrites.get(attachmentKey) === writePromise) {
      pendingAttachmentWrites.delete(attachmentKey);
    }
  });

  return {
    ...withOperationFileMeta(operation, {
      ...fileMeta,
      previewUrl: "",
      offlineAttachmentKey: attachmentKey,
    }),
    attachmentKey,
  };
};

const hydrateOperationFile = async (operation) => {
  const attachmentKey =
    operation.attachmentKey || getOperationFileMeta(operation)?.offlineAttachmentKey;
  if (!attachmentKey) return operation;
  if (pendingAttachmentWrites.has(attachmentKey)) {
    await pendingAttachmentWrites.get(attachmentKey);
  }
  const attachment = await readOfflineAttachment(attachmentKey);
  if (!attachment?.blob) {
    const error = new Error("No se encontro el adjunto offline de la operacion.");
    error.code = "offline-attachment-missing";
    error.retryable = false;
    throw error;
  }
  const fileMeta = getOperationFileMeta(operation) || {};
  return withOperationFileMeta(operation, {
    ...fileMeta,
    name: fileMeta.name || attachment.name,
    type: fileMeta.type || attachment.type,
    size: fileMeta.size || attachment.size,
    previewBlob: attachment.blob,
  });
};

const syncFromIndexedDb = async () => {
  if (!isBrowser()) return;
  try {
    const idbValue = await readEntity(IDB_STORE, IDB_KEY);
    if (!idbValue) return;
    const raw = window.localStorage.getItem(OPERATION_QUEUE_STORAGE_KEY);
    const localValue = raw ? JSON.parse(raw) : [];
    const isDifferent = JSON.stringify(localValue) !== JSON.stringify(idbValue);
    if (isDifferent) {
      window.localStorage.setItem(
        OPERATION_QUEUE_STORAGE_KEY,
        JSON.stringify(idbValue),
      );
      window.dispatchEvent(new Event(OPERATION_QUEUE_UPDATED_EVENT));
    }
  } catch (error) {
    console.warn("No se pudo sincronizar la cola desde IndexedDB:", error);
  }
};

const readRawQueue = () => {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(OPERATION_QUEUE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!raw) syncFromIndexedDb();
    return parsed;
  } catch (error) {
    console.warn("No se pudo leer la cola de operaciones:", error);
    return [];
  }
};

const persistQueue = (queue) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(OPERATION_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  window.dispatchEvent(new Event(OPERATION_QUEUE_UPDATED_EVENT));
  saveEntity(IDB_STORE, IDB_KEY, queue);
};

export const readOperationQueue = () => readRawQueue();

export const recoverInterruptedOperations = () => {
  const queue = readRawQueue();
  let recovered = 0;
  const updated = queue.map((operation) => {
    const lastError = String(operation.lastError || "").toLowerCase();
    const recoverable = RECOVERABLE_ASSET_ERRORS.some((message) =>
      lastError.includes(message),
    );
    if (!recoverable) return operation;
    recovered += 1;
    return {
      ...operation,
      status: "pending",
      retryCount: 0,
      nextAttemptAt: null,
      lastError: null,
    };
  });
  if (recovered > 0) {
    persistQueue(updated);
    appendAuditLog("sync_operations_recovered", {
      metadata: {
        recovered,
        reason: "stale_application_asset",
      },
    });
  }
  return recovered;
};

const buildOperation = (type, payload, meta = {}) => ({
  id: meta.id || `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  type,
  payload,
  status: meta.status || "pending",
  createdAt: nowIso(),
  lastAttemptAt: meta.lastAttemptAt || null,
  retryCount: meta.retryCount || 0,
  lastError: meta.lastError || null,
  user: meta.user || null,
  entityId: meta.entityId || null,
  ownerId: meta.ownerId || meta.user || null,
  schemaVersion: QUEUE_SCHEMA_VERSION,
  nextAttemptAt: meta.nextAttemptAt || null,
});

export const enqueueOperation = (type, payload = {}, meta = {}) => {
  if (!type) return null;
  const queue = readRawQueue();
  const op = detachOperationFile(buildOperation(type, payload, meta));
  const filtered = queue.filter((item) => item.id !== op.id);
  persistQueue([...filtered, op]);
  appendAuditLog("sync_operation_enqueued", {
    user: op.user,
    entityId: op.entityId,
    metadata: { operationId: op.id, operationType: op.type },
  });
  return op;
};

export const markOperationStatus = (id, status, patch = {}) => {
  if (!id || !status) return;
  const queue = readRawQueue();
  const updated = queue.map((item) =>
    item.id === id
      ? {
          ...item,
          status,
          lastAttemptAt: nowIso(),
          ...patch,
        }
      : item,
  );
  persistQueue(updated);
};

export const removeOperation = (id) => {
  if (!id) return;
  const queue = readRawQueue();
  const filtered = queue.filter((item) => item.id !== id);
  if (filtered.length === queue.length) return;
  persistQueue(filtered);
};

const defaultHandler = async (operation) => {
  if (operation) {
    return syncOperation(operation);
  }
  // Simula sync remoto; en producción reemplazar por llamadas HTTP/Firebase.
  const isOffline = hasNavigator() && navigator.onLine === false;
  if (isOffline) {
    return { ok: false, reason: "offline" };
  }
  // Pequeño delay para no bloquear UI
  await new Promise((resolve) => setTimeout(resolve, 20));
  return { ok: true };
};

const belongsToActiveSession = (operation, ownerIds = []) => {
  const allowedOwners = new Set(ownerIds.filter(Boolean));
  if (!allowedOwners.size) return false;
  const operationOwner = operation.ownerId || operation.user;
  return Boolean(operationOwner) && allowedOwners.has(operationOwner);
};

export const processQueue = async (
  handler = defaultHandler,
  { ownerIds = [] } = {},
) => {
  const queue = readRawQueue();
  if (!queue.length) return { processed: 0, pending: 0 };

  const nextQueue = [];
  let processed = 0;
  let failed = 0;
  let conflicts = 0;

  for (const op of queue) {
    if (op.status === "synced") continue;
    if (!belongsToActiveSession(op, ownerIds)) {
      nextQueue.push(op);
      continue;
    }
    if (["failed", "conflict"].includes(op.status)) {
      nextQueue.push(op);
      if (op.status === "failed") failed += 1;
      if (op.status === "conflict") conflicts += 1;
      continue;
    }

    if (hasNavigator() && navigator.onLine === false) {
      nextQueue.push(op);
      continue;
    }

    const nextAttemptAt = Date.parse(op.nextAttemptAt || "");
    if (Number.isFinite(nextAttemptAt) && nextAttemptAt > Date.now()) {
      nextQueue.push(op);
      continue;
    }

    const attemptAt = nowIso();
    const result = await hydrateOperationFile(op)
      .then((hydratedOperation) => handler(hydratedOperation))
      .catch((error) => ({
        ok: false,
        error: error?.message || error?.toString?.() || "sync failed",
        reason: error?.code || "sync_failed",
        retryable: error?.retryable !== false,
      }));

    if (result?.ok) {
      processed += 1;
      if (op.attachmentKey) await deleteOfflineAttachment(op.attachmentKey);
      appendAuditLog("sync_operation_success", {
        user: op.user,
        entityId: op.entityId,
        metadata: { operationId: op.id, operationType: op.type },
      });
      continue; // Se elimina del queue
    }

    const retryCount = (op.retryCount || 0) + 1;
    const isConflict = result?.reason === "sync-conflict";
    const retryable = result?.retryable !== false && !isConflict;
    const exhausted = retryCount >= MAX_RETRY_COUNT;
    const status = isConflict
      ? "conflict"
      : !retryable || exhausted
        ? "failed"
        : "pending";
    if (status === "conflict") conflicts += 1;
    if (status === "failed") failed += 1;
    const nextAttemptAtValue =
      status === "pending"
        ? new Date(Date.now() + calculateRetryDelay(retryCount)).toISOString()
        : null;
    nextQueue.push({
      ...op,
      status,
      lastAttemptAt: attemptAt,
      retryCount,
      nextAttemptAt: nextAttemptAtValue,
      lastError: result?.error || result?.reason || "sync failed",
    });
    appendAuditLog("sync_failed", {
      user: op.user,
      entityId: op.entityId,
      metadata: {
        operationType: op.type,
        operationId: op.id,
        retryCount,
        retryable,
        status,
        nextAttemptAt: nextAttemptAtValue,
        error: result?.error || result?.reason || "sync failed",
      },
    });
  }

  const queueChanged = JSON.stringify(nextQueue) !== JSON.stringify(queue);
  if (queueChanged || processed > 0) {
    persistQueue(nextQueue);
  }

  return {
    processed,
    pending: nextQueue.filter((op) => op.status === "pending").length,
    failed,
    conflicts,
  };
};

export const clearOperationQueue = () => persistQueue([]);

export const startQueueSync = (handler, { ownerIds = [] } = {}) => {
  if (!isBrowser()) return () => {};
  if (!ownerIds.filter(Boolean).length) return () => {};
  recoverInterruptedOperations();
  let syncing = false;

  const runSync = async () => {
    if (syncing) return;
    syncing = true;
    try {
      await processQueue(handler, { ownerIds });
    } finally {
      syncing = false;
    }
  };

  const onlineHandler = () => runSync();
  const intervalId = window.setInterval(runSync, 15000);

  window.addEventListener("online", onlineHandler);
  runSync();

  return () => {
    window.removeEventListener("online", onlineHandler);
    window.clearInterval(intervalId);
  };
};
