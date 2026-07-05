# DSS Deteccion de Riesgos de Salud

Sistema web para registrar ausencias, validar certificados medicos, administrar legajos y visualizar indicadores de salud ocupacional.

## Funcionalidades principales

- Login por roles: superAdmin, medico, administrativo, administrativoSalud, gerente y respRRHH, con permisos diferenciados por alcance funcional.
- Registro de ausencias con busqueda de empleados, calculo automatico de dias, borradores, adjuntos con vista previa y envio para revision.
- Validacion medica con filtros, modal clinico, asignacion de riesgo, planes preventivos, historial y paginacion.
- Legajos medicos digitales con busqueda, certificados por periodo, carga masiva de historicos y vista previa de documentos.
- Dashboard operativo con metricas de ausentismo, alertas activas, mapa de calor por sector, tabla de riesgo individual y planes preventivos.
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
- administrativo: dashboard, registro de ausencias y carga documental.
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
- `firebase`: mantiene la continuidad local y sincroniza operaciones con Firestore.

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
```

4. Ejecutar:

```bash
npm run dev:firebase -- --host
```

Las credenciales reales no deben subirse al repositorio.

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

- superadmin@empresa.com / Super123*
- medico@empresa.com / Medico123*
- administrativo@empresa.com / Admin123*
- salud.admin@empresa.com / Salud123*
- gerente@empresa.com / Gerente123*
- rrhh@empresa.com / Rrhh123*

## Capturas

### Login

![Login](./src/assets/gifs/login.gif)

### Dashboard

![Dashboard](./src/assets/gifs/dashboard.gif)

### Legajo Medico

![Legajo Medico](./src/assets/gifs/legajo-medico.gif)

## Proximos pasos

- Completar autenticacion Firebase con roles reales por usuario.
- Persistir certificados, legajos, borradores, auditoria y planes en Firestore.
- Verificar adjuntos clinicos en Firebase Storage y consolidar reglas de acceso.
- Mantener IndexedDB como respaldo offline-first.
- Mover reglas sensibles y alertas criticas a Cloud Functions.

Si necesitas regenerar datos controlados para presentacion, ejecuta
`window.runDemoSeed()` en la consola del navegador.
