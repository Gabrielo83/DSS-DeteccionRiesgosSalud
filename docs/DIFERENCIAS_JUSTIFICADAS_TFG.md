# Diferencias justificadas entre el TFG y la implementacion

Este documento separa decisiones implementadas, alcances parciales y mejoras pendientes. Su objetivo es evitar afirmar durante la defensa una capacidad que el codigo no posee.

## Diferencias implementadas y justificadas

### 1. API propia frente a Firebase SDK

El Sprint Backlog utiliza el termino "interfaz API". La implementacion no incorpora un servidor REST tradicional: los repositorios del frontend usan Firebase SDK y Cloud Functions dentro de una arquitectura BaaS/serverless.

**Defensa oral:** "La API funcional esta encapsulada en servicios y repositorios. Firebase provee autenticacion, persistencia, almacenamiento y eventos backend, por lo que no fue necesario mantener un servidor REST propio."

### 2. Persistencia Firestore en memoria y cola offline cifrada

El TFG describe la persistencia offline de Firestore. En web, la implementacion usa `memoryLocalCache()` y una cola propia cifrada en IndexedDB. La decision reduce la permanencia automatica de datos medicos entre sesiones y conserva las operaciones necesarias para continuidad.

**Defensa oral:** "Se mantuvo el enfoque local-first, pero no se habilito una cache Firestore persistente indiscriminada. Las operaciones pendientes se cifran con AES-GCM y los metadatos no sensibles quedan separados."

### 3. Estado de ausencia derivado

HU-002 indica actualizar el estado del empleado a ausente. El sistema persiste eventos con fecha inicial y final y deriva la situacion para el periodo; no mantiene un booleano permanente que pueda quedar desactualizado.

**Defensa oral:** "La ausencia es un hecho temporal. Se modela como evento, no como atributo permanente del empleado."

### 4. Riesgo calculado sobre informacion validada

HU-004 menciona recalcular ante una nueva ausencia. El backend recalcula al escribir una validacion medica y consolida alertas solo con eventos validados. Vacaciones, permisos o certificados rechazados no influyen en riesgo de salud.

**Defensa oral:** "El sistema evita convertir una carga administrativa no confirmada en evidencia clinica. El motor prioriza; el medico valida."

### 5. Regla de recurrencia reforzada

La alerta exige tres eventos del mismo grupo diagnostico, empleado y ventana movil de seis meses. Ademas, los eventos deben tener riesgo individual medio o alto. Un unico certificado alto no dispara recurrencia.

**Defensa oral:** "La alerta expresa patron repetido, no gravedad aislada. Esto evita falsos positivos y coincide con el caracter preventivo, no diagnostico."

### 6. Roles administrativos separados

El TFG utiliza el rol Administrativo de forma amplia. El sistema distingue `administrativo`, `administrativoSalud` y `respRRHH`. Salud Ocupacional puede acceder a informacion clinica por su obligacion de confidencialidad; RR. HH. recibe solamente informacion administrativa.

**Defensa oral:** "La implementacion aplica minimo privilegio y separacion de funciones con mayor precision que el prototipo inicial."

### 7. Gerencia consume proyecciones agregadas

Gerencia visualiza indicadores, tendencias y sectores, pero no lee certificados ni diagnósticos individuales. Cloud Functions publica proyecciones agregadas sin PII.

**Defensa oral:** "Gerencia necesita evidencia para decidir presupuesto preventivo, no acceso irrestricto a la historia clinica."

### 8. PNG adicional

HU-003 menciona PDF/JPG. La implementacion agrega PNG, formato habitual de captura, manteniendo limite de 5 MB y validacion doble en frontend y Storage.

### 9. `storagePath` en lugar de URL publica permanente

Los registros nuevos guardan la ruta de Storage y descargan mediante el SDK autenticado. `downloadUrl` se conserva solo para compatibilidad con documentos historicos.

**Defensa oral:** "La aplicacion evita depender de enlaces permanentes y aplica las reglas de Storage en cada lectura."

### 10. RxDB como referencia conceptual

RxDB se cita como fuente del paradigma local-first, pero no es dependencia del proyecto. La implementacion usa IndexedDB, Web Crypto y una cola propia proporcional al alcance del prototipo.

### 11. Firestore sin Realtime Database

El diagrama presenta "Firestore / Realtime DB" como alternativa de nube. El sistema utiliza Firestore y listeners `onSnapshot`; Realtime Database no es necesaria.

## Capacidades parcialmente implementadas

### Politica de contrasena

- Firebase Authentication administra las credenciales; Firestore no guarda contrasenas ni hashes.
- Existe bloqueo local temporal tras cinco intentos fallidos y auditoria del evento.
- La politica de complejidad se configura en Identity Platform y se acompana en flujos de alta/restablecimiento, no en el login normal.
- Su configuracion de consola debe demostrarse con captura o prueba manual, porque no forma parte del repositorio.

### Logging y Monitoring

- Existe auditoria local/remota, Firebase Analytics y Firebase Performance.
- Los logs de Cloud Functions se consultan en Google Cloud Logging.
- La retencion, tableros y alertas de infraestructura dependen de configuracion de consola y deben verificarse por separado.

## No implementado o reservado como evolucion

### MFA

La autenticacion multifactor no esta implementada en el flujo actual. Se mantiene como evolucion recomendada para `superAdmin`, `medico` y `administrativoSalud`.

### Bloqueo de contrasenas comprometidas

No existe integracion con un servicio de reputacion como Have I Been Pwned ni una Blocking Function equivalente. Nunca debe afirmarse como implementado.

### App Check

La proteccion App Check no esta activada desde codigo. Puede incorporarse como defensa adicional contra clientes no autorizados, despues de validar impacto en desarrollo y demostracion.

### Resolucion general de ediciones concurrentes

La politica actual es explicita pero acotada:

- decisiones clinicas finales no pueden ser sobrescritas por otra operacion;
- operaciones usan identificadores estables y documentos idempotentes;
- borradores usan ultima escritura y propietario;
- conflictos no reintentables quedan marcados para intervencion.

No existe fusion de campos arbitraria ni CRDT. Para el alcance del prototipo no es necesario.

## Deuda tecnica aceptada para un proximo sprint

La coleccion `empleados` combina datos de directorio con telefono, sangre y legajo medico. Firestore no permite ocultar campos individuales mediante reglas. La mejora propuesta es:

- `directorio_empleados`: nombre, legajo, sector, puesto y estado activo para RR. HH.;
- `empleados`: perfil ampliado reservado a Salud Ocupacional y `superAdmin`.

El 21/07/2026 se decidio no incorporar esta migracion en el cierre actual para evitar ampliar el alcance con otra coleccion y otra Cloud Function. El frontend restringe la visualizacion segun rol, pero esto no equivale a seguridad por campo en Firestore. Durante la defensa debe presentarse como una brecha conocida y una mejora prioritaria del siguiente sprint.

## Revisar Frontend

No se rediseño el frontend aprobado. Solo se ajusto la visibilidad funcional de opciones clinicas segun rol. Para revision del usuario quedan:

1. Evaluar mas adelante si la pantalla breve de restauracion de sesion necesita otro tratamiento visual.
2. Confirmar que cualquier futura separacion `directorio_empleados` no altere el formulario ni el listado visible.
3. Decidir si el enlace `Olvidaste tu contrasena?` del login se conecta al restablecimiento de Firebase o se retira; actualmente usa `href="#"` y no ejecuta el flujo.
4. El bloque de credenciales demo permanece comentado y no se renderiza. Evaluar su eliminacion durante el refactor sin afectar el modo local.
5. Mantener el prototipo aprobado como referencia antes de cambiar textos, posiciones o componentes.

Ninguno de estos puntos bloquea el funcionamiento actual.
