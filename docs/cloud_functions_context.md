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

## Siguiente etapa sugerida

Agregar Function para recurrencias y alertas consolidadas:

```txt
historial_medico/{reference}
```

Objetivo:

- Detectar 3 eventos del mismo grupo diagnostico en ventana movil.
- Crear o actualizar `alertas_riesgo`.
- Registrar auditoria backend.
