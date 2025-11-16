import {
  PREVENTIVE_PLANS_STORAGE_KEY,
  PREVENTIVE_PLANS_UPDATED_EVENT,
} from "./storageKeys.js";
import { readEntity, saveEntity } from "./indexedDbClient.js";

const IDB_STORE = "plans";
const IDB_KEY = "plans";

const isBrowser = () => typeof window !== "undefined";

const readRawPlans = () => {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(PREVENTIVE_PLANS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    syncFromIndexedDb();
    return parsed;
  } catch (error) {
    console.warn("No se pudieron leer los planes preventivos:", error);
    return {};
  }
};

const persistPlans = (plans) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    PREVENTIVE_PLANS_STORAGE_KEY,
    JSON.stringify(plans),
  );
  window.dispatchEvent(new Event(PREVENTIVE_PLANS_UPDATED_EVENT));
  saveEntity(IDB_STORE, IDB_KEY, plans);
};

const syncFromIndexedDb = async () => {
  if (!isBrowser()) return;
  try {
    const idbValue = await readEntity(IDB_STORE, IDB_KEY);
    if (!idbValue) return;
    const raw = window.localStorage.getItem(PREVENTIVE_PLANS_STORAGE_KEY);
    const localValue = raw ? JSON.parse(raw) : {};
    const isDifferent = JSON.stringify(localValue) !== JSON.stringify(idbValue);
    if (isDifferent) {
      window.localStorage.setItem(
        PREVENTIVE_PLANS_STORAGE_KEY,
        JSON.stringify(idbValue),
      );
      window.dispatchEvent(new Event(PREVENTIVE_PLANS_UPDATED_EVENT));
    }
  } catch (error) {
    console.warn("No se pudo sincronizar planes desde IndexedDB:", error);
  }
};

export const readAllPlans = () => readRawPlans();

export const readEmployeePlan = (employeeKey) => {
  if (!employeeKey) return null;
  const plans = readRawPlans();
  return plans[employeeKey] ?? null;
};

export const saveEmployeePlan = (employeeKey, plan) => {
  if (!employeeKey || !plan) return;
  const plans = readRawPlans();
  plans[employeeKey] = plan;
  persistPlans(plans);
};
