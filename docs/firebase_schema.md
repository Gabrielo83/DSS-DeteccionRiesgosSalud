# Esquema Firestore (Propuesta)

## Colecciones y documentos

1) `empleados/{employeeId}`
- employeeId (string)
- nombreCompleto
- sector
- puesto
- legajoMedico
- activo (bool)
- fechaAlta (timestamp)
- fechaBaja (timestamp | null)

2) `ausencias/{absenceId}`
- absenceId (string)
- employeeId
- nombreCompleto
- sector
- puesto
- tipo (accidente/enfermedad/...)
- diagnostico
- fechaInicio (timestamp)
- fechaFin (timestamp)
- dias (number)
- institucionMedica
- certificadoDigital
  - nombre
  - tamano
  - tipoContenido
  - rutaStorage
- estado (borrador | enviado)
- creadoEn, actualizadoEn
- creadoPor (userId/email)

3) `validaciones_medicas/{reference}`
- reference (CM-..., docId)
- employeeId, nombreCompleto
- sector
- puesto
- tipo, diagnostico
- fechaInicio, fechaFin, dias
- institucionMedica
- prioridad (Alta/Media/Baja)
- estado (pendiente | en_revision | validado | rechazado)
- riesgoPuntaje (number)
- riesgoNivel (alta/media/baja)
- notasMedicas
- revisadoPor, revisadoEn
- creadoEn, actualizadoEn

4) `historial_medico/{historyId}`
- historyId (string, usar reference)
- reference
- employeeId, nombreCompleto
- sector
- puesto
- tipo, diagnostico
- fechaInicio, fechaFin, dias
- institucionMedica
- riesgoPuntaje, riesgoNivel
- estadoFinal (validado | rechazado)
- aprobadoPor, aprobadoEn
- creadoEn

5) `borradores/{draftId}`
- draftId
- employeeId, nombreCompleto
- sector
- puesto
- tipo, diagnostico, fechaInicio, fechaFin
- camposParciales (object)
- actualizadoEn

6) `planes_preventivos/{employeeId}`
- employeeId
- acciones[]
- seguimientos[]
- recomendaciones[]
- actualizadoEn, actualizadoPor

7) `patologias/{pathologyId}`
- pathologyId
- nombre
- cie10
- grupo
- riesgoBase (number)

8) `parametros_riesgo/{configId}`
- configId
- umbralAltoRiesgo (number)
- periodoEvaluacionMeses (number)
- factorRecurrencia (number)

9) `usuarios/{uid}`
- email
- nombreVisible
- rol

Notas
- Usar reference como docId en validaciones_medicas y historial_medico para evitar duplicados.
- Storage sugerido: certificados/{reference}/{filename}

## Diagrama (Mermaid)

```mermaid
erDiagram
  USUARIOS {
    string uid
    string email
    string nombreVisible
    string rol
  }

  EMPLEADOS {
    string employeeId
    string nombreCompleto
    string sector
    string puesto
    string legajoMedico
    boolean activo
    timestamp fechaAlta
    timestamp fechaBaja
  }

  AUSENCIAS {
    string absenceId
    string employeeId
    string nombreCompleto
    string sector
    string puesto
    string tipo
    string diagnostico
    timestamp fechaInicio
    timestamp fechaFin
    number dias
    string institucionMedica
    string estado
    timestamp creadoEn
    timestamp actualizadoEn
    string creadoPor
  }

  VALIDACIONES_MEDICAS {
    string reference
    string employeeId
    string nombreCompleto
    string sector
    string puesto
    string tipo
    string diagnostico
    timestamp fechaInicio
    timestamp fechaFin
    number dias
    string institucionMedica
    string prioridad
    string estado
    number riesgoPuntaje
    string riesgoNivel
    string notasMedicas
    string revisadoPor
    timestamp revisadoEn
    timestamp creadoEn
    timestamp actualizadoEn
  }

  HISTORIAL_MEDICO {
    string historyId
    string reference
    string employeeId
    string nombreCompleto
    string sector
    string puesto
    string tipo
    string diagnostico
    timestamp fechaInicio
    timestamp fechaFin
    number dias
    string institucionMedica
    number riesgoPuntaje
    string riesgoNivel
    string estadoFinal
    string aprobadoPor
    timestamp aprobadoEn
    timestamp creadoEn
  }

  BORRADORES {
    string draftId
    string employeeId
    string nombreCompleto
    string sector
    string puesto
    string tipo
    string diagnostico
    timestamp fechaInicio
    timestamp fechaFin
    object camposParciales
    timestamp actualizadoEn
  }

  PLANES_PREVENTIVOS {
    string employeeId
    string acciones
    string seguimientos
    string recomendaciones
    timestamp actualizadoEn
    string actualizadoPor
  }

  PATOLOGIAS {
    string pathologyId
    string nombre
    string cie10
    string grupo
    number riesgoBase
  }

  PARAMETROS_RIESGO {
    string configId
    number umbralAltoRiesgo
    number periodoEvaluacionMeses
    number factorRecurrencia
  }

  EMPLEADOS ||--o{ AUSENCIAS : tiene
  EMPLEADOS ||--o{ VALIDACIONES_MEDICAS : encola
  EMPLEADOS ||--o{ HISTORIAL_MEDICO : historial
  EMPLEADOS ||--o{ BORRADORES : borradores
  EMPLEADOS ||--|| PLANES_PREVENTIVOS : plan
  USUARIOS ||--o{ AUSENCIAS : crea
  USUARIOS ||--o{ VALIDACIONES_MEDICAS : revisa
```
