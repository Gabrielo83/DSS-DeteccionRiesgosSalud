# Esquema Firestore (Propuesta)

## Colecciones y documentos

1) `employees/{employeeId}`
- employeeId (string)
- fullName
- sector
- position
- medicalRecordId
- active (bool)
- startDate (timestamp)
- endDate (timestamp | null)

2) `absences/{absenceId}`
- absenceId (string)
- employeeId
- fullName
- sector
- position
- type (accidente/enfermedad/...)
- diagnosis
- startDate (timestamp)
- endDate (timestamp)
- days (number)
- medicalInstitution
- certificateFile
  - name
  - size
  - contentType
  - storagePath
- status (draft | submitted)
- createdAt, updatedAt
- createdBy (userId/email)

3) `medical_validations/{reference}`
- reference (CM-..., docId)
- employeeId, fullName
- sector
- position
- type, diagnosis
- startDate, endDate, days
- medicalInstitution
- priority (Alta/Media/Baja)
- status (pendiente | en_revision | validado | rechazado)
- riskScore (number)
- riskLevel (alta/media/baja)
- medicalNotes
- reviewedBy, reviewedAt
- createdAt, updatedAt

4) `medical_history/{historyId}`
- historyId (string, usar reference)
- reference
- employeeId, fullName
- sector
- position
- type, diagnosis
- startDate, endDate, days
- medicalInstitution
- riskScore, riskLevel
- finalStatus (validado | rechazado)
- approvedBy, approvedAt
- createdAt

5) `drafts/{draftId}`
- draftId
- employeeId, fullName
- sector
- position
- type, diagnosis, startDate, endDate
- partialFields (object)
- updatedAt

6) `preventive_plans/{employeeId}`
- employeeId
- actions[]
- followUps[]
- recommendations[]
- updatedAt, updatedBy

7) `pathologies/{pathologyId}`
- pathologyId
- name
- cie10Code
- group
- baseRisk (number)

8) `risk_parameters/{configId}`
- configId
- highRiskThreshold (number)
- reviewPeriodMonths (number)
- recurrenceFactor (number)

9) `users/{uid}`
- email
- displayName
- role

Notas
- Usar reference como docId en medical_validations y medical_history para evitar duplicados.
- Storage sugerido: certificates/{reference}/{filename}

## Diagrama (Mermaid)

```mermaid
erDiagram
  USERS {
    string uid
    string email
    string displayName
    string role
  }

  EMPLOYEES {
    string employeeId
    string fullName
    string sector
    string position
    string medicalRecordId
    boolean active
    timestamp startDate
    timestamp endDate
  }

  ABSENCES {
    string absenceId
    string employeeId
    string fullName
    string sector
    string position
    string type
    string diagnosis
    timestamp startDate
    timestamp endDate
    number days
    string medicalInstitution
    string status
    timestamp createdAt
    timestamp updatedAt
    string createdBy
  }

  MEDICAL_VALIDATIONS {
    string reference
    string employeeId
    string fullName
    string sector
    string position
    string type
    string diagnosis
    timestamp startDate
    timestamp endDate
    number days
    string medicalInstitution
    string priority
    string status
    number riskScore
    string riskLevel
    string medicalNotes
    string reviewedBy
    timestamp reviewedAt
    timestamp createdAt
    timestamp updatedAt
  }

  MEDICAL_HISTORY {
    string historyId
    string reference
    string employeeId
    string fullName
    string sector
    string position
    string type
    string diagnosis
    timestamp startDate
    timestamp endDate
    number days
    string medicalInstitution
    number riskScore
    string riskLevel
    string finalStatus
    string approvedBy
    timestamp approvedAt
    timestamp createdAt
  }

  DRAFTS {
    string draftId
    string employeeId
    string fullName
    string sector
    string position
    string type
    string diagnosis
    timestamp startDate
    timestamp endDate
    object partialFields
    timestamp updatedAt
  }

  PREVENTIVE_PLANS {
    string employeeId
    string actions
    string followUps
    string recommendations
    timestamp updatedAt
    string updatedBy
  }

  PATHOLOGIES {
    string pathologyId
    string name
    string cie10Code
    string group
    number baseRisk
  }

  RISK_PARAMETERS {
    string configId
    number highRiskThreshold
    number reviewPeriodMonths
    number recurrenceFactor
  }

  EMPLOYEES ||--o{ ABSENCES : has
  EMPLOYEES ||--o{ MEDICAL_VALIDATIONS : queues
  EMPLOYEES ||--o{ MEDICAL_HISTORY : history
  EMPLOYEES ||--o{ DRAFTS : drafts
  EMPLOYEES ||--|| PREVENTIVE_PLANS : plan
  USERS ||--o{ ABSENCES : creates
  USERS ||--o{ MEDICAL_VALIDATIONS : reviews
```
