import {
  listBorradores,
  listAusencias,
  listEmpleados,
  listHistorial,
  listPatologias,
  listPlanesPreventivos,
  getParametrosRiesgo,
  getIndicadorAlertas,
  getIndicadorRiesgo,
  listAlertasRiesgo,
  listValidaciones,
} from "../../utils/firestoreEntities.js";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { getFirebaseServices } from "./firebaseClient.js";
import { readDrafts, replaceDrafts } from "../../utils/draftStorage.js";
import { replaceEmployees } from "../../utils/employeeStorage.js";
import { replaceAllHistory } from "../../utils/historyStorage.js";
import { replaceAllPlans } from "../../utils/planStorage.js";
import { replaceRiskConfig } from "../../utils/riskConfigStorage.js";
import {
  readValidationQueue,
  replaceValidationQueue,
} from "../../utils/validationStorage.js";
import { readOperationQueue } from "../../utils/operationQueue.js";
import { appendAuditLog } from "../../utils/auditLog.js";
import {
  replaceRiskAlerts,
  replaceRiskAlertSummary,
} from "../../utils/riskAlertStorage.js";
import { rebuildFirebaseAlertSummary } from "./alertService.js";
import { rebuildFirebaseRiskIndicator } from "./alertService.js";
import { replaceRiskIndicator } from "../../utils/riskIndicatorStorage.js";
import { readAbsences, replaceAbsences } from "../../utils/absenceStorage.js";
import { recordDashboardSyncSuccess } from "../../utils/syncStatus.js";

const toDateString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.toDate === "function") {
    return value.toDate().toISOString().slice(0, 10);
  }
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return "";
};

const toIsoString = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value.toDate === "function") return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  return "";
};

const mapCertificateMetaFromFirestore = (certificadoDigital) => {
  if (!certificadoDigital) return null;
  return {
    name: certificadoDigital.nombre || "certificado",
    size: certificadoDigital.tamano || "",
    type: certificadoDigital.tipoContenido || "",
    contentType: certificadoDigital.tipoContenido || "",
    storagePath: certificadoDigital.rutaStorage || "",
    downloadUrl: certificadoDigital.downloadUrl || "",
    previewUrl: certificadoDigital.rutaStorage
      ? ""
      : certificadoDigital.downloadUrl || "",
  };
};

const normalizeStatusLabel = (value, fallback = "Pendiente") => {
  const normalized = String(value || "").trim().toLowerCase();
  const map = {
    pendiente: "Pendiente",
    en_revision: "En Revision",
    "en revision": "En Revision",
    validado: "Validado",
    rechazado: "Rechazado",
    observacion: "Observacion",
  };
  return map[normalized] || value || fallback;
};

const normalizeValidation = (doc = {}) => ({
  reference: doc.reference || doc.id,
  employee: doc.nombreCompleto || "",
  employeeId: doc.employeeId || "",
  position: doc.puesto || "",
  sector: doc.sector || "",
  status: normalizeStatusLabel(doc.estado),
  priority: doc.prioridad || "Media",
  submitted: toIsoString(doc.creadoEn || doc.actualizadoEn || doc.updatedAt),
  receivedTimestamp:
    doc.creadoEn?.toMillis?.() ||
    doc.actualizadoEn?.toMillis?.() ||
    doc.updatedAt?.toMillis?.() ||
    Date.now(),
  detailedReason: doc.diagnostico || "",
  startDate: toDateString(doc.fechaInicio),
  endDate: toDateString(doc.fechaFin),
  absenceDays: doc.dias ?? null,
  absenceType: doc.tipo || "",
  certificateType: doc.tipoCertificado || doc.tipo || "Certificado medico",
  institution: doc.institucionMedica || "",
  pathologyCategory: doc.grupoPatologia || "",
  cieCode: doc.cie10 || "",
  issueDate: toDateString(doc.fechaEmision || doc.fechaInicio),
  validityDate: toDateString(doc.fechaValidez || doc.fechaFin),
  notes: doc.notasMedicas || "Sin comentarios adicionales registrados.",
  reviewer: doc.revisadoPor || doc.reviewer || doc.aprobadoPor || "",
  lastDecisionAt: toIsoString(doc.revisadoEn || doc.updatedAt || doc.actualizadoEn),
  certificateFileMeta: mapCertificateMetaFromFirestore(doc.certificadoDigital),
  planActions: doc.planAcciones || [],
  planFollowUps: doc.planSeguimientos || [],
  planRecommendations: doc.planRecomendaciones || [],
  riskScoreValue: doc.riesgoPuntaje ?? null,
  riskLevel: doc.riesgoNivel || "",
});

const normalizeHistory = (doc = {}) => ({
  id: doc.historyId || doc.reference || doc.id,
  reference: doc.reference || doc.id,
  title: doc.tipoCertificado || doc.tipo || "Certificado medico",
  employee: doc.nombreCompleto || "",
  sector: doc.sector || "",
  position: doc.puesto || "",
  issued: toDateString(doc.fechaEmision || doc.fechaInicio || doc.creadoEn),
  submittedAt: toIsoString(doc.creadoEn),
  validatedAt: toIsoString(doc.aprobadoEn || doc.actualizadoEn),
  days: doc.dias ?? "-",
  status: normalizeStatusLabel(doc.estadoFinal, "Validado"),
  document: doc.certificadoDigital?.nombre || "Documento no disponible",
  documentMeta: mapCertificateMetaFromFirestore(doc.certificadoDigital),
  institution: doc.institucionMedica || "No indicado",
  notes: doc.notasMedicas || "",
  reviewer: doc.aprobadoPor || doc.revisadoPor || doc.reviewer || "",
  detailedReason: doc.diagnostico || "",
  startDate: toDateString(doc.fechaInicio),
  endDate: toDateString(doc.fechaFin),
  riskScore: doc.riesgoPuntaje ?? null,
  riskLevel: doc.riesgoNivel || "",
  pathologyCategory: doc.grupoPatologia || "",
  cieCode: doc.cie10 || "",
  planActions: doc.planAcciones || [],
  planFollowUps: doc.planSeguimientos || [],
  planRecommendations: doc.planRecomendaciones || [],
});

const normalizeDraft = (doc = {}) => ({
  draftId: doc.draftId || doc.id,
  savedAt: toIsoString(doc.guardadoEn || doc.actualizadoEn),
  savedBy: doc.guardadoPor || "",
  formValues: doc.camposParciales || {
    employeeId: doc.employeeId || "",
    employeeName: doc.nombreCompleto || "",
    sector: doc.sector || "",
    position: doc.puesto || "",
    absenceType: doc.tipo || "",
    detailedReason: doc.diagnostico || "",
    startDate: toDateString(doc.fechaInicio),
    endDate: toDateString(doc.fechaFin),
  },
  certificateInstitution: doc.camposParciales?.certificateInstitution || "",
  certificateReference: doc.camposParciales?.certificateReference || "",
  requiresMedicalCertificate: doc.requiereCertificado ?? false,
  absenceDays: doc.ausenciaDias ?? null,
  absenceLabel: doc.ausenciaLabel || "",
  periodLabel: doc.periodoLabel || "",
});

const normalizePlan = (doc = {}) => ({
  actions: doc.acciones || [],
  followUps: doc.seguimientos || [],
  recommendations: doc.recomendaciones || [],
});

const normalizeEmployee = (doc = {}) => ({
  employeeId: doc.employeeId || doc.id || "",
  medicalRecordId: doc.legajoMedico || doc.medicalRecordId || "",
  fullName: doc.nombreCompleto || doc.fullName || "",
  sector: doc.sector || "Sin sector",
  position: doc.puesto || doc.position || "",
  email: doc.email || "",
  phone: doc.telefono || doc.phone || "",
  bloodType: doc.tipoSangre || doc.bloodType || "",
  seniority: doc.antiguedad || doc.seniority || "",
  avatar: doc.avatar || "",
  active: doc.activo ?? doc.active ?? true,
  hireDate: toDateString(doc.fechaAlta || doc.hireDate),
  terminationDate: toDateString(doc.fechaBaja || doc.terminationDate),
});

const normalizeAbsence = (doc = {}) => ({
  absenceId: doc.absenceId || doc.id || "",
  employeeId: doc.employeeId || "",
  employeeName: doc.nombreCompleto || "",
  sector: doc.sector || "",
  position: doc.puesto || "",
  absenceType: doc.tipo || "",
  startDate: toDateString(doc.fechaInicio),
  endDate: toDateString(doc.fechaFin),
  absenceDays: doc.dias ?? null,
  requiresApproval: doc.requiereAprobacion || "",
  requiresCertificate:
    doc.requiereCertificado ?? Boolean(doc.referenciaCertificado),
  status: doc.estado || "registrada",
  submittedAt: toIsoString(doc.creadoEn || doc.updatedAt),
});

const normalizeRiskAlert = (doc = {}) => ({
  id: doc.alertaId || doc.id || "",
  employeeId: doc.employeeId || "",
  employee: doc.nombreCompleto || "",
  sector: doc.sector || "Sin sector",
  position: doc.puesto || "",
  pathologyCategory: doc.grupoPatologia || "",
  status: doc.estado || "",
  reasons: doc.motivos || [],
  occurrenceCount: doc.recurrencias || 0,
  windowMonths: doc.ventanaMeses || 6,
  maxRiskScore: doc.riesgoMaximo ?? 0,
  maxIndividualRiskScore: doc.riesgoIndividualMaximo ?? 0,
  references: doc.referencias || [],
  latestReference: doc.ultimaReferencia || "",
  latestDate: toDateString(doc.ultimaFecha),
});

const normalizeRiskAlertSummary = (doc = {}) => ({
  totalActive: doc.totalActivas || 0,
  sectors: (Array.isArray(doc.sectores) ? doc.sectores : []).map((sector) => ({
    sector: sector.sector || "Sin sector",
    cantidad: Number(sector.cantidad || 0),
    groups: (Array.isArray(sector.grupos) ? sector.grupos : []).map((group) => ({
      pathologyCategory: group.grupoPatologia || "",
      activeAlerts: Number(group.cantidadAlertas || 0),
      occurrences: Number(group.recurrencias || 0),
      windowMonths: Number(group.ventanaMeses || 6),
    })),
  })),
  reasons: doc.motivos || {},
  version: doc.version || "",
  updatedAt: toIsoString(doc.actualizadoEn),
});

const normalizeRiskIndicator = (doc = {}) => ({
  periods: (doc.periodos || []).map((period) => ({
    period: period.periodo || "",
    averageRisk: period.promedioRiesgo ?? null,
    certificateCount: period.certificados || 0,
    daysLost: period.diasPerdidos || 0,
    sectors: (period.sectores || []).map((sector) => ({
      sector: sector.sector || "Sin sector",
      averageRisk: sector.promedioRiesgo ?? null,
      certificateCount: sector.certificados || 0,
      daysLost: sector.diasPerdidos || 0,
    })),
  })),
  updatedAt: toIsoString(doc.actualizadoEn),
});

const fetchOrFallback = async (fetcher, fallback, eventName, detail) => {
  try {
    return { ok: true, value: await fetcher(), error: null };
  } catch (error) {
    appendAuditLog(eventName, {
      ...detail,
      metadata: {
        error: error?.message || "No se pudo leer Firestore.",
      },
    });
    return { ok: false, value: fallback, error };
  }
};

export const hydrateFirebaseData = async ({ user, role } = {}) => {
  const clinicalRoles = ["superAdmin", "medico", "administrativoSalud"];
  const canReadClinical = clinicalRoles.includes(role);
  const detail = { user: user?.email, role };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    appendAuditLog("firebase_hydration_local_fallback", {
      ...detail,
      metadata: {
        preservoCacheLocal: true,
        motivo: "navegador_sin_conexion",
      },
    });
    return {
      preservedLocalCache: true,
      offline: true,
      failedCollections: ["network-offline"],
    };
  }

  const [
    empleadosResult,
    patologiasResult,
    parametrosRiesgoResult,
    ausenciasResult,
    validacionesResult,
    historialResult,
    borradoresResult,
    planesResult,
    alertasResult,
    indicadorAlertasResult,
    indicadorRiesgoResult,
  ] =
    await Promise.all([
      fetchOrFallback(listEmpleados, [], "firebase_hydration_failed", detail),
      fetchOrFallback(listPatologias, [], "firebase_hydration_failed", detail),
      fetchOrFallback(
        () => getParametrosRiesgo("global"),
        null,
        "firebase_hydration_failed",
        detail,
      ),
      fetchOrFallback(listAusencias, [], "firebase_hydration_failed", detail),
      canReadClinical
        ? fetchOrFallback(
            listValidaciones,
            [],
            "firebase_hydration_failed",
            detail,
          )
        : Promise.resolve({ ok: true, value: [], error: null }),
      canReadClinical
        ? fetchOrFallback(listHistorial, [], "firebase_hydration_failed", detail)
        : Promise.resolve({ ok: true, value: [], error: null }),
      fetchOrFallback(listBorradores, [], "firebase_hydration_failed", detail),
      canReadClinical
        ? fetchOrFallback(
            listPlanesPreventivos,
            [],
            "firebase_hydration_failed",
            detail,
          )
        : Promise.resolve({ ok: true, value: [], error: null }),
      canReadClinical
        ? fetchOrFallback(
            listAlertasRiesgo,
            [],
            "firebase_hydration_failed",
            detail,
          )
        : Promise.resolve({ ok: true, value: [], error: null }),
      fetchOrFallback(
        getIndicadorAlertas,
        null,
        "firebase_hydration_failed",
        detail,
      ),
      fetchOrFallback(
        getIndicadorRiesgo,
        null,
        "firebase_hydration_failed",
        detail,
      ),
    ]);

  const empleados = empleadosResult.value;
  const patologias = patologiasResult.value;
  const parametrosRiesgo = parametrosRiesgoResult.value;
  const ausencias = ausenciasResult.value;
  const validaciones = validacionesResult.value;
  const historial = historialResult.value;
  const borradores = borradoresResult.value;
  const planes = planesResult.value;
  const alertas = alertasResult.value;
  const indicadorAlertasInicial = indicadorAlertasResult.value;
  const indicadorRiesgoInicial = indicadorRiesgoResult.value;

  let indicadorAlertas = indicadorAlertasInicial;
  let indicadorAlertasFresh = indicadorAlertasResult.ok;
  if (
    indicadorAlertasResult.ok &&
    (!indicadorAlertas ||
      indicadorAlertas.version !== "alert-summary-v2") &&
    (typeof navigator === "undefined" || navigator.onLine !== false)
  ) {
    const rebuildResult = await fetchOrFallback(
      rebuildFirebaseAlertSummary,
      null,
      "firebase_alert_summary_rebuild_failed",
      detail,
    );
    if (rebuildResult.ok) {
      indicadorAlertas = rebuildResult.value;
      indicadorAlertasFresh = true;
    }
  }
  let indicadorRiesgo = indicadorRiesgoInicial;
  let indicadorRiesgoFresh = indicadorRiesgoResult.ok;
  if (
    indicadorRiesgoResult.ok &&
    !indicadorRiesgo &&
    (typeof navigator === "undefined" || navigator.onLine !== false)
  ) {
    const rebuildResult = await fetchOrFallback(
      rebuildFirebaseRiskIndicator,
      null,
      "firebase_risk_indicator_rebuild_failed",
      detail,
    );
    if (rebuildResult.ok) {
      indicadorRiesgo = rebuildResult.value;
      indicadorRiesgoFresh = true;
    }
  }

  if (empleadosResult.ok) {
    replaceEmployees(empleados.map(normalizeEmployee));
  }
  if (patologiasResult.ok && parametrosRiesgoResult.ok) {
    replaceRiskConfig({
      parameters: parametrosRiesgo || {},
      pathologies: patologias,
    });
  }
  if (ausenciasResult.ok) {
    replaceAbsences(mergeAbsencesWithPendingLocal(ausencias.map(normalizeAbsence)));
  }

  if (canReadClinical) {
    if (validacionesResult.ok) {
      replaceValidationQueue(
        mergeValidationsWithPendingLocal(validaciones.map(normalizeValidation)),
      );
    }
  } else {
    replaceValidationQueue([]);
  }
  if (borradoresResult.ok) {
    replaceDrafts(mergeDraftsWithPendingLocal(borradores.map(normalizeDraft)));
  }

  const historyByEmployee = {};
  historial.forEach((doc) => {
    const record = normalizeHistory(doc);
    const employeeKey = doc.employeeId || record.employee;
    if (!employeeKey) return;
    historyByEmployee[employeeKey] = [
      ...(historyByEmployee[employeeKey] || []),
      record,
    ];
  });
  if (canReadClinical && historialResult.ok) {
    replaceAllHistory(historyByEmployee);
  } else if (!canReadClinical) {
    replaceAllHistory({});
  }

  const plansByEmployee = {};
  planes.forEach((doc) => {
    if (!doc.employeeId && !doc.id) return;
    plansByEmployee[doc.employeeId || doc.id] = normalizePlan(doc);
  });
  if (canReadClinical) {
    if (planesResult.ok) replaceAllPlans(plansByEmployee);
    if (alertasResult.ok) {
      replaceRiskAlerts(alertas.map(normalizeRiskAlert));
    }
  } else {
    replaceAllPlans({});
    replaceRiskAlerts([]);
  }
  if (indicadorAlertasFresh) {
    replaceRiskAlertSummary(
      indicadorAlertas ? normalizeRiskAlertSummary(indicadorAlertas) : null,
    );
  }
  if (indicadorRiesgoFresh) {
    replaceRiskIndicator(
      indicadorRiesgo ? normalizeRiskIndicator(indicadorRiesgo) : null,
    );
  }

  const failedCollections = [
    ["empleados", empleadosResult],
    ["patologias", patologiasResult],
    ["parametros_riesgo", parametrosRiesgoResult],
    ["ausencias", ausenciasResult],
    ["validaciones_medicas", validacionesResult],
    ["historial_medico", historialResult],
    ["borradores", borradoresResult],
    ["planes_preventivos", planesResult],
    ["alertas_riesgo", alertasResult],
    ["indicadores_alertas", indicadorAlertasResult],
    ["indicadores_riesgo", indicadorRiesgoResult],
  ]
    .filter(([, result]) => !result.ok)
    .map(([collectionName]) => collectionName);

  appendAuditLog(
    failedCollections.length
      ? "firebase_hydration_local_fallback"
      : "firebase_hydration_success",
    {
    user: user?.email,
    role,
    metadata: {
      empleados: empleados.length,
      patologias: patologias.length,
      parametrosRiesgo: parametrosRiesgo ? 1 : 0,
      ausencias: ausencias.length,
      validaciones: validaciones.length,
      historial: historial.length,
      borradores: borradores.length,
      planes: planes.length,
      alertas: alertas.length,
      indicadorAlertas: indicadorAlertas ? 1 : 0,
      indicadorRiesgo: indicadorRiesgo ? 1 : 0,
      preservoCacheLocal: failedCollections.length > 0,
      coleccionesNoDisponibles: failedCollections,
    },
    },
  );

  if (!failedCollections.length) {
    recordDashboardSyncSuccess();
  }

  return {
    empleados: empleados.length,
    patologias: patologias.length,
    parametrosRiesgo: parametrosRiesgo ? 1 : 0,
    ausencias: ausencias.length,
    validaciones: validaciones.length,
    historial: historial.length,
    borradores: borradores.length,
    planes: planes.length,
    alertas: alertas.length,
    indicadorAlertas: indicadorAlertas ? 1 : 0,
    indicadorRiesgo: indicadorRiesgo ? 1 : 0,
    preservedLocalCache: failedCollections.length > 0,
    failedCollections,
  };
};

const mapSnapshotDocs = (snapshot) =>
  snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data(),
  }));

const getPendingOperations = () =>
  readOperationQueue().filter(
    (operation) => !["synced", "failed", "conflict"].includes(operation.status),
  );

const mergeValidationsWithPendingLocal = (remoteEntries) => {
  const pendingReferences = new Set(
    getPendingOperations()
      .filter((operation) =>
        ["submitCertificate", "validateCertificate"].includes(operation.type),
      )
      .map((operation) => operation.entityId || operation.payload?.reference)
      .filter(Boolean),
  );
  const merged = new Map(
    remoteEntries.map((entry) => [entry.reference || entry.id, entry]),
  );
  readValidationQueue().forEach((entry) => {
    const reference = entry.reference || entry.id;
    if (pendingReferences.has(reference)) merged.set(reference, entry);
  });
  return [...merged.values()];
};

const mergeAbsencesWithPendingLocal = (remoteEntries) => {
  const pendingIds = new Set(
    getPendingOperations()
      .filter((operation) =>
        ["submitAbsence", "submitCertificate"].includes(operation.type),
      )
      .map((operation) => operation.entityId)
      .filter(Boolean),
  );
  const merged = new Map(
    remoteEntries.map((entry) => [entry.absenceId || entry.id, entry]),
  );
  readAbsences().forEach((entry) => {
    const absenceId = entry.absenceId || entry.id;
    if (pendingIds.has(absenceId)) merged.set(absenceId, entry);
  });
  return [...merged.values()];
};

const mergeDraftsWithPendingLocal = (remoteDrafts) => {
  const pendingOperations = getPendingOperations();
  const pendingSaves = new Set(
    pendingOperations
      .filter((operation) => operation.type === "saveDraft")
      .map(
        (operation) =>
          operation.entityId ||
          operation.payload?.draftId ||
          operation.payload?.payload?.draftId,
      )
      .filter(Boolean),
  );
  const pendingDeletes = new Set(
    pendingOperations
      .filter((operation) => operation.type === "deleteDraft")
      .map(
        (operation) =>
          operation.entityId || operation.payload?.draftId || operation.payload?.id,
      )
      .filter(Boolean),
  );
  const merged = new Map(
    remoteDrafts
      .filter((draft) => !pendingDeletes.has(draft.draftId || draft.id))
      .map((draft) => [draft.draftId || draft.id, draft]),
  );
  readDrafts().forEach((draft) => {
    const draftId = draft.draftId || draft.id;
    if (pendingSaves.has(draftId)) merged.set(draftId, draft);
  });
  return [...merged.values()];
};

const shouldPreserveLocalSnapshot = (snapshot) => {
  const offline =
    typeof navigator !== "undefined" && navigator.onLine === false;
  return offline && snapshot?.metadata?.fromCache === true;
};

export const startFirebaseRealtimeSync = ({ user, role } = {}) => {
  const clinicalRoles = ["superAdmin", "medico", "administrativoSalud"];
  const canReadClinical = clinicalRoles.includes(role);
  const { db } = getFirebaseServices();
  const unsubscribers = [];

  unsubscribers.push(
    onSnapshot(
      collection(db, "ausencias"),
      (snapshot) => {
        if (shouldPreserveLocalSnapshot(snapshot)) return;
        replaceAbsences(
          mergeAbsencesWithPendingLocal(
            mapSnapshotDocs(snapshot).map(normalizeAbsence),
          ),
        );
      },
      (error) => {
        appendAuditLog("firebase_realtime_sync_failed", {
          user: user?.email,
          role,
          metadata: {
            collection: "ausencias",
            error: error?.message || "No se pudo escuchar Firestore.",
          },
        });
      },
    ),
  );

  if (canReadClinical) {
    unsubscribers.push(
      onSnapshot(
        collection(db, "validaciones_medicas"),
        (snapshot) => {
          if (shouldPreserveLocalSnapshot(snapshot)) return;
          replaceValidationQueue(
            mergeValidationsWithPendingLocal(
              mapSnapshotDocs(snapshot).map(normalizeValidation),
            ),
          );
        },
        (error) => {
          appendAuditLog("firebase_realtime_sync_failed", {
            user: user?.email,
            role,
            metadata: {
              collection: "validaciones_medicas",
              error: error?.message || "No se pudo escuchar Firestore.",
            },
          });
        },
      ),
    );
    unsubscribers.push(
      onSnapshot(
        collection(db, "alertas_riesgo"),
        (snapshot) => {
          if (shouldPreserveLocalSnapshot(snapshot)) return;
          replaceRiskAlerts(mapSnapshotDocs(snapshot).map(normalizeRiskAlert));
        },
        (error) => {
          appendAuditLog("firebase_realtime_sync_failed", {
            user: user?.email,
            role,
            metadata: {
              collection: "alertas_riesgo",
              error: error?.message || "No se pudo escuchar Firestore.",
            },
          });
        },
      ),
    );
  }

  unsubscribers.push(
    onSnapshot(
      doc(db, "indicadores_alertas", "global"),
      (snapshot) => {
        if (shouldPreserveLocalSnapshot(snapshot)) return;
        replaceRiskAlertSummary(
          snapshot.exists()
            ? normalizeRiskAlertSummary(snapshot.data())
            : null,
        );
      },
      (error) => {
        appendAuditLog("firebase_realtime_sync_failed", {
          user: user?.email,
          role,
          metadata: {
            collection: "indicadores_alertas",
            error: error?.message || "No se pudo escuchar Firestore.",
          },
        });
      },
    ),
  );

  unsubscribers.push(
    onSnapshot(
      doc(db, "indicadores_riesgo", "global"),
      (snapshot) => {
        if (shouldPreserveLocalSnapshot(snapshot)) return;
        replaceRiskIndicator(
          snapshot.exists() ? normalizeRiskIndicator(snapshot.data()) : null,
        );
      },
      (error) => {
        appendAuditLog("firebase_realtime_sync_failed", {
          user: user?.email,
          role,
          metadata: {
            collection: "indicadores_riesgo",
            error: error?.message || "No se pudo escuchar Firestore.",
          },
        });
      },
    ),
  );

  unsubscribers.push(
    onSnapshot(
      collection(db, "borradores"),
      (snapshot) => {
        if (shouldPreserveLocalSnapshot(snapshot)) return;
        replaceDrafts(
          mergeDraftsWithPendingLocal(
            mapSnapshotDocs(snapshot).map(normalizeDraft),
          ),
        );
      },
      (error) => {
        appendAuditLog("firebase_realtime_sync_failed", {
          user: user?.email,
          role,
          metadata: {
            collection: "borradores",
            error: error?.message || "No se pudo escuchar Firestore.",
          },
        });
      },
    ),
  );

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
};
