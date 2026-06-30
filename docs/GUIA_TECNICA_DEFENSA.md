# Guia tecnica de defensa del sistema

Proyecto: DSS para deteccion de riesgos en salud ocupacional  
Objetivo de la guia: ayudarte a entender, explicar y defender el sistema desde el codigo, la arquitectura y el flujo funcional.

## 1. Idea central para defender

El sistema es un **Sistema de Soporte a la Decision (DSS)** aplicado a salud ocupacional. No diagnostica enfermedades. Registra ausencias, permite validacion medica, consolida certificados en legajos y detecta patrones de recurrencia para priorizar acciones preventivas.

Frase recomendada:

> El sistema no reemplaza al medico laboral. Organiza informacion, detecta recurrencias y prioriza casos para que el profesional tome decisiones con mejor trazabilidad.

Puntos clave:

- El diagnostico lo realiza el profesional medico.
- El sistema calcula indicadores operativos de riesgo.
- Las alertas son senales de priorizacion, no conclusiones clinicas.
- La regla fuerte del TFG es la recurrencia: 3 eventos del mismo grupo diagnostico dentro de una ventana movil de 6 meses.

## 2. Stack tecnologico

Tecnologias principales:

- React 19: construccion de interfaz.
- React Router: navegacion y rutas protegidas.
- Vite: servidor de desarrollo y build.
- Tailwind CSS: estilos utilitarios.
- Vitest: pruebas automatizadas.
- Testing Library: pruebas de comportamiento de interfaz.
- localStorage: persistencia local inmediata.
- IndexedDB: persistencia local mas robusta.

Comandos importantes:

```bash
npm install
npm run dev
npm run test
npm run lint
npm run build
```

Como explicarlo:

> Se eligio React porque permite construir una SPA modular por pantallas. Vite simplifica el entorno de desarrollo y build. La persistencia local con localStorage e IndexedDB permite ejecutar el sistema sin depender de conectividad, y deja preparada una evolucion futura hacia Firebase o un backend remoto.

## 3. Arquitectura general

Punto de entrada:

- `src/main.jsx`: monta la aplicacion React, carga estilos y registra seeds de demostracion.
- `src/App.jsx`: define rutas, roles, autenticacion, tema y sincronizacion de cola.

Capas principales:

- `src/pages`: pantallas funcionales.
- `src/components`: componentes reutilizables.
- `src/context`: contexto de autenticacion.
- `src/data`: datos base simulados.
- `src/utils`: reglas de negocio, almacenamiento, cola y planes.
- `src/demo`: datos controlados para demostracion.
- `src/pages/tests`: pruebas automatizadas.

Rutas principales:

- `/`: login.
- `/dashboard`: Panel de Control.
- `/registro-ausencia`: Registro de Ausencia.
- `/certificados-medicos`: carga simple de certificados.
- `/validacion-medica`: validacion profesional.
- `/legajos-medicos`: historial y legajo del empleado.

## 4. Control de roles

Archivo principal: `src/App.jsx`

Roles:

- `superAdmin`: acceso completo.
- `medico`: acceso completo operativo.
- `administrativo`: registra ausencias, carga documentacion y consulta dashboard operativo.
- `administrativoSalud`: registra ausencias, carga documentacion y consulta legajos/certificados historicos por pertenecer al circuito de salud ocupacional, sin validar decisiones medicas.
- `gerente`: consulta dashboard de indicadores y tendencias.
- `respRRHH`: consulta dashboard y registra informacion administrativa de ausencias.

Patron utilizado:

- `AuthContext` mantiene usuario, rol, rutas permitidas y logout.
- `ProtectedRoute` bloquea rutas segun rol.
- `ROLE_PERMISSIONS` define navegacion visible.
- `ROUTE_ACCESS` define proteccion real de rutas.

Como defenderlo:

> La seguridad funcional esta separada entre navegacion y proteccion de rutas. Aunque un usuario escriba una URL manualmente, `ProtectedRoute` valida si su rol esta autorizado.

La restriccion sobre legajos medicos se mantiene alineada con la memoria: `superAdmin`, `medico` y `administrativoSalud` pueden consultar legajos porque forman parte del circuito sanitario. El rol `administrativoSalud` solo consulta antecedentes y certificados historicos para evitar duplicados o inconsistencias de carga; no accede a la validacion medica ni puede aprobar, rechazar o modificar decisiones clinicas. Los perfiles administrativo general, RRHH y gerencia quedan limitados a informacion operativa segun su funcion.

## 5. Flujo funcional completo

### 5.1 Registro de Ausencia

Archivo: `src/pages/RegisterAbsence.jsx`

Responsabilidad:

- Seleccionar empleado.
- Autocompletar legajo, puesto y sector.
- Registrar fechas.
- Calcular dias.
- Seleccionar tipo de ausencia y grupo diagnostico.
- Adjuntar certificado.
- Persistir la solicitud en cola de validacion.

Persistencia:

- Usa `upsertValidationEntry` de `src/utils/validationStorage.js`.
- Guarda en `localStorage`.
- Replica en IndexedDB.
- Dispara evento `medical-validations-updated`.

Como explicarlo:

> Registro de Ausencia no valida clinicamente. Genera una entrada pendiente para que luego sea revisada por el area medica.

### 5.2 Validacion Medica

Archivo: `src/pages/MedicalValidation.jsx`

Responsabilidad:

- Leer certificados pendientes.
- Filtrar por estado, prioridad o busqueda.
- Revisar detalle medico-administrativo.
- Aprobar, rechazar o marcar en revision.
- Asignar score de riesgo.
- Registrar observaciones.
- Crear o editar plan preventivo.
- Enviar el resultado al historial del empleado.

Funciones clave:

- `persistUpdatedEntry`: actualiza la entrada validada.
- `appendEmployeeHistory`: agrega el certificado al historial medico.
- `saveEmployeePlan`: persiste plan preventivo.
- `enqueueOperation`: registra operacion pendiente de sincronizacion.

Como defenderlo:

> La validacion medica es el punto donde interviene el criterio profesional. El sistema puede sugerir riesgo, pero el medico puede revisar, documentar y ajustar la decision.

### 5.3 Legajos Medicos

Archivo: `src/pages/MedicalRecords.jsx`

Responsabilidad:

- Mostrar ficha del empleado.
- Buscar empleado por nombre.
- Ver estudios ocupacionales.
- Ver certificados medicos presentados.
- Combinar certificados pendientes y certificados historicos.
- Permitir ver documentos adjuntos si existen.
- Mostrar listado de empleados ordenable por apellido/nombre o sector.

Fuentes de datos:

- `readEmployeeHistory`: certificados validados/historicos.
- `readValidationQueue`: certificados pendientes o en revision.

Comportamiento importante:

- Deduplica por referencia.
- Prioriza estado mas avanzado.
- Escucha cambios de storage para actualizarse sin recargar.

Como defenderlo:

> El legajo funciona como vista consolidada del colaborador. No solo muestra documentos validados, tambien permite ver certificados pendientes relacionados al empleado.

### 5.4 Panel de Control

Archivo: `src/pages/Dashboard.jsx`

Responsabilidad:

- Mostrar metricas generales.
- Mapa de calor por sector.
- Evolucion del riesgo promedio.
- Tabla de empleados con riesgo individual.
- Historial y plan preventivo desde el panel.

Datos que consume:

- Cola de validaciones.
- Historial medico.
- Planes preventivos.
- Base de empleados.

Regla importante:

- La tabla **Empleados con riesgo individual** muestra empleados con 3 eventos del mismo grupo diagnostico dentro de 6 meses.

Como defenderlo:

> El dashboard no diagnostica. Resume informacion validada y pendiente para priorizar la gestion preventiva. La tabla individual aparece solo cuando hay recurrencia suficiente para justificar seguimiento.

## 6. Regla de riesgo individual

Archivo: `src/pages/Dashboard.jsx`

Concepto:

- Agrupa eventos por empleado.
- Agrupa tambien por grupo diagnostico.
- Cuenta eventos dentro de ventana movil de 6 meses.
- Si hay 3 o mas eventos del mismo grupo, aparece en la tabla.

Funciones relacionadas:

- `resolveOccurrenceTimestamp`
- `countOccurrencesInRollingWindow`
- `resolvePathologyLabel`
- `dynamicEmployees`

Defensa tecnica:

> No alcanza con que un empleado tenga 3 certificados cualquiera. Deben pertenecer al mismo grupo diagnostico y estar dentro de la ventana movil de 6 meses. Esto evita falsos positivos por ausencias aisladas o no relacionadas.

Ejemplo defendible:

- Febrero: lumbalgia.
- Abril: lumbalgia.
- Junio: lumbalgia.
- Resultado: recurrencia musculoesqueletica y necesidad de plan preventivo.

## 7. Calculo de riesgo

Archivo: `src/utils/riskUtils.js`

Funciones:

- `calculateRiskScore`: calcula score desde tipo de ausencia y motivo.
- `mapScoreToRisk`: convierte numero en nivel Alta, Media o Baja.

Rangos:

- Alta: 7.0 a 10.0.
- Media: 5.0 a 6.9.
- Baja: menor a 5.0.

Datos base:

- `src/data/riskProfiles.js` define perfiles y palabras clave.
- `defaultRiskScore` actua como fallback.

Variables consideradas:

- Motivo o descripcion del certificado.
- Grupo diagnostico.
- Duracion de la ausencia.
- Frecuencia/recurrencia cuando el contexto la informa.

Como defenderlo:

> El score no pretende ser diagnostico medico. Es una ponderacion operativa que combina motivo, grupo diagnostico, duracion y recurrencia disponible para ordenar prioridades. El medico puede confirmarlo o ajustarlo durante la validacion.

## 8. Mapa de calor por sector

Archivo: `src/pages/Dashboard.jsx`

Muestra:

- Headcount activo.
- Cantidad de certificados validados.
- Cantidad de alertas pendientes.
- Riesgo promedio.
- Tasa de ausentismo estimada.

Estados posibles:

- Sin datos.
- Alertas pendientes.
- Riesgo bajo.
- Riesgo medio.
- Riesgo medio + alertas.
- Riesgo alto.
- Riesgo alto + alertas.

Detalle del modal:

- Muestra certificados validados y pendientes del sector.
- No oculta certificados de bajo riesgo.
- Distingue `Validado` y `En cola`.

Como defenderlo:

> El mapa de calor permite observar concentracion de riesgo por sector. Es util para detectar si un problema es individual, sectorial o documental.

## 9. Evolucion del riesgo promedio

Archivo: `src/pages/Dashboard.jsx`

Muestra:

- Promedio mensual de riesgo de los ultimos 12 meses.
- Tooltip por mes con valor promedio y cantidad de certificados.
- Meses sin datos aparecen como `Sin certificados`.

Como defenderlo:

> La linea permite ver tendencia, no diagnostico. El tooltip evita sobrecargar el grafico y permite explicar de donde sale cada punto.

## 10. Almacenamiento local

Archivos:

- `src/utils/validationStorage.js`
- `src/utils/historyStorage.js`
- `src/utils/planStorage.js`
- `src/utils/draftStorage.js`
- `src/utils/indexedDbClient.js`
- `src/utils/storageKeys.js`

Patron utilizado:

1. Leer desde `localStorage`.
2. Sincronizar con IndexedDB.
3. Guardar cambios en ambos.
4. Disparar eventos custom para refrescar pantallas.

Eventos importantes:

- `medical-validations-updated`
- `medical-history-updated`
- `preventive-plans-updated`
- `absence-drafts-updated`
- `operation-queue-updated`

Como defenderlo:

> localStorage da lectura rapida y simple. IndexedDB permite persistencia mas robusta. Los eventos custom mantienen sincronizadas las pantallas dentro de la SPA.

## 10.1 Seguridad operativa implementada

Archivo principal: `src/App.jsx`

Controles implementados para el prototipo:

- Politica de contrasena segura en login: minimo 8 caracteres, mayusculas, minusculas, numeros y simbolos.
- Expiracion de sesion tras 20 minutos de inactividad.
- Limpieza de sesion persistida al cerrar sesion o expirar.
- Auditoria local de eventos criticos.

Archivo de auditoria:

- `src/utils/auditLog.js`

Eventos auditados:

- `login_success`
- `logout`
- `session_expired`
- `route_denied`
- `absence_submitted`
- `certificate_decision`

Como defenderlo:

> Para el alcance local del prototipo, la auditoria se registra en almacenamiento local. En una version Firebase, estos eventos deberian persistirse en Firestore o Logging/Monitoring con reglas de acceso y retencion.

## 11. Cola de operaciones

Archivo: `src/utils/operationQueue.js`

Responsabilidad:

- Registrar operaciones pendientes.
- Procesarlas periodicamente.
- Mantenerlas si no hay conexion.
- Simular sincronizacion remota.

Funciones:

- `enqueueOperation`
- `processQueue`
- `startQueueSync`
- `clearOperationQueue`

Como defenderlo:

> La cola prepara el sistema para funcionar de forma tolerante a desconexion. Hoy simula sincronizacion, pero el patron permite reemplazar el handler por llamadas a Firebase o API REST.

## 12. Planes preventivos

Archivos:

- `src/utils/preventivePlan.js`
- `src/utils/planStorage.js`

Responsabilidad:

- Generar plantillas segun nivel de riesgo.
- Permitir edicion profesional.
- Guardar plan asociado al empleado.
- Mostrar acciones, seguimientos y recomendaciones.

Como defenderlo:

> El plan preventivo transforma una alerta en accion concreta. Esa es la parte mas importante del DSS: no solo detecta, tambien orienta intervenciones.

## 13. Datos base y seed

Archivos:

- `src/data/mockEmployees.js`
- `src/data/mockUsers.js`
- `src/data/pathologyCategories.js`
- `src/data/riskProfiles.js`
- `src/demo/demoSeed.js`

`mockEmployees.js`:

- Genera 80 empleados deterministas.
- Distribuye por sectores.
- Incluye legajo, puesto, antiguedad, email, telefono y estado activo.

`demoSeed.js`:

- Crea escenarios controlados.
- Permite mostrar el sistema con datos defendibles.
- La recurrencia musculoesqueletica esta ubicada en Produccion.
- Areas de oficina tienen casos administrativos, respiratorios o preventivos.

Como defenderlo:

> El seed no intenta representar una empresa real completa. Crea casos pedagogicos para demostrar reglas del sistema de forma verificable.

## 14. Pruebas automatizadas

Herramientas:

- Vitest.
- Testing Library.
- jsdom.

Archivos:

- `src/pages/tests/Dashboard.test.jsx`
- `src/pages/tests/RegisterAbsence.test.jsx`
- `src/pages/tests/MedicalValidation.test.jsx`
- `src/pages/tests/MedicalRecords.test.jsx`
- `src/pages/tests/MedicalFlow.integration.test.jsx`
- `src/pages/tests/Login.test.jsx`
- `src/pages/tests/MedicalCertificate.test.jsx`

Cobertura importante:

- Login y roles.
- Navegacion protegida.
- Registro de ausencia.
- Validacion medica.
- Flujo integrado Registro -> Validacion.
- Legajos actualizados desde storage.
- Dashboard, heatmap y tabla de riesgo individual.
- Recurrencia de 3 eventos del mismo grupo diagnostico.

Comandos:

```bash
npm run test
npm run lint
npm run build
```

Estado actual validado:

- 47 tests pasan.
- Build correcto.
- Lint sin errores.

## 15. Patrones usados

### Componentes por pantalla

Cada modulo funcional grande vive en `src/pages`.

Ventaja:

- Facil de navegar.
- Cada pantalla mantiene su propio estado.
- Se reduce acoplamiento visual.

### Utilidades para reglas compartidas

Reglas como riesgo, storage, planes y cola estan en `src/utils`.

Ventaja:

- Evita duplicacion.
- Facilita pruebas.
- Permite cambiar implementacion sin reescribir pantallas.

### Eventos custom

El sistema dispara eventos cuando cambia una entidad del almacenamiento.

Ventaja:

- Dashboard, Legajos y Validacion pueden refrescarse sin recargar.

### Local-first

El sistema funciona localmente y sincroniza cuando puede.

Ventaja:

- Es robusto para una defensa o demo.
- Permite evolucion futura a Firebase.

### Role-based access

Las rutas dependen del rol.

Ventaja:

- El usuario ve solo las secciones que necesita.
- El acceso real tambien se valida en las rutas.

## 16. Como estudiar el codigo por etapas

### Etapa 1: mapa mental

Leer:

1. `src/main.jsx`
2. `src/App.jsx`
3. `src/context/AuthContext.jsx`
4. `src/components/AppHeader.jsx`

Objetivo:

- Entender como arranca la app.
- Entender rutas, roles y tema.

Practica:

- Explicar que pasa al iniciar sesion.
- Explicar que pasa si un rol no autorizado entra a `/validacion-medica`.

### Etapa 2: flujo operativo

Leer:

1. `src/pages/RegisterAbsence.jsx`
2. `src/utils/validationStorage.js`
3. `src/pages/MedicalValidation.jsx`
4. `src/utils/historyStorage.js`

Objetivo:

- Entender como una ausencia se convierte en certificado pendiente.
- Entender como pasa a historial validado.

Practica:

- Registrar ausencia.
- Ir a Validacion Medica.
- Aprobar certificado.
- Revisar Legajos.

### Etapa 3: decision y riesgo

Leer:

1. `src/utils/riskUtils.js`
2. `src/data/riskProfiles.js`
3. `src/pages/Dashboard.jsx`

Objetivo:

- Entender score.
- Entender heatmap.
- Entender tabla de riesgo individual.

Practica:

- Ejecutar `window.runDemoSeed()`.
- Explicar por que Produccion aparece con riesgo.
- Explicar por que un pendiente no es diagnostico.

### Etapa 4: legajos

Leer:

1. `src/pages/MedicalRecords.jsx`
2. `src/utils/historyStorage.js`
3. `src/utils/validationStorage.js`

Objetivo:

- Entender consolidacion por empleado.
- Entender certificados pendientes vs validados.

Practica:

- Buscar empleado.
- Abrir listado.
- Ordenar por sector.
- Ver certificados presentados.

### Etapa 5: persistencia y sincronizacion

Leer:

1. `src/utils/indexedDbClient.js`
2. `src/utils/operationQueue.js`
3. `src/utils/storageKeys.js`

Objetivo:

- Entender modo local.
- Entender preparacion para sincronizacion futura.

Practica:

- Explicar que pasa si no hay internet.
- Explicar como se reemplazaria el handler por Firebase.

### Etapa 6: testing

Leer:

1. `src/pages/tests/MedicalFlow.integration.test.jsx`
2. `src/pages/tests/Dashboard.test.jsx`
3. `src/pages/tests/MedicalValidation.test.jsx`

Objetivo:

- Entender que comportamientos estan protegidos.
- Usar tests como argumento tecnico.

Practica:

- Ejecutar `npm run test`.
- Explicar un test de flujo integrado.
- Explicar el test de recurrencia.

## 17. Preguntas probables y respuestas

### Por que React?

Porque el sistema requiere multiples vistas interactivas, estado local, filtros, modales, roles y actualizacion dinamica. React permite organizar eso en componentes y pantallas.

### Por que no se uso backend?

Porque esta version prioriza ejecucion local y demostracion funcional. La arquitectura local-first permite trabajar sin conexion y deja preparada la sincronizacion mediante cola de operaciones.

### Que deberia cambiar para Firebase?

- Reemplazar persistencia local por Firestore/Auth/Storage.
- Mantener interfaces de almacenamiento similares.
- Cambiar el handler de `operationQueue`.
- Reemplazar usuarios mock por Firebase Auth.
- Guardar certificados adjuntos en Firebase Storage.
- Persistir auditoria en Firestore/Logging.
- Implementar MFA y JWT reales mediante Firebase Authentication.
- Mover reglas sensibles y alertas criticas a Cloud Functions.

### El sistema diagnostica?

No. Clasifica, organiza y prioriza. El diagnostico y la decision final corresponden al profesional medico.

### Como se calcula el riesgo?

Se calcula con reglas basadas en perfiles de riesgo y palabras clave, o mediante score manual ingresado por el medico. El numero se traduce a nivel Bajo, Medio o Alto.

### Por que 3 eventos en 6 meses?

Porque representa una recurrencia suficiente para diferenciar eventos aislados de un patron que amerita seguimiento preventivo.

### Que evita falsos positivos?

- Agrupacion por empleado.
- Agrupacion por grupo diagnostico.
- Ventana movil de 6 meses.
- Validacion medica antes de consolidar decisiones.

### Que pasa con certificados pendientes?

Se muestran como alertas o cola de revision. No se tratan como diagnostico validado.

### Como se garantiza trazabilidad?

Cada certificado tiene referencia, empleado, sector, fechas, estado, observaciones, documento y profesional revisor cuando aplica.

### Como se prueba que funciona?

Con pruebas automatizadas que cubren login, roles, registro, validacion, legajos, dashboard y flujo integrado. Actualmente pasan 47 tests.

## 18. Guion de demo recomendado

1. Iniciar sesion.
2. Mostrar rutas disponibles segun rol.
3. Ir a Registro de Ausencia.
4. Cargar una ausencia con certificado.
5. Ir a Validacion Medica.
6. Buscar el certificado.
7. Aprobarlo con observaciones y score.
8. Ir a Legajos Medicos.
9. Buscar el empleado y mostrar certificado presentado.
10. Ir al Panel de Control.
11. Explicar heatmap.
12. Explicar evolucion de riesgo.
13. Explicar tabla de empleados con riesgo individual.
14. Ejecutar seed si hace falta para mostrar recurrencia controlada.

Frase final:

> El valor del sistema esta en cerrar el circuito: registro, validacion, historial, analitica y accion preventiva.

## 19. Puntos fuertes para mencionar

- Flujo completo de punta a punta.
- Separacion por roles.
- Trazabilidad por certificado.
- Consolidacion en legajos.
- Regla de recurrencia defendible.
- Visualizacion por sector.
- Plan preventivo asociado al riesgo.
- Persistencia local robusta.
- Preparacion para sincronizacion futura.
- Tests automatizados.

## 20. Limitaciones honestas

Conviene reconocerlas si preguntan:

- No usa backend real en esta version.
- El score es heuristico, no modelo clinico.
- Los datos de demo son simulados.
- La autenticacion actual es mock.
- El sistema requiere integracion futura con Firebase para produccion real.

Como decirlo:

> Para el alcance del TFG se implemento un prototipo funcional local-first, con arquitectura preparada para evolucionar a Firebase. La prioridad fue validar el flujo de soporte a la decision y la trazabilidad de datos.

## 21. Checklist antes de defender

Antes de la presentacion:

- Ejecutar `npm run test`.
- Ejecutar `npm run build`.
- Probar login.
- Probar Registro de Ausencia.
- Probar Validacion Medica.
- Probar Legajos.
- Probar Dashboard.
- Ejecutar `window.runDemoSeed()` si necesitas datos controlados.
- Tener claro que las alertas no son diagnosticos.
- Practicar explicar la regla de 3 eventos en 6 meses.

## 22. Resumen ejecutivo

El sistema esta estructurado como una SPA React local-first. Implementa registro de ausencias, validacion medica, legajos, panel de control y deteccion de recurrencias. Usa almacenamiento local con respaldo en IndexedDB y una cola preparada para sincronizacion remota. La logica de riesgo es heuristica y opera como soporte a la decision, no como diagnostico. El flujo esta cubierto por pruebas automatizadas y es defendible como prototipo funcional de TFG.
