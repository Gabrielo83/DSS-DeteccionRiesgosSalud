import { readRiskConfig } from "./riskConfigStorage.js";
import {
  calculateRiskScoreWithConfig,
  mapScoreToRiskWithConfig,
} from "../../functions/src/riskEngine.js";

export const mapScoreToRisk = (value) => {
  const { parameters } = readRiskConfig();
  return mapScoreToRiskWithConfig(value, parameters);
};

export const calculateRiskScore = ({
  absenceType = "",
  detailedReason = "",
  pathologyCategory = "",
  durationDays = 0,
  occurrenceCount = 1,
} = {}) => {
  const riskConfig = readRiskConfig();
  return calculateRiskScoreWithConfig(
    {
      absenceType,
      detailedReason,
      pathologyCategory,
      durationDays,
      occurrenceCount,
    },
    riskConfig,
  );
};

export default calculateRiskScore;
