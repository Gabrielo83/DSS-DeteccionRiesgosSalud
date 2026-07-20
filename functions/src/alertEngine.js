const normalizeText = (value = "") =>
  String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value.toDate === "function") return value.toDate();
  if (typeof value === "string") {
    const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const parsed = new Date(dateOnly ? `${value}T00:00:00Z` : value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const resolveOccurrenceDate = (occurrence = {}) =>
  occurrence.fechaInicio ||
  occurrence.fechaEmision ||
  occurrence.creadoEn ||
  occurrence.updatedAt ||
  occurrence.actualizadoEn;

const isValidated = (occurrence = {}) => {
  const status = normalizeText(occurrence.estado || occurrence.status);
  return status === "validado" || status === "validada";
};

const numericOrFallback = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

export const normalizeAlertKey = (value = "") =>
  normalizeText(value)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "sin-dato";

export const buildAlertId = (employeeId, pathologyGroup) =>
  `${normalizeAlertKey(employeeId)}__${normalizeAlertKey(pathologyGroup)}`;

export const evaluateConsolidatedAlert = (
  occurrences = [],
  parameters = {},
) => {
  const reviewPeriodMonths = numericOrFallback(
    parameters.periodoEvaluacionMeses ?? parameters.reviewPeriodMonths,
    6,
  );
  const highOccurrenceCount = numericOrFallback(
    parameters.recurrenciasAlta ?? parameters.highOccurrenceCount,
    3,
  );
  const minimumRiskThreshold = numericOrFallback(
    parameters.umbralMedioRiesgo ?? parameters.mediumRiskThreshold,
    5,
  );
  const eligible = occurrences
    .filter(isValidated)
    .map((occurrence) => ({
      ...occurrence,
      resolvedDate: toDate(resolveOccurrenceDate(occurrence)),
      individualRiskScore: Number(
        occurrence.riesgoIndividualPuntaje ??
          occurrence.riesgoPuntaje ??
          occurrence.risk?.score,
      ),
    }))
    .filter(
      (occurrence) =>
        occurrence.resolvedDate &&
        Number.isFinite(occurrence.individualRiskScore) &&
        occurrence.individualRiskScore >= minimumRiskThreshold,
    );
  const dated = eligible;
  const latestDate = dated.reduce(
    (latest, occurrence) =>
      !latest || occurrence.resolvedDate > latest
        ? occurrence.resolvedDate
        : latest,
    null,
  );
  const windowStart = latestDate ? new Date(latestDate) : null;
  if (windowStart) {
    windowStart.setUTCMonth(windowStart.getUTCMonth() - reviewPeriodMonths);
  }

  const inWindow = eligible
    .filter(
      (occurrence) =>
        !latestDate ||
        (occurrence.resolvedDate >= windowStart &&
          occurrence.resolvedDate <= latestDate),
    )
    .sort((left, right) => {
      const dateDifference =
        (left.resolvedDate?.getTime() || 0) -
        (right.resolvedDate?.getTime() || 0);
      return dateDifference ||
        String(left.reference || left.id || "").localeCompare(
          String(right.reference || right.id || ""),
        );
    });
  const riskScores = inWindow
    .map((occurrence) => Number(occurrence.riesgoPuntaje ?? occurrence.risk?.score))
    .filter(Number.isFinite);
  const individualRiskScores = inWindow
    .map((occurrence) => occurrence.individualRiskScore)
    .filter(Number.isFinite);
  const maxRiskScore = riskScores.length ? Math.max(...riskScores) : 0;
  const maxIndividualRiskScore = individualRiskScores.length
    ? Math.max(...individualRiskScores)
    : 0;
  const reasons = [];

  if (inWindow.length >= highOccurrenceCount) {
    reasons.push("recurrencia_diagnostica");
  }

  const latestOccurrence = inWindow.at(-1) || null;
  return {
    active: reasons.length > 0,
    reasons,
    occurrenceCount: inWindow.length,
    maxRiskScore: Number(maxRiskScore.toFixed(1)),
    maxIndividualRiskScore: Number(maxIndividualRiskScore.toFixed(1)),
    references: inWindow
      .map((occurrence) => occurrence.reference || occurrence.id || "")
      .filter(Boolean),
    latestReference:
      latestOccurrence?.reference || latestOccurrence?.id || "",
    latestDate: latestDate ? latestDate.toISOString().slice(0, 10) : "",
    reviewPeriodMonths,
    highOccurrenceCount,
    minimumRiskThreshold,
  };
};
