const normalizeEstado = (value) => {
  if (!value) return "";
  const lowered = value.toString().trim().toLowerCase();
  return lowered.replace(/\s+/g, "_");
};

const toNumber = (value) => {
  if (value == null || value === "") return null;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export const mapDraftPayloadToFirestore = (draftPayload) => {
  const formValues = draftPayload?.formValues || {};
  return {
    draftId: draftPayload?.draftId,
    employeeId: formValues.employeeId || "",
    nombreCompleto: formValues.employeeName || "",
    sector: formValues.sector || "",
    puesto: formValues.position || "",
    tipo: formValues.absenceType || "",
    diagnostico: formValues.detailedReason || "",
    fechaInicio: formValues.startDate || "",
    fechaFin: formValues.endDate || "",
    ausenciaDias: draftPayload?.absenceDays ?? null,
    ausenciaLabel: draftPayload?.absenceLabel || "",
    periodoLabel: draftPayload?.periodLabel || "",
    requiereCertificado: draftPayload?.requiresMedicalCertificate ?? false,
    guardadoEn: draftPayload?.savedAt || "",
    guardadoPor: draftPayload?.savedBy || "",
    camposParciales: {
      ...formValues,
      certificateInstitution: draftPayload?.certificateInstitution || "",
      certificateReference: draftPayload?.certificateReference || "",
      requiresMedicalCertificate:
        draftPayload?.requiresMedicalCertificate ?? false,
      absenceDays: draftPayload?.absenceDays ?? null,
      pathologyCategory: formValues.pathologyCategory || "",
      cieCode: formValues.cieCode || "",
      additionalNotes: formValues.additionalNotes || "",
      certificateFileMeta: draftPayload?.certificateFile || null,
    },
  };
};

export const mapValidationEntryToFirestore = (entry) => ({
  reference: entry?.reference,
  employeeId: entry?.employeeId || "",
  nombreCompleto: entry?.employee || entry?.employeeName || "",
  sector: entry?.sector || "",
  puesto: entry?.position || "",
  tipo: entry?.absenceType || "",
  tipoCertificado: entry?.certificateType || "",
  diagnostico: entry?.detailedReason || "",
  fechaInicio: entry?.startDate || "",
  fechaFin: entry?.endDate || "",
  dias: entry?.absenceDays ?? null,
  fechaEmision: entry?.issueDate || entry?.startDate || "",
  fechaValidez: entry?.validityDate || entry?.endDate || "",
  institucionMedica: entry?.institution || "",
  prioridad: entry?.priority || "",
  estado: normalizeEstado(entry?.status || ""),
  riesgoPuntaje: toNumber(entry?.riskScoreValue ?? entry?.riskScore),
  riesgoNivel: entry?.riskLevel || "",
  notasMedicas: entry?.medicalNotes || entry?.notes || "",
  grupoPatologia: entry?.pathologyCategory || "",
  cie10: entry?.cieCode || "",
  certificadoDigital: entry?.certificateFileMeta
    ? {
        nombre: entry.certificateFileMeta.name,
        tamano: entry.certificateFileMeta.size,
        tipoContenido:
          entry.certificateFileMeta.type ||
          entry.certificateFileMeta.contentType,
        rutaStorage: entry.certificateFileMeta.storagePath || "",
        downloadUrl: entry.certificateFileMeta.downloadUrl || "",
      }
    : null,
  planAcciones: entry?.planActions || [],
  planSeguimientos: entry?.planFollowUps || [],
  planRecomendaciones: entry?.planRecommendations || [],
  revisadoPor: entry?.reviewer || entry?.reviewedBy || "",
  revisadoEn: entry?.reviewedAt || entry?.reviewedTimestamp || null,
});

export const mapHistoryRecordToFirestore = (record) => ({
  historyId: record?.reference || record?.id,
  reference: record?.reference || "",
  employeeId: record?.employeeId || "",
  nombreCompleto: record?.employee || "",
  sector: record?.sector || "",
  puesto: record?.position || record?.puesto || "",
  tipo: record?.title || record?.absenceType || "",
  tipoCertificado: record?.certificateType || "",
  diagnostico: record?.detailedReason || "",
  fechaInicio: record?.startDate || "",
  fechaFin: record?.endDate || "",
  dias: record?.days ?? null,
  fechaEmision: record?.issued || record?.startDate || "",
  institucionMedica: record?.institution || "",
  riesgoPuntaje: toNumber(record?.riskScore),
  riesgoNivel: record?.riskLevel || "",
  estadoFinal: normalizeEstado(record?.status || ""),
  aprobadoPor: record?.reviewer || record?.approvedBy || "",
  aprobadoEn: record?.approvedAt || record?.reviewedAt || null,
  notasMedicas: record?.notes || "",
  grupoPatologia: record?.pathologyCategory || "",
  cie10: record?.cieCode || "",
  certificadoDigital: record?.documentMeta
    ? {
        nombre: record.documentMeta.name,
        tamano: record.documentMeta.size,
        tipoContenido:
          record.documentMeta.type || record.documentMeta.contentType,
        rutaStorage: record.documentMeta.storagePath || "",
        downloadUrl: record.documentMeta.downloadUrl || "",
      }
    : record?.document
      ? {
          nombre: record.document,
          tamano: null,
          tipoContenido: "",
          rutaStorage: "",
        }
      : null,
  planAcciones: record?.planActions || [],
  planSeguimientos: record?.planFollowUps || [],
  planRecomendaciones: record?.planRecommendations || [],
});

export const mapAbsenceFormToFirestore = ({
  formValues,
  absenceDays,
  certificateInstitution,
  certificateFileMeta,
  certificateReference,
  requiresApproval,
  status,
  createdBy,
}) => ({
  absenceId: formValues?.absenceId,
  referenciaCertificado: certificateReference || "",
  employeeId: formValues?.employeeId || "",
  nombreCompleto: formValues?.employeeName || "",
  sector: formValues?.sector || "",
  puesto: formValues?.position || "",
  tipo: formValues?.absenceType || "",
  diagnostico: formValues?.detailedReason || "",
  requiereAprobacion: requiresApproval || formValues?.requiresApproval || "",
  grupoPatologia: formValues?.pathologyCategory || "",
  cie10: formValues?.cieCode || "",
  observacionesAdicionales: formValues?.additionalNotes || "",
  fechaInicio: formValues?.startDate || "",
  fechaFin: formValues?.endDate || "",
  dias: absenceDays ?? null,
  institucionMedica: certificateInstitution || "",
  certificadoDigital: certificateFileMeta
    ? {
        nombre: certificateFileMeta.name,
        tamano: certificateFileMeta.size,
        tipoContenido: certificateFileMeta.type || certificateFileMeta.contentType,
        rutaStorage: certificateFileMeta.storagePath || "",
        downloadUrl: certificateFileMeta.downloadUrl || "",
      }
    : null,
  estado: status || "",
  creadoPor: createdBy || "",
});

export const mapPlanPreventivoToFirestore = (
  plan,
  employeeId,
  updatedBy,
  employeeMeta = {},
) => ({
  employeeId,
  nombreCompleto: employeeMeta?.nombreCompleto || employeeMeta?.fullName || "",
  sector: employeeMeta?.sector || "",
  puesto: employeeMeta?.puesto || employeeMeta?.position || "",
  acciones: plan?.actions || plan?.acciones || [],
  seguimientos: plan?.followUps || plan?.seguimientos || [],
  recomendaciones: plan?.recommendations || plan?.recomendaciones || [],
  actualizadoPor: updatedBy || "",
});

export const mapEmpleadoToFirestore = (employee) => ({
  employeeId: employee?.employeeId || employee?.id || "",
  nombreCompleto: employee?.fullName || employee?.nombreCompleto || "",
  sector: employee?.sector || "",
  puesto: employee?.position || employee?.puesto || "",
  legajoMedico: employee?.medicalRecordId || employee?.legajoMedico || "",
  email: employee?.email || "",
  telefono: employee?.phone || employee?.telefono || "",
  tipoSangre: employee?.bloodType || employee?.tipoSangre || "",
  antiguedad: employee?.seniority || employee?.antiguedad || "",
  avatar: employee?.avatar || "",
  activo: employee?.active ?? employee?.activo ?? true,
  fechaAlta: employee?.hireDate || employee?.startDate || employee?.fechaAlta || "",
  fechaBaja:
    employee?.terminationDate || employee?.endDate || employee?.fechaBaja || null,
});

export const mapUsuarioToFirestore = (user) => ({
  uid: user?.uid || "",
  email: user?.email || "",
  nombreVisible: user?.displayName || user?.fullName || "",
  rol: user?.role || "",
});

export const mapPatologiaToFirestore = (pathology) => ({
  pathologyId: pathology?.pathologyId || pathology?.id || "",
  nombre: pathology?.name || pathology?.nombre || "",
  cie10: pathology?.cie10 || pathology?.cie10Code || "",
  grupo: pathology?.group || pathology?.grupo || "",
  riesgoBase: toNumber(pathology?.baseRisk ?? pathology?.riesgoBase),
});

export const mapParametrosRiesgoToFirestore = (config) => ({
  configId: config?.configId || config?.id || "global",
  umbralAltoRiesgo: toNumber(
    config?.highRiskThreshold ?? config?.umbralAltoRiesgo,
  ),
  periodoEvaluacionMeses: toNumber(
    config?.reviewPeriodMonths ?? config?.periodoEvaluacionMeses,
  ),
  factorRecurrencia: toNumber(
    config?.recurrenceFactor ?? config?.factorRecurrencia,
  ),
});
