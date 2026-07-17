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

## Restriccion de cambios en el frontend

- El diseno visual y los textos visibles actuales forman parte de la version del TFG ya presentada y validada.
- No se deben modificar estilos, distribucion, componentes visibles, etiquetas, leyendas, mensajes ni flujos de navegacion sin consulta y aprobacion explicita del autor del TFG.
- Las mejoras tecnicas deben conservar la interfaz existente. Si una correccion requiere un cambio perceptible, primero se debe explicar el motivo, el impacto y la alternativa propuesta.
- Esta restriccion tambien aplica al trabajo realizado en chats o tareas paralelas.
- Las pruebas automatizadas pueden reforzarse para proteger esta estabilidad visual y funcional, pero no deben introducir cambios visibles por si mismas.

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
- Firestore no almacena contrasenas ni hashes de contrasena. Las credenciales son responsabilidad exclusiva de Firebase Auth.
- Los documentos `usuarios/{uid}` se limitan por reglas a UID, email, nombre visible, rol y marcas de tiempo.
- Cloud Function callable `actualizarCorreoUsuario`: permite al `superAdmin` migrar un correo ficticio a uno accesible conservando el UID, sincroniza Authentication y Firestore, revierte Authentication ante fallo de persistencia y registra auditoria.
- El login local se conserva para contingencia y pruebas.
- Auditoria registra login exitoso/fallido, usuario sin rol, accesos denegados y expiracion de sesion.
- Sesion local expira por inactividad luego de 20 minutos.
- Modulo reutilizable de politica de contrasena para alta o restablecimiento.
- Bloqueo temporal local luego de 5 intentos fallidos por usuario.
- Auditoria de bloqueo por intentos reiterados mediante `login_blocked`.

Decision de implementacion para politicas de contrasena:

- La politica fuerte debe configurarse en Firebase Authentication / Google Cloud Identity Platform, no solo en el frontend.
- Requisitos consignados por el TFG:
  - minimo 8 caracteres
  - al menos una mayuscula
  - al menos una minuscula
  - al menos un numero
  - al menos un simbolo
- Configuracion esperada en Identity Platform:
  - `minLength: 8`
  - `requireUppercase: true`
  - `requireLowercase: true`
  - `requireNumeric: true`
  - `requireNonAlphanumeric: true`
  - modo `ENFORCE` para rechazar contrasenas que no cumplan
- El frontend debe acompanar con validacion visual de requisitos en pantallas de alta, primer acceso o restablecimiento de contrasena, pero no en el login normal.
- Se puede usar `validatePassword(auth, password)` en el cliente si se implementan formularios de alta o cambio de contrasena.
- Se registran intentos fallidos en auditoria.
- Se implemento bloqueo temporal local ante 5 fallos consecutivos.
- MFA se evaluara para roles sensibles:
  - recomendado obligatorio para `superAdmin`
  - recomendado obligatorio o progresivo para `medico`
  - opcional/progresivo para `administrativoSalud`
- Las contrasenas comprometidas se documentan como control complementario avanzado:
  - posible integracion con servicio externo tipo Have I Been Pwned usando k-anonymity
  - posible uso de Blocking Functions para impedir login/registro
  - nunca guardar ni loguear contrasenas

Texto base defendible:

> En modo conectado, la autenticacion se delega en Firebase Auth. El sistema complementa esa identidad con una capa funcional de roles en Firestore. Las politicas de contrasena se administran desde Firebase/Google Cloud, separando autenticacion tecnica de autorizacion funcional.

Orden recomendado de implementacion:

1. Activar politica de contrasenas en Firebase/Identity Platform.
2. Agregar validacion visual en frontend. Preparado como modulo; pendiente de aplicar en alta/restablecimiento.
3. Registrar intentos fallidos en auditoria. Completado.
4. Agregar bloqueo temporal local por intentos. Completado.
5. Evaluar MFA para roles sensibles.
6. Dejar contrasenas comprometidas como mejora con servicio externo o Blocking Function si el tiempo alcanza.

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
- `login_failure`
- `login_blocked`
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
  - Requisitos: minimo 8 caracteres, mayuscula, minuscula, numero y simbolo.
  - Lugar de configuracion: Firebase Authentication / Google Cloud Identity Platform.
  - Modo sugerido: `ENFORCE`.
  - Complemento frontend: modulo de checklist preparado; no se muestra en el login normal.
  - Auditoria: intentos fallidos y bloqueo registrados.
  - Bloqueo temporal local: implementado, 5 fallos consecutivos bloquean 15 minutos.
  - Capturas o evidencia: pendiente.
  - Impacto en defensa: alinea el sistema con la memoria del TFG y separa autenticacion backend de autorizacion funcional.

- MFA / segundo factor:
  - Se implementa: pendiente de decidir.
  - Recomendacion: obligatorio para `superAdmin` y `medico`; progresivo u opcional para `administrativoSalud`.
  - Base tecnica: Firebase Auth / Identity Platform MFA para web.
  - Se documenta como evolucion: si no se alcanza a activar completamente antes de la defensa.

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
