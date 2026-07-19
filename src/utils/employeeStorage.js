import mockEmployees from "../data/mockEmployees.js";
import {
  EMPLOYEES_STORAGE_KEY,
  EMPLOYEES_UPDATED_EVENT,
} from "./storageKeys.js";

const fallbackEmployees = Array.isArray(mockEmployees) ? mockEmployees : [];

const dispatchEmployeesUpdated = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EMPLOYEES_UPDATED_EVENT));
};

export const readEmployees = () => {
  if (typeof window === "undefined") return fallbackEmployees;
  try {
    const raw = window.localStorage.getItem(EMPLOYEES_STORAGE_KEY);
    if (!raw) return fallbackEmployees;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0
      ? parsed
      : fallbackEmployees;
  } catch {
    return fallbackEmployees;
  }
};

export const replaceEmployees = (employees = []) => {
  if (typeof window === "undefined") return;
  if (!Array.isArray(employees) || employees.length === 0) return;
  window.localStorage.setItem(EMPLOYEES_STORAGE_KEY, JSON.stringify(employees));
  dispatchEmployeesUpdated();
};
