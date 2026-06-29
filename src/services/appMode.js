export const DATA_PROVIDERS = {
  local: "local",
  firebase: "firebase",
};

export const getDataProvider = () => {
  const raw = import.meta.env.VITE_DATA_PROVIDER || DATA_PROVIDERS.local;
  const normalized = String(raw).trim().toLowerCase();
  return normalized === DATA_PROVIDERS.firebase
    ? DATA_PROVIDERS.firebase
    : DATA_PROVIDERS.local;
};

export const isFirebaseProvider = () =>
  getDataProvider() === DATA_PROVIDERS.firebase;
