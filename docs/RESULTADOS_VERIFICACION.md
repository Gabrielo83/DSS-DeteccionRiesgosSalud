# Resultados de verificacion para cierre del TFG

Fecha de ejecucion: 21/07/2026.

Este documento separa la evidencia automatizada ejecutada sobre el codigo local de las comprobaciones manuales realizadas previamente contra el proyecto Firebase. Durante este cierre no se desplegaron recursos ni se escribieron datos de prueba en produccion.

| Caso probado | Resultado esperado | Resultado obtenido | Estado | Evidencia | Observaciones |
|---|---|---|---|---|---|
| Autorizacion por roles en Firestore | Cada rol accede solamente a los recursos habilitados | Las reglas aceptan y rechazan los casos previstos para Gerencia, RR. HH., Salud y propietarios | Correcto | `test/securityRules.rules.js` | Ejecutado con emulador, sin produccion |
| Aislamiento de borradores y operaciones | Un usuario no puede leer ni modificar pendientes de otro propietario | Acceso cruzado rechazado; `ownerUid` requerido | Correcto | `test/securityRules.rules.js`, `firestore.rules` | `superAdmin` conserva acceso de auditoria definido |
| Saneamiento de operaciones legacy | Una operacion antigua no debe conservar payload clinico | La sincronizacion elimina `payload` y las reglas rechazan campos fuera del esquema tecnico | Correcto | `firestoreRepository.test.js`, `test/securityRules.rules.js` | La adopcion exige coincidencia con el correo autenticado |
| Borradores legacy | Un borrador sin propietario no debe asignarse por nombre | Solo `superAdmin` puede agregar un UID existente sin cambiar el contenido | Correcto | `test/securityRules.rules.js` | Migracion manual y verificable |
| Certificados PDF/JPEG/PNG | Archivos autenticados y autorizados de hasta 5 MB son admitidos | Tipos y limite aceptados conforme a reglas | Correcto | `test/securityRules.rules.js`, `storage.rules` | La validacion frontend es complementaria |
| Archivo mayor a 5 MB o tipo no admitido | Storage debe rechazarlo aunque se omita el control de interfaz | Escritura rechazada por reglas | Correcto | `test/securityRules.rules.js` | Control aplicado en backend |
| Vista segura de adjuntos | El archivo se recupera mediante Firebase SDK y permisos vigentes | El servicio resuelve la referencia protegida y genera la previsualizacion | Correcto | `src/services/firebase/certificateStorage.test.js` | No depende de exponer base64 en Firestore |
| Ausencia sin certificado | Vacaciones, permiso o licencia se persisten sin validacion medica | Se registra `ausencias` y no se crea `validaciones_medicas` | Correcto | pruebas de Registro de Ausencia y repositorio Firebase | Incluida en la cola offline-first |
| Operacion offline | La accion queda pendiente, cifrada y se reintenta al volver la red | La cola conserva el payload AES-GCM y procesa en orden con backoff | Correcto | `src/utils/operationQueue.test.js` | Metadatos no sensibles quedan visibles para operar la cola |
| Reconexion | Las operaciones pendientes llegan al repositorio remoto y salen de la cola | Sincronizacion confirmada por pruebas automatizadas y pruebas manuales previas | Correcto | pruebas de `operationQueue`; evidencia manual del usuario | No se repitio contra produccion en este cierre |
| Idempotencia de ausencia | Reintentar la misma operacion no debe duplicar documentos | El mismo `absenceId` y `operationId` se sobrescribe de forma determinista | Correcto | `src/services/firebase/firestoreRepository.test.js` | Cubre reintento de `submitAbsence` |
| Conflicto de versiones | Una version remota mas reciente no debe ser reemplazada silenciosamente | La cola identifica el conflicto y conserva evidencia del fallo | Correcto | `src/utils/operationQueue.test.js` | Politica explicita basada en version/marcas temporales |
| Recurrencia clinica | Tres eventos validados del mismo empleado y grupo en seis meses generan alerta | Regla evaluada en backend con umbral individual medio/alto | Correcto | `functions/test/alertEngine.test.js`, `functions/src/riskEngine.js` | Un solo evento alto no genera recurrencia |
| Volumen de calculo | Los agregados deben conservar exactitud y no propagar datos clinicos identificables | 5.000 historiales, 5.000 ausencias y 1.000 empleados procesados correctamente | Correcto | `functions/test/volume.test.js` | Prueba funcional de volumen, no benchmark de carga concurrente |
| Dashboard y proyecciones agregadas | Gerencia consume indicadores sin acceso a documentos clinicos individuales | Pruebas verifican metricas y datos agregados esperados | Correcto | pruebas de Dashboard y reglas | Se ajustaron permisos visibles sin redisenar el prototipo aprobado |
| Linter | No debe haber errores estaticos | Frontend y Functions sin errores | Correcto | `npm run lint`; `npm --prefix functions run lint` | Se registra la salida en el cierre de la tarea |
| Pruebas automatizadas | Todas las suites deben finalizar correctamente | Frontend: 84; backend: 15; reglas: 11, todas correctas | Correcto | comandos de prueba del repositorio | Cifras finales en `resumen_tecnico_tfg.md` |
| Build local y Firebase | Ambos perfiles deben compilar | Compilacion correcta | Correcto | `npm run build`; `npm run build:firebase` | Advertencia no bloqueante por tamano de bundle |
| Dependencias runtime frontend | No debe haber vulnerabilidades conocidas de runtime | 0 vulnerabilidades | Correcto | `npm audit --omit=dev` | Resultado al 21/07/2026 |
| Dependencias de Functions | No debe haber vulnerabilidades altas o criticas | 7 moderadas transitivas; 0 altas y 0 criticas | Aceptado con observacion | `npm --prefix functions audit --omit=dev` | Sin correccion compatible no disruptiva disponible |

## Limitaciones de esta verificacion

- No se realizaron escrituras nuevas en el proyecto Firebase productivo.
- No se desplegaron Functions, reglas, indices ni Hosting.
- La prueba de volumen mide exactitud y tiempo de ejecucion local de la logica; no sustituye una prueba de carga distribuida.
- MFA, control de contrasenas comprometidas y App Check permanecen como evoluciones documentadas, no como funciones implementadas.
- `empleados` aun combina campos de directorio con datos ampliados. El frontend restringe su visualizacion, pero Firestore no aplica seguridad por campo; separar `directorio_empleados` queda aceptado para un sprint posterior.
- Cualquier ajuste visual futuro debe revisarse previamente en `Revisar Frontend`, sin alterar el prototipo aprobado sin autorizacion.
