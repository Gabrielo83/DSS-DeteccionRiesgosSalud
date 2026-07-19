# Estrategia Local-First / Offline-First

## Alcance implementado

El modo Firebase aplica una estrategia local-first por capas. La aplicacion conserva una copia operativa en el navegador, registra cada escritura como una operacion idempotente y la sincroniza cuando vuelve la conectividad. Firebase sigue siendo la fuente remota autoritativa.

La aplicacion no usa RxDB como dependencia. RxDB es la referencia conceptual citada por el TFG para definir el paradigma offline-first. La implementacion concreta utiliza APIs nativas del navegador y Firebase Web SDK.

## Componentes

1. `localStorage`: espejo inmediato para actualizar la interfaz y conservar compatibilidad con los modulos existentes.
2. IndexedDB `dss-salud-ocupacional`: almacena validaciones, historiales, planes, borradores, cola y adjuntos temporales.
3. Cola `app_operation_queue`: guarda operaciones en orden cronologico con ID estable, propietario, version de esquema, reintentos y proximo intento.
4. Sincronizador: escucha el evento `online` y reintenta periodicamente con backoff exponencial de 5 segundos a 5 minutos.
5. Firestore persistent cache: se habilita expresamente solo en dispositivos confiables mediante `VITE_FIREBASE_TRUSTED_DEVICE=true`.
6. Service worker: en builds de produccion y con `VITE_ENABLE_OFFLINE_SHELL=true`, conserva el shell para poder volver a abrir la aplicacion sin red.

## Coherencia e idempotencia

- Cada operacion posee un `id` estable y un `ownerId`.
- Solo la sesion autenticada propietaria procesa sus operaciones.
- Los adjuntos se guardan como `Blob` en IndexedDB; no se introduce base64 en la cola ni en Firestore.
- La ruta de Storage deriva del ID de operacion, por lo que un reintento sobrescribe el mismo objeto y no genera copias.
- Firestore registra `sourceOperationId`, `syncVersion`, `clientUpdatedAt` y `updatedAt` del servidor.
- Borradores: politica de ultima escritura, apropiada para contenido editable no consolidado.
- Decisiones clinicas: una operacion antigua no puede reemplazar un estado final `validado` o `rechazado`. El conflicto queda en la cola con estado `conflict` para intervencion, sin reintentos automaticos.
- Certificado, ausencia, historial y plan relacionados se escriben mediante transacciones cuando interviene una decision clinica.

## Fallos y recuperacion

- Sin red, las operaciones permanecen pendientes y no se descartan.
- Los fallos transitorios usan backoff exponencial y un maximo de ocho intentos automaticos.
- Los fallos no recuperables quedan en estado `failed`.
- Una hidratacion remota fallida conserva la ultima copia local valida; no la reemplaza por arreglos vacios.
- Cloud Functions no se ejecutan offline. Procesan el documento cuando la cola lo sincroniza con Firestore.

## Seguridad de cache

- La persistencia Firestore entre sesiones esta deshabilitada por defecto.
- Debe habilitarse solo en un equipo institucional o personal confiable.
- Al cerrar sesion Firebase se eliminan de la cache de aplicacion los historiales, validaciones, planes, borradores y nomina hidratada.
- Las operaciones pendientes y sus adjuntos se preservan para evitar perdida de trabajo y quedan aisladas por propietario.
- Los certificados remotos no se almacenan en base64; se conserva su referencia de Storage.

## Configuracion para defensa

Agregar a `.env.firebase`:

```env
VITE_FIREBASE_TRUSTED_DEVICE="true"
VITE_ENABLE_OFFLINE_SHELL="true"
```

Reiniciar el proceso despues de cambiar variables. El service worker solo se activa en un build de produccion:

```bash
npm run build:firebase
npm run preview -- --host
```

## Prueba manual defendible

1. Abrir el build conectado e iniciar sesion.
2. Seleccionar modo Offline en DevTools, pestaña Network.
3. Registrar o guardar un borrador con un archivo valido.
4. Verificar en Application > IndexedDB que existe la operacion y el adjunto temporal.
5. Confirmar que Firestore aun no contiene el cambio.
6. Volver a Online.
7. Verificar que la cola desaparece, el archivo se sube una sola vez y Firestore contiene `sourceOperationId`, `syncVersion`, `clientUpdatedAt` y `updatedAt`.
8. Cerrar sesion y comprobar que los datos medicos hidratados se eliminan de la cache de aplicacion.

## Limite que debe explicarse

Offline-first no significa que todas las funciones remotas se ejecuten sin internet. El registro y la continuidad operativa se mantienen localmente; autenticacion inicial, Storage, Firestore, Cloud Functions y consolidacion remota se completan al recuperar conectividad. Una sesion Firebase ya restaurada puede usar su perfil en cache, pero un primer acceso en un navegador nuevo requiere red.
