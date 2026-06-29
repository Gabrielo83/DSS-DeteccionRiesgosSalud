import mockEmployees from "../data/mockEmployees.js";
import {
  MEDICAL_HISTORY_STORAGE_KEY,
  MEDICAL_HISTORY_UPDATED_EVENT,
  MEDICAL_VALIDATIONS_STORAGE_KEY,
  MEDICAL_VALIDATIONS_UPDATED_EVENT,
  PREVENTIVE_PLANS_STORAGE_KEY,
  PREVENTIVE_PLANS_UPDATED_EVENT,
} from "../utils/storageKeys.js";
import { saveEntity } from "../utils/indexedDbClient.js";

const PLACEHOLDER_IMAGE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAYAAAAGCAYAAADgzO9IAAAAFElEQVR42mP8//8/AwXgPxQDAwMADIYH/qAnbcIAAAAASUVORK5CYII=";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

const formatDateLabel = (date) =>
  date.toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });
const formatDateISO = (date) => date.toISOString().slice(0, 10);

const scenarioTemplates = [
  {
    priority: "Alta",
    status: "Pendiente",
    absenceType: "accidente",
    certificateType: "Accidente de trabajo",
    detailedReason:
      "Lesion lumbar luego de tareas de carga. Requiere reposo y fisioterapia.",
    institution: "Clinica del Sur",
    durationDays: 7,
    notes: "Esperando informe de estudios complementarios.",
  },
  {
    priority: "Media",
    status: "En Revision",
    absenceType: "enfermedad",
    certificateType: "Reposo gripal",
    detailedReason:
      "Cuadro febril con cefalea intensa. Indicacion de reposo domiciliario.",
    institution: "Hospital Central",
    durationDays: 5,
    notes: "Se solicito analitica complementaria.",
  },
  {
    priority: "Baja",
    status: "Pendiente",
    absenceType: "enfermedad",
    certificateType: "Chequeo preventivo",
    detailedReason:
      "Control cardiologico programado. Reposo 48hs post estudio.",
    institution: "Centro Cardiologico Norte",
    durationDays: 2,
    notes: "Sin observaciones adicionales.",
  },
  {
    priority: "Media",
    status: "Validado",
    absenceType: "enfermedad",
    certificateType: "Lesion musculoesqueletica",
    detailedReason:
      "Lumbalgia cronica reagudizada. Necesita kinesiologia supervisada.",
    institution: "Sanatorio Oeste",
    durationDays: 9,
    notes: "Plan preventivo asignado por medico laboral.",
  },
];

const createCertificateMeta = (name, uploadedAt) => ({
  name,
  size: "0.42 MB",
  uploadedAt,
  type: "image/png",
  previewUrl: PLACEHOLDER_IMAGE,
});

const createValidationEntry = (
  employee,
  {
    reference,
    priority,
    status,
    absenceType,
    certificateType,
    detailedReason,
    institution,
    startDate,
    endDate,
    notes,
    submittedDate,
  },
) => {
  const submittedLabel = formatDateLabel(submittedDate);
  return {
    reference,
    employee: employee.fullName,
    employeeId: employee.employeeId,
    position: employee.position,
    sector: employee.sector,
    status,
    priority,
    submitted: submittedLabel,
    receivedTimestamp: submittedDate.getTime(),
    badgeTone:
      status === "Pendiente"
        ? "bg-rose-100 text-rose-700"
        : status === "En Revision"
          ? "bg-amber-100 text-amber-700"
          : "bg-emerald-100 text-emerald-700",
    detailedReason,
    absenceDays:
      Math.max(
        1,
        Math.ceil(
          (Date.parse(endDate) - Date.parse(startDate)) /
            (1000 * 60 * 60 * 24),
        ) + 1,
      ) || 1,
    absenceType,
    certificateType,
    institution,
    startDate,
    endDate,
    issueDate: startDate,
    validityDate: endDate,
    notes,
    certificateFileMeta: createCertificateMeta(
      `${reference}.png`,
      submittedLabel,
    ),
  };
};

const createHistoryRecord = (
  employeeKey,
  reference,
  issued,
  status,
  riskLevel,
) => ({
  id: reference,
  reference,
  title: "Reposo Medico",
  issued,
  days: 5,
  status,
  document: `${reference}.pdf`,
  institution: "Sanatorio Central",
  notes: `Resultado: ${status}. Seguimiento medico semanal.`,
  reviewer: "Dr. Gabriel Caamano",
  riskScore: riskLevel === "Alta" ? 7.8 : riskLevel === "Media" ? 5.2 : 3.9,
  riskLevel,
  riskDescriptor:
    riskLevel === "Alta"
      ? "Intervencion inmediata"
      : riskLevel === "Media"
        ? "Monitoreo continuo"
        : "Seguimiento general",
  planActions: ["Reposo activo", "Trabajo remoto supervisado"],
  planFollowUps: ["Control clinico 10/05", "Evaluacion ergonomica 24/05"],
  planRecommendations: [
    "Pausas cada 2 horas",
    "Reportar sintomas en app de bienestar",
  ],
  employeeKey,
});

const normalizeSectorName = (value = "") =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

const getEmployeesBySector = (sector, count = 1) => {
  const target = normalizeSectorName(sector);
  return mockEmployees
    .filter((employee) => normalizeSectorName(employee.sector) === target)
    .slice(0, count);
};

const buildRange = (baseDate, startOffsetDays, durationDays) => {
  const startDate = new Date(baseDate.getTime() - startOffsetDays * DAY_IN_MS);
  const endDate = new Date(
    startDate.getTime() + Math.max(1, durationDays) * DAY_IN_MS,
  );
  return {
    startDate: formatDateISO(startDate),
    endDate: formatDateISO(endDate),
    issued: formatDateISO(startDate),
  };
};

const createControlledValidation = (employee, scenario, index, baseDate) => {
  const range = buildRange(
    baseDate,
    scenario.startOffsetDays,
    scenario.durationDays,
  );
  return createValidationEntry(employee, {
    reference: scenario.reference || `CM-PEND-${String(index + 1).padStart(4, "0")}`,
    priority: scenario.priority,
    status: scenario.status,
    absenceType: scenario.absenceType,
    certificateType: scenario.certificateType,
    detailedReason: scenario.detailedReason,
    institution: scenario.institution,
    startDate: range.startDate,
    endDate: range.endDate,
    notes: scenario.notes,
    submittedDate: new Date(baseDate.getTime() - index * 45 * 60 * 1000),
  });
};

const createControlledHistoryRecord = (
  employee,
  scenario,
  index,
  baseDate,
) => {
  const range = buildRange(
    baseDate,
    scenario.startOffsetDays,
    scenario.durationDays,
  );
  const riskDescriptor =
    scenario.riskLevel === "Alta"
      ? "Intervencion inmediata"
      : scenario.riskLevel === "Media"
        ? "Monitoreo continuo"
        : "Seguimiento general";

  return {
    id: scenario.reference || `CM-VAL-${String(index + 1).padStart(4, "0")}`,
    reference: scenario.reference || `CM-VAL-${String(index + 1).padStart(4, "0")}`,
    title: scenario.certificateType,
    employee: employee.fullName,
    employeeId: employee.employeeId,
    sector: employee.sector,
    position: employee.position,
    absenceType: scenario.absenceType,
    certificateType: scenario.certificateType,
    detailedReason: scenario.detailedReason,
    pathologyCategory: scenario.pathologyCategory,
    startDate: range.startDate,
    endDate: range.endDate,
    issued: range.issued,
    issueDate: range.issued,
    days: scenario.durationDays + 1,
    status: "Validado",
    document: `${scenario.reference || `CM-VAL-${String(index + 1).padStart(4, "0")}`}.pdf`,
    institution: scenario.institution,
    notes: scenario.notes,
    reviewer: "Dra. Laura Alvarez",
    riskScore: scenario.riskScore,
    riskScoreValue: scenario.riskScore,
    riskLevel: scenario.riskLevel,
    riskDescriptor,
    planActions: scenario.planActions || [],
    planFollowUps: scenario.planFollowUps || [],
    planRecommendations: scenario.planRecommendations || [],
  };
};

const appendHistoryCase = (historyPayload, employee, record) => {
  if (!historyPayload[employee.employeeId]) {
    historyPayload[employee.employeeId] = [];
  }
  historyPayload[employee.employeeId].push(record);
};

const IDB_TARGETS = {
  [MEDICAL_VALIDATIONS_STORAGE_KEY]: { store: "validations", key: "queue" },
  [MEDICAL_HISTORY_STORAGE_KEY]: { store: "history", key: "records" },
  [PREVENTIVE_PLANS_STORAGE_KEY]: { store: "plans", key: "plans" },
};

const persistWithEvent = (key, value, eventName) => {
  window.localStorage.setItem(key, JSON.stringify(value));
  window.dispatchEvent(new Event(eventName));
  const target = IDB_TARGETS[key];
  if (target) {
    saveEntity(target.store, target.key, value).catch((error) =>
      console.warn("No se pudo sincronizar demo seed con IndexedDB:", error),
    );
  }
};

export const runDemoSeed = () => {
  if (typeof window === "undefined") return;
  const now = new Date();
  const [rrhh1, rrhh2] = getEmployeesBySector("Recursos Humanos", 2);
  const [salud1] = getEmployeesBySector("Salud Ocupacional", 1);
  const [admin1] = getEmployeesBySector("Administracion", 1);
  const [produccion1, produccion2] = getEmployeesBySector("Produccion", 2);
  const [seguridad1, seguridad2] = getEmployeesBySector(
    "Seguridad Ocupacional",
    2,
  );
  const safeProduccion1 = produccion1 || mockEmployees[0];
  const safeProduccion2 = produccion2 || safeProduccion1;

  const validationScenarios = [
    {
      employee: rrhh1,
      reference: "CM-PEND-RRHH-001",
      priority: "Alta",
      status: "Pendiente",
      absenceType: "enfermedad",
      certificateType: "Licencia por estres laboral",
      detailedReason:
        "Cuadro de estres laboral asociado a cierre mensual y sobrecarga administrativa.",
      pathologyCategory: "salud-mental",
      institution: "Clinica del Sur",
      durationDays: 7,
      startOffsetDays: 12,
      notes:
        "Pendiente de revision: requiere evaluacion profesional antes de definir acciones preventivas.",
    },
    {
      employee: rrhh2 || rrhh1,
      reference: "CM-PEND-RRHH-002",
      priority: "Alta",
      status: "En Revision",
      absenceType: "enfermedad",
      certificateType: "Reposo respiratorio",
      detailedReason:
        "Cuadro respiratorio agudo en personal administrativo. Se solicita ampliar informe medico.",
      pathologyCategory: "respiratoria",
      institution: "Hospital Central",
      durationDays: 5,
      startOffsetDays: 9,
      notes:
        "En revision: falta constancia de tratamiento indicado por profesional externo.",
    },
    {
      employee: seguridad1,
      reference: "CM-PEND-SEG-001",
      priority: "Media",
      status: "Pendiente",
      absenceType: "enfermedad",
      certificateType: "Control preventivo",
      detailedReason:
        "Control medico preventivo posterior a recorrida de inspeccion.",
      pathologyCategory: "otra",
      institution: "Sanatorio Oeste",
      durationDays: 1,
      startOffsetDays: 6,
      notes:
        "Pendiente de validacion documental. No constituye patron productivo.",
    },
    {
      employee: seguridad2 || seguridad1,
      reference: "CM-PEND-SEG-002",
      priority: "Media",
      status: "Pendiente",
      absenceType: "enfermedad",
      certificateType: "Reposo respiratorio",
      detailedReason: "Cuadro respiratorio agudo con indicacion de reposo.",
      pathologyCategory: "respiratoria",
      institution: "Centro Medico Norte",
      durationDays: 3,
      startOffsetDays: 5,
      notes: "Pendiente de carga completa de antecedente clinico.",
    },
    {
      employee: admin1 || rrhh1,
      reference: "CM-PEND-ADM-001",
      priority: "Baja",
      status: "Pendiente",
      absenceType: "enfermedad",
      certificateType: "Control preventivo",
      detailedReason: "Control medico programado sin patron recurrente.",
      pathologyCategory: "otra",
      institution: "Centro Cardiologico Norte",
      durationDays: 1,
      startOffsetDays: 3,
      notes: "Sin observaciones adicionales.",
    },
  ].filter((scenario) => scenario.employee);

  const validationEntries = validationScenarios.map((scenario, index) =>
    createControlledValidation(scenario.employee, scenario, index, now),
  );

  const historyPayload = {};
  const plansPayload = {};
  const validatedScenarios = [
    {
      employee: safeProduccion1,
      reference: "CM-VAL-PROD-001",
      riskLevel: "Alta",
      riskScore: 8.4,
      absenceType: "enfermedad",
      certificateType: "Lumbalgia ocupacional",
      detailedReason:
        "Lumbalgia cronica reagudizada asociada a tareas de carga y traslado de producto.",
      pathologyCategory: "musculoesqueletica",
      institution: "Sanatorio Central",
      durationDays: 5,
      startOffsetDays: 135,
      notes:
        "Primer antecedente de lumbalgia dentro de la ventana de seguimiento.",
    },
    {
      employee: safeProduccion1,
      reference: "CM-VAL-PROD-002",
      riskLevel: "Alta",
      riskScore: 8.6,
      absenceType: "enfermedad",
      certificateType: "Lumbalgia ocupacional",
      detailedReason:
        "Segundo episodio de lumbalgia con indicacion de kinesiologia. Vinculado a esfuerzo en linea de produccion.",
      pathologyCategory: "musculoesqueletica",
      institution: "Sanatorio Central",
      durationDays: 6,
      startOffsetDays: 78,
      notes:
        "Segundo antecedente asociado al mismo grupo diagnostico.",
    },
    {
      employee: safeProduccion1,
      reference: "CM-VAL-PROD-003",
      riskLevel: "Alta",
      riskScore: 8.9,
      absenceType: "enfermedad",
      certificateType: "Lumbalgia ocupacional",
      detailedReason:
        "Tercer episodio de lumbalgia en seis meses. Se activa plan preventivo para tareas de carga y traslado.",
      pathologyCategory: "musculoesqueletica",
      institution: "Sanatorio Central",
      durationDays: 7,
      startOffsetDays: 20,
      notes:
        "Tercer antecedente del mismo grupo diagnostico dentro de seis meses.",
      planActions: [
        "Evaluacion ergonomica del puesto - Medico laboral - 48 hs",
        "Adecuacion temporal de tareas - RRHH - 72 hs",
      ],
      planFollowUps: [
        "7 dias - Control clinico",
        "15 dias - Reevaluacion de aptitud",
      ],
      planRecommendations: [
        "Evitar tareas con flexion lumbar sostenida.",
        "Registrar evolucion semanal hasta el alta preventiva.",
      ],
    },
    {
      employee: safeProduccion2,
      reference: "CM-VAL-PROD-004",
      riskLevel: "Media",
      riskScore: 6.1,
      absenceType: "enfermedad",
      certificateType: "Tendinitis de hombro",
      detailedReason:
        "Tendinitis asociada a movimientos repetitivos en puesto de embalaje.",
      pathologyCategory: "musculoesqueletica",
      institution: "Hospital Central",
      durationDays: 4,
      startOffsetDays: 18,
      notes:
        "Caso validado de riesgo medio para seguimiento ergonomico sectorial.",
    },
    {
      employee: admin1 || rrhh2 || rrhh1,
      reference: "CM-VAL-ADM-001",
      riskLevel: "Media",
      riskScore: 5.3,
      absenceType: "enfermedad",
      certificateType: "Reposo respiratorio",
      detailedReason:
        "Cuadro respiratorio aislado en area administrativa.",
      pathologyCategory: "respiratoria",
      institution: "Hospital Central",
      durationDays: 3,
      startOffsetDays: 11,
      notes:
        "Caso validado de riesgo medio sin patron recurrente.",
    },
    {
      employee: salud1,
      reference: "CM-VAL-SALUD-001",
      riskLevel: "Baja",
      riskScore: 3.7,
      absenceType: "enfermedad",
      certificateType: "Control preventivo",
      detailedReason:
        "Control medico preventivo del equipo de salud ocupacional.",
      pathologyCategory: "otra",
      institution: "Centro Medico Norte",
      durationDays: 1,
      startOffsetDays: 16,
      notes: "Validado como seguimiento general del personal del area.",
    },
    {
      employee: seguridad1,
      reference: "CM-VAL-SEG-001",
      riskLevel: "Baja",
      riskScore: 3.8,
      absenceType: "enfermedad",
      certificateType: "Control preventivo",
      detailedReason:
        "Control medico preventivo sin hallazgos de riesgo ocupacional.",
      pathologyCategory: "otra",
      institution: "Centro Medico Norte",
      durationDays: 1,
      startOffsetDays: 14,
      notes: "Validado como seguimiento general.",
    },
  ].filter((scenario) => scenario.employee);

  validatedScenarios.forEach((scenario, index) => {
    const record = createControlledHistoryRecord(
      scenario.employee,
      scenario,
      index,
      now,
    );
    appendHistoryCase(historyPayload, scenario.employee, record);
    if (record.planActions.length) {
      plansPayload[scenario.employee.employeeId] = {
        actions: record.planActions,
        followUps: record.planFollowUps,
        recommendations: record.planRecommendations,
      };
    }
  });

  persistWithEvent(
    MEDICAL_VALIDATIONS_STORAGE_KEY,
    validationEntries,
    MEDICAL_VALIDATIONS_UPDATED_EVENT,
  );
  persistWithEvent(
    MEDICAL_HISTORY_STORAGE_KEY,
    historyPayload,
    MEDICAL_HISTORY_UPDATED_EVENT,
  );
  persistWithEvent(
    PREVENTIVE_PLANS_STORAGE_KEY,
    plansPayload,
    PREVENTIVE_PLANS_UPDATED_EVENT,
  );

  window.dispatchEvent(new Event("storage"));
  console.info(
    "%cDemo seed completado",
    "background:#0f172a;color:#fff;padding:4px 8px;border-radius:6px",
    "Ejecuta window.runDemoSeed() nuevamente si queres regenerar los datos.",
  );
};

if (import.meta.env.MODE !== "production" && typeof window !== "undefined") {
  window.runDemoSeed = runDemoSeed;
  console.info(
    "%cDemo disponible",
    "background:#e0f2fe;color:#0f172a;padding:4px 8px;border-radius:6px",
    "Ejecuta window.runDemoSeed() en la consola para precargar certificados.",
  );
}

/**
 * Seed enfocado en la evolucion de riesgo promedio:
 * - Crea historicos validados para 50 empleados entre enero y diciembre del anio actual.
 * - Cada mes aporta riesgos variados (bajo/medio/alto) para que el grafico muestre tendencia.
 * - Limpia la cola de validacion (solo historicos).
 */
export const runRiskTrendSeed = () => {
  if (typeof window === "undefined") return;
  const now = new Date();
  const baseYear = now.getFullYear();
  const employees = mockEmployees.slice(0, 50);
  const historyPayload = {};

  const riskLevels = ["Baja", "Media", "Alta", "Media", "Baja", "Media", "Alta", "Media", "Baja", "Media", "Alta", "Media"];

  employees.forEach((emp, idx) => {
    const records = [];
    for (let month = 0; month < 12; month += 1) {
      const riskLevel = riskLevels[month % riskLevels.length];
      const issueDate = new Date(baseYear, month, 10 + (idx % 5));
      const reference = `CM-TREND-${String(idx + 1).padStart(3, "0")}-${String(month + 1).padStart(2, "0")}`;
      records.push(
        createHistoryRecord(
          emp.employeeId,
          reference,
          formatDateISO(issueDate),
          "Validado",
          riskLevel,
        ),
      );
    }
    historyPayload[emp.employeeId] = records;
  });

  persistWithEvent(
    MEDICAL_VALIDATIONS_STORAGE_KEY,
    [],
    MEDICAL_VALIDATIONS_UPDATED_EVENT,
  );
  persistWithEvent(
    MEDICAL_HISTORY_STORAGE_KEY,
    historyPayload,
    MEDICAL_HISTORY_UPDATED_EVENT,
  );
  persistWithEvent(
    PREVENTIVE_PLANS_STORAGE_KEY,
    {},
    PREVENTIVE_PLANS_UPDATED_EVENT,
  );

  window.dispatchEvent(new Event("storage"));
  console.info(
    "%cSeed tendencia riesgo cargado",
    "background:#0f172a;color:#fff;padding:4px 8px;border-radius:6px",
    "Ejecuta window.runRiskTrendSeed() para regenerarlo.",
  );
};

if (import.meta.env.MODE !== "production" && typeof window !== "undefined") {
  window.runRiskTrendSeed = runRiskTrendSeed;
}

/**
 * Seed extendido para pruebas del dashboard:
 * - 50 empleados con certificados en cola de validacion
 * - Los primeros 10 empleados tienen 4 certificados cada uno (para disparar indicadores)
 * - Resto de empleados con 1 certificado
 * - Incluye historial validado para reflejar riesgos e historicos
 */
export const runDashboardSeed = () => {
  if (typeof window === "undefined") return;

  const now = new Date();
  const employees = mockEmployees.slice(0, 50);
  const multiCertEmployees = employees.slice(0, 10);
  const singleCertEmployees = employees.slice(10);

  const entries = [];
  const historyPayload = {};

  const makeRef = (idx) => `CM-SEED-${String(idx + 1).padStart(4, "0")}`;
  const statusCycle = ["Pendiente", "En Revision", "Validado", "Validado"];

  let globalIdx = 0;

  const pushEntry = (employee, scenario, idxOffset = 0) => {
    const submittedDate = new Date(
      now.getTime() - (globalIdx + idxOffset) * 2 * 60 * 60 * 1000,
    );
    const startDateObj = new Date(
      submittedDate.getTime() - (scenario.durationDays + 1) * DAY_IN_MS,
    );
    const endDateObj = new Date(
      startDateObj.getTime() + scenario.durationDays * DAY_IN_MS,
    );
    const status =
      statusCycle[(globalIdx + idxOffset) % statusCycle.length] || "Pendiente";
    const reference = makeRef(globalIdx);

    const entry = createValidationEntry(employee, {
      reference,
      priority: scenario.priority,
      status,
      absenceType: scenario.absenceType,
      certificateType: scenario.certificateType,
      detailedReason: scenario.detailedReason,
      institution: scenario.institution,
      startDate: formatDateISO(startDateObj),
      endDate: formatDateISO(endDateObj),
      notes: scenario.notes,
      submittedDate,
    });

    entries.push(entry);

    if (status === "Validado") {
      const riskLevel =
        scenario.priority === "Alta"
          ? "Alta"
          : scenario.priority === "Media"
            ? "Media"
            : "Baja";
      const histArr = historyPayload[employee.employeeId] || [];
      histArr.push(
        createHistoryRecord(
          employee.employeeId,
          reference,
          formatDateISO(startDateObj),
          status,
          riskLevel,
        ),
      );
      historyPayload[employee.employeeId] = histArr;
    }
    globalIdx += 1;
  };

  multiCertEmployees.forEach((emp) => {
    scenarioTemplates.forEach((scenario, sIdx) => pushEntry(emp, scenario, sIdx));
  });

  singleCertEmployees.forEach((emp, idx) => {
    const scenario = scenarioTemplates[idx % scenarioTemplates.length];
    pushEntry(emp, scenario);
  });

  const plansPayload = multiCertEmployees.reduce((acc, employee, idx) => {
    acc[employee.employeeId] = {
      actions: [
        "Plan ergonomico personalizado",
        `Control clinico quincenal ${idx + 1}`,
      ],
      followUps: [
        `Seguimiento kinesiologia ${idx + 5}`,
        `Evaluacion laboral ${idx + 10}`,
      ],
      recommendations: [
        "Pausas activas y registro de sintomas",
        "Uso de faja segun criterio medico",
      ],
    };
    return acc;
  }, {});

  persistWithEvent(
    MEDICAL_VALIDATIONS_STORAGE_KEY,
    entries,
    MEDICAL_VALIDATIONS_UPDATED_EVENT,
  );
  persistWithEvent(
    MEDICAL_HISTORY_STORAGE_KEY,
    historyPayload,
    MEDICAL_HISTORY_UPDATED_EVENT,
  );
  persistWithEvent(
    PREVENTIVE_PLANS_STORAGE_KEY,
    plansPayload,
    PREVENTIVE_PLANS_UPDATED_EVENT,
  );

  window.dispatchEvent(new Event("storage"));
  console.info(
    "%cSeed dashboard completado",
    "background:#0f172a;color:#fff;padding:4px 8px;border-radius:6px",
    "Ejecuta window.runDashboardSeed() para recargar los 50 empleados.",
  );
};

if (import.meta.env.MODE !== "production" && typeof window !== "undefined") {
  window.runDashboardSeed = runDashboardSeed;
}
