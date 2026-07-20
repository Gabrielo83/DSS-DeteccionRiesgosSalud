# Estrategia Local-First / Offline-First

## Alcance implementado

El modo Firebase aplica una estrategia local-first por capas. La aplicacion conserva una copia operativa en el navegador, registra cada escritura como una operacion idempotente y la sincroniza cuando vuelve la conectividad. Firebase sigue siendo la fuente remota autoritativa.

La aplicacion no usa RxDB como dependencia. RxDB es la referencia conceptual citada por el TFG para definir el paradigma offline-first. La implementacion concreta utiliza APIs nativas del navegador y Firebase Web SDK.

## Componentes

1. `localStorage`: conserva solo metadatos operativos y de interfaz; no contiene payloads clinicos en modo Firebase.
2. IndexedDB `dss-salud-ocupacional`: almacena contenido temporal cifrado con AES-GCM mediante Web Crypto.
3. Cola `app_operation_queue`: guarda en claro solo ID, tipo, propietario, version, estado y reintentos; el payload se referencia mediante `payloadRef`.
4. Sincronizador: escucha el evento `online` y reintenta periodicamente con backoff exponencial de 5 segundos a 5 minutos.
5. Firestore utiliza cache en memoria. La continuidad entre sesiones depende de la cola cifrada controlada por la aplicacion.
6. Service worker: en builds de produccion y con `VITE_ENABLE_OFFLINE_SHELL=true`, conserva el shell para poder volver a abrir la aplicacion sin red.

## Indicadores de sincronizacion del dashboard

- `Ultima actualizacion` representa la ultima hidratacion completa terminada sin fallos en Firebase. No avanza por una modificacion meramente local.
- `Siguiente sync automatica` es la cuenta regresiva real hasta la proxima hidratacion completa, programada 150 segundos despues de finalizar el ciclo anterior.
- Los listeners de Firestore siguen actualizando los datos en tiempo real entre ciclos.
- Al recuperar conectividad se ejecuta inmediatamente una hidratacion completa y se reinicia el contador solo si finaliza sin fallos.
- La cola Offline-First mantiene un proceso independiente cada 15 segundos y tambien reacciona inmediatamente al evento `online`.
- En modo local, el mismo indicador corresponde a la recarga periodica de los repositorios del navegador, conservando la presentacion prevista en el TFG.

## Coherencia e idempotencia

- Cada operacion posee un `id` estable y un `ownerId`.
- Solo la sesion autenticada propietaria procesa sus operaciones.
- Los payloads y adjuntos se cifran con AES-GCM antes de persistirse en IndexedDB; no aparecen en claro en la cola ni en Firestore.
- La ruta de Storage deriva del ID de operacion, por lo que un reintento sobrescribe el mismo objeto y no genera copias.
- Firestore registra `sourceOperationId`, `syncVersion`, `clientUpdatedAt` y `updatedAt` del servidor.
- Borradores: politica de ultima escritura, apropiada para contenido editable no consolidado.
- Decisiones clinicas: una operacion antigua no puede reemplazar un estado final `validado` o `rechazado`. El conflicto queda en la cola con estado `conflict` para intervencion, sin reintentos automaticos.
- Certificado, ausencia, historial y plan relacionados se escriben mediante transacciones cuando interviene una decision clinica.

## Fallos y recuperacion

- Sin red, las operaciones permanecen pendientes y no se descartan.
- Los fallos transitorios usan backoff exponencial y un maximo de ocho intentos automaticos.
- El repositorio de sincronizacion se incluye en el bundle inicial para evitar que un despliegue cambie el nombre de un chunk requerido por operaciones offline. Si se detecta ese error en una cola anterior, sus reintentos se recuperan automaticamente.
- Los fallos no recuperables quedan en estado `failed`.
- Una hidratacion remota fallida conserva la ultima copia local valida; no la reemplaza por arreglos vacios.
- Mientras el navegador esta offline se ignoran snapshots de la cache remota anterior. Al reconectar, los borradores y validaciones con operaciones pendientes conservan prioridad local hasta finalizar la sincronizacion.
- Cloud Functions no se ejecutan offline. Procesan el documento cuando la cola lo sincroniza con Firestore.

## Seguridad de cache

- La persistencia general de Firestore entre sesiones esta deshabilitada para evitar copias clinicas fuera del control de la aplicacion.
- La clave AES-GCM del dispositivo es no extraible; protege frente a lectura directa del almacenamiento, aunque no reemplaza la seguridad del equipo ni evita el acceso desde una sesion comprometida.
- Al cerrar sesion Firebase se eliminan de la cache de aplicacion historiales, validaciones, planes, borradores, ausencias y alertas detalladas.
- Las operaciones pendientes permanecen cifradas para evitar perdida de trabajo y quedan aisladas por propietario.
- Los certificados remotos no se almacenan en base64; se conserva su referencia de Storage.

## Configuracion para defensa

Agregar a `.env.firebase`:

```env
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
4. Verificar en Application > Local Storage que la operacion solo contiene `payloadRef` y no contiene diagnostico, notas ni archivo.
5. Verificar en IndexedDB `secureData` que el contenido aparece como `ciphertext` e `iv`, no como texto medico legible.
6. Confirmar que Firestore aun no contiene el cambio.
7. Volver a Online.
8. Verificar que la cola desaparece, el archivo se sube una sola vez y Firestore contiene `sourceOperationId`, `syncVersion`, `clientUpdatedAt` y `updatedAt`.
9. Cerrar sesion y comprobar que los datos medicos hidratados se eliminan de la cache de aplicacion.

## Saneamiento de documentos historicos

Despues de desplegar Functions, iniciar sesion como `superAdmin` y ejecutar una sola vez en la consola:

```js
await window.sanitizeAdministrativeAbsences()
```

La Function elimina de los documentos existentes en `ausencias` los campos clinicos heredados y registra el resultado en `auditoria`. Es idempotente: una segunda ejecucion informa cero documentos pendientes de saneamiento.

## HU-002: ausencias sin certificado

- Vacaciones, permisos especiales y licencias personales se guardan en el repositorio operativo de `ausencias`.
- Estas solicitudes generan una operacion `submitAbsence`; no crean entradas en `validaciones_medicas` ni requieren adjuntos.
- Un borrador general reanudado se convierte en ausencia antes de eliminarse, evitando perdida de datos.
- Sin conectividad, el payload queda cifrado en IndexedDB y `localStorage` conserva solamente `payloadRef` y metadatos de sincronizacion.
- Al recuperarse la red, la misma operacion se escribe de forma idempotente en `ausencias/{absenceId}` y desaparece de la cola tras confirmarse la sincronizacion.
- La cobertura automatizada verifica los tres tipos, el flujo desde borrador, la reconexion offline y el adaptador Firebase.

## Limite que debe explicarse

Offline-first no significa que todas las funciones remotas se ejecuten sin internet. El registro y la continuidad operativa se mantienen localmente; autenticacion inicial, Storage, Firestore, Cloud Functions y consolidacion remota se completan al recuperar conectividad. Una sesion Firebase ya restaurada puede usar su perfil en cache, pero un primer acceso en un navegador nuevo requiere red.
