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
} = {}) => {
  const text = `${absenceType} ${detailedReason}`.toLowerCase();
  const profile =
    riskProfiles.find((item) =>
      item.keywords.some((keyword) => text.includes(keyword.toLowerCase())),
    ) || null;
  let score = profile?.score ?? defaultRiskScore;

  if (absenceType.toLowerCase().includes("accidente")) {
    score = Math.min(10, score + 0.5);
  }

  const assessment = mapScoreToRisk(score);
  return {
    ...assessment,
    matchedProfile: profile?.name || null,
  };
};

export default calculateRiskScore;
