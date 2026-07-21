# DSS Deteccion de Riesgos de Salud

Sistema web para registrar ausencias, validar certificados medicos, administrar legajos y visualizar indicadores de salud ocupacional.

## Funcionalidades principales

- Login por roles: superAdmin, medico, administrativo, administrativoSalud, gerente y respRRHH, con permisos diferenciados por alcance funcional.
- Registro de ausencias con busqueda de empleados, calculo automatico de dias, borradores, adjuntos con vista previa y envio para revision.
- Validacion medica con filtros, modal clinico, asignacion de riesgo, planes preventivos, historial y paginacion.
- Legajos medicos digitales con busqueda, certificados por periodo, carga masiva de historicos y vista previa de documentos.
- Dashboard operativo con metricas de ausentismo, alertas activas, mapa de calor por sector, tendencias y grupos diagnosticos prevalentes.
- Persistencia en navegador con IndexedDB/localStorage y cola de operaciones para continuidad operativa.
- Sincronizacion progresiva con Firebase mediante selector de proveedor.
- Politica de contrasena segura, expiracion de sesion por inactividad y auditoria local de eventos criticos.

## Stack

- React + Vite + TailwindCSS
- React Router
- Context API para autenticacion y permisos por rol
- IndexedDB/localStorage para persistencia del prototipo
- Firebase Web SDK para Firestore, Authentication y Storage
- Vitest + Testing Library para pruebas unitarias e integrales

## Alcance de roles

- superAdmin: acceso completo.
- medico: validacion, legajos, registro, certificados y dashboard.
- administrativo: dashboard y registro de ausencias administrativas, sin acceso a documentacion clinica.
- administrativoSalud: dashboard, registro, carga documental y consulta de legajos/certificados historicos sin decision medica.
- respRRHH: dashboard y registro administrativo de ausencias.
- gerente: dashboard de indicadores.

## Configuracion

1. Clonar el repositorio.
2. Instalar dependencias:

```bash
npm install
```

3. Levantar la aplicacion:

```bash
npm run dev -- --host
```

4. Abrir [http://localhost:5173](http://localhost:5173).

## Modos de datos

El proyecto mantiene un unico codigo base con selector de proveedor:

- `local`: usa `localStorage`, IndexedDB y cola local. Es el modo estable para defensa.
- `firebase`: mantiene la continuidad local, sincroniza operaciones con Firestore, sube adjuntos a Storage e hidrata las pantallas desde Firestore segun permisos.

Para modo local:

```bash
npm run dev -- --host
```

Para modo Firebase:

1. Copiar `.env.example` a `.env.firebase`.
2. Completar las variables `VITE_FIREBASE_*` del proyecto Firebase.
3. Configurar:

```env
VITE_DATA_PROVIDER="firebase"
VITE_FIREBASE_TRUSTED_DEVICE="false"
VITE_ENABLE_OFFLINE_SHELL="false"
```

`VITE_FIREBASE_TRUSTED_DEVICE` conserva la cache Firestore entre sesiones y solo debe activarse en equipos confiables. `VITE_ENABLE_OFFLINE_SHELL` registra el service worker en builds de produccion para poder reabrir la aplicacion sin red.

4. Ejecutar:

```bash
npm run dev:firebase -- --host
```

Las credenciales reales no deben subirse al repositorio.

### Reglas Firebase

El repositorio incluye `firestore.rules`, `storage.rules` y `firebase.json`.

Para desplegarlas desde Firebase CLI:

```bash
firebase deploy --only firestore:rules,storage
```

Las reglas de Storage limitan certificados a PDF/JPG/PNG de hasta 5 MB en
`certificados/{reference}/{archivo}`. La validacion del frontend mantiene el
mismo limite para evitar intentos invalidos antes de sincronizar.

## Scripts utiles

```bash
# levantar en desarrollo local
npm run dev -- --host

# levantar en desarrollo Firebase
npm run dev:firebase -- --host

# ejecutar pruebas
npm test

# verificar calidad de codigo
npm run lint

# generar build de produccion local
npm run build

# generar build con modo Firebase
npm run build:firebase
```

## Flujo de presentacion

1. Iniciar sesion con un usuario autorizado.
2. Registrar una ausencia: seleccionar empleado, completar diagnostico, adjuntar archivo y enviar para revision.
3. Validar el certificado: abrir el caso, visualizar el documento, asignar riesgo, aprobar/rechazar o marcar para revision.
4. Consultar legajo medico: buscar el empleado y revisar el historial actualizado.
5. Revisar dashboard: verificar metricas, alertas, mapa de calor, recurrencias y planes preventivos.

## Usuarios de referencia

En modo Firebase, los usuarios se administran desde Firebase Authentication y sus roles desde `usuarios/{uid}`. El repositorio no publica ni persiste contrasenas.

## Prueba offline-first

La arquitectura, limites, politica de conflictos y prueba manual se documentan en `docs/OFFLINE_FIRST_DEFENSA.md`.

## Capturas

### Login

![Login](./src/assets/gifs/login.gif)

### Dashboard

![Dashboard](./src/assets/gifs/dashboard.gif)

### Legajo Medico

![Legajo Medico](./src/assets/gifs/legajo-medico.gif)

## Proximos pasos

- Mantener actualizadas las semillas remotas controladas de empleados, patologias y parametros de riesgo.
- Revisar eventos en Firebase Analytics, Performance y la coleccion `auditoria`.
- Ajustar reglas productivas finas si se agregan claims custom por rol.
- Mantener IndexedDB como respaldo offline-first.
- Monitorear las Cloud Functions que calculan riesgo, recurrencia, alertas e indicadores consolidados.

Las herramientas de consola para semillas y mantenimiento solo se cargan con
`npm run dev` o `npm run dev:firebase`; no forman parte del build productivo.
Para regenerar datos controlados en desarrollo, ejecuta
`window.runDemoSeed()` en la consola del navegador.

Para cargar la nomina controlada de 80 empleados en Firestore, inicia sesion en
modo Firebase con un rol autorizado (`superAdmin` o `respRRHH`) y ejecuta:

```js
await window.seedFirebaseEmployees()
```
