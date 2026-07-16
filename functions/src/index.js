import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { calculateRiskScoreWithConfig } from "./riskEngine.js";

initializeApp();

const db = getFirestore();
const RISK_ENGINE_VERSION = "risk-engine-v2";

const toDate = (value) => {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string") {
    const parsed = new Date(`${value}T00:00:00`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value instanceof Date) return value;
  return null;
};

const diffDaysInclusive = (startValue, endValue) => {
  const start = toDate(startValue);
  const end = toDate(endValue);
  if (!start || !end || end < start) return null;
  return Math.round((end - start) / 86400000) + 1;
};

const isWithinMonthWindow = (dateValue, referenceDate, months) => {
  const date = toDate(dateValue);
  const reference = toDate(referenceDate);
  if (!date || !reference) return false;
  const windowStart = new Date(reference);
  windowStart.setMonth(windowStart.getMonth() - months);
  return date >= windowStart && date <= reference;
};

const normalizeStatus = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const isValidatedStatus = (value) => {
  const normalized = normalizeStatus(value);
  return normalized === "validado" || normalized === "validada";
};

const resolveReferenceDate = (validation) =>
  validation.fechaInicio ||
  validation.fechaEmision ||
  validation.creadoEn ||
  validation.updatedAt ||
  validation.actualizadoEn;

const loadRiskConfig = async () => {
  const [parametersSnapshot, pathologiesSnapshot] = await Promise.all([
    db.doc("parametros_riesgo/global").get(),
    db.collection("patologias").get(),
  ]);

  return {
    parameters: parametersSnapshot.exists ? parametersSnapshot.data() : {},
    profiles: pathologiesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })),
  };
};

const countOccurrences = async (validation, riskConfig) => {
  const employeeId = validation.employeeId;
  const pathologyGroup = validation.grupoPatologia;
  if (!employeeId || !pathologyGroup) return 1;

  const months =
    riskConfig.parameters?.periodoEvaluacionMeses ||
    riskConfig.parameters?.reviewPeriodMonths ||
    6;
  const referenceDate = resolveReferenceDate(validation);

  const snapshot = await db
    .collection("validaciones_medicas")
    .where("employeeId", "==", employeeId)
    .where("grupoPatologia", "==", pathologyGroup)
    .get();

  const count = snapshot.docs.filter((doc) => {
    const item = doc.data();
    if (!isValidatedStatus(item.estado || item.status)) return false;
    return isWithinMonthWindow(
      resolveReferenceDate(item),
      referenceDate,
      months,
    );
  }).length;

  if (isValidatedStatus(validation.estado || validation.status)) {
    return Math.max(1, count);
  }

  return Math.max(0, count);
};

const buildRiskInput = async (validation, riskConfig) => {
  const absenceDays =
    Number(validation.dias) ||
    diffDaysInclusive(validation.fechaInicio, validation.fechaFin) ||
    0;

  return {
    absenceType: validation.tipo || validation.tipoCertificado || "",
    detailedReason: validation.diagnostico || validation.notasMedicas || "",
    pathologyCategory: validation.grupoPatologia || "",
    durationDays: absenceDays,
    occurrenceCount: await countOccurrences(validation, riskConfig),
    referenceDate: resolveReferenceDate(validation) || null,
  };
};

const riskChanged = (validation, riskAssessment) => {
  const currentScore = Number(validation.riesgoPuntaje);
  const currentLevel = validation.riesgoNivel || "";
  return (
    !Number.isFinite(currentScore) ||
    Math.abs(currentScore - riskAssessment.score) >= 0.05 ||
    currentLevel !== riskAssessment.level ||
    validation.riesgoCalculadoPor !== "cloud-functions" ||
    validation.procesamientoRiesgo?.version !== RISK_ENGINE_VERSION
  );
};

const buildProcessingMetadata = (validation, riskInput, riskConfig, riskAssessment) => {
  const parameters = riskConfig.parameters || {};
  return {
    origen: "cloud-functions",
    version: RISK_ENGINE_VERSION,
    actualizadoEn: FieldValue.serverTimestamp(),
    estadoEvaluado: validation.estado || validation.status || "",
    insumos: {
      diasAusencia: riskInput.durationDays,
      recurrenciasVentana: riskInput.occurrenceCount,
      periodoEvaluacionMeses:
        parameters.periodoEvaluacionMeses ||
        parameters.reviewPeriodMonths ||
        6,
      grupoPatologia: validation.grupoPatologia || "",
      tipoAusencia: riskInput.absenceType,
      fechaReferencia: riskInput.referenceDate || "",
    },
    parametros: {
      umbralMedio:
        parameters.umbralMedioRiesgo || parameters.mediumRiskThreshold || 5,
      umbralAlto:
        parameters.umbralAltoRiesgo || parameters.highRiskThreshold || 7,
      recurrenciasMedia:
        parameters.recurrenciasMedia || parameters.mediumOccurrenceCount || 2,
      recurrenciasAlta:
        parameters.recurrenciasAlta || parameters.highOccurrenceCount || 3,
    },
    resultado: {
      puntaje: riskAssessment.score,
      nivel: riskAssessment.level,
      descriptor: riskAssessment.descriptor,
      perfilDetectado: riskAssessment.matchedProfile || "",
    },
  };
};

const writeAudit = async (
  reference,
  validation,
  riskAssessment,
  riskInput,
  riskConfig,
) => {
  const auditRef = db.collection("auditoria").doc();
  const processing = buildProcessingMetadata(
    validation,
    riskInput,
    riskConfig,
    riskAssessment,
  );
  await auditRef.set({
    id: auditRef.id,
    eventType: "riesgo_recalculado_backend",
    evento: "riesgo_recalculado_backend",
    entityId: reference,
    referencia: reference,
    user: "cloud-functions",
    role: "backend",
    employeeId: validation.employeeId || "",
    nombreCompleto: validation.nombreCompleto || "",
    origen: "cloud-functions",
    riesgoPuntaje: riskAssessment.score,
    riesgoNivel: riskAssessment.level,
    perfilDetectado: riskAssessment.matchedProfile || "",
    recurrenciasVentana: riskInput.occurrenceCount,
    periodoEvaluacionMeses: processing.insumos.periodoEvaluacionMeses,
    metadata: {
      employeeId: validation.employeeId || "",
      nombreCompleto: validation.nombreCompleto || "",
      riesgoPuntaje: riskAssessment.score,
      riesgoNivel: riskAssessment.level,
      perfilDetectado: riskAssessment.matchedProfile || "",
      procesamientoRiesgo: processing,
    },
    creadoEn: FieldValue.serverTimestamp(),
    timestamp: FieldValue.serverTimestamp(),
  });
};

const syncHistoryRisk = async (reference, validation, riskAssessment, riskInput) => {
  if (!isValidatedStatus(validation.estado || validation.status)) return;

  const historyRef = db.collection("historial_medico").doc(reference);
  const historySnapshot = await historyRef.get();
  if (!historySnapshot.exists) return;

  await historyRef.set(
    {
      riesgoPuntaje: riskAssessment.score,
      riesgoNivel: riskAssessment.level,
      riesgoDescriptor: riskAssessment.descriptor,
      riesgoPerfilDetectado: riskAssessment.matchedProfile || "",
      riesgoCalculadoPor: "cloud-functions",
      riesgoRecurrencias: riskInput.occurrenceCount,
      riesgoActualizadoEn: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
};

export const recalcularRiesgoValidacionMedica = onDocumentWritten(
  {
    document: "validaciones_medicas/{reference}",
    region: "us-east1",
  },
  async (event) => {
    const afterSnapshot = event.data?.after;
    if (!afterSnapshot?.exists) return;

    const reference = event.params.reference;
    const validation = afterSnapshot.data();
    const riskConfig = await loadRiskConfig();
    const riskInput = await buildRiskInput(validation, riskConfig);
    const riskAssessment = calculateRiskScoreWithConfig(riskInput, riskConfig);

    if (!riskChanged(validation, riskAssessment)) {
      logger.info("Riesgo sin cambios; no se actualiza documento.", {
        reference,
        riskScore: riskAssessment.score,
      });
      return;
    }

    await afterSnapshot.ref.set(
      {
        riesgoPuntaje: riskAssessment.score,
        riesgoNivel: riskAssessment.level,
        riesgoDescriptor: riskAssessment.descriptor,
        riesgoPerfilDetectado: riskAssessment.matchedProfile || "",
        riesgoCalculadoPor: "cloud-functions",
        riesgoRecurrencias: riskInput.occurrenceCount,
        riesgoVentanaMeses:
          riskConfig.parameters?.periodoEvaluacionMeses ||
          riskConfig.parameters?.reviewPeriodMonths ||
          6,
        riesgoActualizadoEn: FieldValue.serverTimestamp(),
        procesamientoRiesgo: buildProcessingMetadata(
          validation,
          riskInput,
          riskConfig,
          riskAssessment,
        ),
      },
      { merge: true },
    );

    await syncHistoryRisk(reference, validation, riskAssessment, riskInput);
    await writeAudit(reference, validation, riskAssessment, riskInput, riskConfig);

    logger.info("Riesgo recalculado por Cloud Functions.", {
      reference,
      riskScore: riskAssessment.score,
      riskLevel: riskAssessment.level,
      occurrenceCount: riskInput.occurrenceCount,
    });
  },
);
