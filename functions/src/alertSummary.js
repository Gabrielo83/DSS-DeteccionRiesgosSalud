export const buildAlertSummary = (alerts = []) => {
  const active = alerts.filter((alert) => alert.estado === "activa");
  const sectors = new Map();
  const periods = new Map();
  const reasonCounts = {
    recurrenciaDiagnostica: 0,
    riesgoAlto: 0,
  };

  active.forEach((alert) => {
    const sector = alert.sector || "Sin sector";
    const pathologyGroup = alert.grupoPatologia || "sin_grupo_informado";
    const sectorSummary = sectors.get(sector) || {
      cantidad: 0,
      grupos: new Map(),
    };
    const groupSummary = sectorSummary.grupos.get(pathologyGroup) || {
      cantidadAlertas: 0,
      recurrencias: 0,
      ventanaMeses: Number(alert.ventanaMeses || 6),
    };

    sectorSummary.cantidad += 1;
    groupSummary.cantidadAlertas += 1;
    groupSummary.recurrencias += Number(alert.recurrencias || 0);
    groupSummary.ventanaMeses = Math.max(
      groupSummary.ventanaMeses,
      Number(alert.ventanaMeses || 6),
    );
    sectorSummary.grupos.set(pathologyGroup, groupSummary);
    sectors.set(sector, sectorSummary);

    const periodMatch = String(alert.ultimaFecha || "").match(/^(\d{4})-(\d{2})/);
    if (periodMatch) {
      const period = `${periodMatch[1]}-${periodMatch[2]}`;
      periods.set(period, (periods.get(period) || 0) + 1);
    }

    if ((alert.motivos || []).includes("recurrencia_diagnostica")) {
      reasonCounts.recurrenciaDiagnostica += 1;
    }
    if ((alert.motivos || []).includes("riesgo_alto")) {
      reasonCounts.riesgoAlto += 1;
    }
  });

  return {
    totalActivas: active.length,
    sectores: Array.from(sectors, ([sector, summary]) => ({
      sector,
      cantidad: summary.cantidad,
      grupos: Array.from(
        summary.grupos,
        ([grupoPatologia, groupSummary]) => ({
          grupoPatologia,
          ...groupSummary,
        }),
      ).sort(
        (left, right) =>
          right.cantidadAlertas - left.cantidadAlertas ||
          right.recurrencias - left.recurrencias ||
          left.grupoPatologia.localeCompare(right.grupoPatologia),
      ),
    })).sort((left, right) => left.sector.localeCompare(right.sector)),
    motivos: reasonCounts,
    periodos: Array.from(periods, ([periodo, cantidad]) => ({
      periodo,
      cantidad,
    })).sort((left, right) => left.periodo.localeCompare(right.periodo)),
    origen: "cloud-functions",
    version: "alert-summary-v3",
  };
};
