import {
  listBorradores,
  listEmpleados,
  listHistorial,
  listPatologias,
  listPlanesPreventivos,
  getParametrosRiesgo,
  listValidaciones,
} from "../../utils/firestoreEntities.js";
import { replaceDrafts } from "../../utils/draftStorage.js";
import { replaceEmployees } from "../../utils/employeeStorage.js";
import { replaceAllHistory } from "../../utils/historyStorage.js";
import { replaceAllPlans } from "../../utils/planStorage.js";
import { replaceRiskConfig } from "../../utils/riskConfigStorage.js";
import { replaceValidationQueue } from "../../utils/validationStorage.js";
import { appendAuditLog } from "../../utils/auditLog.js";

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
    previewUrl: certificadoDigital.downloadUrl || "",
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
  submitted: toIsoString(doc.creadoEn || doc.actualizadoEn),
  receivedTimestamp: doc.creadoEn?.toMillis?.() || Date.now(),
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
  reviewer: doc.aprobadoPor || "",
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

const fetchOrFallback = async (fetcher, fallback, eventName, detail) => {
  try {
    return await fetcher();
  } catch (error) {
    appendAuditLog(eventName, {
      ...detail,
      metadata: {
        error: error?.message || "No se pudo leer Firestore.",
      },
    });
    return fallback;
  }
};

export const hydrateFirebaseData = async ({ user, role } = {}) => {
  const clinicalRoles = ["superAdmin", "medico", "administrativoSalud"];
  const canReadClinical = clinicalRoles.includes(role);
  const detail = { user: user?.email, role };

  const [
    empleados,
    patologias,
    parametrosRiesgo,
    validaciones,
    historial,
    borradores,
    planes,
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
      canReadClinical
        ? fetchOrFallback(
            listValidaciones,
            [],
            "firebase_hydration_failed",
            detail,
          )
        : Promise.resolve([]),
      canReadClinical
        ? fetchOrFallback(listHistorial, [], "firebase_hydration_failed", detail)
        : Promise.resolve([]),
      fetchOrFallback(listBorradores, [], "firebase_hydration_failed", detail),
      canReadClinical
        ? fetchOrFallback(
            listPlanesPreventivos,
            [],
            "firebase_hydration_failed",
            detail,
          )
        : Promise.resolve([]),
    ]);

  replaceEmployees(empleados.map(normalizeEmployee));
  replaceRiskConfig({
    parameters: parametrosRiesgo || {},
    pathologies: patologias,
  });

  if (canReadClinical) {
    replaceValidationQueue(validaciones.map(normalizeValidation));
  }
  replaceDrafts(borradores.map(normalizeDraft));

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
  if (canReadClinical) {
    replaceAllHistory(historyByEmployee);
  }

  const plansByEmployee = {};
  planes.forEach((doc) => {
    if (!doc.employeeId && !doc.id) return;
    plansByEmployee[doc.employeeId || doc.id] = normalizePlan(doc);
  });
  if (canReadClinical) {
    replaceAllPlans(plansByEmployee);
  }

  appendAuditLog("firebase_hydration_success", {
    user: user?.email,
    role,
    metadata: {
      empleados: empleados.length,
      patologias: patologias.length,
      parametrosRiesgo: parametrosRiesgo ? 1 : 0,
      validaciones: validaciones.length,
      historial: historial.length,
      borradores: borradores.length,
      planes: planes.length,
    },
  });

  return {
    empleados: empleados.length,
    patologias: patologias.length,
    parametrosRiesgo: parametrosRiesgo ? 1 : 0,
    validaciones: validaciones.length,
    historial: historial.length,
    borradores: borradores.length,
    planes: planes.length,
  };
};
