# RELEASE / Versionado (TFG)

Este documento define como versionar y publicar releases del prototipo para mantener una rama estable para la defensa del TFG y, en paralelo, habilitar desarrollo incremental sin romper la demo.

## Estrategia de ramas

- `main`
  - Refleja la version estable (lo que se muestra en la defensa del TFG).
  - Debe compilar, ejecutar y pasar tests.
  - Solo se integra codigo ya validado (idealmente por PR).
- `feature/*`
  - Ramas de desarrollo/experimentos.
  - Ejemplos: `feature/indexeddb`, `feature/firebase`, `feature/dashboard-indicators`.
  - Cada feature debe incluir pruebas (cuando aplique) y documentacion minima.

Recomendacion (GitHub):
- Proteger `main`: merges solo por PR y requerir checks verdes (`npm test`) antes de mergear.

## Estrategia de versionado (tags)

Para la defensa del TFG usaremos tags con nombre explicito (no solo SemVer) para que sea evidente el hito:

- `v1.0-tfgprototipo-ui-offline`: prototipo estable con UI + modo offline (IndexedDB) + seeds para demo.

Reglas:
- Prefijo `v` para consistencia.
- Tag anotado (annotated) con mensaje descriptivo.
- El release en GitHub debe apuntar a `main`.

## Checklist antes de taggear `main`

En tu maquina:

```bash
git checkout main
git pull
npm ci
npm test
npm run build
```

Ademas, validar el flujo principal de demo:
- Login -> Registro de Ausencias (borrador + envio) -> Validacion Medica (revision/aceptacion/rechazo) -> Historial/Legajo -> Dashboard (indicadores).

## Crear el tag `v1.0-tfgprototipo-ui-offline`

1) Asegurate de estar en `main` y actualizado:

```bash
git checkout main
git pull
```

2) Verifica que el working tree este limpio:

```bash
git status
```

3) Crea el tag anotado:

```bash
git tag -a v1.0-tfgprototipo-ui-offline -m "TFG: prototipo UI + offline (IndexedDB) listo para defensa"
```

4) Publicalo en GitHub:

```bash
git push origin v1.0-tfgprototipo-ui-offline
```

## Crear el Release en GitHub (paso a paso)

1) Abrir el repositorio en GitHub.
2) Ir a **Releases** > **Draft a new release**.
3) En **Choose a tag**, seleccionar `v1.0-tfgprototipo-ui-offline` (si no existe en el remoto, crear el tag y pushearlo primero).
4) En **Target**, seleccionar `main`.
5) Completar:
   - **Release title**: `v1.0-tfgprototipo-ui-offline`
   - **Description** (sugerido):
     - Que incluye (UI, rutas, roles demo, persistencia offline con IndexedDB, seeds `window.run*()`).
     - Como ejecutar demo (comandos principales).
     - Que queda pendiente (p. ej., sincronizacion/Firestore real).
6) Marcar:
   - **Set as the latest release** (si, si es el release para defensa).
   - **This is a pre-release** (no, si es el release para defensa).
7) Click en **Publish release**.

## Flujo recomendado para cambios posteriores

1) Crear feature branch:

```bash
git checkout -b feature/<tema>
```

2) Implementar cambios + actualizar tests.
3) Abrir PR hacia `main` cuando este estable.
4) Taggear el siguiente hito (ej.: `v1.1-tfgprototipo-firebase-sync`) y publicar release.

