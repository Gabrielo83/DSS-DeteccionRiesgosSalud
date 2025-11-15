const TEMPLATE_BY_LEVEL = {
  alta: {
    actions: [
      "Suspension temporal de tareas criticas · RRHH + Lider · Inmediata",
      "Coordinacion con servicio medico externo · Medico laboral · Dentro de 48 hs",
      "Seguimiento clinico diario · Equipo medico · Semana inicial",
    ],
    followUps: [
      "48 hs · Evaluacion interdisciplinaria",
      "7 dias · Control clinico + ajustes ergonomicos",
      "15 dias · Reevaluacion de aptitud",
    ],
    recommendations: [
      "Limitar tareas fisicas de alto impacto hasta nuevo aviso.",
      "Registrar sintomas a diario y reportar cambios al servicio medico.",
      "Coordinar adaptaciones temporales del puesto de trabajo.",
    ],
  },
  media: {
    actions: [
      "Evaluacion clinica ampliada · Medico laboral · Dentro de 7 dias",
      "Aviso a RRHH y lider · Responsable RRHH · Dentro de 3 dias",
    ],
    followUps: [
      "12 Mayo · Control medico interdisciplinario",
      "20 Mayo · Sesion ergonomica / kinesiologia",
      "03 Junio · Evaluacion final",
    ],
    recommendations: [
      "Reforzar pausas activas y ejercicios de estiramiento 3 veces al dia.",
      "Limitar tareas con carga fisica moderada por 15 dias.",
      "Registrar sintomas en la app de bienestar corporativo.",
    ],
  },
  baja: {
    actions: [
      "Orientacion de bienestar · RRHH · Dentro de 5 dias",
      "Chequeo ergonomico preventivo · HSE · Proxima semana",
    ],
    followUps: [
      "Control ergonomico trimestral",
      "Sesion de bienestar integral el proximo mes",
    ],
    recommendations: [
      "Mantener pausas activas cada 2 horas.",
      "Micro ejercicios al iniciar y finalizar el turno.",
      "Control trimestral para verificar estabilidad clinica.",
    ],
  },
};

const splitSegments = (line = "") =>
  line
    .split(/·|��/g)
    .map((segment) => segment.trim())
    .filter(Boolean);

const stringifyArray = (items = []) =>
  Array.isArray(items) ? items.join("\n") : "";

const parseDraftField = (value = "") =>
  value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const parseActionLine = (line, index) => {
  const parts = splitSegments(line);
  if (!parts.length) {
    return {
      title: `Accion #${index + 1}`,
      description: "Accion definida por el profesional.",
      owner: "Responsable a designar",
      due: "A coordinar",
    };
  }
  if (parts.length === 1) {
    return {
      title: parts[0],
      description: "Accion registrada por el profesional.",
      owner: "Responsable a definir",
      due: "Sin fecha",
    };
  }
  if (parts.length === 2) {
    return {
      title: parts[0],
      description: parts[1],
      owner: "Responsable a definir",
      due: "Sin fecha",
    };
  }
  return {
    title: parts[0],
    description: parts[1],
    owner: parts[2] || "Responsable a definir",
    due: parts[3] || parts[2] || "Sin fecha",
  };
};

const parseFollowUpLine = (line, index) => {
  const parts = splitSegments(line);
  if (!parts.length) {
    return {
      label: `Seguimiento #${index + 1}`,
      date: "A definir",
    };
  }
  if (parts.length === 1) {
    return {
      date: "A definir",
      label: parts[0],
    };
  }
  return {
    date: parts[0],
    label: parts[1],
  };
};

export const generatePreventivePlanTemplate = (riskLevel = "Media") => {
  const normalizedLevel = (riskLevel || "media").toLowerCase();
  return TEMPLATE_BY_LEVEL[normalizedLevel] || TEMPLATE_BY_LEVEL.media;
};

export const planToDraftText = (plan = {}) => ({
  actions: stringifyArray(plan.actions),
  followUps: stringifyArray(plan.followUps),
  recommendations: stringifyArray(plan.recommendations),
});

export const draftTextToPlan = (draft = {}) => ({
  actions: parseDraftField(draft.actions),
  followUps: parseDraftField(draft.followUps),
  recommendations: parseDraftField(draft.recommendations),
});

export const shapePlanForDisplay = (plan = {}) => {
  const safePlan = {
    actions: Array.isArray(plan.actions) ? plan.actions : [],
    followUps: Array.isArray(plan.followUps) ? plan.followUps : [],
    recommendations: Array.isArray(plan.recommendations)
      ? plan.recommendations
      : [],
  };

  return {
    baseActions: safePlan.actions.map(parseActionLine),
    followUps: safePlan.followUps.map(parseFollowUpLine),
    recommendations: safePlan.recommendations,
  };
};

export const draftForRiskLevel = (riskLevel = "Media") =>
  planToDraftText(generatePreventivePlanTemplate(riskLevel));
