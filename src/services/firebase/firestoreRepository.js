import {
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { ref, uploadBytes } from "firebase/storage";
import { getFirebaseServices } from "./firebaseClient.js";
import {
  mapAbsenceFormToFirestore,
  mapDraftPayloadToFirestore,
  mapHistoryRecordToFirestore,
  mapPlanPreventivoToFirestore,
  mapValidationEntryToFirestore,
} from "../../utils/firestoreMappings.js";
import { appendAuditLog } from "../../utils/auditLog.js";

const isFirestoreFieldValue = (value) =>
  value &&
  typeof value === "object" &&
  ("_methodName" in value ||
    String(value.constructor?.name || "").includes("FieldValue"));

const stripUndefined = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
  }
  if (isFirestoreFieldValue(value) || value instanceof Date) {
    return value;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .map(([key, entryValue]) => [key, stripUndefined(entryValue)]),
    );
  }
  return value;
};

const stripTransientFileData = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripTransientFileData);
  }
  if (isFirestoreFieldValue(value) || value instanceof Date) {
    return value;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !["previewUrl", "previewBlob", "offlineAttachmentKey"].includes(
              key,
            ),
        )
        .map(([key, entryValue]) => [key, stripTransientFileData(entryValue)]),
    );
  }
  return value;
};

const sanitizeFileName = (name = "certificado") =>
  String(name)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 120) || "certificado";

const FINAL_STATUSES = new Set(["validado", "rechazado"]);
const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

class SyncConflictError extends Error {
  constructor(message) {
    super(message);
    this.name = "SyncConflictError";
    this.code = "sync-conflict";
    this.retryable = false;
  }
}

const assertClinicalWriteAllowed = (existing, operation) => {
  if (!existing) return;
  const sameOperation = existing.sourceOperationId === operation.id;
  const existingStatus = normalizeStatus(existing.estado || existing.status);
  if (!sameOperation && FINAL_STATUSES.has(existingStatus)) {
    throw new SyncConflictError(
      "La operacion local no puede reemplazar una decision medica final mas reciente.",
    );
  }
};

const buildSyncMetadata = (operation, existing = {}) => ({
  sourceOperationId: operation.id,
  syncVersion:
    existing.sourceOperationId === operation.id
      ? Number(existing.syncVersion || 1)
      : Number(existing.syncVersion || 0) + 1,
  clientUpdatedAt: operation.createdAt || null,
  conflictPolicy: "decision-clinica-no-sobrescribible",
  updatedAt: serverTimestamp(),
});

const dataUrlToBlob = async (dataUrl) => {
  if (!dataUrl || !String(dataUrl).startsWith("data:")) return null;
  const response = await fetch(dataUrl);
  return response.blob();
};

const uploadCertificateFile = async (
  storage,
  reference,
  certificate,
  operationId,
  uploaderUid,
) => {
  const fileMeta = certificate?.certificateFileMeta;
  const hasLocalFile = fileMeta?.previewBlob || fileMeta?.previewUrl;
  if (!hasLocalFile || fileMeta.storagePath || fileMeta.downloadUrl) {
    return certificate;
  }

  const blob = fileMeta.previewBlob || (await dataUrlToBlob(fileMeta.previewUrl));
  if (!blob) return certificate;

  const safeName = sanitizeFileName(fileMeta.name);
  const safeOperationId = sanitizeFileName(operationId || reference);
  const storagePath = `certificados/${reference}/${safeOperationId}-${safeName}`;
  const storageReference = ref(storage, storagePath);
  try {
    await uploadBytes(storageReference, blob, {
      contentType: fileMeta.type || blob.type || "application/octet-stream",
      customMetadata: {
        reference,
        originalName: fileMeta.name || safeName,
        uploaderUid,
      },
    });
    appendAuditLog("certificate_upload_success", {
      entityId: reference,
      metadata: {
        storagePath,
        contentType: fileMeta.type || blob.type || "",
        size: fileMeta.size || "",
      },
    });
  } catch (error) {
    appendAuditLog("certificate_upload_failed", {
      entityId: reference,
      metadata: {
        storagePath,
        error: error?.message || "No se pudo subir el certificado.",
      },
    });
    throw error;
  }

  return {
    ...certificate,
    certificateFileMeta: {
      ...stripTransientFileData(fileMeta),
      storagePath,
      downloadUrl: "",
      previewUrl: "",
    },
  };
};

const prepareSubmitCertificateOperation = async (
  storage,
  operation,
  uploaderUid,
) => {
  const certificate = operation.payload?.certificate || operation.payload || {};
  const reference =
    certificate.reference || operation.payload?.reference || operation.entityId;
  if (!reference) return operation;
  const uploadedCertificate = await uploadCertificateFile(
    storage,
    reference,
    certificate,
    operation.id,
    uploaderUid,
  );
  return {
    ...operation,
    payload: {
      ...operation.payload,
      certificate: uploadedCertificate,
    },
  };
};

const buildBasePayload = (operation, syncStatus = "processing", error = null) =>
  stripUndefined({
    id: operation.id,
    type: operation.type,
    payload: stripTransientFileData(operation.payload || {}),
    user: operation.user || null,
    entityId: operation.entityId || null,
    localCreatedAt: operation.createdAt || null,
    retryCount: operation.retryCount || 0,
    syncStatus,
    syncError: error,
    attemptedAt: serverTimestamp(),
    ...(syncStatus === "synced" ? { syncedAt: serverTimestamp() } : {}),
  });

const writeOperationAudit = async (
  db,
  operation,
  syncStatus = "processing",
  error = null,
) => {
  await setDoc(
    doc(db, "operations", operation.id),
    buildBasePayload(operation, syncStatus, error),
    { merge: true },
  );
};

const writeDraft = async (db, operation) => {
  const draft = operation.payload?.payload || operation.payload || {};
  const draftId = draft.draftId || operation.payload?.draftId || operation.id;
  const draftRef = doc(db, "borradores", draftId);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(draftRef);
    const existing = snapshot.data() || {};
    transaction.set(
      draftRef,
      stripUndefined(stripTransientFileData({
        ...mapDraftPayloadToFirestore(draft),
        sourceOperationId: operation.id,
        syncVersion: Number(existing.syncVersion || 0) + 1,
        clientUpdatedAt: operation.createdAt || null,
        conflictPolicy: "ultima-escritura-para-borradores",
        updatedAt: serverTimestamp(),
      })),
      { merge: true },
    );
  });
};

const deleteDraft = async (db, operation) => {
  const draftId =
    operation.payload?.draftId || operation.entityId || operation.payload?.id;
  if (!draftId) {
    throw new Error("No se pudo eliminar borrador sin identificador.");
  }
  await deleteDoc(doc(db, "borradores", draftId));
};

const writeCertificate = async (db, operation) => {
  const certificate = operation.payload?.certificate || operation.payload || {};
  const reference =
    certificate.reference || operation.payload?.reference || operation.entityId;
  if (!reference) {
    throw new Error("No se pudo sincronizar certificado sin referencia.");
  }
  const validationRef = doc(db, "validaciones_medicas", reference);
  const absenceRef = doc(db, "ausencias", reference);
  await runTransaction(db, async (transaction) => {
    const validationSnapshot = await transaction.get(validationRef);
    const existing = validationSnapshot.data() || {};
    assertClinicalWriteAllowed(existing, operation);
    if (existing.sourceOperationId === operation.id) return;

    transaction.set(
      validationRef,
      stripUndefined(stripTransientFileData({
        ...mapValidationEntryToFirestore(certificate),
        reference,
        creadoEn: serverTimestamp(),
        ...buildSyncMetadata(operation, existing),
      })),
      { merge: true },
    );
    transaction.set(
      absenceRef,
      stripUndefined(stripTransientFileData({
        ...mapAbsenceFormToFirestore({
          formValues: {
            absenceId: reference,
            employeeId: certificate.employeeId,
            employeeName: certificate.employee,
            sector: certificate.sector,
            position: certificate.position,
            absenceType: certificate.absenceType,
            detailedReason: certificate.detailedReason,
            pathologyCategory: certificate.pathologyCategory,
            cieCode: certificate.cieCode,
            additionalNotes: certificate.notes,
            startDate: certificate.startDate,
            endDate: certificate.endDate,
          },
          absenceDays: certificate.absenceDays,
          certificateInstitution: certificate.institution,
          certificateFileMeta: certificate.certificateFileMeta,
          certificateReference: reference,
          requiresApproval: "si",
          status: "enviado",
          createdBy: operation.user,
        }),
        absenceId: reference,
        creadoEn: serverTimestamp(),
        ...buildSyncMetadata(operation),
      })),
      { merge: true },
    );
  });
};

const writeCertificateDecision = async (db, operation) => {
  const reference = operation.payload?.reference || operation.entityId;
  if (!reference) {
    throw new Error("No se pudo sincronizar decision sin referencia.");
  }
  const validationEntry = operation.payload?.validationEntry;
  const historyRecord = operation.payload?.historyRecord;
  const decisionPayload = Object.fromEntries(
    Object.entries(operation.payload || {}).filter(
      ([key]) => !["validationEntry", "historyRecord"].includes(key),
    ),
  );
  const validationRef = doc(db, "validaciones_medicas", reference);
  await runTransaction(db, async (transaction) => {
    const validationSnapshot = await transaction.get(validationRef);
    const existing = validationSnapshot.data() || {};
    assertClinicalWriteAllowed(existing, operation);

    transaction.set(
    validationRef,
    stripUndefined(stripTransientFileData({
      ...(validationEntry ? mapValidationEntryToFirestore(validationEntry) : {}),
      ...decisionPayload,
      reference,
      revisadoEn: serverTimestamp(),
      ...buildSyncMetadata(operation, existing),
    })),
    { merge: true },
  );
  if (historyRecord) {
    transaction.set(
      doc(db, "historial_medico", reference),
      stripUndefined(stripTransientFileData({
        ...mapHistoryRecordToFirestore(historyRecord),
        historyId: reference,
        reference,
        ...buildSyncMetadata(operation),
      })),
      { merge: true },
    );
  }
  if (
    validationEntry?.employeeId &&
    (validationEntry.planActions?.length ||
      validationEntry.planFollowUps?.length ||
      validationEntry.planRecommendations?.length)
  ) {
    transaction.set(
      doc(db, "planes_preventivos", validationEntry.employeeId),
      stripUndefined({
        ...mapPlanPreventivoToFirestore(
          {
            actions: validationEntry.planActions || [],
            followUps: validationEntry.planFollowUps || [],
            recommendations: validationEntry.planRecommendations || [],
          },
          validationEntry.employeeId,
          operation.user,
          {
            nombreCompleto: validationEntry.employee,
            sector: validationEntry.sector,
            puesto: validationEntry.position,
          },
        ),
        ...buildSyncMetadata(operation),
      }),
      { merge: true },
    );
  }
  });
};

export const syncOperationToFirestore = async (operation) => {
  const { auth, db, storage } = getFirebaseServices();
  if (operation.type === "submitCertificate") {
    const certificate = operation.payload?.certificate || operation.payload || {};
    const reference =
      certificate.reference || operation.payload?.reference || operation.entityId;
    if (reference) {
      const snapshot = await getDoc(doc(db, "validaciones_medicas", reference));
      assertClinicalWriteAllowed(snapshot.data(), operation);
    }
  }
  const preparedOperation =
    operation.type === "submitCertificate"
      ? await prepareSubmitCertificateOperation(
          storage,
          operation,
          auth.currentUser?.uid || "",
        )
      : operation;

  await writeOperationAudit(db, preparedOperation, "processing");

  try {
    if (preparedOperation.type === "saveDraft") {
      await writeDraft(db, preparedOperation);
    }

    if (preparedOperation.type === "deleteDraft") {
      await deleteDraft(db, preparedOperation);
    }

    if (preparedOperation.type === "submitCertificate") {
      await writeCertificate(db, preparedOperation);
    }

    if (preparedOperation.type === "validateCertificate") {
      await writeCertificateDecision(db, preparedOperation);
    }

    await writeOperationAudit(db, preparedOperation, "synced");
  } catch (error) {
    await writeOperationAudit(
      db,
      preparedOperation,
      error?.code === "sync-conflict" ? "conflict" : "failed",
      error?.message || "Error de sincronizacion",
    ).catch(() => {});
    throw error;
  }

  return { ok: true };
};
