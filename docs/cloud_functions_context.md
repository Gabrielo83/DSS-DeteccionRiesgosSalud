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
- Activa una alerta al alcanzar `recurrenciasAlta` eventos validados de riesgo individual medio o alto, del mismo empleado y grupo diagnostico, dentro de la ventana configurada.
- Evalua el riesgo individual sin el bono de recurrencia y usa `umbralMedioRiesgo` como minimo para contabilizar cada evento.
- Un evento aislado de riesgo alto se prioriza en los indicadores de riesgo, pero no genera por si solo una alerta de recurrencia.
- Mantiene un documento estable por empleado y grupo en `alertas_riesgo`.
- Actualiza la evidencia sin duplicar alertas y resuelve el documento cuando deja de cumplirse la condicion.
- `reconstruirAlertasRiesgo` permite reevaluar de forma controlada los datos existentes cuando cambia la version de la regla.
- Audita activacion, actualizacion y resolucion desde backend.
- Las reglas permiten lectura clinica y bloquean toda escritura desde clientes.

Eventos de auditoria:

- `alerta_riesgo_activada_backend`
- `alerta_riesgo_actualizada_backend`
- `alerta_riesgo_resuelta_backend`

La alerta es una senal preventiva y trazable. No reemplaza la validacion ni el diagnostico profesional.

## Etapa 3.5 completada: consumo visual de alertas

La integracion fue implementada y desplegada el 18/07/2026.

Objetivo:

- Consumir `alertas_riesgo` en tiempo real desde el modo Firebase.
- Integrar alertas activas, motivos explicables y tendencias en el Panel de Control.
- Mostrar recurrencias, ventana evaluada y referencias que originaron la alerta.
- Mantener el comportamiento equivalente en modo local con el motor local existente.
- Evitar cambios visuales no aprobados: se reutilizaran tarjetas, modales y patrones actuales.
- No mezclar certificados pendientes de validacion con alertas consolidadas de riesgo.

Acceso por rol previsto:

- Salud Ocupacional y `superAdmin`: detalle de la alerta y evidencia clinica autorizada.
- Recursos Humanos: informacion operativa necesaria para coordinar acciones preventivas.
- Gerencia: indicadores agregados y tendencias, sin diagnosticos individuales.

Implementacion:

- Los roles clinicos se suscriben a `alertas_riesgo` y reciben detalle explicable.
- Todos los usuarios autenticados pueden leer `indicadores_alertas/global`, que contiene solo cantidades por sector, motivo y grupo diagnostico.
- `actualizarIndicadoresAlertas` recalcula la proyeccion agregada ante cada cambio de alerta.
- `reconstruirIndicadoresAlertas` inicializa la proyeccion cuando falta; exige autenticacion y un rol habilitado, y solo devuelve el resumen sanitizado.
- La version `alert-summary-v2` agrupa todas las alertas activas por sector y grupo diagnostico, conserva la ventana movil aplicada y las ordena por cantidad de alertas y recurrencias.
- Gerencia visualiza los grupos con alerta en el modal sectorial, sin nombres, certificados, CIE-10 ni diagnosticos individuales.
- La tarjeta de alertas y el mapa de calor usan alertas activas consolidadas.
- El modal sectorial muestra evidencia solo a roles clinicos.
- El modo local aplica la misma regla sobre el historial validado.

Criterios de aceptacion:

- Una alerta creada o resuelta en Firestore actualiza el componente correspondiente sin recargar la pagina.
- El Panel de Control presenta cantidad, sector, motivo y estado de las alertas activas.
- El detalle explica por que se genero la alerta y que parametros se aplicaron.
- Las alertas resueltas dejan de contabilizarse como activas sin perder trazabilidad.
- Las reglas de Firestore y las consultas respetan minimizacion de datos por rol.

## Indicadores gerenciales agregados

Para que Gerencia pueda asignar recursos preventivos sin acceder a datos clinicos individuales:

- `actualizarIndicadoresRiesgo` se ejecuta ante cambios en `historial_medico`.
- Consolida por mes y sector el promedio de riesgo, cantidad de certificados y dias perdidos.
- Escribe exclusivamente en `indicadores_riesgo/global`.
- `reconstruirIndicadoresRiesgo` realiza el backfill inicial de registros existentes.
- El cliente escucha la proyeccion en tiempo real y alimenta las tarjetas, el mapa sectorial y la tendencia anual.
- La proyeccion no contiene nombres, legajos, diagnosticos, referencias ni archivos.
