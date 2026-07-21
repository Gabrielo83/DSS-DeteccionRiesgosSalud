# Matriz de trazabilidad de Historias de Usuario

Fuente: Product Backlog, Historias de Usuario y Sprint Backlog del TFG, paginas 20 a 26.

## Convenciones

- **Cumple**: el criterio tiene implementacion y evidencia automatizada o manual registrada.
- **Cumple con ajuste**: se conserva el objetivo, pero la implementacion aplica una precision de seguridad o alcance.
- **Parcial justificado**: una parte literal del criterio no se implementa porque produciria un estado ambiguo o inseguro; se documenta la alternativa.

## HU-001 - Autenticacion y gestion de roles

| Criterio del TFG | Resultado implementado | Codigo principal | Prueba o evidencia | Estado |
|---|---|---|---|---|
| Credenciales validas permiten acceder y redirigen segun rol. | En local se validan usuarios demo; en Firebase se usa Authentication, se obtiene el perfil `usuarios/{uid}` y se habilitan rutas por rol. | `src/pages/Login.jsx:65`, `src/utils/firebaseAuth.js`, `src/App.jsx:22`, `src/App.jsx:275` | `src/pages/tests/Login.test.jsx` - acceso super admin; prueba manual con usuarios Firebase. | Cumple |
| Credenciales incorrectas muestran un error y no permiten acceso. | El formulario valida campos y formato; Firebase Auth o el proveedor local resuelven la credencial. Se auditan fallos y existe bloqueo temporal tras cinco intentos. | `src/pages/Login.jsx:65`, `src/utils/passwordPolicy.js`, `src/utils/auditLog.js` | `Login.test.jsx` - campos vacios, formato, usuario invalido y bloqueo por intentos. | Cumple |
| Gerencia accede al Dashboard. | `gerente` solo dispone del Dashboard y consume indicadores agregados, no legajos clinicos. | `src/App.jsx:22`, `src/App.jsx:31`, `src/pages/Dashboard.jsx` | `Dashboard.test.jsx` - navegacion de gerente; `DashboardGerenteFirebase.test.jsx`; `securityRules.rules.js`. | Cumple con ajuste de minimo privilegio |
| Responsable de RR. HH. accede al Dashboard. | `respRRHH` accede al Dashboard y Registro de Ausencia, con restricciones sobre validaciones y certificados. | `src/App.jsx:22`, `firestore.rules`, `storage.rules` | `Dashboard.test.jsx` - alcance RR. HH.; suite de reglas en emuladores. | Cumple |
| Medico accede a Registro, Certificados y Dashboard con edicion. | El rol `medico` tambien accede a Validacion y Legajos por ser responsable de la decision profesional. | `src/App.jsx:22`, `src/pages/MedicalValidation.jsx` | `MedicalValidation.test.jsx`; `MedicalFlow.integration.test.jsx`; reglas en emuladores. | Cumple |
| Administrativo accede a Registro, Certificados y Dashboard con edicion. | Se distinguen `administrativo` y `administrativoSalud`: el primero gestiona ausencias administrativas; solo el segundo recepciona certificados y consulta Legajos. Ninguno valida decisiones finales. | `src/App.jsx:22`, `src/App.jsx:31`, `firestore.rules`, `storage.rules` | Pruebas de rutas en `Dashboard.test.jsx` y permisos clinicos en `securityRules.rules.js`. | Cumple con ajuste de confidencialidad posterior al TFG |

## HU-002 - Registro de ausencia laboral

| Criterio del TFG | Resultado implementado | Codigo principal | Prueba o evidencia | Estado |
|---|---|---|---|---|
| Una ausencia de un empleado existente se almacena en su historial y actualiza su estado de ausente. | Se crea un evento en `ausencias` asociado por `employeeId` y aparece en el historial operativo. No se mantiene un booleano permanente `ausente`, porque quedaria obsoleto al finalizar el periodo; el estado se deriva de las fechas. | `src/pages/RegisterAbsence.jsx:1078`, `src/services/firebase/firestoreRepository.js:251`, `src/services/firebase/firestoreHydration.js` | `RegisterAbsence.test.jsx`; `firestoreRepository.test.js`; prueba manual local/Firebase/offline. | Parcial justificado en el estado derivado |
| Un motivo no valido se rechaza. | El tipo se selecciona desde catalogo controlado y el formulario exige un valor admitido antes de enviar. | `src/pages/RegisterAbsence.jsx:158`, `src/pages/RegisterAbsence.jsx:927` | `RegisterAbsence.test.jsx` - seleccion, campos dependientes y persistencia. | Cumple |
| Un registro exitoso notifica a RR. HH. | La campanita de `respRRHH` se construye desde la proyeccion administrativa de `ausencias`, sin diagnostico, CIE-10 ni documento, y se actualiza con `onSnapshot`. | `src/components/AppHeader.jsx:175`, `src/components/AppHeader.jsx:466`, `src/services/firebase/firestoreHydration.js` | `AppHeader.test.jsx`; prueba manual con dos sesiones Firebase. | Cumple |
| Vacaciones, permisos y licencias se registran sin validacion medica. | Se escriben en `ausencias`, participan de la cola offline y no generan documento en `validaciones_medicas`. | `src/pages/RegisterAbsence.jsx:1182`, `src/services/firebase/firestoreRepository.js:251` | `firestoreRepository.test.js`; `operationQueue.test.js`. | Cumple, precision incorporada durante validacion del backlog |

## HU-003 - Carga de certificado medico digital

| Criterio del TFG | Resultado implementado | Codigo principal | Prueba o evidencia | Estado |
|---|---|---|---|---|
| Cargar PDF/JPG y asociarlo deja la ausencia pendiente de validacion. | El registro genera referencia estable, sube el adjunto y escribe `ausencias` y `validaciones_medicas`. PNG se admite adicionalmente. | `src/pages/RegisterAbsence.jsx:1078`, `src/services/firebase/firestoreRepository.js:116`, `src/services/firebase/firestoreRepository.js:293` | `MedicalFlow.integration.test.jsx`; prueba manual en Firestore y Storage. | Cumple con extension PNG adicional |
| El medico aprueba, rechaza o solicita informacion y se registra fecha y responsable. | Las tres decisiones actualizan la validacion; las finales generan historial y registran evaluador y marca temporal. | `src/pages/MedicalValidation.jsx:517`, `src/pages/MedicalValidation.jsx:664`, `src/services/firebase/firestoreRepository.js:349` | `MedicalValidation.test.jsx` - revision, rechazo y aprobacion; prueba manual Firebase. | Cumple |
| El archivo se almacena de forma segura y queda accesible a autorizados. | Storage usa `certificados/{reference}/{operationId}-{archivo}`; Firestore guarda `storagePath`; la lectura se realiza mediante SDK autenticado y URL temporal en memoria. | `src/services/firebase/firestoreRepository.js:116`, `src/services/firebase/certificateStorage.js`, `storage.rules:55` | `certificateStorage.test.js`; suite de reglas; verificacion manual en Storage. | Cumple |
| Archivos mayores a 5 MB se rechazan con aviso. | Existe validacion en formulario y regla de Storage del lado servidor. | `src/pages/RegisterAbsence.jsx`, `storage.rules:34` | `securityRules.rules.js` rechaza 5 MB + 1 byte. | Cumple |
| Extensiones diferentes de PDF/JPG se rechazan. | Se permiten PDF, JPEG y PNG; otros tipos se rechazan en frontend y Storage. | `src/pages/RegisterAbsence.jsx`, `storage.rules:34` | `securityRules.rules.js` rechaza `text/plain`. | Cumple con extension PNG justificada |

## HU-004 - Deteccion y puntuacion de riesgo

| Criterio del TFG | Resultado implementado | Codigo principal | Prueba o evidencia | Estado |
|---|---|---|---|---|
| Una nueva ausencia recalcula el riesgo del empleado. | El recalculo backend se activa sobre `validaciones_medicas`, no sobre una ausencia administrativa sin confirmar. Asi se evita que vacaciones o certificados no validados alteren el riesgo clinico. | `functions/src/index.js:453`, `functions/src/riskEngine.js:136` | `riskIndicator.test.js`; pruebas manuales de validacion Firebase. | Cumple con ajuste de integridad clinica |
| Tres ausencias del mismo grupo en seis meses generan alerta de recurrencia. | Se consideran eventos validados, mismo empleado y grupo, ventana movil parametrizable y riesgo individual medio/alto. Un unico evento alto no genera alerta. | `functions/src/index.js:686`, `functions/src/alertEngine.js:45`, `parametros_riesgo/global` | `alertEngine.test.js` - recurrencia, ventana, estado y umbral. | Cumple con umbral explicable acordado |
| El nuevo puntaje se persiste al finalizar el calculo. | Cloud Functions actualiza validacion, historial, auditoria e indicadores agregados con metadatos del motor. | `functions/src/index.js:391`, `functions/src/index.js:431`, `functions/src/index.js:839` | Pruebas backend; evidencia manual en `validaciones_medicas`, `historial_medico` y `auditoria`. | Cumple |

## HU-005 - Dashboard de analisis proactivo

| Criterio del TFG | Resultado implementado | Codigo principal | Prueba o evidencia | Estado |
|---|---|---|---|---|
| Mostrar las cinco tendencias patologicas mas prevalentes de los ultimos tres meses. | Se muestran hasta cinco grupos diagnosticos validados en ventana movil de tres meses, ordenados por certificados y dias. | `src/pages/Dashboard.jsx:559`, `src/pages/Dashboard.jsx:581`, `functions/src/riskIndicator.js:68` | `Dashboard.test.jsx` - prevalencia; `riskIndicator.test.js`. | Cumple |
| Sectores sobre el umbral se resaltan en el mapa de calor. | Las cards sectoriales combinan riesgo promedio, ausencias y alertas consolidadas; los colores siguen umbrales configurados. | `src/pages/Dashboard.jsx:1004`, `src/utils/riskUtils.js` | `Dashboard.test.jsx` - mapa de calor; pruebas manuales con alertas consolidadas. | Cumple |
| Al seleccionar una metrica se presenta evolucion historica. | Las tres cards principales abren una vista agregada de doce meses. | `src/pages/Dashboard.jsx:1479` | `Dashboard.test.jsx` - apertura y cierre del historico. | Cumple |
| Prueba de carga con grandes cantidades. | El backend procesa 5.000 registros de riesgo y ausentismo y 1.000 empleados, manteniendo agregados sin PII. | `functions/test/volume.test.js` | `npm --prefix functions test`: 15/15 pruebas. | Cumple |

## Trazabilidad transversal

| Capacidad | Inicio | Capa intermedia | Servicio/recurso | Resultado |
|---|---|---|---|---|
| Autenticacion | `src/pages/Login.jsx` | `src/utils/firebaseAuth.js` | Firebase Authentication + `usuarios/{uid}` | Sesion y rutas segun rol. |
| Registro de ausencia | `src/pages/RegisterAbsence.jsx` | `operationQueue.js` -> `syncHandler.js` -> `firestoreRepository.js` | `ausencias`, `borradores`, `operations` | Registro persistido y notificable. |
| Certificado | `RegisterAbsence.jsx` | `firestoreRepository.js` | Storage + `validaciones_medicas` | Documento pendiente de evaluacion. |
| Decision medica | `MedicalValidation.jsx` | cola + repositorio | `validaciones_medicas`, `historial_medico`, `planes_preventivos` | Estado profesional trazable. |
| Riesgo y alerta | escritura en validacion | Cloud Functions | `parametros_riesgo`, `patologias`, `alertas_riesgo` | Puntaje y alerta explicable. |
| Dashboard | `Dashboard.jsx` | hidratacion/listeners | `indicadores_riesgo`, `indicadores_alertas`, `indicadores_ausentismo` | Metricas, calor, tendencias y prevalencia. |
| Offline-first | formularios | cola cifrada e IndexedDB | sincronizacion automatica | Continuidad y envio posterior idempotente. |

## Resultado de los Sprint Backlog

- Sprint 1: HU-001 y HU-002 se encuentran implementadas y verificadas.
- Sprint 2: HU-003, HU-004 y HU-005 se encuentran implementadas y verificadas.
- La expresion "interfaz API" del Sprint se materializa mediante servicios/repositorios que encapsulan Firebase SDK; no existe un servidor REST propio porque la arquitectura elegida es BaaS/serverless.
- La prueba de volumen del dashboard se formalizo con datos sinteticos y no utiliza produccion.
