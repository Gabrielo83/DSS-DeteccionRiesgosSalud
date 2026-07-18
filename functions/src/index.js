import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { calculateRiskScoreWithConfig } from "./riskEngine.js";
import {
  buildAlertId,
  evaluateConsolidatedAlert,
} from "./alertEngine.js";
import { buildAlertSummary } from "./alertSummary.js";
import { buildRiskIndicator } from "./riskIndicator.js";

initializeApp();

const db = getFirestore();
const RISK_ENGINE_VERSION = "risk-engine-v2";
const ALERT_ENGINE_VERSION = "alert-engine-v1";

const requireSuperAdmin = async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }

  const callerSnapshot = await db.doc(`usuarios/${callerUid}`).get();
  if (!callerSnapshot.exists || callerSnapshot.data()?.rol !== "superAdmin") {
    throw new HttpsError(
      "permission-denied",
      "Solo un superAdmin puede ejecutar esta operacion.",
    );
  }

  return callerSnapshot.data();
};

const requireEnabledUser = async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion.");
  }
  const callerSnapshot = await db.doc(`usuarios/${callerUid}`).get();
  const caller = callerSnapshot.exists ? callerSnapshot.data() : null;
  if (!caller?.rol) {
    throw new HttpsError(
      "permission-denied",
      "El usuario no tiene un rol habilitado.",
    );
  }
  return caller;
};

export const actualizarCorreoUsuario = onCall(
  { region: "us-east1" },
  async (request) => {
    await requireSuperAdmin(request);

    const uid = String(request.data?.uid || "").trim();
    const nuevoEmail = String(request.data?.nuevoEmail || "")
      .trim()
      .toLowerCase();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!uid || !emailPattern.test(nuevoEmail)) {
      throw new HttpsError(
        "invalid-argument",
        "Debes indicar un UID y un correo valido.",
      );
    }

    const profileRef = db.doc(`usuarios/${uid}`);
    const [profileSnapshot, userRecord] = await Promise.all([
      profileRef.get(),
      getAuth().getUser(uid),
    ]);

    if (!profileSnapshot.exists) {
      throw new HttpsError(
        "not-found",
        "El usuario no tiene un perfil funcional en Firestore.",
      );
    }

    const correoAnterior = userRecord.email || "";
    if (correoAnterior.toLowerCase() === nuevoEmail) {
      return { uid, email: nuevoEmail, sinCambios: true };
    }

    try {
      await getAuth().updateUser(uid, {
        email: nuevoEmail,
        emailVerified: false,
      });

      try {
        await profileRef.set(
          {
            email: nuevoEmail,
            actualizadoEn: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
      } catch (firestoreError) {
        if (correoAnterior) {
          await getAuth()
            .updateUser(uid, {
              email: correoAnterior,
              emailVerified: userRecord.emailVerified,
            })
            .catch((rollbackError) => {
              logger.error("No se pudo revertir el correo en Authentication.", {
                uid,
                rollbackError,
              });
            });
        }
        throw firestoreError;
      }
    } catch (error) {
      logger.error("No se pudo actualizar el correo del usuario.", {
        uid,
        error,
      });
      if (error?.code === "auth/email-already-exists") {
        throw new HttpsError(
          "already-exists",
          "El correo ya pertenece a otro usuario.",
        );
      }
      throw new HttpsError("internal", "No se pudo actualizar el correo.");
    }

    await db
      .collection("auditoria")
      .add({
        eventType: "usuario_correo_actualizado_backend",
        entityId: uid,
        user: request.auth?.token?.email || request.auth.uid,
        role: "superAdmin",
        metadata: {
          correoAnterior,
          correoNuevo: nuevoEmail,
        },
        creadoEn: FieldValue.serverTimestamp(),
        timestamp: FieldValue.serverTimestamp(),
      })
      .catch((auditError) => {
        logger.error("No se pudo auditar el cambio de correo.", {
          uid,
          auditError,
        });
      });

    logger.info("Correo de usuario actualizado.", {
      uid,
      nuevoEmail,
      callerUid: request.auth.uid,
    });

    return { uid, email: nuevoEmail, sinCambios: false };
  },
);

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

const resolveAlertPair = (validation = {}) => {
  const employeeId = String(validation.employeeId || "").trim();
  const pathologyGroup = String(validation.grupoPatologia || "").trim();
  return employeeId && pathologyGroup
    ? { employeeId, pathologyGroup }
    : null;
};

const alertSignature = (alert = {}) =>
  JSON.stringify({
    estado: alert.estado || "",
    motivos: alert.motivos || [],
    recurrencias: Number(alert.recurrencias || 0),
    riesgoMaximo: Number(alert.riesgoMaximo || 0),
    riesgoIndividualMaximo: Number(alert.riesgoIndividualMaximo || 0),
    referencias: alert.referencias || [],
    ultimaReferencia: alert.ultimaReferencia || "",
    ultimaFecha: alert.ultimaFecha || "",
    ventanaMeses: Number(alert.ventanaMeses || 0),
    version: alert.version || "",
  });

const auditAlertTransition = (
  transaction,
  eventId,
  alertId,
  eventType,
  alert,
) => {
  const safeEventId = String(eventId || Date.now()).replace(
    /[^a-zA-Z0-9_-]/g,
    "-",
  );
  const auditRef = db.collection("auditoria").doc(`${safeEventId}_${alertId}`);
  transaction.set(auditRef, {
    id: auditRef.id,
    eventType,
    evento: eventType,
    entityId: alertId,
    referencia: alert.ultimaReferencia || "",
    employeeId: alert.employeeId,
    nombreCompleto: alert.nombreCompleto || "",
    user: "cloud-functions",
    role: "backend",
    origen: "cloud-functions",
    metadata: {
      estado: alert.estado,
      grupoPatologia: alert.grupoPatologia,
      motivos: alert.motivos,
      recurrencias: alert.recurrencias,
      riesgoMaximo: alert.riesgoMaximo,
      riesgoIndividualMaximo: alert.riesgoIndividualMaximo,
      referencias: alert.referencias,
      ventanaMeses: alert.ventanaMeses,
      version: ALERT_ENGINE_VERSION,
    },
    creadoEn: FieldValue.serverTimestamp(),
    timestamp: FieldValue.serverTimestamp(),
  });
};

const consolidateRiskAlert = async (pair, riskConfig, eventId) => {
  const snapshot = await db
    .collection("validaciones_medicas")
    .where("employeeId", "==", pair.employeeId)
    .where("grupoPatologia", "==", pair.pathologyGroup)
    .get();
  const occurrences = snapshot.docs.map((doc) => {
    const validation = doc.data();
    const absenceDays =
      Number(validation.dias) ||
      diffDaysInclusive(validation.fechaInicio, validation.fechaFin) ||
      0;
    const individualRisk = calculateRiskScoreWithConfig(
      {
        absenceType: validation.tipo || validation.tipoCertificado || "",
        detailedReason:
          validation.diagnostico || validation.notasMedicas || "",
        pathologyCategory: validation.grupoPatologia || "",
        durationDays: absenceDays,
        occurrenceCount: 1,
      },
      riskConfig,
    );
    return {
      id: doc.id,
      ...validation,
      riesgoIndividualPuntaje: individualRisk.score,
    };
  });
  const assessment = evaluateConsolidatedAlert(
    occurrences,
    riskConfig.parameters,
  );
  const alertId = buildAlertId(pair.employeeId, pair.pathologyGroup);
  const alertRef = db.collection("alertas_riesgo").doc(alertId);
  const latestOccurrence =
    occurrences.find(
      (item) => (item.reference || item.id) === assessment.latestReference,
    ) || occurrences.at(-1) || {};

  await db.runTransaction(async (transaction) => {
    const alertSnapshot = await transaction.get(alertRef);
    const currentAlert = alertSnapshot.exists ? alertSnapshot.data() : null;

    if (!assessment.active && !currentAlert) return;
    if (!assessment.active && currentAlert?.estado !== "activa") return;

    const state = assessment.active ? "activa" : "resuelta";
    const alert = {
      alertaId: alertId,
      employeeId: pair.employeeId,
      nombreCompleto:
        latestOccurrence.nombreCompleto || currentAlert?.nombreCompleto || "",
      sector: latestOccurrence.sector || currentAlert?.sector || "",
      puesto: latestOccurrence.puesto || currentAlert?.puesto || "",
      grupoPatologia: pair.pathologyGroup,
      tipo: "riesgo_consolidado",
      estado: state,
      severidad: assessment.active ? "alta" : currentAlert?.severidad || "alta",
      motivos: assessment.reasons,
      recurrencias: assessment.occurrenceCount,
      ventanaMeses: assessment.reviewPeriodMonths,
      riesgoMaximo: assessment.maxRiskScore,
      riesgoIndividualMaximo: assessment.maxIndividualRiskScore,
      referencias: assessment.references,
      ultimaReferencia: assessment.latestReference,
      ultimaFecha: assessment.latestDate,
      origen: "cloud-functions",
      version: ALERT_ENGINE_VERSION,
    };

    if (currentAlert && alertSignature(currentAlert) === alertSignature(alert)) {
      return;
    }

    const transition = !currentAlert
      ? "alerta_riesgo_activada_backend"
      : state === "resuelta"
        ? "alerta_riesgo_resuelta_backend"
        : currentAlert.estado === "resuelta"
          ? "alerta_riesgo_activada_backend"
          : "alerta_riesgo_actualizada_backend";
    const timestamps = {
      actualizadoEn: FieldValue.serverTimestamp(),
      ...(alertSnapshot.exists
        ? {}
        : { creadoEn: FieldValue.serverTimestamp() }),
      ...(state === "activa"
        ? {
            ...(currentAlert?.estado === "activa"
              ? {}
              : { activadoEn: FieldValue.serverTimestamp() }),
            resueltoEn: null,
          }
        : { resueltoEn: FieldValue.serverTimestamp() }),
    };

    transaction.set(alertRef, { ...alert, ...timestamps }, { merge: true });
    auditAlertTransition(
      transaction,
      eventId,
      alertId,
      transition,
      alert,
    );
  });
};

export const consolidarAlertasRiesgo = onDocumentWritten(
  {
    document: "validaciones_medicas/{reference}",
    region: "us-east1",
  },
  async (event) => {
    const before = event.data?.before?.exists ? event.data.before.data() : null;
    const after = event.data?.after?.exists ? event.data.after.data() : null;
    const pairs = [resolveAlertPair(before), resolveAlertPair(after)].filter(
      Boolean,
    );
    const uniquePairs = [
      ...new Map(
        pairs.map((pair) => [
          buildAlertId(pair.employeeId, pair.pathologyGroup),
          pair,
        ]),
      ).values(),
    ];

    if (!uniquePairs.length) return;

    const riskConfig = await loadRiskConfig();

    await Promise.all(
      uniquePairs.map((pair) =>
        consolidateRiskAlert(pair, riskConfig, event.id),
      ),
    );

    logger.info("Alertas de riesgo consolidadas.", {
      reference: event.params.reference,
      pairs: uniquePairs.length,
    });
  },
);

const rebuildAlertSummary = async () => {
  const snapshot = await db.collection("alertas_riesgo").get();
  const summary = buildAlertSummary(
    snapshot.docs.map((document) => document.data()),
  );
  await db.doc("indicadores_alertas/global").set(
    {
      ...summary,
      actualizadoEn: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );
  return summary;
};

export const actualizarIndicadoresAlertas = onDocumentWritten(
  {
    document: "alertas_riesgo/{alertId}",
    region: "us-east1",
  },
  async (event) => {
    const summary = await rebuildAlertSummary();
    logger.info("Indicadores agregados de alertas actualizados.", {
      alertId: event.params.alertId,
      totalActivas: summary.totalActivas,
    });
  },
);

export const reconstruirIndicadoresAlertas = onCall(
  { region: "us-east1" },
  async (request) => {
    const caller = await requireEnabledUser(request);
    const summary = await rebuildAlertSummary();
    await db.collection("auditoria").add({
      eventType: "indicadores_alertas_reconstruidos_backend",
      entityId: "global",
      user: request.auth?.token?.email || request.auth.uid,
      role: caller.rol,
      metadata: { totalActivas: summary.totalActivas },
      creadoEn: FieldValue.serverTimestamp(),
      timestamp: FieldValue.serverTimestamp(),
    });
    return summary;
  },
);

const rebuildRiskIndicator = async () => {
  const snapshot = await db.collection("historial_medico").get();
  const indicator = buildRiskIndicator(
    snapshot.docs.map((document) => document.data()),
  );
  await db.doc("indicadores_riesgo/global").set(
    {
      ...indicator,
      actualizadoEn: FieldValue.serverTimestamp(),
    },
    { merge: false },
  );
  return indicator;
};

export const actualizarIndicadoresRiesgo = onDocumentWritten(
  {
    document: "historial_medico/{historyId}",
    region: "us-east1",
  },
  async (event) => {
    const indicator = await rebuildRiskIndicator();
    logger.info("Indicadores agregados de riesgo actualizados.", {
      historyId: event.params.historyId,
      periodos: indicator.periodos.length,
    });
  },
);

export const reconstruirIndicadoresRiesgo = onCall(
  { region: "us-east1" },
  async (request) => {
    const caller = await requireEnabledUser(request);
    const indicator = await rebuildRiskIndicator();
    await db.collection("auditoria").add({
      eventType: "indicadores_riesgo_reconstruidos_backend",
      entityId: "global",
      user: request.auth?.token?.email || request.auth.uid,
      role: caller.rol,
      metadata: { periodos: indicator.periodos.length },
      creadoEn: FieldValue.serverTimestamp(),
      timestamp: FieldValue.serverTimestamp(),
    });
    return indicator;
  },
);
