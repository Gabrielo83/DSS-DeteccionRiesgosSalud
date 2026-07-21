const MetricHistoryModal = ({ isOpen, title, subtitle, series = [], onClose }) => {
  if (!isOpen) return null;

  const numericValues = series.map((item) => Number(item.value) || 0);
  const maxValue = Math.max(...numericValues, 1);
  const step = series.length > 1 ? 520 / (series.length - 1) : 0;
  const points = series.map((item, index) => ({
    ...item,
    x: 20 + index * step,
    y: 150 - ((Number(item.value) || 0) / maxValue) * 120,
  }));
  const linePoints = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/70 px-4 py-8">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="metric-history-title"
        className="w-full max-w-4xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-950"
      >
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Evolucion historica
            </p>
            <h2
              id="metric-history-title"
              className="text-xl font-semibold text-slate-900 dark:text-white"
            >
              {title}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar evolucion historica"
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path
                fillRule="evenodd"
                d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </header>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4 dark:bg-slate-900">
          <svg viewBox="0 0 560 180" className="h-52 w-full" aria-hidden="true">
            <line x1="20" y1="150" x2="540" y2="150" stroke="rgb(203,213,225)" />
            <polyline
              points={linePoints}
              fill="none"
              stroke="rgb(239,68,68)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.map((point) => (
              <g key={point.key}>
                <circle
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="rgb(239,68,68)"
                  stroke="white"
                  strokeWidth="2"
                />
                <text
                  x={point.x}
                  y="170"
                  textAnchor="middle"
                  className="fill-slate-500 text-[9px] dark:fill-slate-400"
                >
                  {point.shortLabel}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm dark:divide-slate-800">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Periodo</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Detalle</th>
                <th className="px-4 py-3">Base</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-600 dark:divide-slate-800 dark:text-slate-300">
              {series.map((item) => (
                <tr key={item.key}>
                  <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                    {item.label}
                  </td>
                  <td className="px-4 py-3">{item.displayValue}</td>
                  <td className="px-4 py-3">{item.detailPrimary}</td>
                  <td className="px-4 py-3">{item.detailSecondary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};

export default MetricHistoryModal;
