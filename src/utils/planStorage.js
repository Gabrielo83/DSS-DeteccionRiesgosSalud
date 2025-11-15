import {
  PREVENTIVE_PLANS_STORAGE_KEY,
  PREVENTIVE_PLANS_UPDATED_EVENT,
} from "./storageKeys.js";

const isBrowser = () => typeof window !== "undefined";

const readRawPlans = () => {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(PREVENTIVE_PLANS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
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
