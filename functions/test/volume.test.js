import assert from "node:assert/strict";
import test from "node:test";
import { buildAbsenceIndicator } from "../src/absenceIndicator.js";
import { buildRiskIndicator } from "../src/riskIndicator.js";

const SECTORS = [
  "Produccion",
  "Logistica",
  "Administracion",
  "Ventas",
  "Recursos Humanos",
];
const GROUPS = [
  "musculoesqueletica",
  "respiratoria",
  "cardiovascular",
  "gastrointestinal",
  "salud-mental",
];

const dateFor = (index) => {
  const month = String((index % 12) + 1).padStart(2, "0");
  const day = String((index % 27) + 1).padStart(2, "0");
  return `2026-${month}-${day}`;
};

test("consolida miles de registros sin propagar datos personales", () => {
  const history = Array.from({ length: 5000 }, (_, index) => ({
    estadoFinal: "validado",
    fechaInicio: dateFor(index),
    riesgoPuntaje: 4 + (index % 6),
    dias: 1 + (index % 7),
    sector: SECTORS[index % SECTORS.length],
    grupoPatologia: GROUPS[index % GROUPS.length],
    nombreCompleto: `Empleado volumen ${index}`,
    cie10: `TEST-${index}`,
  }));
  const absences = history.map((record, index) => ({
    fechaInicio: record.fechaInicio,
    sector: record.sector,
    tipo: index % 4 === 0 ? "vacaciones" : "enfermedad",
    dias: record.dias,
    nombreCompleto: record.nombreCompleto,
    diagnostico: `Diagnostico volumen ${index}`,
  }));
  const employees = Array.from({ length: 1000 }, (_, index) => ({
    employeeId: `LEG-${index}`,
    nombreCompleto: `Empleado dotacion ${index}`,
    sector: SECTORS[index % SECTORS.length],
    fechaAlta: "2020-01-01",
    activo: true,
  }));

  const riskIndicator = buildRiskIndicator(history);
  const absenceIndicator = buildAbsenceIndicator(
    absences,
    employees,
    new Date("2026-12-20T12:00:00Z"),
  );

  assert.equal(
    riskIndicator.periodos.reduce(
      (total, period) => total + period.certificados,
      0,
    ),
    5000,
  );
  assert.equal(
    absenceIndicator.periodos.reduce(
      (total, period) => total + period.ausencias,
      0,
    ),
    5000,
  );
  assert.equal(absenceIndicator.dotacionPeriodos.at(-1).activos, 1000);
  const serialized = JSON.stringify({ riskIndicator, absenceIndicator });
  assert.equal(serialized.includes("Empleado volumen"), false);
  assert.equal(serialized.includes("Empleado dotacion"), false);
  assert.equal(serialized.includes("Diagnostico volumen"), false);
  assert.equal(serialized.includes("TEST-"), false);
});
