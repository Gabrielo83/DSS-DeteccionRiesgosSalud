const normalizeStatus = (value = "") =>
  String(value || "").trim().toLowerCase();

const resolvePeriod = (entry = {}) => {
  const value =
    entry.fechaInicio || entry.fechaEmision || entry.fechaFin || entry.updatedAt;
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : "";
  }
  const date = typeof value.toDate === "function" ? value.toDate() : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const createAccumulator = () => ({
  certificados: 0,
  diasPerdidos: 0,
  sumaRiesgo: 0,
  riesgosInformados: 0,
  groups: new Map(),
});

const addTotals = (target, entry) => {
  target.certificados += 1;
  target.diasPerdidos += Number(entry.dias) || 0;
  const risk = Number(entry.riesgoPuntaje);
  if (Number.isFinite(risk)) {
    target.sumaRiesgo += risk;
    target.riesgosInformados += 1;
  }
};

const addEntry = (target, entry) => {
  addTotals(target, entry);
  const pathologyGroup = String(entry.grupoPatologia || "").trim();
  if (!pathologyGroup) return;
  if (!target.groups.has(pathologyGroup)) {
    target.groups.set(pathologyGroup, createAccumulator());
  }
  addTotals(target.groups.get(pathologyGroup), entry);
};

const finalizeTotals = (accumulator) => ({
  certificados: accumulator.certificados,
  diasPerdidos: accumulator.diasPerdidos,
  promedioRiesgo: accumulator.riesgosInformados
    ? Number(
        (accumulator.sumaRiesgo / accumulator.riesgosInformados).toFixed(1),
      )
    : null,
});

const finalize = (accumulator) => ({
  ...finalizeTotals(accumulator),
  grupos: Array.from(accumulator.groups, ([grupoPatologia, group]) => ({
    grupoPatologia,
    ...finalizeTotals(group),
  })).sort(
    (left, right) =>
      right.certificados - left.certificados ||
      right.diasPerdidos - left.diasPerdidos ||
      left.grupoPatologia.localeCompare(right.grupoPatologia),
  ),
});

export const buildRiskIndicator = (history = []) => {
  const periods = new Map();

  history.forEach((entry) => {
    const status = normalizeStatus(entry.estadoFinal || entry.estado);
    if (status !== "validado" && status !== "aprobado") return;
    const period = resolvePeriod(entry);
    if (!period) return;
    if (!periods.has(period)) {
      periods.set(period, {
        total: createAccumulator(),
        sectors: new Map(),
      });
    }
    const bucket = periods.get(period);
    addEntry(bucket.total, entry);
    const sector = entry.sector || "Sin sector";
    if (!bucket.sectors.has(sector)) {
      bucket.sectors.set(sector, createAccumulator());
    }
    addEntry(bucket.sectors.get(sector), entry);
  });

  const periodos = Array.from(periods, ([periodo, bucket]) => ({
    periodo,
    ...finalize(bucket.total),
    sectores: Array.from(bucket.sectors, ([sector, accumulator]) => ({
      sector,
      ...finalize(accumulator),
    })).sort((left, right) => left.sector.localeCompare(right.sector)),
  }))
    .sort((left, right) => left.periodo.localeCompare(right.periodo))
    .slice(-36);

  return {
    periodos,
    origen: "cloud-functions",
    version: "risk-indicator-v2",
  };
};
