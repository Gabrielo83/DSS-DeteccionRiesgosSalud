const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseLocalDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);

  const match = String(value).match(DATE_ONLY_RE);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const getLocalDateTimestamp = (value, endOfDay = false) => {
  const date = parseLocalDate(value);
  if (!date) return null;
  const normalized = new Date(date);
  normalized.setHours(
    endOfDay ? 23 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 59 : 0,
    endOfDay ? 999 : 0,
  );
  return normalized.getTime();
};

export const formatLocalDate = (value, options = {}) => {
  const date = parseLocalDate(value);
  if (!date) return value || "";
  return date.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...options,
  });
};
