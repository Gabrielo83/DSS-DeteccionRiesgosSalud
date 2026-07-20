import {
  ABSENCE_DRAFTS_STORAGE_KEY,
  ABSENCES_STORAGE_KEY,
  EMPLOYEES_STORAGE_KEY,
  MEDICAL_HISTORY_STORAGE_KEY,
  MEDICAL_VALIDATIONS_STORAGE_KEY,
  PREVENTIVE_PLANS_STORAGE_KEY,
} from "./storageKeys.js";
import {
  deleteEntitiesByKeyPrefix,
  deleteEntity,
} from "./indexedDbClient.js";
import { clearValidationCache } from "./validationStorage.js";
import { clearHistoryCache } from "./historyStorage.js";
import { clearPlanCache } from "./planStorage.js";
import { clearDraftCache } from "./draftStorage.js";
import { clearAbsenceCache } from "./absenceStorage.js";
import { deleteEncryptedEntitiesByPrefix } from "./secureStorage.js";
import { clearRiskAlertCache } from "./riskAlertStorage.js";

const LOCAL_KEYS = [
  MEDICAL_VALIDATIONS_STORAGE_KEY,
  MEDICAL_HISTORY_STORAGE_KEY,
  PREVENTIVE_PLANS_STORAGE_KEY,
  ABSENCE_DRAFTS_STORAGE_KEY,
  ABSENCES_STORAGE_KEY,
  EMPLOYEES_STORAGE_KEY,
];

export const clearSensitiveOperationalCache = () => {
  if (typeof window === "undefined") return Promise.resolve();
  LOCAL_KEYS.forEach((key) => window.localStorage.removeItem(key));
  clearValidationCache();
  clearHistoryCache();
  clearPlanCache();
  clearDraftCache();
  clearAbsenceCache();
  clearRiskAlertCache();
  return Promise.all([
    deleteEntity("validations", "queue"),
    deleteEntity("history", "records"),
    deleteEntity("plans", "plans"),
    deleteEntity("drafts", "drafts"),
    deleteEntitiesByKeyPrefix("attachments", "draft:"),
    deleteEncryptedEntitiesByPrefix("attachments:draft:"),
  ]);
};
