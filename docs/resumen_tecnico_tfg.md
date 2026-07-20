# Resumen tecnico vivo del TFG

Proyecto: DSS para deteccion de riesgos en salud ocupacional.

Objetivo del documento: centralizar decisiones tecnicas, implementaciones cerradas, pendientes y argumentos de defensa. Este archivo debe actualizarse cada vez que se tome una decision relevante en este chat o en chats paralelos.

## Estado general

- Rama actual de endurecimiento local-first: `feature/offline-first`, derivada de `feature/cloud-functions`.
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
- Cada evento contabilizado debe tener riesgo individual medio o alto.
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
- La cuenta de ejecucion de esa funcion posee el rol IAM minimo `Firebase Authentication Admin` (`roles/firebaseauth.admin`) para consultar y actualizar usuarios de Firebase Auth.
- Flujo de migracion validado de punta a punta: cambio de correo manteniendo UID y rol, sincronizacion entre Authentication y `usuarios/{uid}`, recepcion del correo de restablecimiento, cambio de contrasena e inicio de sesion con el nuevo correo y la nueva credencial.
- El login local se conserva para contingencia y pruebas.
- Auditoria registra login exitoso/fallido, usuario sin rol, accesos denegados y expiracion de sesion.
- Los eventos anteriores a la autenticacion, como credenciales invalidas, se conservan localmente y no intentan escribir anonimamente en Firestore; la evidencia remota de Firebase Auth se consulta en Cloud Logging.
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

- Ruta idempotente de certificados: `certificados/{reference}/{operationId}-{archivo}`.
- No se persiste base64 en Firestore.
- Se guarda:
  - `rutaStorage`
  - `downloadUrl` solo en registros historicos
  - nombre
  - tamano
  - tipoContenido
- Los certificados nuevos se recuperan mediante el SDK autenticado y una URL temporal en memoria.

Reglas de Storage:

- Lectura clinica: `superAdmin`, `medico` y `administrativoSalud`.
- Carga operativa: `superAdmin`, `medico`, `administrativo`, `administrativoSalud` y `respRRHH`.
- Cada objeto registra el UID del cargador; solo ese usuario puede reintentar o reemplazar la misma ruta.
- Eliminacion exclusiva de `superAdmin`.
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

## Local-First / Offline-First

Implementado:

- Firestore utiliza cache en memoria y no persiste documentos clinicos de forma legible entre sesiones.
- IndexedDB conserva temporalmente los contenidos pendientes cifrados con AES-GCM y una clave no extraible de Web Crypto.
- `localStorage` conserva solo metadatos de la cola: ID, tipo, estado, propietario, reintentos y referencias al contenido cifrado.
- La cola no guarda payloads clinicos ni archivos base64 legibles y procesa operaciones en orden cronologico.
- Los adjuntos pendientes tambien se cifran; se eliminan junto con el payload al completar la sincronizacion.
- El sincronizador reacciona al evento `online` y usa backoff exponencial de 5 segundos a 5 minutos, con ocho intentos automaticos.
- Las operaciones tienen ID idempotente, propietario de sesion, version de esquema y estado de conflicto.
- Solo el UID o correo propietario puede procesar una operacion pendiente.
- La ruta de Storage deriva del ID de operacion y evita archivos duplicados por reintentos.
- Firestore recibe `sourceOperationId`, `syncVersion`, `clientUpdatedAt` y timestamp del servidor.
- Politica de conflicto explicita:
  - borradores: ultima escritura
  - decisiones clinicas finales: no se sobrescriben desde una operacion local antigua
- Una hidratacion fallida preserva la ultima cache valida, sin reemplazarla por datos vacios.
- Al cerrar sesion Firebase se limpian historiales, validaciones, planes, borradores, ausencias y alertas detalladas hidratadas; la cola pendiente permanece cifrada y aislada por propietario.
- El build de produccion puede cachear el shell con `VITE_ENABLE_OFFLINE_SHELL=true`.
- Cloud Functions se ejecuta despues de recuperar conectividad y sincronizar Firestore; no se simula su ejecucion offline.

Pruebas automatizadas:

- aislamiento de cola por usuario
- conservacion de operaciones sin conectividad
- backoff exponencial limitado
- conflictos no reintentables
- ausencia general sin creacion de validacion medica
- ausencia de payload clinico legible en `localStorage`

Detalle y guion de prueba: `docs/OFFLINE_FIRST_DEFENSA.md`.

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

La coleccion `ausencias` funciona como proyeccion administrativa: conserva empleado, sector, tipo, periodo, dias y estado, pero no diagnostico, CIE-10, institucion, notas ni adjunto. Estos campos permanecen exclusivamente en las colecciones clinicas protegidas.

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

- Se conserva la composicion visual aprobada en el prototipo del TFG: tres KPI, mapa de calor sectorial, evolucion del riesgo y estado de sincronizacion.
- `Ultima actualizacion` se vincula a una hidratacion Firebase completa y satisfactoria, no a cualquier evento local.
- `Siguiente sync automatica` ejecuta una cuenta regresiva real de 150 segundos hasta la siguiente hidratacion completa.
- Este ciclo es un respaldo de consistencia: convive con listeners Firestore en tiempo real y con la cola Offline-First, que procesa cada 15 segundos y al recuperar conectividad.
- El evento `online` tambien dispara una hidratacion completa inmediata; una ejecucion en curso impide ciclos concurrentes.
- En modo local, el mismo intervalo recarga los repositorios del navegador sin modificar el aspecto presentado al tribunal.

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
3. Etapa 2.5 - Migrar runtime Node 20 a Node 22: completada.
4. Etapa 3 - Alertas consolidadas backend: completada y validada manualmente en Firebase.
5. Etapa 3.5 - Integracion visual de alertas consolidadas: completada y desplegada.
6. Etapa 4 - Documentacion tecnica para defensa: en progreso.
7. Etapa 5 - Validacion final y merge: pendiente.

Migracion Node 22 completada el 18/07/2026:

- `functions/package.json` declara Node 22.
- `firebase-functions` actualizado a `7.3.0`.
- `firebase-admin` actualizado a `14.2.0`.
- Sintaxis e importacion de las Functions verificadas con Node `22.23.1`.
- Deploy realizado con Firebase CLI `15.23.0`.
- `actualizarCorreoUsuario`, `recalcularRiesgoValidacionMedica` y `consolidarAlertasRiesgo` quedaron `ACTIVE`, `gcfv2`, `nodejs22`, en `us-east1`.
- Prueba remota no destructiva de la callable: respondio `HTTP 401 / UNAUTHENTICATED` ante una solicitud anonima, confirmando disponibilidad y control de acceso.
- Regresion local: lint de Functions correcto, lint general correcto y 55 pruebas aprobadas.
- `npm audit --omit=dev` informa siete hallazgos moderados transitivos y ninguno alto o critico. No se aplico la solucion automatica porque propone degradar los SDK principales a versiones incompatibles; queda como riesgo residual monitoreado.

Alertas consolidadas implementadas el 18/07/2026:

- `consolidarAlertasRiesgo` observa cambios en `validaciones_medicas`.
- Consolida por empleado y grupo diagnostico en una ventana movil configurable.
- Activa por tres recurrencias configurables de riesgo individual medio o alto; un certificado aislado de riesgo alto no genera una alerta consolidada.
- Separa el riesgo individual del bono por recurrencia para evitar alertas residuales incorrectas.
- Usa un ID estable en `alertas_riesgo`, evitando duplicados.
- Actualiza evidencia y resuelve automaticamente cuando deja de cumplirse la condicion.
- Registra transiciones en `auditoria` con origen `cloud-functions`.
- Los clientes clinicos pueden leer alertas, pero no crearlas, modificarlas ni eliminarlas.
- No se modifico el frontend en esta etapa; su consumo se evaluara por separado para no alterar la interfaz validada del TFG.
- La prueba manual con tres certificados musculoesqueleticos del mismo empleado genero correctamente la alerta consolidada y sus campos de auditoria.

Integracion visual completada en la etapa 3.5:

- Suscripcion en tiempo real a `alertas_riesgo` en modo Firebase.
- Incorporacion al Panel de Control usando los componentes visuales existentes.
- Separacion conceptual entre pendientes de validacion y alertas de riesgo consolidadas.
- Detalle explicable: recurrencias, ventana movil, motivos, referencias y estado.
- Salud Ocupacional accede al detalle autorizado; RRHH recibe informacion operativa y Gerencia indicadores agregados.
- Equivalencia funcional en modo local sin mostrar al usuario el origen de los datos.
- La tarjeta `Alertas Activas` y el mapa de calor contabilizan alertas consolidadas, no certificados pendientes.
- El modal sectorial reutiliza el diseno existente y explica motivo, recurrencias, ventana, riesgo maximo y referencias.
- Los roles clinicos leen el detalle de `alertas_riesgo`; RRHH y Gerencia leen solo `indicadores_alertas/global`.
- `actualizarIndicadoresAlertas` mantiene la proyeccion agregada sin datos personales y `reconstruirIndicadoresAlertas` permite inicializarla a usuarios autenticados con rol habilitado cuando todavia no existe.
- `alert-summary-v2` incorpora todos los grupos diagnosticos con alertas activas por sector, ordenados por cantidad de alertas y recurrencias dentro de la ventana movil configurada.
- Gerencia puede identificar concentraciones musculoesqueleticas, respiratorias u otros grupos para decidir acciones y presupuesto, sin acceder a empleados, certificados, CIE-10 ni diagnosticos individuales.
- Ejemplos defendibles de decision: revisar puestos ante concentraciones musculoesqueleticas, evaluar campanas de vacunacion ante grupos respiratorios y planificar controles periodicos ante alertas cardiovasculares.
- El motor informa y prioriza patrones; no prescribe acciones medicas. La intervencion concreta requiere evaluacion profesional y autorizacion gerencial.
- Firestore actualiza ambos componentes mediante listeners en tiempo real, sin recargar la pagina.
- El modo local deriva alertas equivalentes desde el historial validado sin exponer el origen de datos en la interfaz.
- No se cambiaron colores, estructura, tipografia ni navegacion del frontend validado.
- Deploy de Functions y reglas completado el 18/07/2026.
- Regresion: lint correcto, 8 pruebas de Functions y 55 pruebas frontend aprobadas; build Firebase correcto.

Indicadores gerenciales agregados implementados el 18/07/2026:

- `actualizarIndicadoresRiesgo` observa `historial_medico` y reconstruye la proyeccion `indicadores_riesgo/global`.
- La proyeccion contiene hasta 36 periodos mensuales con promedio de riesgo, certificados y dias perdidos.
- Cada periodo incluye el mismo desglose agregado por sector para alimentar el mapa de calor.
- No persiste nombres, legajos, diagnosticos, referencias ni documentos medicos.
- `reconstruirIndicadoresRiesgo` permite inicializar datos historicos de forma autenticada y auditable.
- Gerencia visualiza tasa de ausentismo, riesgo promedio, evolucion de 12 meses, alertas y cards sectoriales con el mismo criterio preventivo que Salud Ocupacional.
- Al abrir un sector, Gerencia recibe solo ausencias, dias perdidos y riesgo promedio agregados.
- Los roles clinicos mantienen el acceso al detalle autorizado; no se ampliaron permisos sobre historias medicas.
- Regresion actualizada: 9 pruebas de Functions y 55 pruebas frontend aprobadas.

Comandos de verificacion:

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

- Certificados legibles solo por roles clinicos.
- Los roles operativos pueden cargar archivos sin obtener acceso posterior de consulta clinica.
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
  - Coleccion elegida: `alertas_riesgo`.
  - Campos: empleado, grupo, estado, motivos, recurrencias, ventana, riesgo maximo, referencias y timestamps de ciclo de vida.
  - Pantallas que consumen: agendado para etapa 3.5 en Panel de Control y detalle de alerta, reutilizando el diseno existente.

- Node 22:
  - Fecha de migracion: 18/07/2026.
  - Resultado deploy: ambas Functions activas en `nodejs22`, segunda generacion.
  - Warnings remanentes: siete vulnerabilidades moderadas transitivas reportadas por npm; cero altas y cero criticas.

## Frases de defensa rapida

- "El sistema no diagnostica; prioriza y brinda trazabilidad para la decision profesional."
- "La recurrencia se calcula por grupo diagnostico, empleado y ventana movil."
- "Firebase Auth resuelve identidad; Firestore `usuarios` resuelve rol funcional."
- "Cloud Functions mueve la logica sensible al backend y deja evidencia auditable."
- "El modo local permite continuidad operativa y defensa aun sin conectividad."
- "Los certificados se almacenan en Storage; Firestore conserva solo metadatos y URL."
- "Las reglas de seguridad refuerzan del lado servidor lo que el frontend valida."
