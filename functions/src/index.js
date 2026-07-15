import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { calculateRiskScoreWithConfig } from "./riskEngine.js";

initializeApp();

const db = getFirestore();

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

const countOccurrences = async (validation) => {
  const employeeId = validation.employeeId;
  const pathologyGroup = validation.grupoPatologia;
  if (!employeeId || !pathologyGroup) return 1;

  const config = await loadRiskConfig();
  const months = config.parameters?.periodoEvaluacionMeses || 6;
  const referenceDate =
    validation.fechaInicio || validation.fechaEmision || validation.creadoEn;

  const snapshot = await db
    .collection("validaciones_medicas")
    .where("employeeId", "==", employeeId)
    .where("grupoPatologia", "==", pathologyGroup)
    .get();

  const count = snapshot.docs.filter((doc) => {
    const item = doc.data();
    return isWithinMonthWindow(
      item.fechaInicio || item.fechaEmision || item.creadoEn,
      referenceDate,
      months,
    );
  }).length;

  return Math.max(1, count);
};

const buildRiskInput = async (validation) => {
  const absenceDays =
    Number(validation.dias) ||
    diffDaysInclusive(validation.fechaInicio, validation.fechaFin) ||
    0;

  return {
    absenceType: validation.tipo || validation.tipoCertificado || "",
    detailedReason: validation.diagnostico || validation.notasMedicas || "",
    pathologyCategory: validation.grupoPatologia || "",
    durationDays: absenceDays,
    occurrenceCount: await countOccurrences(validation),
  };
};

const riskChanged = (validation, riskAssessment) => {
  const currentScore = Number(validation.riesgoPuntaje);
  const currentLevel = validation.riesgoNivel || "";
  return (
    !Number.isFinite(currentScore) ||
    Math.abs(currentScore - riskAssessment.score) >= 0.05 ||
    currentLevel !== riskAssessment.level ||
    validation.riesgoCalculadoPor !== "cloud-functions"
  );
};

const writeAudit = async (reference, validation, riskAssessment) => {
  const auditRef = db.collection("auditoria").doc();
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
    metadata: {
      employeeId: validation.employeeId || "",
      nombreCompleto: validation.nombreCompleto || "",
      riesgoPuntaje: riskAssessment.score,
      riesgoNivel: riskAssessment.level,
      perfilDetectado: riskAssessment.matchedProfile || "",
    },
    creadoEn: FieldValue.serverTimestamp(),
    timestamp: FieldValue.serverTimestamp(),
  });
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
    const riskInput = await buildRiskInput(validation);
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
        riesgoActualizadoEn: FieldValue.serverTimestamp(),
        procesamientoRiesgo: {
          origen: "cloud-functions",
          version: "risk-engine-v1",
          actualizadoEn: FieldValue.serverTimestamp(),
        },
      },
      { merge: true },
    );

    await writeAudit(reference, validation, riskAssessment);

    logger.info("Riesgo recalculado por Cloud Functions.", {
      reference,
      riskScore: riskAssessment.score,
      riskLevel: riskAssessment.level,
    });
  },
);
