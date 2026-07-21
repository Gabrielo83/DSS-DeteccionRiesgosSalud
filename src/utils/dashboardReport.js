const protectSpreadsheetValue = (value) => {
  const text = String(value ?? "");
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
};

const escapeCsvValue = (value) => {
  const protectedValue = protectSpreadsheetValue(value);
  return `"${protectedValue.replace(/"/g, '""')}"`;
};

const row = (...values) => values.map(escapeCsvValue).join(";");

export const buildDashboardReportCsv = ({
  periodLabel,
  generatedAt,
  metrics = [],
  sectors = [],
  prevalence = [],
}) => {
  const lines = [
    row("Reporte", "Panel de Control - Gestion de Ausencias"),
    row("Periodo", periodLabel),
    row("Generado", generatedAt),
    "",
    row("Metricas principales"),
    row("Indicador", "Valor", "Detalle", "Base"),
    ...metrics.map((metric) =>
      row(
        metric.title,
        metric.value,
        `${metric.primaryLabel}: ${metric.primaryValue}`,
        `${metric.secondaryLabel}: ${metric.secondaryValue}`,
      ),
    ),
    "",
    row("Resumen por sector"),
    row("Sector", "Ausencias", "Dias perdidos", "Riesgo promedio", "Alertas"),
    ...sectors.map((sector) =>
      row(
        sector.sector,
        sector.absenceCount,
        sector.daysLost,
        sector.avgRisk == null ? "Sin datos" : sector.avgRisk.toFixed(1),
        sector.alerts,
      ),
    ),
    "",
    row("Grupos diagnosticos prevalentes", "Ventana movil de 3 meses"),
    row("Posicion", "Grupo", "Certificados", "Dias perdidos", "Participacion"),
    ...prevalence.map((group, index) =>
      row(index + 1, group.label, group.count, group.days, `${group.percentage}%`),
    ),
  ];

  return `\uFEFF${lines.join("\r\n")}`;
};

export const downloadDashboardReportCsv = (report, filename) => {
  const csv = buildDashboardReportCsv(report);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};
