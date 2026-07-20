import {
  deleteEntitiesByKeyPrefix,
  deleteEntity,
  readEntity,
  saveEntity,
} from "./indexedDbClient.js";

const KEY_STORE = "secureKeys";
const DATA_STORE = "secureData";
const DEVICE_KEY_ID = "operational-aes-gcm-v1";
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const memoryFallback = new Map();
let keyPromise;

const getCrypto = () => globalThis.crypto?.subtle;

const getDeviceKey = async () => {
  if (keyPromise) return keyPromise;
  keyPromise = (async () => {
    const subtle = getCrypto();
    if (!subtle) throw new Error("Web Crypto no esta disponible.");
    const storedKey = await readEntity(KEY_STORE, DEVICE_KEY_ID);
    if (storedKey) return storedKey;
    const generatedKey = await subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
    await saveEntity(KEY_STORE, DEVICE_KEY_ID, generatedKey);
    return generatedKey;
  })();
  return keyPromise;
};

export const saveEncryptedEntity = async (key, value) => {
  if (!key) return;
  memoryFallback.set(key, value);
  const subtle = getCrypto();
  if (!subtle) return;
  const encryptionKey = await getDeviceKey();
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = encoder.encode(JSON.stringify(value));
  const ciphertext = await subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    plaintext,
  );
  await saveEntity(DATA_STORE, key, {
    version: 1,
    algorithm: "AES-GCM",
    iv,
    ciphertext,
    savedAt: new Date().toISOString(),
  });
};

export const readEncryptedEntity = async (key) => {
  if (!key) return null;
  const record = await readEntity(DATA_STORE, key);
  if (!record) return memoryFallback.get(key) ?? null;
  const subtle = getCrypto();
  if (!subtle) return memoryFallback.get(key) ?? null;
  const encryptionKey = await getDeviceKey();
  const plaintext = await subtle.decrypt(
    { name: "AES-GCM", iv: record.iv },
    encryptionKey,
    record.ciphertext,
  );
  const value = JSON.parse(decoder.decode(plaintext));
  memoryFallback.set(key, value);
  return value;
};

export const deleteEncryptedEntity = async (key) => {
  if (!key) return;
  memoryFallback.delete(key);
  await deleteEntity(DATA_STORE, key);
};

export const deleteEncryptedEntitiesByPrefix = async (prefix) => {
  if (!prefix) return;
  [...memoryFallback.keys()].forEach((key) => {
    if (String(key).startsWith(prefix)) memoryFallback.delete(key);
  });
  await deleteEntitiesByKeyPrefix(DATA_STORE, prefix);
};
