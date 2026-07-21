import {
  COLLECTIONS,
  getDocById,
  listCollection,
  queryCollection,
} from "./firestoreStorage.js";

export const listEmpleados = () => listCollection(COLLECTIONS.EMPLEADOS);

export const listAusencias = () => listCollection(COLLECTIONS.AUSENCIAS);

export const listValidaciones = () => listCollection(COLLECTIONS.VALIDACIONES);

export const listHistorial = () => listCollection(COLLECTIONS.HISTORIAL);

export const listBorradoresPorPropietario = (ownerUid) =>
  queryCollection(COLLECTIONS.BORRADORES, {
    filters: [["ownerUid", "==", ownerUid]],
  });

export const listPlanesPreventivos = () => listCollection(COLLECTIONS.PLANES);

export const listPatologias = () => listCollection(COLLECTIONS.PATOLOGIAS);

export const getParametrosRiesgo = (configId) =>
  getDocById(COLLECTIONS.PARAMETROS, configId);

export const listAlertasRiesgo = () =>
  listCollection(COLLECTIONS.ALERTAS_RIESGO);

export const getIndicadorAlertas = () =>
  getDocById(COLLECTIONS.INDICADORES_ALERTAS, "global");

export const getIndicadorRiesgo = () =>
  getDocById(COLLECTIONS.INDICADORES_RIESGO, "global");

export const getIndicadorAusentismo = () =>
  getDocById(COLLECTIONS.INDICADORES_AUSENTISMO, "global");
