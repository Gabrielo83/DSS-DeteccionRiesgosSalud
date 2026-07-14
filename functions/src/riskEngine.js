const baseDescriptors = {
  Alta: "Alto Riesgo 7.0 - 10.0",
  Media: "Riesgo Medio 5.0 - 6.9",
  Baja: "Riesgo Bajo < 5.0",
};

const baseBadgeTone = {
  Alta: "bg-rose-500 text-white",
  Media: "bg-amber-400 text-slate-900",
  Baja: "bg-emerald-500 text-white",
};

export const fallbackRiskParameters = {
  defaultRiskScore: 4.2,
  mediumRiskThreshold: 5,
  highRiskThreshold: 7,
  accidentBonus: 0.5,
  mediumDurationDays: 7,
  mediumDurationBonus: 0.4,
  highDurationDays: 14,
  highDurationBonus: 0.8,
  mediumOccurrenceCount: 2,
  mediumOccurrenceBonus: 0.5,
  highOccurrenceCount: 3,
  highOccurrenceBonus: 1,
  reviewPeriodMonths: 6,
};

export const normalizeRiskParameters = (params = {}) => {
  const numberOrFallback = (value, fallback) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  };

  return {
    defaultRiskScore: numberOrFallback(
      params.puntajeDefault ?? params.defaultRiskScore,
      fallbackRiskParameters.defaultRiskScore,
    ),
    mediumRiskThreshold: numberOrFallback(
      params.umbralMedioRiesgo ?? params.mediumRiskThreshold,
      fallbackRiskParameters.mediumRiskThreshold,
    ),
    highRiskThreshold: numberOrFallback(
      params.umbralAltoRiesgo ?? params.highRiskThreshold,
      fallbackRiskParameters.highRiskThreshold,
    ),
    accidentBonus: numberOrFallback(
      params.bonoAccidente ?? params.accidentBonus,
      fallbackRiskParameters.accidentBonus,
    ),
    mediumDurationDays: numberOrFallback(
      params.diasRiesgoMedio ?? params.mediumDurationDays,
      fallbackRiskParameters.mediumDurationDays,
    ),
    mediumDurationBonus: numberOrFallback(
      params.bonoDiasMedio ?? params.mediumDurationBonus,
      fallbackRiskParameters.mediumDurationBonus,
    ),
    highDurationDays: numberOrFallback(
      params.diasRiesgoAlto ?? params.highDurationDays,
      fallbackRiskParameters.highDurationDays,
    ),
    highDurationBonus: numberOrFallback(
      params.bonoDiasAlto ?? params.highDurationBonus,
      fallbackRiskParameters.highDurationBonus,
    ),
    mediumOccurrenceCount: numberOrFallback(
      params.recurrenciasMedia ?? params.mediumOccurrenceCount,
      fallbackRiskParameters.mediumOccurrenceCount,
    ),
    mediumOccurrenceBonus: numberOrFallback(
      params.bonoRecurrenciasMedia ?? params.mediumOccurrenceBonus,
      fallbackRiskParameters.mediumOccurrenceBonus,
    ),
    highOccurrenceCount: numberOrFallback(
      params.recurrenciasAlta ?? params.highOccurrenceCount,
      fallbackRiskParameters.highOccurrenceCount,
    ),
    highOccurrenceBonus: numberOrFallback(
      params.factorRecurrencia ?? params.highOccurrenceBonus,
      fallbackRiskParameters.highOccurrenceBonus,
    ),
    reviewPeriodMonths: numberOrFallback(
      params.periodoEvaluacionMeses ?? params.reviewPeriodMonths,
      fallbackRiskParameters.reviewPeriodMonths,
    ),
  };
};

export const normalizePathologyProfile = (pathology = {}) => {
  const keywords = Array.isArray(pathology.keywords)
    ? pathology.keywords
    : Array.isArray(pathology.palabrasClave)
      ? pathology.palabrasClave
      : [];

  return {
    id: pathology.pathologyId || pathology.codigo || pathology.id || "",
    name: pathology.nombre || pathology.name || "Patologia",
    score: Number(
      pathology.factorRiesgoBase ??
        pathology.riesgoBase ??
        pathology.score ??
        fallbackRiskParameters.defaultRiskScore,
    ),
    keywords,
    group: pathology.grupo || pathology.group || "",
    active: pathology.activo ?? pathology.active ?? true,
  };
};

export const mapScoreToRiskWithConfig = (value, parameters = {}) => {
  const normalizedParameters = normalizeRiskParameters(parameters);
  const numeric = Number(value);
  const normalized = Number(
    Number.isFinite(numeric)
      ? Math.min(10, Math.max(0, numeric)).toFixed(1)
      : normalizedParameters.defaultRiskScore.toFixed(1),
  );
  const level =
    normalized >= normalizedParameters.highRiskThreshold
      ? "Alta"
      : normalized >= normalizedParameters.mediumRiskThreshold
        ? "Media"
        : "Baja";

  return {
    score: normalized,
    level,
    descriptor: baseDescriptors[level],
    badgeTone: baseBadgeTone[level],
  };
};

export const calculateRiskScoreWithConfig = (
  {
    absenceType = "",
    detailedReason = "",
    pathologyCategory = "",
    durationDays = 0,
    occurrenceCount = 1,
  } = {},
  { parameters = {}, profiles = [] } = {},
) => {
  const normalizedParameters = normalizeRiskParameters(parameters);
  const normalizedProfiles = profiles
    .map(normalizePathologyProfile)
    .filter((item) => item.active !== false);
  const text =
    `${absenceType} ${detailedReason} ${pathologyCategory}`.toLowerCase();
  const profile =
    normalizedProfiles.find((item) =>
      item.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
    ) || null;
  let score = profile?.score ?? normalizedParameters.defaultRiskScore;

  if (absenceType.toLowerCase().includes("accidente")) {
    score = Math.min(10, score + normalizedParameters.accidentBonus);
  }

  const safeDuration = Number(durationDays);
  if (Number.isFinite(safeDuration)) {
    if (safeDuration >= normalizedParameters.highDurationDays) {
      score += normalizedParameters.highDurationBonus;
    } else if (safeDuration >= normalizedParameters.mediumDurationDays) {
      score += normalizedParameters.mediumDurationBonus;
    }
  }

  const safeOccurrences = Number(occurrenceCount);
  if (Number.isFinite(safeOccurrences)) {
    if (safeOccurrences >= normalizedParameters.highOccurrenceCount) {
      score += normalizedParameters.highOccurrenceBonus;
    } else if (safeOccurrences >= normalizedParameters.mediumOccurrenceCount) {
      score += normalizedParameters.mediumOccurrenceBonus;
    }
  }

  return {
    ...mapScoreToRiskWithConfig(score, normalizedParameters),
    matchedProfile: profile?.name || null,
  };
};
