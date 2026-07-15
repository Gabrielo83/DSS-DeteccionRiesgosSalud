import {
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseServices } from "./firebaseClient.js";
import {
  mapAbsenceFormToFirestore,
  mapDraftPayloadToFirestore,
  mapHistoryRecordToFirestore,
  mapPlanPreventivoToFirestore,
  mapValidationEntryToFirestore,
} from "../../utils/firestoreMappings.js";
import { appendAuditLog } from "../../utils/auditLog.js";

const stripUndefined = (value) => {
  if (Array.isArray(value)) {
    return value.map(stripUndefined);
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
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "previewUrl")
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

const dataUrlToBlob = async (dataUrl) => {
  if (!dataUrl || !String(dataUrl).startsWith("data:")) return null;
  const response = await fetch(dataUrl);
  return response.blob();
};

const uploadCertificateFile = async (storage, reference, certificate) => {
  const fileMeta = certificate?.certificateFileMeta;
  if (!fileMeta?.previewUrl || fileMeta.storagePath || fileMeta.downloadUrl) {
    return certificate;
  }

  const blob = await dataUrlToBlob(fileMeta.previewUrl);
  if (!blob) return certificate;

  const safeName = sanitizeFileName(fileMeta.name);
  const storagePath = `certificados/${reference}/${Date.now()}-${safeName}`;
  const storageReference = ref(storage, storagePath);
  let downloadUrl = "";
  try {
    await uploadBytes(storageReference, blob, {
      contentType: fileMeta.type || blob.type || "application/octet-stream",
      customMetadata: {
        reference,
        originalName: fileMeta.name || safeName,
      },
    });
    downloadUrl = await getDownloadURL(storageReference);
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
      downloadUrl,
      previewUrl: downloadUrl,
    },
  };
};

const prepareSubmitCertificateOperation = async (storage, operation) => {
  const certificate = operation.payload?.certificate || operation.payload || {};
  const reference =
    certificate.reference || operation.payload?.reference || operation.entityId;
  if (!reference) return operation;
  const uploadedCertificate = await uploadCertificateFile(
    storage,
    reference,
    certificate,
  );
  return {
    ...operation,
    payload: {
      ...operation.payload,
      certificate: uploadedCertificate,
    },
  };
};

const buildBasePayload = (operation) =>
  stripUndefined({
    id: operation.id,
    type: operation.type,
    payload: stripTransientFileData(operation.payload || {}),
    user: operation.user || null,
    entityId: operation.entityId || null,
    localCreatedAt: operation.createdAt || null,
    retryCount: operation.retryCount || 0,
    syncedAt: serverTimestamp(),
  });

const writeOperationAudit = async (db, operation) => {
  await setDoc(
    doc(db, "operations", operation.id),
    buildBasePayload(operation),
    { merge: true },
  );
};

const writeDraft = async (db, operation) => {
  const draft = operation.payload?.payload || operation.payload || {};
  const draftId = draft.draftId || operation.payload?.draftId || operation.id;
  await setDoc(
    doc(db, "borradores", draftId),
    stripUndefined(stripTransientFileData({
      ...mapDraftPayloadToFirestore(draft),
      sourceOperationId: operation.id,
      updatedAt: serverTimestamp(),
    })),
    { merge: true },
  );
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
  await setDoc(
    doc(db, "validaciones_medicas", reference),
    stripUndefined(stripTransientFileData({
      ...mapValidationEntryToFirestore(certificate),
      reference,
      sourceOperationId: operation.id,
      updatedAt: serverTimestamp(),
    })),
    { merge: true },
  );
  await setDoc(
    doc(db, "ausencias", reference),
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
      sourceOperationId: operation.id,
      updatedAt: serverTimestamp(),
    })),
    { merge: true },
  );
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
  await setDoc(
    doc(db, "validaciones_medicas", reference),
    stripUndefined(stripTransientFileData({
      ...(validationEntry ? mapValidationEntryToFirestore(validationEntry) : {}),
      ...decisionPayload,
      reference,
      sourceOperationId: operation.id,
      revisadoEn: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })),
    { merge: true },
  );
  if (historyRecord) {
    await setDoc(
      doc(db, "historial_medico", reference),
      stripUndefined(stripTransientFileData({
        ...mapHistoryRecordToFirestore(historyRecord),
        historyId: reference,
        reference,
        sourceOperationId: operation.id,
        updatedAt: serverTimestamp(),
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
    await setDoc(
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
        sourceOperationId: operation.id,
        updatedAt: serverTimestamp(),
      }),
      { merge: true },
    );
  }
};

export const syncOperationToFirestore = async (operation) => {
  const { db, storage } = getFirebaseServices();
  const preparedOperation =
    operation.type === "submitCertificate"
      ? await prepareSubmitCertificateOperation(storage, operation)
      : operation;

  await writeOperationAudit(db, preparedOperation);

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

  return { ok: true };
};
