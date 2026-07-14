import { riskProfiles, defaultRiskScore } from "../data/riskProfiles.js";
import {
  RISK_CONFIG_STORAGE_KEY,
  RISK_CONFIG_UPDATED_EVENT,
} from "./storageKeys.js";

export const defaultRiskParameters = {
  defaultRiskScore,
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

const defaultPathologyProfiles = riskProfiles.map((profile) => ({
  id: profile.id || profile.name,
  name: profile.name,
  score: profile.score,
  keywords: profile.keywords || [],
  active: true,
}));

const defaultRiskConfig = {
  parameters: defaultRiskParameters,
  profiles: defaultPathologyProfiles,
};

const dispatchRiskConfigUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(RISK_CONFIG_UPDATED_EVENT));
};

const toNumberOrFallback = (value, fallback) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const normalizeParameters = (params = {}) => ({
  defaultRiskScore: toNumberOrFallback(
    params.puntajeDefault ?? params.defaultRiskScore,
    defaultRiskParameters.defaultRiskScore,
  ),
  mediumRiskThreshold: toNumberOrFallback(
    params.umbralMedioRiesgo ?? params.mediumRiskThreshold,
    defaultRiskParameters.mediumRiskThreshold,
  ),
  highRiskThreshold: toNumberOrFallback(
    params.umbralAltoRiesgo ?? params.highRiskThreshold,
    defaultRiskParameters.highRiskThreshold,
  ),
  accidentBonus: toNumberOrFallback(
    params.bonoAccidente ?? params.accidentBonus,
    defaultRiskParameters.accidentBonus,
  ),
  mediumDurationDays: toNumberOrFallback(
    params.diasRiesgoMedio ?? params.mediumDurationDays,
    defaultRiskParameters.mediumDurationDays,
  ),
  mediumDurationBonus: toNumberOrFallback(
    params.bonoDiasMedio ?? params.mediumDurationBonus,
    defaultRiskParameters.mediumDurationBonus,
  ),
  highDurationDays: toNumberOrFallback(
    params.diasRiesgoAlto ?? params.highDurationDays,
    defaultRiskParameters.highDurationDays,
  ),
  highDurationBonus: toNumberOrFallback(
    params.bonoDiasAlto ?? params.highDurationBonus,
    defaultRiskParameters.highDurationBonus,
  ),
  mediumOccurrenceCount: toNumberOrFallback(
    params.recurrenciasMedia ?? params.mediumOccurrenceCount,
    defaultRiskParameters.mediumOccurrenceCount,
  ),
  mediumOccurrenceBonus: toNumberOrFallback(
    params.bonoRecurrenciasMedia ?? params.mediumOccurrenceBonus,
    defaultRiskParameters.mediumOccurrenceBonus,
  ),
  highOccurrenceCount: toNumberOrFallback(
    params.recurrenciasAlta ?? params.highOccurrenceCount,
    defaultRiskParameters.highOccurrenceCount,
  ),
  highOccurrenceBonus: toNumberOrFallback(
    params.factorRecurrencia ?? params.highOccurrenceBonus,
    defaultRiskParameters.highOccurrenceBonus,
  ),
  reviewPeriodMonths: toNumberOrFallback(
    params.periodoEvaluacionMeses ?? params.reviewPeriodMonths,
    defaultRiskParameters.reviewPeriodMonths,
  ),
});

const normalizeProfile = (pathology = {}) => {
  const keywords = Array.isArray(pathology.keywords)
    ? pathology.keywords
    : Array.isArray(pathology.palabrasClave)
      ? pathology.palabrasClave
      : [];
  return {
    id: pathology.pathologyId || pathology.codigo || pathology.id || "",
    name: pathology.nombre || pathology.name || "Patologia",
    score: toNumberOrFallback(
      pathology.factorRiesgoBase ?? pathology.riesgoBase ?? pathology.score,
      defaultRiskParameters.defaultRiskScore,
    ),
    keywords,
    group: pathology.grupo || pathology.group || "",
    active: pathology.activo ?? pathology.active ?? true,
  };
};

export const readRiskConfig = () => {
  if (typeof window === "undefined") return defaultRiskConfig;
  try {
    const raw = window.localStorage.getItem(RISK_CONFIG_STORAGE_KEY);
    if (!raw) return defaultRiskConfig;
    const parsed = JSON.parse(raw);
    return {
      parameters: normalizeParameters(parsed.parameters || parsed.parametros),
      profiles:
        Array.isArray(parsed.profiles) && parsed.profiles.length > 0
          ? parsed.profiles.map(normalizeProfile).filter((item) => item.active)
          : defaultPathologyProfiles,
    };
  } catch {
    return defaultRiskConfig;
  }
};

export const replaceRiskConfig = ({ parameters, pathologies } = {}) => {
  if (typeof window === "undefined") return;
  const nextConfig = {
    parameters: normalizeParameters(parameters),
    profiles:
      Array.isArray(pathologies) && pathologies.length > 0
        ? pathologies.map(normalizeProfile).filter((item) => item.active)
        : defaultPathologyProfiles,
  };
  window.localStorage.setItem(
    RISK_CONFIG_STORAGE_KEY,
    JSON.stringify(nextConfig),
  );
  dispatchRiskConfigUpdated();
};
