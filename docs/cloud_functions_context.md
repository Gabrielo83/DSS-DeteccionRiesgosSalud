# Contexto Cloud Functions

Rama de trabajo: `feature/cloud-functions`.

Base estable: `feature/firebase` en el commit `0ca439e Parametriza motor de riesgo con Firebase`.

## Etapa implementada

- Se agrego scaffold de Firebase Cloud Functions en `functions/`.
- Se configuro `firebase.json` para deploy de Functions.
- Se agrego script raiz `deploy:firebase:functions`.
- Se extrajo un motor de riesgo puro en `functions/src/riskEngine.js`.
- El frontend usa ese mismo motor puro desde `src/utils/riskUtils.js`.
- Se agrego la Function `recalcularRiesgoValidacionMedica`.

## Function inicial

Trigger:

```txt
validaciones_medicas/{reference}
```

Acciones:

- Lee `parametros_riesgo/global`.
- Lee `patologias`.
- Recalcula puntaje y nivel de riesgo.
- Actualiza el documento de `validaciones_medicas`.
- Registra evento en `auditoria`.
- Evita bucles actualizando solo cuando el resultado cambio o faltan campos backend.

## Validaciones ejecutadas

```bash
npm run lint:functions
npm run lint
npm test -- --run --testTimeout 10000
npm run build
npm run build:firebase
```

## Deploy

```bash
npm run deploy:firebase:functions
```

## Etapa 3: alertas consolidadas

Se agrego `consolidarAlertasRiesgo`, con trigger sobre:

```txt
validaciones_medicas/{reference}
```

Comportamiento:

- Agrupa certificados validados por empleado y grupo diagnostico.
- Usa la ventana movil configurada en `parametros_riesgo/global`.
- Activa una alerta al alcanzar `recurrenciasAlta` o el umbral de riesgo alto.
- Evalua el riesgo individual sin el bono de recurrencia para no duplicar motivos ni impedir una resolucion posterior.
- Mantiene un documento estable por empleado y grupo en `alertas_riesgo`.
- Actualiza la evidencia sin duplicar alertas y resuelve el documento cuando deja de cumplirse la condicion.
- Audita activacion, actualizacion y resolucion desde backend.
- Las reglas permiten lectura clinica y bloquean toda escritura desde clientes.

Eventos de auditoria:

- `alerta_riesgo_activada_backend`
- `alerta_riesgo_actualizada_backend`
- `alerta_riesgo_resuelta_backend`

La alerta es una senal preventiva y trazable. No reemplaza la validacion ni el diagnostico profesional.
