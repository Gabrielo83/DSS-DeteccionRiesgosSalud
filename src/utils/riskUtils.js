import { riskProfiles, defaultRiskScore } from "../data/riskProfiles.js";

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
  const numeric = Number(value);
  const normalized = Number(
    Number.isFinite(numeric)
      ? Math.min(10, Math.max(0, numeric)).toFixed(1)
      : defaultRiskScore.toFixed(1),
  );
  const level =
    normalized >= 7
      ? "Alta"
      : normalized >= 5
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
  const text = `${absenceType} ${detailedReason} ${pathologyCategory}`.toLowerCase();
  const profile =
    riskProfiles.find((item) =>
      item.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
    ) || null;
  let score = profile?.score ?? defaultRiskScore;

  if (absenceType.toLowerCase().includes("accidente")) {
    score = Math.min(10, score + 0.5);
  }
  const safeDuration = Number(durationDays);
  if (Number.isFinite(safeDuration)) {
    if (safeDuration >= 14) {
      score += 0.8;
    } else if (safeDuration >= 7) {
      score += 0.4;
    }
  }

  const safeOccurrences = Number(occurrenceCount);
  if (Number.isFinite(safeOccurrences)) {
    if (safeOccurrences >= 3) {
      score += 1;
    } else if (safeOccurrences === 2) {
      score += 0.5;
    }
  }

  const assessment = mapScoreToRisk(score);
  return {
    ...assessment,
    matchedProfile: profile?.name || null,
  };
};

export default calculateRiskScore;
