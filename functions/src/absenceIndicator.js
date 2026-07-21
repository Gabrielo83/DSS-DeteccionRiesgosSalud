const resolvePeriod = (entry = {}) => {
  const value = entry.fechaInicio || entry.fechaFin || entry.actualizadoEn;
  if (!value) return "";
  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})/);
    return match ? `${match[1]}-${match[2]}` : "";
  }
  const date = typeof value.toDate === "function" ? value.toDate() : value;
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};

const normalizeType = (value) =>
  String(value || "Sin tipo informado").trim() || "Sin tipo informado";

const parseDate = (value) => {
  if (!value) return null;
  const date =
    typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
};

const buildWorkforcePeriods = (employees = [], now = new Date()) => {
  const end = parseDate(now) || new Date();
  const periods = [];

  for (let offset = 35; offset >= 0; offset -= 1) {
    const start = new Date(
      Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - offset, 1),
    );
    const finish = new Date(
      Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1) - 1,
    );
    const sectors = new Map();
    let active = 0;

    employees.forEach((employee) => {
      const hire = parseDate(employee.fechaAlta || employee.hireDate);
      const termination = parseDate(employee.fechaBaja || employee.terminationDate);
      const isCurrentlyInactive =
        employee.activo === false || employee.active === false;
      if (isCurrentlyInactive && !termination) return;
      if (!hire || hire > finish || (termination && termination < start)) return;
      active += 1;
      const sector =
        String(employee.sector || "Sin sector").trim() || "Sin sector";
      sectors.set(sector, (sectors.get(sector) || 0) + 1);
    });

    periods.push({
      periodo: `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, "0")}`,
      activos: active,
      sectores: Array.from(sectors, ([sector, activos]) => ({
        sector,
        activos,
      })).sort((left, right) => left.sector.localeCompare(right.sector)),
    });
  }

  return periods;
};

const createAccumulator = () => ({
  ausencias: 0,
  diasPerdidos: 0,
  tipos: new Map(),
});

const addTotals = (target, entry) => {
  target.ausencias += 1;
  target.diasPerdidos += Number(entry.dias) || 0;
};

const addEntry = (target, entry) => {
  addTotals(target, entry);
  const type = normalizeType(entry.tipo);
  if (!target.tipos.has(type)) {
    target.tipos.set(type, { ausencias: 0, diasPerdidos: 0 });
  }
  addTotals(target.tipos.get(type), entry);
};

const finalize = (accumulator) => ({
  ausencias: accumulator.ausencias,
  diasPerdidos: accumulator.diasPerdidos,
  tipos: Array.from(accumulator.tipos, ([tipo, totals]) => ({
    tipo,
    ausencias: totals.ausencias,
    diasPerdidos: totals.diasPerdidos,
  })).sort(
    (left, right) =>
      right.ausencias - left.ausencias || left.tipo.localeCompare(right.tipo),
  ),
});

export const buildAbsenceIndicator = (absences = [], employees = [], now) => {
  const periods = new Map();

  absences.forEach((entry) => {
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
    const sector = String(entry.sector || "Sin sector").trim() || "Sin sector";
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
    dotacionPeriodos: buildWorkforcePeriods(employees, now),
    origen: "cloud-functions",
    version: "absence-indicator-v2",
  };
};
