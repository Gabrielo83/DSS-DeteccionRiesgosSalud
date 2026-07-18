export const buildAlertSummary = (alerts = []) => {
  const active = alerts.filter((alert) => alert.estado === "activa");
  const sectorCounts = new Map();
  const reasonCounts = {
    recurrenciaDiagnostica: 0,
    riesgoAlto: 0,
  };

  active.forEach((alert) => {
    const sector = alert.sector || "Sin sector";
    sectorCounts.set(sector, (sectorCounts.get(sector) || 0) + 1);
    if ((alert.motivos || []).includes("recurrencia_diagnostica")) {
      reasonCounts.recurrenciaDiagnostica += 1;
    }
    if ((alert.motivos || []).includes("riesgo_alto")) {
      reasonCounts.riesgoAlto += 1;
    }
  });

  return {
    totalActivas: active.length,
    sectores: Array.from(sectorCounts, ([sector, cantidad]) => ({
      sector,
      cantidad,
    })).sort((left, right) => left.sector.localeCompare(right.sector)),
    motivos: reasonCounts,
    origen: "cloud-functions",
    version: "alert-summary-v1",
  };
};
