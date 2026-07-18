import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import AppHeader from "../components/AppHeader.jsx";
import AuthContext from "../context/AuthContext.jsx";
import { pathologyCategories } from "../data/pathologyCategories.js";
import { readValidationQueue } from "../utils/validationStorage.js";
import { readAllHistory } from "../utils/historyStorage.js";
import { readEmployees } from "../utils/employeeStorage.js";
import calculateRiskScore, { mapScoreToRisk } from "../utils/riskUtils.js";
import {
  formatLocalDate,
  getLocalDateTimestamp,
  parseLocalDate,
} from "../utils/dateUtils.js";
import {
  MEDICAL_HISTORY_UPDATED_EVENT,
  MEDICAL_VALIDATIONS_UPDATED_EVENT,
  EMPLOYEES_UPDATED_EVENT,
  PREVENTIVE_PLANS_UPDATED_EVENT,
  RISK_CONFIG_UPDATED_EVENT,
  RISK_ALERTS_UPDATED_EVENT,
} from "../utils/storageKeys.js";
import { readAllPlans } from "../utils/planStorage.js";
import {
  generatePreventivePlanTemplate,
  shapePlanForDisplay,
} from "../utils/preventivePlan.js";
import {
  readRiskAlerts,
  readRiskAlertSummary,
} from "../utils/riskAlertStorage.js";
import { isFirebaseProvider } from "../services/appMode.js";

const levelToneMap = {
  Alta: "bg-rose-100 text-rose-700",
  Media: "bg-amber-100 text-amber-700",
  Baja: "bg-emerald-100 text-emerald-700",
};

const pathologyCategoryMap = new Map(
  pathologyCategories.map((item) => [item.value, item.label]),
);

const buildEmployeeIndexes = (employees = []) => {
  const byId = new Map();
  const byName = new Map();
  employees.forEach((employee) => {
    if (employee.employeeId) byId.set(employee.employeeId, employee);
    if (employee.fullName) byName.set(employee.fullName.toLowerCase(), employee);
  });
  return { byId, byName };
};

const normalizeText = (value = "") =>
  value
    .replace(/certificado medico\s*-/gi, "")
    .replace(/certificado\s*-/gi, "")
    .replace(/\benfermedad(es)?\b/gi, "")
    .replace(/cm-\d+/gi, "")
    .trim();

const extractScoreValue = (input) => {
  if (typeof input === "number" && Number.isFinite(input)) {
    return input;
  }
  if (typeof input === "string") {
    const match = input.match(/-?\d+(\.\d+)?/);
    if (match) return parseFloat(match[0]);
  }
  return null;
};

const MIN_RECURRENT_COUNT = 3;
const RECURRENCE_WINDOW_MONTHS = 6;
const AUTO_SYNC_INTERVAL_MS = 150 * 1000;
const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Date(2024, i, 1).toLocaleDateString("es-AR", { month: "long" }),
);

const countWorkingDays = (startDate, endDate) => {
  if (!startDate || !endDate) return 0;
  const start = parseLocalDate(startDate);
  const end = parseLocalDate(endDate);
  if (!start || !end || start > end) return 0;
  let days = 0;
  const cursor = new Date(start);
  cursor.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const day = cursor.getDay();
    // cuenta lunes a sabado; excluye domingos
    if (day !== 0) days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
};

const diffDaysInclusive = (start, end) => {
  const a = start ? parseLocalDate(start) : null;
  const b = end ? parseLocalDate(end) : null;
  if (!a || !b) return 0;
  const diff = Math.round((b - a) / (1000 * 60 * 60 * 24)) + 1;
  return diff > 0 ? diff : 0;
};

const formatDateTimeLabel = (value) => {
  if (!value) return "--";
  return value.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const formatDateValue = (value) => {
  if (!value) return "--";
  return formatLocalDate(value, {
    month: "short",
  });
};

const resolvePathologyLabel = (payload = {}) => {
  if (payload.pathologyLabel) return payload.pathologyLabel;
  if (payload.diagnosticGroupLabel) return payload.diagnosticGroupLabel;
  if (payload.groupLabel) return payload.groupLabel;
  if (payload.pathologyCategory) {
    const label =
      pathologyCategoryMap.get(payload.pathologyCategory) ||
      payload.pathologyCategory;
    if (label) return label;
  }
  const fields = [
    payload.detailedReason,
    payload.pathology,
    payload.reason,
    payload.detail,
    payload.absenceType,
    payload.title,
    payload.notes,
    payload.certificateType,
  ];
  const match = fields.find((field) => field && field.trim().length > 0);
  if (!match) return null;
  const cleaned = normalizeText(match);
  if (!cleaned) return null;
  // use only first sentence to keep label short
  const [firstSentence] = cleaned.split(/[.,;]/);
  return firstSentence.trim();
};

const buildDiagnosticGroupSummary = (entries = []) => {
  const groups = new Map();
  entries.forEach((entry) => {
    const label = resolvePathologyLabel(entry) || "Sin grupo informado";
    const days =
      entry.absenceDays ||
      entry.days ||
      diffDaysInclusive(entry.startDate, entry.endDate) ||
      0;
    const riskScore = extractScoreValue(entry.riskScoreValue ?? entry.riskScore);
    const current = groups.get(label) || {
      label,
      count: 0,
      days: 0,
      riskTotal: 0,
      riskCount: 0,
    };
    current.count += 1;
    current.days += Number.isFinite(Number(days)) ? Number(days) : 0;
    if (riskScore != null) {
      current.riskTotal += riskScore;
      current.riskCount += 1;
    }
    groups.set(label, current);
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      avgRisk: group.riskCount ? group.riskTotal / group.riskCount : null,
    }))
    .sort(
      (a, b) =>
        b.count - a.count ||
        b.days - a.days ||
        (b.avgRisk ?? 0) - (a.avgRisk ?? 0),
    );
};

const isWithinPeriod = (dateValue, start, end) => {
  if (!dateValue) return false;
  const ts = getLocalDateTimestamp(dateValue);
  if (ts === null) return false;
  return ts >= start && ts <= end;
};

const resolveOccurrenceTimestamp = (payload = {}) => {
  const candidates = [
    payload.startDate,
    payload.issueDate,
    payload.issued,
    payload.validityDate,
    payload.updatedAt,
    payload.submitted,
  ];
  for (const value of candidates) {
    if (!value) continue;
    const ts = getLocalDateTimestamp(value);
    if (ts !== null) return ts;
  }
  return Date.now();
};

const normalizeCertificateReference = (value = "") => {
  if (!value) return "";
  const segments = String(value).split("-");
  const last = segments[segments.length - 1];
  if (/^\d{7,}$/.test(last)) {
    return segments.slice(0, -1).join("-");
  }
  return String(value);
};

const countOccurrencesInRollingWindow = (timestamps = []) => {
  const valid = timestamps
    .filter((timestamp) => Number.isFinite(timestamp))
    .sort((a, b) => a - b);
  if (!valid.length) return 0;
  const latest = valid[valid.length - 1];
  const windowStart = new Date(latest);
  windowStart.setMonth(windowStart.getMonth() - RECURRENCE_WINDOW_MONTHS);
  return valid.filter(
    (timestamp) => timestamp >= windowStart.getTime() && timestamp <= latest,
  ).length;
};

const buildLocalRiskAlerts = (entries = []) => {
  const groups = new Map();
  entries.forEach((entry) => {
    const status = String(entry.status || "").toLowerCase();
    if (status !== "validado" && status !== "aprobado") return;
    const employeeId = entry.employeeId || entry.employee;
    const pathologyCategory =
      entry.pathologyCategory || resolvePathologyLabel(entry);
    if (!employeeId || !pathologyCategory) return;
    const key = `${employeeId}::${pathologyCategory}`;
    groups.set(key, [...(groups.get(key) || []), entry]);
  });

  return Array.from(groups.entries()).flatMap(([id, occurrences]) => {
    const dated = occurrences
      .map((entry) => ({ entry, timestamp: resolveOccurrenceTimestamp(entry) }))
      .sort((left, right) => left.timestamp - right.timestamp);
    const latestTimestamp = dated.at(-1)?.timestamp;
    if (!Number.isFinite(latestTimestamp)) return [];
    const windowStart = new Date(latestTimestamp);
    windowStart.setMonth(windowStart.getMonth() - RECURRENCE_WINDOW_MONTHS);
    const inWindow = dated.filter(
      ({ timestamp }) =>
        timestamp >= windowStart.getTime() && timestamp <= latestTimestamp,
    );
    const scores = inWindow
      .map(({ entry }) =>
        extractScoreValue(entry.riskScoreValue ?? entry.riskScore),
      )
      .filter((score) => score != null);
    const maxRiskScore = scores.length ? Math.max(...scores) : 0;
    const reasons = [];
    if (inWindow.length >= MIN_RECURRENT_COUNT) {
      reasons.push("recurrencia_diagnostica");
    }
    if (maxRiskScore >= 7) reasons.push("riesgo_alto");
    if (!reasons.length) return [];
    const latest = inWindow.at(-1)?.entry || {};
    return [{
      id,
      employeeId: latest.employeeId || "",
      employee: latest.employee || "",
      sector: latest.sector || "Sin sector",
      position: latest.position || "",
      pathologyCategory:
        latest.pathologyCategory || resolvePathologyLabel(latest) || "",
      status: "activa",
      reasons,
      occurrenceCount: inWindow.length,
      windowMonths: RECURRENCE_WINDOW_MONTHS,
      maxRiskScore,
      maxIndividualRiskScore: maxRiskScore,
      references: inWindow
        .map(({ entry }) => entry.reference || entry.id)
        .filter(Boolean),
      latestReference: latest.reference || latest.id || "",
    }];
  });
};

/* codigo comentado para referencia futura
const legendLevels = [
  { label: 'Alto (>= 7)', tone: 'bg-rose-500', description: 'Intervencion inmediata y seguimiento continuo.' },
  {
    label: 'Medio (5.0-6.9)',
    tone: 'bg-amber-400',
    description: 'Monitoreo regular y medidas preventivas.',
  },
  {
    label: 'Bajo (< 5)',
    tone: 'bg-emerald-400',
    description: 'Seguimiento de rutina y prevencion general.',
  },
]
*/

function Dashboard({ isDark, onToggleTheme }) {
  const { role } = useContext(AuthContext);
  const firebaseMode = isFirebaseProvider();
  const canReadAlertDetail = [
    "superAdmin",
    "medico",
    "administrativoSalud",
  ].includes(role);
  const [employees, setEmployees] = useState(() =>
    typeof window === "undefined" ? [] : readEmployees(),
  );
  const [validationQueue, setValidationQueue] = useState(() =>
    typeof window === "undefined" ? [] : readValidationQueue(),
  );
  const [historySnapshot, setHistorySnapshot] = useState(() =>
    typeof window === "undefined" ? {} : readAllHistory(),
  );
  const [riskAlerts, setRiskAlerts] = useState(() =>
    typeof window === "undefined" ? [] : readRiskAlerts(),
  );
  const [riskAlertSummary, setRiskAlertSummary] = useState(() =>
    typeof window === "undefined" ? null : readRiskAlertSummary(),
  );
  const today = useMemo(() => new Date(), []);
  const [periodMonth, setPeriodMonth] = useState(today.getMonth());
  const [periodYear, setPeriodYear] = useState(today.getFullYear());
  const [lastRefresh, setLastRefresh] = useState(() => new Date());
  const [countdownLabel, setCountdownLabel] = useState("02:30");
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    employee: "",
    records: [],
  });
  const [heatmapModal, setHeatmapModal] = useState({
    isOpen: false,
    sector: "",
    items: [],
    diagnosticGroups: [],
    validatedCount: 0,
    pendingCount: 0,
    alerts: [],
    headcount: 0,
  });
  const [planModal, setPlanModal] = useState({
    isOpen: false,
    employee: "",
    plan: null,
    employeeKey: "",
    planSource: "auto",
  });
  const [planStore, setPlanStore] = useState(() =>
    typeof window === "undefined" ? {} : readAllPlans(),
  );
  const { byId: employeeIndexById, byName: employeeIndexByName } = useMemo(
    () => buildEmployeeIndexes(employees),
    [employees],
  );
  const periodRange = useMemo(() => {
    const start = new Date(periodYear, periodMonth, 1);
    const end = new Date(periodYear, periodMonth + 1, 0, 23, 59, 59, 999);
    return {
      startMs: start.getTime(),
      endMs: end.getTime(),
      label: `${MONTH_LABELS[periodMonth]} ${periodYear}`,
    };
  }, [periodMonth, periodYear]);
  const periodWorkingDays = useMemo(
    () =>
      countWorkingDays(
        new Date(periodYear, periodMonth, 1),
        new Date(periodYear, periodMonth + 1, 0),
      ),
    [periodMonth, periodYear],
  );

  const allHistoryEntries = useMemo(() => {
    const entries = [];
    Object.entries(historySnapshot || {}).forEach(([employeeId, records]) => {
      if (!Array.isArray(records)) return;
      records.forEach((record) => {
        entries.push({
          ...record,
          employeeId,
          employee:
            record.employee ||
            employeeIndexById.get(employeeId)?.fullName ||
            record.employeeId ||
            "Empleado no identificado",
          sector: record.sector || employeeIndexById.get(employeeId)?.sector,
        });
      });
    });
    return entries;
  }, [employeeIndexById, historySnapshot]);

  const headcountActive = useMemo(() => {
    const { startMs, endMs } = periodRange;
    return employees.filter((emp) => {
      if (emp.active === false) return false;
      const hire = Date.parse(emp.hireDate);
      const termination = emp.terminationDate ? Date.parse(emp.terminationDate) : null;
      if (Number.isNaN(hire)) return false;
      const started = hire <= endMs;
      const notTerminated = !termination || termination >= startMs;
      return started && notTerminated;
    }).length;
  }, [employees, periodRange]);

  const headcountBySector = useMemo(() => {
    const { startMs, endMs } = periodRange;
    const map = new Map();
    employees.forEach((emp) => {
      if (emp.active === false) return;
      const hire = Date.parse(emp.hireDate);
      const termination = emp.terminationDate
        ? Date.parse(emp.terminationDate)
        : null;
      if (Number.isNaN(hire)) return;
      const started = hire <= endMs;
      const notTerminated = !termination || termination >= startMs;
      if (!started || !notTerminated) return;
      const sector = emp.sector || "Sin sector";
      map.set(sector, (map.get(sector) || 0) + 1);
    });
    return map;
  }, [employees, periodRange]);

  const filteredValidated = useMemo(() => {
    const { startMs, endMs } = periodRange;
    return allHistoryEntries.filter((entry) => {
      const status = (entry.status || "").toLowerCase();
      if (status !== "validado" && status !== "aprobado") return false;
      const candidateDate =
        entry.startDate ||
        entry.issueDate ||
        entry.issued ||
        entry.validityDate ||
        entry.updatedAt;
      return isWithinPeriod(candidateDate, startMs, endMs);
    });
  }, [allHistoryEntries, periodRange]);

  const effectiveRiskAlerts = useMemo(
    () =>
      (firebaseMode ? riskAlerts : buildLocalRiskAlerts(allHistoryEntries)).filter(
        (alert) => alert.status === "activa",
      ),
    [allHistoryEntries, firebaseMode, riskAlerts],
  );

  const validatedBySector = useMemo(() => {
    const map = new Map();
    filteredValidated.forEach((entry) => {
      const base = entry.employeeId ? employeeIndexById.get(entry.employeeId) : null;
      const sector = entry.sector || base?.sector || "Sin sector";
      if (!map.has(sector)) map.set(sector, []);
      map.get(sector).push(entry);
    });
    return map;
  }, [employeeIndexById, filteredValidated]);

  const alertsCount =
    firebaseMode && riskAlertSummary
      ? riskAlertSummary.totalActive
      : effectiveRiskAlerts.length;

  const alertsBySector = useMemo(() => {
    const map = new Map();
    if (firebaseMode && riskAlertSummary?.sectors) {
      riskAlertSummary.sectors.forEach(({ sector, cantidad }) => {
        map.set(sector || "Sin sector", Number(cantidad) || 0);
      });
      return map;
    }
    effectiveRiskAlerts.forEach((entry) => {
      const sector = entry.sector || "Sin sector";
      map.set(sector, (map.get(sector) || 0) + 1);
    });
    return map;
  }, [effectiveRiskAlerts, firebaseMode, riskAlertSummary]);

  const riskAverage = useMemo(() => {
    if (!filteredValidated.length) return null;
    const scores = filteredValidated
      .map((item) => extractScoreValue(item.riskScoreValue ?? item.riskScore))
      .filter((v) => v != null);
    if (!scores.length) return null;
    const avg = scores.reduce((sum, val) => sum + val, 0) / scores.length;
    return avg;
  }, [filteredValidated]);

  const openHeatmapModal = useCallback(
    (sector) => {
      const { startMs, endMs } = periodRange;
      const totalsByEmployee = new Map();
      const totalReferences = new Set();

      const registerTotal = (employeeKey, days, reference) => {
        if (!employeeKey) return;
        const normalizedReference = normalizeCertificateReference(reference);
        const totalKey = normalizedReference
          ? `${employeeKey}::${normalizedReference}`
          : "";
        if (totalKey) {
          if (totalReferences.has(totalKey)) return;
          totalReferences.add(totalKey);
        }
        const safeDays = Number.isFinite(days) ? days : Number(days);
        const increment = Number.isFinite(safeDays) ? safeDays : 0;
        const current = totalsByEmployee.get(employeeKey) || { days: 0, count: 0 };
        totalsByEmployee.set(employeeKey, {
          days: current.days + increment,
          count: current.count + 1,
        });
      };

      // Totaliza todos los certificados del periodo (validados + cola) para el sector,
      // independientemente de si luego se muestran o no por criterio de riesgo.
      allHistoryEntries.forEach((entry) => {
        const base = entry.employeeId ? employeeIndexById.get(entry.employeeId) : null;
        const entrySector = entry.sector || base?.sector || "Sin sector";
        if (entrySector !== sector) return;
        const candidateDate =
          entry.startDate ||
          entry.issueDate ||
          entry.issued ||
          entry.validityDate ||
          entry.updatedAt;
        if (!isWithinPeriod(candidateDate, startMs, endMs)) return;
        const days =
          entry.absenceDays ||
          entry.days ||
          diffDaysInclusive(entry.startDate, entry.endDate) ||
          0;
        registerTotal(
          entry.employeeId || entry.employee,
          days,
          entry.reference || entry.id,
        );
      });

      validationQueue.forEach((entry) => {
        const base = entry.employeeId ? employeeIndexById.get(entry.employeeId) : null;
        const entrySector = entry.sector || base?.sector || "Sin sector";
        if (entrySector !== sector) return;
        const candidateDate = entry.startDate || entry.submitted || entry.issueDate;
        if (!isWithinPeriod(candidateDate, startMs, endMs)) return;
        const days =
          entry.absenceDays ||
          entry.days ||
          diffDaysInclusive(entry.startDate, entry.endDate) ||
          0;
        registerTotal(
          entry.employeeId || entry.employee,
          days,
          entry.reference || entry.id,
        );
      });

      const validatedItems = filteredValidated
        .filter((entry) => {
          const base = entry.employeeId ? employeeIndexById.get(entry.employeeId) : null;
          const entrySector = entry.sector || base?.sector || "Sin sector";
          return entrySector === sector;
        })
        .map((entry) => {
          const score =
            extractScoreValue(entry.riskScoreValue ?? entry.riskScore) ??
            calculateRiskScore({
              absenceType:
                entry.absenceType ||
                entry.certificateType ||
                entry.title ||
                "",
              detailedReason:
                entry.detailedReason || entry.notes || entry.detail || "",
              pathologyCategory: entry.pathologyCategory,
              durationDays:
                entry.absenceDays ||
                entry.days ||
                diffDaysInclusive(entry.startDate, entry.endDate),
            })?.score ??
            0;
          const level = mapScoreToRisk(score).level;
          const totals = totalsByEmployee.get(entry.employeeId || entry.employee) || null;
          return {
            reference: entry.reference || entry.id || "N/A",
            employeeId: entry.employeeId || "",
            employee:
              entry.employee ||
              (entry.employeeId ? employeeIndexById.get(entry.employeeId)?.fullName : "") ||
              "Empleado",
            status: entry.status || "Validado",
            priority: level === "Alta" ? "Alta" : level === "Media" ? "Media" : "Baja",
            startDate: entry.startDate || entry.issueDate || entry.issued,
            endDate: entry.endDate || entry.validityDate,
            days:
              entry.absenceDays ||
              entry.days ||
              diffDaysInclusive(entry.startDate, entry.endDate) ||
              null,
            type:
              entry.certificateType ||
              entry.absenceType ||
              entry.title ||
              "Certificado",
            source: "validado",
            pathologyLabel: resolvePathologyLabel(entry) || "Sin grupo informado",
            riskScore: score,
            employeePeriodDaysTotal: totals?.days ?? null,
            employeePeriodCertificatesTotal: totals?.count ?? null,
          };
        });

      const queueItems = validationQueue
        .filter((entry) => {
          const base = entry.employeeId ? employeeIndexById.get(entry.employeeId) : null;
          const entrySector = entry.sector || base?.sector || "Sin sector";
          const status = (entry.status || "").toLowerCase();
          const priority = (entry.priority || "").toLowerCase();
          const isPending = status.includes("pendiente") || status.includes("revision");
          const isHighOrLow = priority === "alta" || priority === "baja" || priority === "media";
          return entrySector === sector && isPending && isHighOrLow;
        })
        .map((entry) => ({
          reference: entry.reference || entry.id || "N/A",
          employeeId: entry.employeeId || "",
          employee:
            entry.employee ||
            (entry.employeeId ? employeeIndexById.get(entry.employeeId)?.fullName : "") ||
            "Empleado",
          status: entry.status || "Pendiente",
          priority: entry.priority || "--",
          startDate: entry.startDate,
          endDate: entry.endDate,
          days:
            entry.absenceDays ||
            entry.days ||
            diffDaysInclusive(entry.startDate, entry.endDate) ||
            null,
          type: entry.certificateType || entry.absenceType || "Certificado",
          source: "cola",
          pathologyLabel: resolvePathologyLabel(entry) || "Sin grupo informado",
          riskScore: extractScoreValue(entry.riskScoreValue ?? entry.riskScore) ?? null,
          employeePeriodDaysTotal:
            totalsByEmployee.get(entry.employeeId || entry.employee)?.days ?? null,
          employeePeriodCertificatesTotal:
            totalsByEmployee.get(entry.employeeId || entry.employee)?.count ?? null,
        }))
        .sort((a, b) => {
          const pa = (a.priority || "").toLowerCase();
          const pb = (b.priority || "").toLowerCase();
          if (pa === pb) return 0;
          if (pa === "alta") return -1;
          if (pb === "alta") return 1;
          if (pa === "media") return -1;
          if (pb === "media") return 1;
          return 0;
        });

      const modalItems = [...validatedItems, ...queueItems].map((item) => ({
        ...item,
        sectorHeadcount: {
          active: headcountBySector.get(sector) || 0,
        },
      }));

      const alertItems = canReadAlertDetail
        ? effectiveRiskAlerts
            .filter((alert) => (alert.sector || "Sin sector") === sector)
            .map((alert) => ({
              ...alert,
              pathologyLabel:
                pathologyCategoryMap.get(alert.pathologyCategory) ||
                alert.pathologyCategory ||
                "Sin grupo informado",
            }))
        : [];

      setHeatmapModal({
        isOpen: true,
        sector,
        items: modalItems,
        diagnosticGroups: buildDiagnosticGroupSummary(validatedItems),
        validatedCount: validatedItems.length,
        pendingCount: queueItems.length,
        alerts: alertItems,
        headcount: headcountBySector.get(sector) || 0,
      });
    },
    [
      employeeIndexById,
      filteredValidated,
      validationQueue,
      headcountBySector,
      allHistoryEntries,
      periodRange,
      canReadAlertDetail,
      effectiveRiskAlerts,
    ],
  );

  const closeHeatmapModal = useCallback(
    () =>
      setHeatmapModal({
        isOpen: false,
        sector: "",
        items: [],
        diagnosticGroups: [],
        validatedCount: 0,
        pendingCount: 0,
        alerts: [],
        headcount: 0,
      }),
    [],
  );

  const heatmapData = useMemo(() => {
    const sectors = new Set([
      ...headcountBySector.keys(),
      ...validatedBySector.keys(),
      ...alertsBySector.keys(),
    ]);

    const items = Array.from(sectors).map((sector) => {
      const headcount = headcountBySector.get(sector) || 0;
      const validated = validatedBySector.get(sector) || [];
      const alerts = alertsBySector.get(sector) || 0;
      const avgRisk =
        validated.length > 0
          ? validated.reduce((sum, entry) => {
              const manual =
                extractScoreValue(entry.riskScoreValue ?? entry.riskScore);
              if (manual != null) return sum + manual;
              const computed = calculateRiskScore({
                absenceType:
                  entry.absenceType ||
                  entry.certificateType ||
                  entry.title ||
                  "",
                detailedReason:
                  entry.detailedReason || entry.notes || entry.detail || "",
                pathologyCategory: entry.pathologyCategory,
                durationDays:
                  entry.absenceDays ||
                  entry.days ||
                  diffDaysInclusive(entry.startDate, entry.endDate),
              });
              return sum + (computed?.score ?? 0);
            }, 0) / validated.length
          : null;
      const daysLost = validated.reduce((sum, entry) => {
        if (entry.absenceDays) return sum + entry.absenceDays;
        if (entry.days) return sum + entry.days;
        return sum + diffDaysInclusive(entry.startDate, entry.endDate);
      }, 0);
      const available = headcount * periodWorkingDays;
      const rate = available > 0 ? (daysLost / available) * 100 : 0;
      const diagnosticGroups = buildDiagnosticGroupSummary(validated);
      const dominantGroup = diagnosticGroups[0] || null;

      const classifyTone = () => {
        if (validated.length === 0) {
          if (alerts > 0) {
            return {
              status: "Alerta preventiva",
              tone: "from-slate-500/70 to-slate-600/70",
            };
          }
          return { status: "Sin datos", tone: "from-slate-400/70 to-slate-500/70" };
        }
        if (avgRisk != null && avgRisk >= 7) {
          return {
            status: alerts > 0 ? "Riesgo alto + alertas" : "Riesgo alto",
            tone: "from-rose-500/90 to-amber-400/90",
          };
        }
        if (dominantGroup?.count >= MIN_RECURRENT_COUNT) {
          return {
            status: "Recurrencia preventiva",
            tone: "from-rose-500/90 to-amber-400/90",
          };
        }
        if (avgRisk != null && avgRisk >= 5) {
          return {
            status: alerts > 0 ? "Riesgo medio + alertas" : "Riesgo medio",
            tone: "from-amber-400/90 to-lime-400/90",
          };
        }
        if (alerts >= 3 || rate >= 12) {
          return { status: "Riesgo medio", tone: "from-amber-400/90 to-lime-400/90" };
        }
        return { status: "Riesgo bajo", tone: "from-emerald-500/90 to-sky-400/90" };
      };

      const toneData = classifyTone();
      const summaryLabel = `${validated.length} ausencia${
        validated.length === 1 ? "" : "s"
      } - ${alerts} alerta${alerts === 1 ? "" : "s"}`;

      return {
        sector,
        headcount,
        validatedCount: validated.length,
        alerts,
        avgRisk,
        rate,
        daysLost,
        dominantGroup,
        diagnosticGroups,
        status: toneData.status,
        tone: toneData.tone,
        scoreLabel: avgRisk != null ? `${avgRisk.toFixed(1)}/10` : "--",
        stats: summaryLabel,
        onClick: () => openHeatmapModal(sector),
        headcountInfo: {
          active: headcount,
          total: headcountBySector.get(sector) || headcount,
        },
      };
    });

    return items.sort(
      (a, b) =>
        (b.avgRisk ?? 0) - (a.avgRisk ?? 0) ||
        b.alerts - a.alerts ||
        b.rate - a.rate,
    );
  }, [
    alertsBySector,
    headcountBySector,
    openHeatmapModal,
    periodWorkingDays,
    validatedBySector,
  ]);

  const summaryMetrics = useMemo(() => {
    const periodWorkingDays = countWorkingDays(
      new Date(periodYear, periodMonth, 1),
      new Date(periodYear, periodMonth + 1, 0),
    );
    const totalDaysLost = filteredValidated.reduce((sum, entry) => {
      if (entry.absenceDays) return sum + entry.absenceDays;
      if (entry.days) return sum + entry.days;
      return sum + diffDaysInclusive(entry.startDate, entry.endDate);
    }, 0);
    const availableDays = headcountActive * periodWorkingDays;
    const absenteeRate =
      availableDays > 0 ? ((totalDaysLost / availableDays) * 100).toFixed(1) : "0.0";
    return [
      {
        title: "Tasa de Ausentismo",
        value: `${absenteeRate}%`,
        badge: periodRange.label,
        badgeVariant: "info",
        primaryLabel: "Dias perdidos",
        primaryValue: totalDaysLost,
        secondaryLabel: "Dias Trabajados",
        secondaryValue: availableDays,
      },
      {
        title: "Riesgo Promedio",
        value: riskAverage != null ? riskAverage.toFixed(1) : "--",
        badge: "Certificados",
        badgeVariant: "info",
        primaryLabel: "Certificados en periodo",
        primaryValue: filteredValidated.length,
        secondaryLabel: "Metodo",
        secondaryValue: "Promedio por certificado",
      },
      {
        title: "Alertas Activas",
        value: alertsCount,
        badge: "Alta prioridad",
        badgeVariant: "danger",
        primaryLabel: "Alertas consolidadas",
        primaryValue: alertsCount,
        secondaryLabel: "Periodo",
        secondaryValue: periodRange.label,
      },
    ];
  }, [
    filteredValidated,
    headcountActive,
    riskAverage,
    alertsCount,
    periodRange,
    periodMonth,
    periodYear,
  ]);

  const trendData = useMemo(() => {
    const months = [];
    // Fijamos la base en el mes actual para que la serie no cambie al mover el selector
    const base = new Date(today.getFullYear(), today.getMonth(), 1);
    for (let i = 11; i >= 0; i -= 1) {
      const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: d.toLocaleDateString("es-AR", { month: "short" }),
      });
    }

    const entries = allHistoryEntries.filter((entry) => {
      const status = (entry.status || "").toLowerCase();
      return status === "validado" || status === "aprobado";
    });

    return months.map((item) => {
      const start = new Date(item.year, item.month, 1).getTime();
      const end = new Date(item.year, item.month + 1, 0, 23, 59, 59, 999).getTime();
      const inMonth = entries.filter((entry) => {
        const candidateDate =
          entry.startDate ||
          entry.issueDate ||
          entry.issued ||
          entry.validityDate ||
          entry.updatedAt;
        return isWithinPeriod(candidateDate, start, end);
      });
      if (!inMonth.length) {
        return { ...item, value: 0, count: 0 };
      }
      const scores = inMonth
        .map((entry) => {
          const manual =
            extractScoreValue(entry.riskScoreValue ?? entry.riskScore);
          if (manual != null) return manual;
          const computed = calculateRiskScore({
            absenceType:
              entry.absenceType ||
              entry.certificateType ||
              entry.title ||
              "",
            detailedReason:
              entry.detailedReason || entry.notes || entry.detail || "",
            pathologyCategory: entry.pathologyCategory,
            durationDays:
              entry.absenceDays ||
              entry.days ||
              diffDaysInclusive(entry.startDate, entry.endDate),
          });
          return computed?.score ?? null;
        })
        .filter((val) => val != null);
      const avg =
        scores.length > 0
          ? scores.reduce((sum, val) => sum + val, 0) / scores.length
          : 0;
      return { ...item, value: avg, count: scores.length };
    });
  }, [allHistoryEntries, today]);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const refreshAll = () => {
      setEmployees(readEmployees());
      setValidationQueue(readValidationQueue());
      setHistorySnapshot(readAllHistory());
      setRiskAlerts(readRiskAlerts());
      setRiskAlertSummary(readRiskAlertSummary());
      setLastRefresh(new Date());
    };
    refreshAll();
    window.addEventListener(EMPLOYEES_UPDATED_EVENT, refreshAll);
    window.addEventListener(RISK_CONFIG_UPDATED_EVENT, refreshAll);
    window.addEventListener(MEDICAL_VALIDATIONS_UPDATED_EVENT, refreshAll);
    window.addEventListener(MEDICAL_HISTORY_UPDATED_EVENT, refreshAll);
    window.addEventListener(RISK_ALERTS_UPDATED_EVENT, refreshAll);
    window.addEventListener("storage", refreshAll);
    return () => {
      window.removeEventListener(EMPLOYEES_UPDATED_EVENT, refreshAll);
      window.removeEventListener(RISK_CONFIG_UPDATED_EVENT, refreshAll);
      window.removeEventListener(
        MEDICAL_VALIDATIONS_UPDATED_EVENT,
        refreshAll,
      );
      window.removeEventListener(
        MEDICAL_HISTORY_UPDATED_EVENT,
        refreshAll,
      );
      window.removeEventListener(RISK_ALERTS_UPDATED_EVENT, refreshAll);
      window.removeEventListener("storage", refreshAll);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const syncPlans = () => {
      setPlanStore(readAllPlans());
    };
    window.addEventListener(PREVENTIVE_PLANS_UPDATED_EVENT, syncPlans);
    window.addEventListener("storage", syncPlans);
    return () => {
      window.removeEventListener(
        PREVENTIVE_PLANS_UPDATED_EVENT,
        syncPlans,
      );
      window.removeEventListener("storage", syncPlans);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateCountdown = () => {
      if (!lastRefresh) return;
      const now = Date.now();
      const elapsed = now - lastRefresh.getTime();
      const remaining = Math.max(0, AUTO_SYNC_INTERVAL_MS - elapsed);
      const minutes = String(Math.floor(remaining / 60000)).padStart(2, "0");
      const seconds = String(Math.floor((remaining % 60000) / 1000)).padStart(
        2,
        "0",
      );
      setCountdownLabel(`${minutes}:${seconds}`);
    };
    updateCountdown();
    const intervalId = window.setInterval(updateCountdown, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [lastRefresh]);

  const dynamicEmployees = useMemo(() => {
    const buckets = new Map(); // employee -> Map(pathology -> info)

    const registerOccurrence = (payload = {}, options = {}) => {
      const { isCountable = true } = options;
      const pathologyLabel = resolvePathologyLabel(payload);
      if (!pathologyLabel) return;

      const baseInfo =
        (payload.employeeId && employeeIndexById.get(payload.employeeId)) ||
        (payload.employee
          ? employeeIndexByName.get(payload.employee.toLowerCase())
          : null);
      const displayName =
        payload.employee ||
        baseInfo?.fullName ||
        (payload.employeeId ? `Colaborador ${payload.employeeId}` : null);
      if (!displayName) return;

      const employeeKey = payload.employeeId || displayName;
      const legajoLabel = payload.employeeId
        ? `Legajo ${payload.employeeId}`
        : baseInfo?.employeeId
          ? `Legajo ${baseInfo.employeeId}`
          : payload.reference
            ? `Ref ${payload.reference}`
            : "Sin identificacion";
      const updatedAt = resolveOccurrenceTimestamp(payload);
      const manualScore =
        extractScoreValue(payload.riskScoreValue) ??
        extractScoreValue(payload.riskScore);
      const riskSource =
        manualScore != null
          ? mapScoreToRisk(manualScore)
          : calculateRiskScore({
              absenceType:
                payload.absenceType ||
                payload.certificateType ||
                payload.title ||
                "",
              detailedReason:
                payload.detailedReason ||
                payload.detail ||
                payload.notes ||
                "",
              pathologyCategory: payload.pathologyCategory,
              durationDays:
                payload.absenceDays ||
                payload.days ||
                diffDaysInclusive(payload.startDate, payload.endDate),
            });

      if (!buckets.has(employeeKey)) {
        buckets.set(employeeKey, new Map());
      }
      const employeeBucket = buckets.get(employeeKey);
      const existing = employeeBucket.get(pathologyLabel) || {
        count: 0,
        latest: 0,
        scoreValue: 0,
        display: null,
        occurrences: [],
      };

      const occurrences = isCountable
        ? [...existing.occurrences, updatedAt]
        : existing.occurrences;
      const next = {
        count: occurrences.length,
        latest: Math.max(existing.latest, updatedAt),
        scoreValue: Math.max(existing.scoreValue, riskSource.score),
        occurrences,
        display: {
          key: `${employeeKey}-${pathologyLabel}`,
          employeeKey,
          name: displayName,
          dni: legajoLabel,
          sector: payload.sector || baseInfo?.sector || "Sin sector",
          pathology: pathologyLabel,
          riskScore: `${riskSource.score.toFixed(1)} / 10`,
          level: riskSource.level,
          levelTone: levelToneMap[riskSource.level] || "bg-slate-200 text-slate-700",
          riskHistory: "Ver historial",
          actions: ["Plan Preventivo", "Intervencion"],
          plan: planStore[employeeKey] || null,
          updatedAt,
        },
      };

      employeeBucket.set(pathologyLabel, next);
    };

    validationQueue.forEach((entry) => {
      registerOccurrence(
        {
          employeeId: entry.employeeId,
          employee: entry.employee,
          sector: entry.sector,
          detailedReason: entry.detailedReason,
          pathologyCategory: entry.pathologyCategory,
          absenceType: entry.absenceType,
          certificateType: entry.certificateType,
          detail: entry.notes,
          reference: entry.reference,
          startDate: entry.startDate,
          issueDate: entry.issueDate,
          validityDate: entry.validityDate,
          updatedAt: entry.lastDecisionAt || entry.submitted,
          riskScoreValue: entry.riskScoreValue,
          riskScore: entry.riskScore,
        },
        { isCountable: true },
      );
    });

    Object.entries(historySnapshot || {}).forEach(([employeeId, records]) => {
      if (!Array.isArray(records)) return;
      records.forEach((record) => {
        registerOccurrence({
          employeeId,
          employee: employeeIndexById.get(employeeId)?.fullName || record.employee,
          sector: employeeIndexById.get(employeeId)?.sector,
          certificateType: record.title,
          pathologyCategory: record.pathologyCategory,
          detail: record.notes,
          detailedReason: record.detailedReason,
          reference: record.id,
          startDate: record.startDate,
          issueDate: record.issueDate,
          validityDate: record.validityDate,
          updatedAt: record.issued,
          riskScoreValue: record.riskScore,
          riskScore: record.riskScore,
          planActions: record.planActions,
          planFollowUps: record.planFollowUps,
          planRecommendations: record.planRecommendations,
        });
      });
    });

    const candidates = [];
    buckets.forEach((pathologies) => {
      let bestInfo = null;
      pathologies.forEach((info) => {
        if (!info?.display) return;
        const recurrentCount = countOccurrencesInRollingWindow(
          info.occurrences,
        );
        if (recurrentCount < MIN_RECURRENT_COUNT) return;
        const comparableInfo = { ...info, recurrentCount };
        if (!bestInfo) {
          bestInfo = comparableInfo;
          return;
        }
        if (comparableInfo.recurrentCount > bestInfo.recurrentCount) {
          bestInfo = comparableInfo;
          return;
        }
        if (
          comparableInfo.recurrentCount === bestInfo.recurrentCount &&
          comparableInfo.scoreValue > bestInfo.scoreValue
        ) {
          bestInfo = comparableInfo;
        }
      });
      if (bestInfo?.display) {
        candidates.push({
          ...bestInfo.display,
          count: bestInfo.recurrentCount,
          scoreValue: bestInfo.scoreValue,
        });
      }
    });

    return candidates.sort(
      (a, b) => b.scoreValue - a.scoreValue || b.updatedAt - a.updatedAt,
    );
  }, [
    employeeIndexById,
    employeeIndexByName,
    validationQueue,
    historySnapshot,
    planStore,
  ]);

  const employeesToDisplay = dynamicEmployees.map((employee) => ({
    ...employee,
    plan: employee.plan || planStore[employee.employeeKey] || null,
  }));
  const hasEmployees = employeesToDisplay.length > 0;
  const formattedLastRefresh = formatDateTimeLabel(lastRefresh);

  const openHistoryModal = (employee) => {
    const employeeKey =
      employee.employeeKey ||
      employee.employeeId ||
      employee.name ||
      employee.dni;
    const normalizedKey = employeeKey || employee.name;
    const validatedRecords = historySnapshot[normalizedKey] ?? [];
    const pendingRecords = validationQueue.filter((item) =>
      entryBelongsToEmployee(item, employee, normalizedKey),
    );

    const normalizedHistory = validatedRecords.map((record) => ({
      id: record.id || `${record.title}-${record.issued || Date.now()}`,
      title: record.title || record.certificateType || "Certificado medico",
      status: record.status || "Validado",
      issued: formatDateValue(record.issued),
      notes: record.notes || "Sin observaciones",
      institution: record.institution || "No indicado",
      riskLabel: record.riskLevel
        ? `${record.riskLevel} (${Number(record.riskScore).toFixed?.(1) ?? record.riskScore})`
        : null,
    }));

    const normalizedPending = pendingRecords.map((record) => ({
      id: record.reference || `PENDING-${record.employee}`,
      title: record.certificateType || record.absenceType || "Certificado pendiente",
      status: record.status || "En Revision",
      issued: formatDateValue(record.submitted || record.issueDate),
      notes:
        record.notes ||
        record.detailedReason ||
        "Sin observaciones adicionales.",
      institution: record.institution || "No indicado",
      riskLabel: record.riskLevel
        ? `${record.riskLevel} (${Number(record.riskScoreValue).toFixed?.(1) ?? record.riskScoreValue})`
        : null,
    }));

    const recordMap = new Map();
    const registerRecord = (entry, allowOverride = false) => {
      if (!entry) return;
      const key =
        entry.id ||
        entry.reference ||
        `${entry.title || "registro"}-${entry.issued || Date.now()}`;
      if (!key) return;
      if (!recordMap.has(key) || allowOverride) {
        recordMap.set(key, entry);
      }
    };

    normalizedPending.forEach((entry) => registerRecord(entry, true));
    normalizedHistory.forEach((entry) => {
      const key =
        entry.id ||
        entry.reference ||
        `${entry.title || "registro"}-${entry.issued || Date.now()}`;
      if (!recordMap.has(key)) {
        recordMap.set(key, entry);
      }
    });

    const combined = Array.from(recordMap.values());
    setHistoryModal({
      isOpen: true,
      employee: employee.name,
      records: combined.length
        ? combined
        : [
            {
              id: "empty",
              title: "Sin registros",
              status: "N/A",
              issued: "--",
              notes: "Todavia no se registraron certificados para este colaborador.",
              institution: "",
              riskLabel: null,
            },
          ],
    });
  };

  const closeHistoryModal = () =>
    setHistoryModal({ isOpen: false, employee: "", records: [] });

  const openPlanModal = (employee) => {
    const employeeKey =
      employee.employeeKey ||
      employee.employeeId ||
      employee.name ||
      employee.dni;
    const storedPlan =
      (employeeKey && planStore[employeeKey]) ||
      (employee.employeeId && planStore[employee.employeeId]) ||
      employee.plan ||
      null;
    const fallbackPlan = generatePreventivePlanTemplate(employee.level);
    setPlanModal({
      isOpen: true,
      employee: employee.name,
      employeeKey: employeeKey || "",
      plan: shapePlanForDisplay(storedPlan || fallbackPlan),
      planSource: storedPlan ? "custom" : "auto",
    });
  };

  const closePlanModal = () =>
    setPlanModal({
      isOpen: false,
      employee: "",
      employeeKey: "",
      plan: null,
      planSource: "auto",
    });
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-100 via-blue-100 to-slate-200 transition dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <AppHeader
        active="Panel de Control"
        isDark={isDark}
        onToggleTheme={onToggleTheme}
      />

      <main className="flex w-full flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 lg:px-10 lg:gap-8">
        <section className="space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Resumen de ausentismo y gestion de ausencias
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Panel de Control
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  Ultima actualizacion: {formattedLastRefresh}
                </span>
                <span className="hidden rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:text-slate-400 md:block">
                  Siguiente sync automatica en {countdownLabel}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <label className="font-semibold">Mes:</label>
                <select
                  value={periodMonth}
                  onChange={(e) => setPeriodMonth(Number(e.target.value))}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {MONTH_LABELS.map((label, idx) => (
                    <option key={label} value={idx}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="font-semibold">Año:</label>
                <select
                  value={periodYear}
                  onChange={(e) => setPeriodYear(Number(e.target.value))}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1 font-semibold text-slate-700 focus:border-slate-400 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {[periodYear - 1, periodYear, periodYear + 1].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {summaryMetrics.map((metric) => (
              <article
                key={metric.title}
                className="flex flex-col justify-between rounded-3xl bg-white p-5 shadow-lg shadow-slate-300/30 ring-1 ring-slate-100 transition dark:bg-slate-950/80 dark:shadow-black/30 dark:ring-slate-900/50"
              >
                <header className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      {metric.title}
                    </p>
                    <p className="mt-3 text-3xl font-semibold text-slate-900 dark:text-white">
                      {metric.value}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      metric.badgeVariant === "danger"
                        ? "bg-rose-100 text-rose-700 dark:bg-rose-600/20 dark:text-rose-300"
                        : metric.badgeVariant === "warning"
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
                          : "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-100"
                    }`}
                  >
                    {metric.badge}
                  </span>
                </header>
                <dl className="mt-6 space-y-3 text-sm">
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <dt>{metric.primaryLabel}</dt>
                    <dd className="font-semibold text-slate-700 dark:text-slate-200">
                      {metric.primaryValue}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                    <dt>{metric.secondaryLabel}</dt>
                    <dd className="font-semibold text-slate-700 dark:text-slate-200">
                      {metric.secondaryValue}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          <article className="col-span-full rounded-3xl bg-white p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-100 transition dark:bg-slate-950/80 dark:shadow-black/30 dark:ring-slate-900/50 lg:col-span-2">
            <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Mapa de calor por sector
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Visualizacion de riesgo y ausentismos por departamento
                </p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600"
              >
                Descargar reporte
              </button>
            </header>
            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {heatmapData.length ? (
                heatmapData.map((item) => (
                  <button
                    key={item.sector}
                    type="button"
                    onClick={item.onClick}
                    aria-label={`Ver certificados del sector ${item.sector}`}
                    className={`flex min-h-40 flex-col justify-between rounded-3xl bg-gradient-to-br ${item.tone} p-5 text-left text-white shadow-inner transition hover:scale-[1.01] hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/40`}
                  >
                    <div className="space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">
                        Sector
                      </p>
                      <h3 className="text-xl font-semibold">{item.sector}</h3>
                      <p className="text-sm opacity-90">{item.stats}</p>
                    </div>
                    <div className="mt-6 flex items-end justify-between">
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide opacity-80">
                          Estado
                        </p>
                        <p className="text-sm font-semibold">{item.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="rounded-full bg-white/20 px-4 py-2 text-sm font-semibold">
                          {item.scoreLabel}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="col-span-full rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                  Aun no hay datos validados en el periodo seleccionado. Registra
                  certificados para actualizar este panel.
                </div>
              )}
            </div>
            <p className="mt-4 text-xs text-slate-600 dark:text-slate-400">
              Alto (&gt;= 7) o alertas: intervencion inmediata - Medio (5 - 6.9):
              monitoreo continuo - Bajo (&lt; 5): seguimiento general
            </p>
          </article>

          <article className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-100 transition dark:bg-slate-950/80 dark:shadow-black/30 dark:ring-slate-900/50">
            <header className="flex flex-col gap-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Evolucion del riesgo promedio
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tendencia del riesgo promedio del personal en los ultimos 12
                meses
              </p>
            </header>
            <div className="mt-6 h-52 rounded-2xl bg-gradient-to-br from-slate-50 via-white to-slate-100 p-4 dark:from-slate-900 dark:via-slate-900 dark:to-slate-900">
              <svg viewBox="0 0 400 180" className="h-full w-full">
                <defs>
                  <linearGradient id="trendArea" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgb(248,113,113)" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="rgb(248,113,113)" stopOpacity="0" />
                  </linearGradient>
                </defs>
                {(() => {
                  const height = 140;
                  const baseY = 160;
                  const maxScore = 10;
                  const items = trendData.length ? trendData : [{ label: "", value: 0 }];
                  const step = items.length > 1 ? 380 / (items.length - 1) : 0;
                  const points = items.map((item, idx) => {
                    const val = Math.min(Math.max(item.value || 0, 0), maxScore);
                    const x = 10 + idx * step;
                    const y = baseY - (val / maxScore) * height;
                    return { ...item, x, y, val };
                  });
                  const linePoints = points.map((p) => `${p.x},${p.y}`).join(" ");
                  const areaPoints = `${points
                    .map((p) => `${p.x},${p.y}`)
                    .join(" ")} ${points[points.length - 1].x},${baseY} ${points[0].x},${baseY}`;
                  return (
                    <g>
                      <polyline
                        fill="url(#trendArea)"
                        stroke="none"
                        points={areaPoints}
                      />
                      <polyline
                        fill="none"
                        stroke="rgb(239,68,68)"
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={linePoints}
                      />
                      <line
                        x1="0"
                        y1="38"
                        x2="400"
                        y2="38"
                        stroke="rgb(248,113,113)"
                        strokeDasharray="6 6"
                        strokeWidth="1.5"
                      />
                      <line
                        x1="0"
                        y1="82"
                        x2="400"
                        y2="82"
                        stroke="rgb(234,179,8)"
                        strokeDasharray="6 6"
                        strokeWidth="1.5"
                      />
                      <line
                        x1="0"
                        y1="126"
                        x2="400"
                        y2="126"
                        stroke="rgb(52,211,153)"
                        strokeDasharray="6 6"
                        strokeWidth="1.5"
                      />
                      {points.map((point, idx) => {
                        const tooltipX = Math.min(Math.max(point.x, 54), 346);
                        const tooltipY = Math.max(point.y - 46, 18);
                        const hasData = point.count > 0;
                        const label = point.label || "";
                        return (
                          <g
                            key={`${label}-point-${idx}`}
                            className="group cursor-default outline-none"
                            tabIndex={0}
                          >
                            <line
                              x1={point.x}
                              y1="20"
                              x2={point.x}
                              y2={baseY}
                              stroke="rgb(100,116,139)"
                              strokeWidth="1"
                              strokeDasharray="3 4"
                              opacity="0"
                              className="transition-opacity group-hover:opacity-40 group-focus:opacity-40"
                            />
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r="12"
                              fill="transparent"
                            />
                            <circle
                              cx={point.x}
                              cy={point.y}
                              r={hasData ? "4.5" : "3.5"}
                              fill={hasData ? "rgb(239,68,68)" : "rgb(148,163,184)"}
                              stroke="white"
                              strokeWidth="2"
                              className="transition-transform group-hover:scale-125 group-focus:scale-125"
                              style={{ transformOrigin: `${point.x}px ${point.y}px` }}
                            />
                            <g
                              opacity="0"
                              className="pointer-events-none transition-opacity group-hover:opacity-100 group-focus:opacity-100"
                            >
                              <rect
                                x={tooltipX - 50}
                                y={tooltipY}
                                width="100"
                                height="38"
                                rx="8"
                                fill="rgb(15,23,42)"
                                opacity="0.94"
                              />
                              <text
                                x={tooltipX}
                                y={tooltipY + 15}
                                textAnchor="middle"
                                className="fill-white text-[10px] font-semibold"
                              >
                                {label}
                              </text>
                              <text
                                x={tooltipX}
                                y={tooltipY + 29}
                                textAnchor="middle"
                                className="fill-slate-200 text-[9px]"
                              >
                                {hasData
                                  ? `${point.val.toFixed(1)} / 10 - ${point.count} cert.`
                                  : "Sin certificados"}
                              </text>
                            </g>
                          </g>
                        );
                      })}
                      {items.map((item, idx) => {
                        const x = 10 + idx * step;
                        const label = item.label || "";
                        return (
                          <text
                            key={`${label}-${idx}`}
                            x={x}
                            y={174}
                            textAnchor="middle"
                            className="fill-slate-400 text-[10px]"
                          >
                            {label}
                          </text>
                        );
                      })}
                    </g>
                  );
                })()}
              </svg>
            </div>
            <ul className="mt-6 space-y-2 text-xs text-slate-500 dark:text-slate-400">
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-rose-500" /> Riesgo
                Alto (&gt;=7)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Riesgo
                Medio (5-6.9)
              </li>
              <li className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Riesgo
                Bajo (&lt;5)
              </li>
            </ul>
          </article>
        </section>

        <section>
          <article className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-100 transition dark:bg-slate-950/80 dark:shadow-black/30 dark:ring-slate-900/50">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Empleados con riesgo individual
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Lista detallada de empleados ordenada por puntuacion de riesgo
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 font-semibold transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-600"
                >
                  Exportar CSV
                </button>
                <button
                  type="button"
                  className="rounded-full border border-slate-200 px-3 py-1 font-semibold transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:hover:border-slate-600"
                >
                  Ver filtros
                </button>
              </div>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-slate-100 dark:border-slate-800">
              <table className="min-w-full divide-y divide-slate-100 text-left text-sm dark:divide-slate-800">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-900/60 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Nombre</th>
                    <th className="px-4 py-3">Sector</th>
                    <th className="px-4 py-3">Patologia mas recurrente</th>
                    <th className="px-4 py-3">Puntuacion de riesgo</th>
                    <th className="px-4 py-3">Nivel</th>
                    <th className="px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-xs text-slate-600 dark:divide-slate-800 dark:bg-transparent dark:text-slate-300">
                  {hasEmployees ? (
                    employeesToDisplay.map((employee) => (
                      <tr key={employee.name}>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {employee.name}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {employee.dni}
                          </p>
                        </td>
                        <td className="px-4 py-4">{employee.sector}</td>
                        <td className="px-4 py-4">{employee.pathology}</td>
                        <td className="px-4 py-4 font-semibold text-slate-900 dark:text-white">
                          {employee.riskScore}
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${employee.levelTone}`}
                          >
                            {employee.level}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => openHistoryModal(employee)}
                            className="rounded-full border border-slate-200 px-3 py-1 font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600"
                          >
                            {employee.riskHistory || "Historial"}
                          </button>
                          {employee.actions.map((action) => (
                            <button
                              type="button"
                              key={action}
                              onClick={
                                action === "Plan Preventivo"
                                  ? () => openPlanModal(employee)
                                  : undefined
                              }
                              className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                                action === "Intervencion"
                                  ? "bg-rose-600 text-white hover:bg-rose-700 dark:bg-rose-500 dark:hover:bg-rose-400"
                                  : action === "Plan Preventivo"
                                    ? "border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600"
                                    : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                              }`}
                            >
                              {action}
                            </button>
                          ))}
                        </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-sm text-slate-500 dark:text-slate-400"
                      >
                        Aun no hay empleados con riesgo individual registrado.
                        Registra ausencias para actualizar este panel.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-100 transition dark:bg-slate-950/80 dark:shadow-black/30 dark:ring-slate-900/50">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Criterios de puntuacion de riesgo
          </h2>
          <div className="mt-4 grid gap-4 text-sm text-slate-500 dark:text-slate-300 md:grid-cols-3">
            <div className="rounded-2xl border border-rose-200/60 bg-rose-50/80 p-4 font-semibold text-rose-700 dark:border-rose-700/40 dark:bg-rose-950/30 dark:text-rose-300">
              Alto Riesgo 7.0 - 10.0 - Requiere intervencion inmediata y
              seguimiento continuo.
            </div>
            <div className="rounded-2xl border border-amber-200/60 bg-amber-50/80 p-4 font-semibold text-amber-700 dark:border-amber-700/40 dark:bg-amber-950/30 dark:text-amber-300">
              Riesgo Medio 5.0 - 6.9 - Monitoreo regular y medidas preventivas.
            </div>
            <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/80 p-4 font-semibold text-emerald-700 dark:border-emerald-700/40 dark:bg-emerald-950/30 dark:text-emerald-300">
              {
                "Riesgo Bajo < 5.0 - Seguimiento de rutina y prevencion general."
              }
            </div>
          </div>
        </section>
      </main>
      {heatmapModal.isOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 px-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 dark:bg-slate-950 dark:ring-slate-800">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Sector
                </p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {heatmapModal.sector || "Sector"}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Certificados validados y pendientes del sector en el periodo
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300">
                    HC activos:{" "}
                    {heatmapModal.headcount}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100">
                    Validados: {heatmapModal.validatedCount}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-100">
                    Pendientes: {heatmapModal.pendingCount}
                  </span>
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-[11px] font-semibold text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-100">
                    Alertas: {alertsBySector.get(heatmapModal.sector) || 0}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeHeatmapModal}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600"
                aria-label="Cerrar detalle de sector"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
                  stroke="currentColor"
                  className="h-5 w-5"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="max-h-[480px] overflow-y-auto pr-1">
              {heatmapModal.items.length === 0 && heatmapModal.alerts.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  No hay certificados asociados a este sector en el periodo.
                </p>
              ) : (
                <div className="space-y-4">
                  {heatmapModal.alerts.length ? (
                    <section className="rounded-2xl border border-rose-200 bg-rose-50/50 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
                      <p className="text-xs font-semibold uppercase tracking-wide text-rose-700 dark:text-rose-300">
                        Alertas preventivas activas
                      </p>
                      <div className="mt-3 space-y-2">
                        {heatmapModal.alerts.map((alert) => (
                          <div
                            key={alert.id}
                            className="rounded-xl bg-white px-3 py-3 text-xs text-slate-600 dark:bg-slate-950/70 dark:text-slate-300"
                          >
                            <div className="flex flex-wrap items-start justify-between gap-2">
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {alert.employee || alert.employeeId || "Empleado"}
                                </p>
                                <p>{alert.pathologyLabel}</p>
                              </div>
                              <span className="rounded-full bg-rose-100 px-2 py-1 font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-100">
                                Riesgo {Number(alert.maxRiskScore || 0).toFixed(1)}
                              </span>
                            </div>
                            <p className="mt-2">
                              Motivo: {(alert.reasons || [])
                                .map((reason) =>
                                  reason === "recurrencia_diagnostica"
                                    ? "Recurrencia diagnóstica"
                                    : "Riesgo individual alto",
                                )
                                .join(" y ")}
                            </p>
                            <p>
                              {alert.occurrenceCount} evento(s) en una ventana de {alert.windowMonths} meses
                            </p>
                            {alert.references?.length ? (
                              <p>Referencias: {alert.references.join(", ")}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  {heatmapModal.diagnosticGroups.length ? (
                    <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Ranking preventivo
                          </p>
                          <h4 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                            Grupos diagnosticos mas frecuentes
                          </h4>
                        </div>
                        {heatmapModal.diagnosticGroups[0]?.count >= MIN_RECURRENT_COUNT ? (
                          <span className="rounded-full bg-rose-100 px-3 py-1 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-100">
                            Recurrencia detectada
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 space-y-2">
                        {heatmapModal.diagnosticGroups.slice(0, 4).map((group) => (
                          <div
                            key={group.label}
                            className="grid gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-950/70 dark:text-slate-300 sm:grid-cols-[1fr_auto]"
                          >
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">
                                {group.label}
                              </p>
                              <p>
                                {group.count} certificado(s) -{" "}
                                {Math.round(group.days)} dias perdidos
                              </p>
                            </div>
                            {group.avgRisk != null ? (
                              <div className="flex items-center sm:justify-end">
                                <span className="rounded-full bg-slate-200 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-100">
                                  Riesgo {group.avgRisk.toFixed(1)}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                  <ul className="space-y-3">
                  {heatmapModal.items.map((item) => (
                    <li
                      key={`${item.reference}-${item.source}-${item.employee}`}
                      className="rounded-2xl border border-slate-200/70 bg-slate-50 px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/50"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900 dark:text-white">
                            {item.reference} - {item.type}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {item.employee}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="rounded-full border border-slate-300 bg-white px-2 py-1 font-semibold uppercase text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {item.status}
                          </span>
                          <span
                            className={`rounded-full px-2 py-1 font-semibold text-[11px] shadow-sm ring-1 ${
                              (item.priority || "").toLowerCase() === "alta"
                                ? "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-900/40 dark:text-rose-100 dark:ring-rose-800/60"
                                : (item.priority || "").toLowerCase() === "media"
                                  ? "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:ring-amber-800/60"
                                  : "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:ring-emerald-800/60"
                            }`}
                          >
                            {item.priority || "--"}
                          </span>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300">
                        {item.startDate && item.endDate ? (
                          <span>
                            {formatDateValue(item.startDate)} - {formatDateValue(item.endDate)}
                          </span>
                        ) : null}
                        {item.days ? <span>{item.days} dias</span> : null}
                        <span className="rounded-full bg-slate-200/70 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {item.pathologyLabel}
                        </span>
                        {item.employeePeriodCertificatesTotal > 1 ? (
                          <span className="rounded-full bg-slate-200/70 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            Empleado en periodo: {Math.round(item.employeePeriodDaysTotal || 0)} dias, {item.employeePeriodCertificatesTotal} certificados
                          </span>
                        ) : null}
                        <span className="rounded-full bg-slate-200/70 px-2 py-1 text-[11px] font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {item.source === "validado" ? "Validado" : "En cola"}
                        </span>
                      </div>
                    </li>
                  ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {historyModal.isOpen ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/70 px-4 py-8">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Historial de certificados
                </p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {historyModal.employee}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Registros validados y pendientes del colaborador.
                </p>
              </div>
              <button
                type="button"
                onClick={closeHistoryModal}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300"
                aria-label="Cerrar historial"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-6 space-y-4">
              {historyModal.records.map((record) => (
                <div
                  key={record.id}
                  className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-5 text-sm shadow-sm dark:border-slate-700 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-base font-semibold text-slate-900 dark:text-white">
                        {record.title}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Registrado: {record.issued}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-semibold text-slate-600 shadow dark:bg-slate-800 dark:text-slate-200">
                      {record.status}
                    </span>
                  </div>
                  <p className="mt-4 text-slate-600 dark:text-slate-300">
                    {record.notes}
                  </p>
                  <div className="mt-4 grid gap-3 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-3">
                    <div>
                      <p className="font-semibold uppercase tracking-wide">
                        Institucion
                      </p>
                      <p className="text-slate-700 dark:text-slate-200">
                        {record.institution || "No indicado"}
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide">
                        Riesgo
                      </p>
                      {record.riskLabel ? (
                        <p className="text-slate-700 dark:text-slate-200">
                          {record.riskLabel}
                        </p>
                      ) : (
                        <p className="text-slate-400">Sin asignar</p>
                      )}
                    </div>
                    <div>
                      <p className="font-semibold uppercase tracking-wide">
                        Referencia
                      </p>
                      <p className="text-slate-700 dark:text-slate-200">
                        {record.id}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {planModal.isOpen && planModal.plan ? (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-slate-900/70 px-4 py-8">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-950">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {planModal.planSource === "custom"
                    ? "Plan preventivo registrado"
                    : "Plan preventivo sugerido"}
                </p>
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {planModal.employee}
                </h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {planModal.planSource === "custom"
                    ? "Plan definido por el profesional tratante."
                    : "Plantilla automatica basada en el nivel de riesgo."}
                </p>
              </div>
              <button
                type="button"
                onClick={closePlanModal}
                className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:border-slate-700 dark:text-slate-300"
                aria-label="Cerrar plan preventivo"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-4 w-4"
                >
                  <path
                    fillRule="evenodd"
                    d="M5.22 5.22a.75.75 0 0 1 1.06 0L10 8.94l3.72-3.72a.75.75 0 1 1 1.06 1.06L11.06 10l3.72 3.72a.75.75 0 1 1-1.06 1.06L10 11.06l-3.72 3.72a.75.75 0 1 1-1.06-1.06L8.94 10 5.22 6.28a.75.75 0 0 1 0-1.06Z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            <div className="mt-6 space-y-4 text-sm text-slate-600 dark:text-slate-300">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Acciones inmediatas
                </p>
                <ul className="mt-3 space-y-3">
                  {planModal.plan.baseActions.map((action) => (
                    <li
                      key={action.title}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <p className="font-semibold text-slate-900 dark:text-white">
                        {action.title}
                      </p>
                      <p>{action.description}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Responsable: {action.owner} · Plazo: {action.due}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Seguimientos programados
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {planModal.plan.followUps.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300"
                    >
                      <p className="text-base text-slate-900 dark:text-white">
                        {item.date}
                      </p>
                      <p>{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white px-4 py-4 dark:border-slate-800 dark:bg-slate-900/70">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Recomendaciones del medico
                </p>
                <ul className="mt-3 space-y-2">
                  {planModal.plan.recommendations.map((note, index) => (
                    <li
                      key={note}
                      className="flex items-start gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600 dark:bg-slate-900/60 dark:text-slate-300"
                    >
                      <span className="mt-0.5 h-2 w-2 rounded-full bg-rose-500" />
                      <span>
                        #{index + 1} · {note}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default Dashboard;
const entryBelongsToEmployee = (entry, employee, normalizedKey) => {
  const lowerName = (employee.name || "").toLowerCase();
  const entryName = (entry.employee || "").toLowerCase();
  return (
    entry.employeeId === employee.employeeKey ||
    entry.employeeId === normalizedKey ||
    entry.employeeId === employee.employeeId ||
    entryName === lowerName ||
    entryName === normalizedKey?.toLowerCase()
  );
};
