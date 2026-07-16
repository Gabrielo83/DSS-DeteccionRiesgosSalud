import { PASSWORD_LOGIN_ATTEMPTS_STORAGE_KEY } from "./storageKeys.js";

export const PASSWORD_LOCK_MAX_ATTEMPTS = 5;
export const PASSWORD_LOCK_DURATION_MS = 15 * 60 * 1000;

export const PASSWORD_REQUIREMENTS = [
  {
    id: "minLength",
    label: "8 caracteres o mas",
    test: (password) => password.length >= 8,
  },
  {
    id: "uppercase",
    label: "una mayuscula",
    test: (password) => /[A-Z]/.test(password),
  },
  {
    id: "lowercase",
    label: "una minuscula",
    test: (password) => /[a-z]/.test(password),
  },
  {
    id: "number",
    label: "un numero",
    test: (password) => /\d/.test(password),
  },
  {
    id: "symbol",
    label: "un simbolo",
    test: (password) => /[^A-Za-z0-9]/.test(password),
  },
];

const isBrowser = () => typeof window !== "undefined";

const normalizeEmail = (email) => email.trim().toLowerCase();

const readAttempts = () => {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(PASSWORD_LOGIN_ATTEMPTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeAttempts = (attempts) => {
  if (!isBrowser()) return;
  window.localStorage.setItem(
    PASSWORD_LOGIN_ATTEMPTS_STORAGE_KEY,
    JSON.stringify(attempts),
  );
};

export const validatePasswordPolicy = (password = "") => {
  const requirements = PASSWORD_REQUIREMENTS.map((requirement) => ({
    id: requirement.id,
    label: requirement.label,
    passed: requirement.test(password),
  }));

  return {
    requirements,
    isValid: requirements.every((requirement) => requirement.passed),
  };
};

export const getLoginLockStatus = (email = "", now = Date.now()) => {
  const key = normalizeEmail(email);
  if (!key) {
    return {
      locked: false,
      attempts: 0,
      remainingAttempts: PASSWORD_LOCK_MAX_ATTEMPTS,
      lockedUntil: 0,
    };
  }

  const attempts = readAttempts();
  const entry = attempts[key] || {};
  const lockedUntil = Number(entry.lockedUntil || 0);
  const count = Number(entry.count || 0);

  if (lockedUntil > now) {
    return {
      locked: true,
      attempts: count,
      remainingAttempts: 0,
      lockedUntil,
    };
  }

  if (lockedUntil && lockedUntil <= now) {
    delete attempts[key];
    writeAttempts(attempts);
    return {
      locked: false,
      attempts: 0,
      remainingAttempts: PASSWORD_LOCK_MAX_ATTEMPTS,
      lockedUntil: 0,
    };
  }

  return {
    locked: false,
    attempts: count,
    remainingAttempts: Math.max(PASSWORD_LOCK_MAX_ATTEMPTS - count, 0),
    lockedUntil: 0,
  };
};

export const registerLoginFailure = (email = "", now = Date.now()) => {
  const key = normalizeEmail(email);
  if (!key) return getLoginLockStatus(email, now);

  const attempts = readAttempts();
  const current = attempts[key] || {};
  const nextCount = Number(current.count || 0) + 1;
  const lockedUntil =
    nextCount >= PASSWORD_LOCK_MAX_ATTEMPTS
      ? now + PASSWORD_LOCK_DURATION_MS
      : 0;

  attempts[key] = {
    count: nextCount,
    lastFailureAt: new Date(now).toISOString(),
    lockedUntil,
  };
  writeAttempts(attempts);

  return getLoginLockStatus(email, now);
};

export const clearLoginFailures = (email = "") => {
  const key = normalizeEmail(email);
  if (!key) return;
  const attempts = readAttempts();
  delete attempts[key];
  writeAttempts(attempts);
};

export const formatLockRemaining = (lockedUntil, now = Date.now()) => {
  const remainingMs = Math.max(Number(lockedUntil || 0) - now, 0);
  const minutes = Math.ceil(remainingMs / 60000);
  return `${minutes} min`;
};
