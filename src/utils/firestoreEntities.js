import { COLLECTIONS, deleteDocById, getDocById, listCollection, queryCollection, updateDocById, upsertDocById } from "./firestoreStorage.js";

export const saveEmpleado = (employeeId, data) =>
  upsertDocById(COLLECTIONS.EMPLEADOS, employeeId, data, { includeCreated: true });

export const getEmpleado = (employeeId) =>
  getDocById(COLLECTIONS.EMPLEADOS, employeeId);

export const listEmpleados = () => listCollection(COLLECTIONS.EMPLEADOS);

export const saveAusencia = (absenceId, data) =>
  upsertDocById(COLLECTIONS.AUSENCIAS, absenceId, data, { includeCreated: true });

export const getAusencia = (absenceId) =>
  getDocById(COLLECTIONS.AUSENCIAS, absenceId);

export const listAusencias = () => listCollection(COLLECTIONS.AUSENCIAS);

export const saveValidacion = (reference, data) =>
  upsertDocById(COLLECTIONS.VALIDACIONES, reference, data, {
    includeCreated: true,
  });

export const getValidacion = (reference) =>
  getDocById(COLLECTIONS.VALIDACIONES, reference);

export const listValidaciones = () => listCollection(COLLECTIONS.VALIDACIONES);

export const saveHistorial = (historyId, data) =>
  upsertDocById(COLLECTIONS.HISTORIAL, historyId, data, {
    includeCreated: true,
  });

export const getHistorial = (historyId) =>
  getDocById(COLLECTIONS.HISTORIAL, historyId);

export const listHistorial = () => listCollection(COLLECTIONS.HISTORIAL);

export const saveBorrador = (draftId, data) =>
  upsertDocById(COLLECTIONS.BORRADORES, draftId, data, {
    includeCreated: true,
  });

export const deleteBorrador = (draftId) =>
  deleteDocById(COLLECTIONS.BORRADORES, draftId);

export const listBorradores = () => listCollection(COLLECTIONS.BORRADORES);

export const savePlanPreventivo = (employeeId, data) =>
  upsertDocById(COLLECTIONS.PLANES, employeeId, data, {
    includeCreated: true,
  });

export const getPlanPreventivo = (employeeId) =>
  getDocById(COLLECTIONS.PLANES, employeeId);

export const listPlanesPreventivos = () => listCollection(COLLECTIONS.PLANES);

export const savePatologia = (pathologyId, data) =>
  upsertDocById(COLLECTIONS.PATOLOGIAS, pathologyId, data, {
    includeCreated: true,
  });

export const listPatologias = () => listCollection(COLLECTIONS.PATOLOGIAS);

export const saveParametrosRiesgo = (configId, data) =>
  upsertDocById(COLLECTIONS.PARAMETROS, configId, data, {
    includeCreated: true,
  });

export const getParametrosRiesgo = (configId) =>
  getDocById(COLLECTIONS.PARAMETROS, configId);

export const listAlertasRiesgo = () =>
  listCollection(COLLECTIONS.ALERTAS_RIESGO);

export const getIndicadorAlertas = () =>
  getDocById(COLLECTIONS.INDICADORES_ALERTAS, "global");

export const saveUsuario = (uid, data) =>
  upsertDocById(COLLECTIONS.USUARIOS, uid, data, { includeCreated: true });

export const getUsuario = (uid) => getDocById(COLLECTIONS.USUARIOS, uid);

export const listValidacionesPorEmpleado = (employeeId) =>
  queryCollection(COLLECTIONS.VALIDACIONES, {
    filters: [["employeeId", "==", employeeId]],
    order: [["creadoEn", "desc"]],
  });

export const listHistorialPorEmpleado = (employeeId) =>
  queryCollection(COLLECTIONS.HISTORIAL, {
    filters: [["employeeId", "==", employeeId]],
    order: [["creadoEn", "desc"]],
  });

export const listAusenciasPorEmpleado = (employeeId) =>
  queryCollection(COLLECTIONS.AUSENCIAS, {
    filters: [["employeeId", "==", employeeId]],
    order: [["creadoEn", "desc"]],
  });

export const updateAusencia = (absenceId, data) =>
  updateDocById(COLLECTIONS.AUSENCIAS, absenceId, data);

export const updateValidacion = (reference, data) =>
  updateDocById(COLLECTIONS.VALIDACIONES, reference, data);

export const updateHistorial = (historyId, data) =>
  updateDocById(COLLECTIONS.HISTORIAL, historyId, data);

export const deleteAusencia = (absenceId) =>
  deleteDocById(COLLECTIONS.AUSENCIAS, absenceId);

export const deleteValidacion = (reference) =>
  deleteDocById(COLLECTIONS.VALIDACIONES, reference);

export const deleteHistorial = (historyId) =>
  deleteDocById(COLLECTIONS.HISTORIAL, historyId);
