# Resumen tecnico vivo del TFG

Proyecto: DSS para deteccion de riesgos en salud ocupacional.

Objetivo del documento: centralizar decisiones tecnicas, implementaciones cerradas, pendientes y argumentos de defensa. Este archivo debe actualizarse cada vez que se tome una decision relevante en este chat o en chats paralelos.

## Estado general

- Rama principal de trabajo Firebase/Cloud Functions: `feature/cloud-functions`.
- Proyecto Firebase: `dss-ausentismo`.
- El sistema mantiene dos modos defendibles:
  - Modo local: usa `localStorage` e IndexedDB para ejecutar el sistema sin dependencia remota.
  - Modo Firebase: usa Firebase Auth, Firestore, Storage, Cloud Functions, Analytics/Performance donde corresponde.
- La interfaz no muestra "modo demo/local" al usuario funcional. El indicador de entorno queda discretamente en el contorno del avatar:
  - Verde: Firebase.
  - Naranja: local.

## Idea funcional para defensa

El sistema no diagnostica enfermedades ni reemplaza al medico laboral. Organiza certificados, ausencias y antecedentes; permite validacion profesional; consolida legajos; calcula indicadores de riesgo y detecta recurrencias para priorizar acciones preventivas.

La regla fuerte del TFG es:

- 3 eventos del mismo grupo diagnostico.
- Dentro de una ventana movil de 6 meses.
- Usado como senal preventiva, no como diagnostico clinico.

## Stack tecnico

- React 19.
- React Router.
- Vite.
- Tailwind CSS.
- Vitest + Testing Library.
- Firebase Auth.
- Cloud Firestore.
- Firebase Storage.
- Cloud Functions for Firebase.
- Firebase Analytics.
- Firebase Performance Monitoring.
- localStorage e IndexedDB para modo local y respaldo operativo.

Comandos principales:

```bash
npm run dev
npm run dev:firebase
npm run lint
npm test -- --run --testTimeout 10000
npm run build
npm run build:firebase
npm run deploy:firebase:rules
npm run deploy:firebase:functions
```

## Roles y permisos

Roles funcionales:

- `superAdmin`: acceso completo.
- `medico`: validacion medica, legajos, dashboard, registro.
- `administrativoSalud`: carga certificados, ve historial medico para evitar duplicados, no valida decisiones medicas.
- `administrativo`: operacion administrativa limitada.
- `respRRHH`: dashboard y registro administrativo.
- `gerente`: consulta de indicadores.

Defensa:

- El acceso visible se controla por navegacion.
- El acceso real se protege por rutas.
- En Firebase, el UID autenticado se cruza con `usuarios/{uid}` para obtener rol funcional.
- Un usuario autenticado sin rol habilitado no puede operar.

## Politicas de seguridad y autenticacion

Implementado:

- Firebase Auth autentica usuarios reales en modo conectado.
- La coleccion `usuarios` define el rol funcional.
- El login local se conserva para contingencia y pruebas.
- Auditoria registra login exitoso/fallido, usuario sin rol, accesos denegados y expiracion de sesion.
- Sesion local expira por inactividad luego de 20 minutos.

Para completar desde chat paralelo:

- Registrar decision final sobre politicas de contrasenas de Firebase/Google Cloud.
- Indicar si se exige longitud minima, complejidad, bloqueo o MFA.
- Documentar si esa politica queda aplicada desde Firebase Console o Google Cloud Identity Platform.

Texto base defendible:

> En modo conectado, la autenticacion se delega en Firebase Auth. El sistema complementa esa identidad con una capa funcional de roles en Firestore. Las politicas de contrasena se administran desde Firebase/Google Cloud, separando autenticacion tecnica de autorizacion funcional.

## Arquitectura de datos Firebase

Colecciones principales:

- `usuarios`: UID, email y rol funcional.
- `empleados`: 80 legajos base del sistema.
- `ausencias`: solicitudes de ausencia registradas.
- `validaciones_medicas`: certificados pendientes, en revision, validados o rechazados.
- `historial_medico`: certificados consolidados luego de decision medica.
- `borradores`: cargas incompletas de ausencia.
- `planes_preventivos`: acciones, seguimientos y recomendaciones.
- `patologias`: catalogo de grupos diagnosticos y riesgo base.
- `parametros_riesgo`: parametros configurables del motor de riesgo.
- `auditoria`: eventos funcionales y tecnicos.
- `operations`: bitacora tecnica de sincronizacion.

Storage:

- Ruta de certificados: `certificados/{reference}/{timestamp}-{archivo}`.
- No se persiste base64 en Firestore.
- Se guarda:
  - `rutaStorage`
  - `downloadUrl`
  - nombre
  - tamano
  - tipoContenido

Reglas de Storage:

- Solo usuarios autenticados.
- Archivos permitidos: PDF, JPG, PNG.
- Tamano maximo: 5 MB.

## Modo local

Implementado:

- Persistencia local con `localStorage` e IndexedDB.
- Seeds controlados para defensa.
- Flujo completo sin Firebase:
  - cargar ausencia
  - validar certificado
  - ver legajo
  - dashboard
  - heatmap
  - notificaciones
- El modo local no se presenta como "demo"; es una contingencia operativa para defensa.

## Modo Firebase

Implementado:

- Login con Firebase Auth.
- Lectura de rol desde `usuarios/{uid}`.
- Hidratacion desde Firestore.
- Persistencia funcional en colecciones en espanol.
- Upload real de certificados a Firebase Storage.
- Realtime listeners con `onSnapshot` para:
  - `validaciones_medicas`
  - `borradores`
- Dos navegadores con usuarios distintos reciben cambios sin recargar pagina completa.

## Flujo de certificados

1. Administrativo o administrativo de salud carga ausencia/certificado.
2. Se crea documento en `validaciones_medicas`.
3. Se crea documento en `ausencias`.
4. El archivo se sube a Storage.
5. El medico ve el pendiente en Validacion Medica.
6. El medico puede:
   - validar
   - rechazar
   - enviar a revision
7. Si se valida:
   - se actualiza `validaciones_medicas`
   - se crea/actualiza `historial_medico`
   - se pueden generar planes preventivos
   - se registra auditoria
8. Si se envia a revision:
   - el administrativo ve la notificacion
   - puede corregir o completar informacion

## Notificaciones

Implementado:

- Campanita en header.
- Notificaciones por pendientes medicos.
- Notificaciones por certificados para revision administrativa.
- Notificaciones por certificados validados/rechazados.
- Notificaciones por borradores.
- Notificaciones por eventos de seguridad para superAdmin.
- Al hacer click se marca como atendida.
- Realtime con Firestore para evitar recarga manual.

Destinos actuales:

- Validaciones pendientes para medico: `/validacion-medica`.
- Certificado en revision: `/registro-ausencia`.
- Certificado rechazado: `/registro-ausencia`.
- Certificado validado: `/legajos-medicos?employeeId=...` si existe empleado.

## Dashboard

Implementado:

- Tasa de ausentismo.
- Riesgo promedio.
- Alertas activas.
- Heatmap por sector.
- Evolucion del riesgo promedio.
- Tabla de empleados con riesgo individual.
- Modal por sector con:
  - certificados validados y pendientes
  - ranking preventivo de grupos diagnosticos frecuentes
  - dias perdidos
  - riesgo promedio del grupo

Ajustes realizados:

- Tooltip/numeros en grafico de evolucion.
- Ranking preventivo corrige `Sin grupo informado` usando el label ya calculado.
- Heatmap alinea estados entre cards y detalle.

## Legajos medicos

Implementado:

- Listado de empleados con orden por apellido/nombre o sector.
- Ficha del empleado.
- Estudios medicos realizados.
- Certificados medicos presentados.
- Filtro por periodo.
- Historial completo.
- Visualizacion de certificado adjunto.
- Soporta certificados locales y certificados recuperados desde Firebase Storage.
- Evita diferencias visibles entre local y Firebase.

## Registro de ausencia

Implementado:

- Carga de empleado.
- Carga de periodo.
- Calculo de dias.
- Grupo diagnostico.
- CIE-10.
- Institucion medica.
- Adjuntos PDF/JPG/PNG hasta 5 MB.
- Borradores.
- Historico visible para evitar duplicados.
- Reanudacion de cargas.
- Certificados en revision enviados por medico.

## Validacion medica

Implementado:

- Cola de certificados pendientes.
- Revision profesional en modal.
- Visualizacion de documento.
- Validacion, rechazo o envio a revision.
- Riesgo sugerido y ajustable.
- Planes preventivos.
- Auditoria de decision medica.
- Historial medico consolidado.

## Motor de riesgo

Implementado:

- Motor puro compartido por frontend y Functions: `functions/src/riskEngine.js`.
- Lee parametros configurables:
  - umbrales de riesgo
  - dias de duracion
  - recurrencias
  - bonos/factores
  - ventana de evaluacion
- Lee patologias desde Firestore.
- Calcula:
  - puntaje
  - nivel Baja/Media/Alta
  - descriptor
  - perfil detectado

Cloud Functions:

- Function: `recalcularRiesgoValidacionMedica`.
- Trigger: `validaciones_medicas/{reference}`.
- Version actual del procesamiento: `risk-engine-v2`.
- Lee `patologias`.
- Lee `parametros_riesgo/global`.
- Calcula recurrencias por empleado y grupo diagnostico en ventana movil.
- Escribe en `validaciones_medicas`:
  - `riesgoPuntaje`
  - `riesgoNivel`
  - `riesgoDescriptor`
  - `riesgoPerfilDetectado`
  - `riesgoCalculadoPor: "cloud-functions"`
  - `riesgoRecurrencias`
  - `riesgoVentanaMeses`
  - `procesamientoRiesgo`
- Si el certificado esta validado, sincroniza riesgo en `historial_medico`.
- Registra evento `riesgo_recalculado_backend` en `auditoria`.

## Auditoria

Eventos relevantes:

- `login_success`
- `login_failed`
- `user_role_missing`
- `route_denied`
- `session_expired`
- `certificate_submitted`
- `certificate_upload_success`
- `certificate_upload_failed`
- `certificate_decision`
- `firebase_hydration_success`
- `firebase_hydration_failed`
- `firebase_realtime_sync_failed`
- `riesgo_recalculado_backend`

Defensa:

> La auditoria permite reconstruir acciones funcionales y tecnicas: quien ingreso, que certificado se cargo, que decision tomo el medico, si fallo una sincronizacion y cuando el backend recalculo riesgo.

## Cloud Functions

Etapas:

1. Etapa 1 - Function inicial y auditoria backend: completada.
2. Etapa 2 - Motor de riesgo backend con patologias, parametros y recurrencia: completada.
3. Etapa 2.5 - Migrar runtime Node 20 a Node 22: pendiente.
4. Etapa 3 - Alertas consolidadas backend: pendiente.
5. Etapa 4 - Documentacion tecnica para defensa: en progreso.
6. Etapa 5 - Validacion final y merge: pendiente.

Pendiente Node 22:

- `functions/package.json` usa Node 20.
- Firebase aviso que Node 20 esta deprecado desde 2026-04-30 y sera retirado el 2026-10-30.
- Migrar a Node 22.
- Actualizar `firebase-functions` si corresponde.
- Volver a ejecutar:

```bash
npm --prefix functions run lint
npm run deploy:firebase:functions
```

## Reglas Firebase

Firestore:

- Control de lectura/escritura por autenticacion y roles.
- Datos clinicos restringidos a `superAdmin`, `medico`, `administrativoSalud`.
- Colecciones funcionales definidas en espanol.

Storage:

- Certificados solo para usuarios autenticados.
- Ruta esperada: `certificados/{reference}/{archivo}`.
- Maximo 5 MB.
- Tipos permitidos: `application/pdf`, `image/jpeg`, `image/png`.

## Observabilidad

Implementado/parcial:

- Firebase Analytics integrado como base de metricas funcionales.
- Firebase Performance Monitoring integrado para mediciones de rendimiento.
- Cloud Functions registra logs mediante Firebase/Google Cloud Logging.
- Auditoria en Firestore complementa los logs tecnicos con eventos funcionales.

Pendiente para cierre:

- Documentar pasos exactos para verificar logs en Google Cloud Logs Explorer.
- Documentar eventos utiles en Analytics.
- Confirmar que Performance no genera errores ni ruido en modo desarrollo.

## Pruebas ejecutadas habitualmente

```bash
npm run lint
npm test -- --run --testTimeout 10000
npm run build
npm run build:firebase
npm --prefix functions run lint
npm run deploy:firebase:functions
```

Nota: en Codex, Vite/esbuild a veces falla dentro del sandbox con acceso denegado a `vite.config.js`; en esos casos se repite con ejecucion normal autorizada. No es fallo del proyecto.

## Commits relevantes recientes

- `Fortalece calculo de riesgo en Cloud Functions`
- `Actualiza notificaciones en tiempo real`
- `Corrige ranking de grupos diagnosticos`
- `Ajusta destino de notificaciones medicas`
- `Corrige recepcion de certificados medicos`
- `Normaliza textos enviados a Firestore`

## Decisiones pendientes para completar desde chats paralelos

Agregar aqui cualquier decision tomada fuera de este chat:

- Politicas de contrasena:
  - Requisitos:
  - Lugar de configuracion:
  - Capturas o evidencia:
  - Impacto en defensa:

- MFA / segundo factor:
  - Se implementa:
  - Se documenta como evolucion:

- App Check:
  - Se implementa:
  - Se documenta como evolucion:

- Alertas backend:
  - Coleccion elegida:
  - Campos:
  - Pantallas que consumen:

- Node 22:
  - Fecha de migracion:
  - Resultado deploy:
  - Warnings remanentes:

## Frases de defensa rapida

- "El sistema no diagnostica; prioriza y brinda trazabilidad para la decision profesional."
- "La recurrencia se calcula por grupo diagnostico, empleado y ventana movil."
- "Firebase Auth resuelve identidad; Firestore `usuarios` resuelve rol funcional."
- "Cloud Functions mueve la logica sensible al backend y deja evidencia auditable."
- "El modo local permite continuidad operativa y defensa aun sin conectividad."
- "Los certificados se almacenan en Storage; Firestore conserva solo metadatos y URL."
- "Las reglas de seguridad refuerzan del lado servidor lo que el frontend valida."
