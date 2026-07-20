import assert from "node:assert/strict";
import test from "node:test";
import {
  buildAlertId,
  evaluateConsolidatedAlert,
} from "../src/alertEngine.js";

const validation = (reference, date, score = 2.5, status = "validado") => ({
  reference,
  fechaInicio: date,
  riesgoPuntaje: score,
  estado: status,
});

test("genera un identificador estable sin acentos", () => {
  assert.equal(
    buildAlertId("LEG-060", "Musculoesquelética"),
    "leg-060__musculoesqueletica",
  );
});

test("activa alerta al alcanzar tres recurrencias en seis meses", () => {
  const result = evaluateConsolidatedAlert([
    validation("CM-1", "2026-01-10", 5.5),
    validation("CM-2", "2026-03-10", 6.1),
    validation("CM-3", "2026-06-10", 8.1),
  ]);

  assert.equal(result.active, true);
  assert.equal(result.occurrenceCount, 3);
  assert.deepEqual(result.reasons, ["recurrencia_diagnostica"]);
});

test("no activa alerta con un unico certificado de riesgo alto", () => {
  const result = evaluateConsolidatedAlert([
    validation("CM-ALTO", "2026-06-10", 8.1),
  ]);

  assert.equal(result.active, false);
  assert.equal(result.maxRiskScore, 8.1);
  assert.deepEqual(result.reasons, []);
});

test("requiere tres recurrencias de riesgo medio o alto", () => {
  const result = evaluateConsolidatedAlert([
    validation("CM-1", "2026-01-10", 5.2),
    validation("CM-2", "2026-03-10", 4.9),
    validation("CM-3", "2026-05-10", 6.4),
  ]);

  assert.equal(result.active, false);
  assert.equal(result.occurrenceCount, 2);
  assert.deepEqual(result.references, ["CM-1", "CM-3"]);
});

test("ignora estados no validados y eventos fuera de ventana", () => {
  const result = evaluateConsolidatedAlert([
    validation("CM-ANTIGUO", "2025-01-10"),
    validation("CM-1", "2026-05-10", 5.5),
    validation("CM-2", "2026-06-10", 5.5),
    validation("CM-PEND", "2026-07-10", 9, "pendiente"),
  ]);

  assert.equal(result.active, false);
  assert.equal(result.occurrenceCount, 2);
  assert.deepEqual(result.references, ["CM-1", "CM-2"]);
});

test("permite resolver una alerta cuando ya no quedan evidencias", () => {
  const result = evaluateConsolidatedAlert([
    validation("CM-1", "2026-06-10", 9, "rechazado"),
  ]);

  assert.equal(result.active, false);
  assert.equal(result.occurrenceCount, 0);
  assert.deepEqual(result.reasons, []);
});

test("no cuenta registros sin fecha dentro de una ventana temporal", () => {
  const result = evaluateConsolidatedAlert([
    validation("CM-1", "2026-05-10", 5.5),
    validation("CM-2", "2026-06-10", 5.5),
    validation("CM-SIN-FECHA", "", 5.5),
  ]);

  assert.equal(result.active, false);
  assert.equal(result.occurrenceCount, 2);
});

test("no confunde el bono de recurrencia con riesgo individual alto", () => {
  const occurrences = [
    validation("CM-1", "2026-01-10", 8),
    validation("CM-2", "2026-03-10", 8),
    validation("CM-3", "2026-06-10", 8),
  ].map((item) => ({ ...item, riesgoIndividualPuntaje: 4.2 }));
  const result = evaluateConsolidatedAlert(occurrences);

  assert.equal(result.active, false);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.occurrenceCount, 0);
});
