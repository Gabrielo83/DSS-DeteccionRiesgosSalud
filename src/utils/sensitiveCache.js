import {
  ABSENCE_DRAFTS_STORAGE_KEY,
  EMPLOYEES_STORAGE_KEY,
  MEDICAL_HISTORY_STORAGE_KEY,
  MEDICAL_VALIDATIONS_STORAGE_KEY,
  PREVENTIVE_PLANS_STORAGE_KEY,
} from "./storageKeys.js";
import {
  deleteEntitiesByKeyPrefix,
  deleteEntity,
} from "./indexedDbClient.js";

const LOCAL_KEYS = [
  MEDICAL_VALIDATIONS_STORAGE_KEY,
  MEDICAL_HISTORY_STORAGE_KEY,
  PREVENTIVE_PLANS_STORAGE_KEY,
  ABSENCE_DRAFTS_STORAGE_KEY,
  EMPLOYEES_STORAGE_KEY,
];

export const clearSensitiveOperationalCache = () => {
  if (typeof window === "undefined") return Promise.resolve();
  LOCAL_KEYS.forEach((key) => window.localStorage.removeItem(key));
  return Promise.all([
    deleteEntity("validations", "queue"),
    deleteEntity("history", "records"),
    deleteEntity("plans", "plans"),
    deleteEntity("drafts", "drafts"),
    deleteEntitiesByKeyPrefix("attachments", "draft:"),
  ]);
};
