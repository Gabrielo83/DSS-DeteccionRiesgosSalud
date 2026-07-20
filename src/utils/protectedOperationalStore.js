import { isFirebaseProvider } from "../services/appMode.js";
import { deleteEntity, readEntity, saveEntity } from "./indexedDbClient.js";
import {
  deleteEncryptedEntity,
  readEncryptedEntity,
  saveEncryptedEntity,
} from "./secureStorage.js";

const cloneEmpty = (emptyValue) =>
  Array.isArray(emptyValue) ? [] : { ...(emptyValue || {}) };

export const createProtectedOperationalStore = ({
  storageKey,
  eventName,
  legacyStore,
  legacyKey,
  emptyValue,
}) => {
  const secureKey = `cache:${legacyStore}:${legacyKey}`;
  let cache = cloneEmpty(emptyValue);
  let revision = 0;
  let secureLoadStarted = false;
  let legacyMigrationStarted = false;

  const dispatch = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event(eventName));
    }
  };

  const removeReadableCopies = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(storageKey);
    }
    deleteEntity(legacyStore, legacyKey);
  };

  const migrateReadableCopies = () => {
    if (legacyMigrationStarted || typeof window === "undefined") return;
    legacyMigrationStarted = true;
    const raw = window.localStorage.getItem(storageKey);
    if (raw) {
      try {
        cache = JSON.parse(raw);
        revision += 1;
        secureLoadStarted = true;
        saveEncryptedEntity(secureKey, cache).catch((error) =>
          console.warn(`No se pudo migrar ${storageKey}:`, error),
        );
        dispatch();
      } catch (error) {
        console.warn(`No se pudo interpretar ${storageKey}:`, error);
      }
      removeReadableCopies();
      return;
    }

    const migrationRevision = revision;
    readEntity(legacyStore, legacyKey)
      .then((value) => {
        if (value != null && revision === migrationRevision) {
          cache = value;
          revision += 1;
          return saveEncryptedEntity(secureKey, value).then(dispatch);
        }
        return null;
      })
      .catch((error) =>
        console.warn(`No se pudo migrar ${storageKey} desde IndexedDB:`, error),
      )
      .finally(() => {
        deleteEntity(legacyStore, legacyKey);
        loadSecureCache();
      });
  };

  const loadSecureCache = () => {
    if (secureLoadStarted || typeof window === "undefined") return;
    secureLoadStarted = true;
    const loadRevision = revision;
    readEncryptedEntity(secureKey)
      .then((value) => {
        if (value == null || revision !== loadRevision) return;
        cache = value;
        dispatch();
      })
      .catch((error) =>
        console.warn(`No se pudo descifrar ${storageKey}:`, error),
      );
  };

  const readLegacy = () => {
    if (typeof window === "undefined") return cloneEmpty(emptyValue);
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        readEntity(legacyStore, legacyKey).then((value) => {
          if (value == null) return;
          window.localStorage.setItem(storageKey, JSON.stringify(value));
          dispatch();
        });
      }
      return raw ? JSON.parse(raw) : cloneEmpty(emptyValue);
    } catch (error) {
      console.warn(`No se pudo leer ${storageKey}:`, error);
      return cloneEmpty(emptyValue);
    }
  };

  return {
    read() {
      if (!isFirebaseProvider()) return readLegacy();
      migrateReadableCopies();
      window.localStorage.removeItem(storageKey);
      return cache;
    },
    replace(value) {
      const safeValue = value ?? cloneEmpty(emptyValue);
      if (!isFirebaseProvider()) {
        if (typeof window === "undefined") return;
        window.localStorage.setItem(storageKey, JSON.stringify(safeValue));
        saveEntity(legacyStore, legacyKey, safeValue);
        dispatch();
        return;
      }
      revision += 1;
      legacyMigrationStarted = true;
      cache = safeValue;
      removeReadableCopies();
      saveEncryptedEntity(secureKey, safeValue).catch((error) =>
        console.warn(`No se pudo cifrar ${storageKey}:`, error),
      );
      dispatch();
    },
    clear() {
      revision += 1;
      legacyMigrationStarted = true;
      cache = cloneEmpty(emptyValue);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(storageKey);
      }
      deleteEntity(legacyStore, legacyKey);
      deleteEncryptedEntity(secureKey);
      dispatch();
    },
  };
};
