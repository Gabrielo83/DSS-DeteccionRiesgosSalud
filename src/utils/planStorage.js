import {
  PREVENTIVE_PLANS_STORAGE_KEY,
  PREVENTIVE_PLANS_UPDATED_EVENT,
} from "./storageKeys.js";
import { createProtectedOperationalStore } from "./protectedOperationalStore.js";

const IDB_STORE = "plans";
const IDB_KEY = "plans";

const store = createProtectedOperationalStore({
  storageKey: PREVENTIVE_PLANS_STORAGE_KEY,
  eventName: PREVENTIVE_PLANS_UPDATED_EVENT,
  legacyStore: IDB_STORE,
  legacyKey: IDB_KEY,
  emptyValue: {},
});

const readRawPlans = () => store.read();
const persistPlans = (plans) => store.replace(plans);

export const readAllPlans = () => readRawPlans();

export const replaceAllPlans = (plans = {}) => {
  if (!plans || typeof plans !== "object" || Array.isArray(plans)) {
    persistPlans({});
    return;
  }
  persistPlans(plans);
};

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

export const clearPlanCache = () => store.clear();
