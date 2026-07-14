import { readRiskConfig } from "./riskConfigStorage.js";

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

export const mapScoreToRisk = (value) => {
  const { parameters } = readRiskConfig();
  const numeric = Number(value);
  const normalized = Number(
    Number.isFinite(numeric)
      ? Math.min(10, Math.max(0, numeric)).toFixed(1)
      : parameters.defaultRiskScore.toFixed(1),
  );
  const level =
    normalized >= parameters.highRiskThreshold
      ? "Alta"
      : normalized >= parameters.mediumRiskThreshold
        ? "Media"
        : "Baja";
  return {
    score: normalized,
    level,
    descriptor: baseDescriptors[level],
    badgeTone: baseBadgeTone[level],
  };
};

export const calculateRiskScore = ({
  absenceType = "",
  detailedReason = "",
  pathologyCategory = "",
  durationDays = 0,
  occurrenceCount = 1,
} = {}) => {
  const { parameters, profiles } = readRiskConfig();
  const text = `${absenceType} ${detailedReason} ${pathologyCategory}`.toLowerCase();
  const profile =
    profiles.find((item) =>
      item.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
    ) || null;
  let score = profile?.score ?? parameters.defaultRiskScore;

  if (absenceType.toLowerCase().includes("accidente")) {
    score = Math.min(10, score + parameters.accidentBonus);
  }
  const safeDuration = Number(durationDays);
  if (Number.isFinite(safeDuration)) {
    if (safeDuration >= parameters.highDurationDays) {
      score += parameters.highDurationBonus;
    } else if (safeDuration >= parameters.mediumDurationDays) {
      score += parameters.mediumDurationBonus;
    }
  }

  const safeOccurrences = Number(occurrenceCount);
  if (Number.isFinite(safeOccurrences)) {
    if (safeOccurrences >= parameters.highOccurrenceCount) {
      score += parameters.highOccurrenceBonus;
    } else if (safeOccurrences >= parameters.mediumOccurrenceCount) {
      score += parameters.mediumOccurrenceBonus;
    }
  }

  const assessment = mapScoreToRisk(score);
  return {
    ...assessment,
    matchedProfile: profile?.name || null,
  };
};

export default calculateRiskScore;
