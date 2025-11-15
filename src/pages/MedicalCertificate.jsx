import { useState } from "react";
import AppHeader from "../components/AppHeader.jsx";
import DropdownSelect from "../components/DropdownSelect.jsx";

const certificateTypes = [
  { value: "certificado-medico", label: "Certificado Medico" },
  { value: "accidente-laboral", label: "Accidente Laboral" },
  { value: "reposo-prolongado", label: "Reposo Prolongado" },
  { value: "maternidad", label: "Maternidad" },
];

const statusOptions = [
  { value: "pendiente", label: "Pendiente" },
  { value: "validado", label: "Validado" },
  { value: "rechazado", label: "Rechazado" },
];

const sectionIcons = {
  identification: (
    <svg
      className="h-5 w-5 text-slate-700 dark:text-slate-200"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 20.25a8.25 8.25 0 0115 0"
      />
    </svg>
  ),
  upload: (
    <svg
      className="h-5 w-5 text-slate-700 dark:text-slate-200"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 15.75V19.5A1.5 1.5 0 004.5 21h15a1.5 1.5 0 001.5-1.5v-3.75"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7.5 10.5L12 6l4.5 4.5M12 6v12"
      />
    </svg>
  ),
  validation: (
    <svg
      className="h-5 w-5 text-slate-700 dark:text-slate-200"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 21h12a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H6A1.5 1.5 0 004.5 6v13.5A1.5 1.5 0 006 21z"
      />
    </svg>
  ),
  status: (
    <svg
      className="h-5 w-5 text-slate-700 dark:text-slate-200"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 10a8 8 0 0113.856-4.641"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20 14a8 8 0 01-13.856 4.641"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 10H2m2 0V8" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 14h2m-2 0v2" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  ),
};

const inputClasses =
  "w-full rounded-2xl border border-slate-400 bg-white px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-500 transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:bg-slate-100 disabled:text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-800 dark:disabled:bg-slate-900/80 dark:disabled:text-slate-500";

const textareaClasses =
  "w-full rounded-2xl border border-slate-400 bg-white px-4 py-3 text-sm font-semibold text-slate-900 placeholder:text-slate-500 transition focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-500 dark:focus:ring-slate-800";

function SectionCard({ title, description, icon, children }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-lg shadow-slate-300/30 ring-1 ring-slate-100 transition dark:bg-slate-950/80 dark:shadow-black/30 dark:ring-slate-900/50">
      <header className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {icon}
        </div>
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </header>
      {children}
    </section>
  );
}

function MedicalCertificate({ isDark, onToggleTheme }) {
  const [formValues, setFormValues] = useState({
    employeeId: "EMP-001",
    employeeName: "Maria Garcia Lopez",
    certificateType: "",
    referenceNumber: "",
    issueDate: "",
    validityDate: "",
    institution: "",
    notes: "",
    status: "pendiente",
  });

  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadError, setUploadError] = useState("");

  const MAX_FILE_SIZE_MB = 5;
  const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png"];
  const allowedExtensions = ["pdf", "jpg", "jpeg", "png"];

  const handleInputChange = (field) => (event) => {
    const value = event.target.value;
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleSelectChange = (field) => (value) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const sizeInMb = file.size / (1024 * 1024);
    const normalizedType = (file.type || "").toLowerCase();
    const extension = file.name.split(".").pop().toLowerCase();
    const isAllowedType =
      allowedMimeTypes.includes(normalizedType) ||
      allowedExtensions.includes(extension);
    if (!isAllowedType) {
      setUploadError("Formato no permitido. Solo PDF o imagenes (JPG/PNG).");
      setUploadedFile(null);
      event.target.value = "";
      return;
    }
    if (sizeInMb > MAX_FILE_SIZE_MB) {
      setUploadError("El archivo supera los 5 MB permitidos.");
      setUploadedFile(null);
      event.target.value = "";
      return;
    }
    setUploadError("");
    setUploadedFile({
      name: file.name,
      size: `${sizeInMb.toFixed(2)} MB`,
      uploadedAt: new Date().toLocaleString(),
    });
  };

  const clearUpload = () => {
    setUploadedFile(null);
    setUploadError("");
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-slate-100 via-blue-100 to-slate-200 transition dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
      <AppHeader
        active="Certificados Medicos"
        isDark={isDark}
        onToggleTheme={onToggleTheme}
      />

      <main className="flex w-full flex-col gap-6 px-4 pb-16 pt-10 sm:px-6 lg:px-10 lg:gap-8">
        <section className="mx-auto w-full max-w-5xl space-y-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Sistema para cargar y validar certificados medicos de empleados
            </p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
                Carga de Certificado Medico
              </h1>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="rounded-full border border-slate-300 px-3 py-1 dark:border-slate-700">
                  Ultima actualizacion: 12 Feb 2025 - 11:15 hs
                </span>
                <span className="hidden rounded-full border border-slate-300 px-3 py-1 dark:border-slate-700 md:block">
                  Estado global: Validacion Pendiente
                </span>
              </div>
            </div>
          </div>

          <SectionCard
            title="Identificacion del Empleado"
            description="Datos de identificacion del empleado titular del certificado"
            icon={sectionIcons.identification}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  ID Empleado
                </label>
                <input
                  type="text"
                  value={formValues.employeeId}
                  readOnly
                  className={`${inputClasses} bg-slate-50 dark:bg-slate-900/80`}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  value={formValues.employeeName}
                  readOnly
                  className={`${inputClasses} bg-slate-50 dark:bg-slate-900/80`}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Tipo de Certificado
                </label>
                <DropdownSelect
                  name="certificateType"
                  value={formValues.certificateType}
                  onChange={handleSelectChange("certificateType")}
                  options={certificateTypes}
                  placeholder="Selecciona el tipo de certificado"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Numero de Referencia
                </label>
                <input
                  type="text"
                  value={formValues.referenceNumber}
                  onChange={handleInputChange("referenceNumber")}
                  placeholder="CM-2024-001234"
                  className={inputClasses}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Subida de Archivo"
            description="Carga los documentos del certificado medico (PDF, JPG, PNG)"
            icon={sectionIcons.upload}
          >
            <div className="space-y-4">
              <label
                htmlFor="certificate-upload"
                className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-slate-400 bg-white py-10 text-center text-sm text-slate-600 transition hover:border-slate-500 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-900/80"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  className="h-10 w-10 text-slate-500 dark:text-slate-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M12 16V4m0 0l-3.5 3.5M12 4l3.5 3.5M4.5 20h15a1.5 1.5 0 001.5-1.5V12a1.5 1.5 0 00-1.5-1.5h-15A1.5 1.5 0 003 12v6.5A1.5 1.5 0 004.5 20z"
                  />
                </svg>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    Arrastra archivos aqui o haz clic para seleccionar
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Formatos admitidos: PDF, JPG, PNG - Tamano maximo: 5 MB
                  </p>
                </div>
                <span className="rounded-full border border-slate-400 px-5 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-500 hover:text-slate-900 dark:border-slate-600 dark:text-slate-200 dark:hover:border-slate-500">
                  Seleccionar Archivos
                </span>
              </label>
              <input
                id="certificate-upload"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleUpload}
              />
              {uploadError ? (
                <p className="text-xs font-semibold text-rose-500">
                  {uploadError}
                </p>
              ) : null}

              {uploadedFile ? (
                <div className="flex items-center justify-between rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  <div>
                    <p className="font-semibold">{uploadedFile.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Peso: {uploadedFile.size} � - Subido:{" "}
                      {uploadedFile.uploadedAt}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-600/20 dark:text-emerald-200">
                      Validado
                    </span>
                    <button
                      type="button"
                      aria-label="Ver archivo"
                      className="text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path d="M3 4.5A1.5 1.5 0 014.5 3h8.75l3 3V15.5A1.5 1.5 0 0114.75 17h-10A1.5 1.5 0 013 15.5v-11z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={clearUpload}
                      aria-label="Eliminar archivo"
                      className="text-rose-500 transition hover:text-rose-600"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4"
                      >
                        <path
                          fillRule="evenodd"
                          d="M12.75 4.5V4a1 1 0 00-1-1h-3.5a1 1 0 00-1 1v.5H4.25a.75.75 0 000 1.5h.465l.637 9.166A1.5 1.5 0 006.846 16.5h6.308a1.5 1.5 0 001.494-1.334l.637-9.166h.465a.75.75 0 000-1.5H12.75zm-4.5-.5h3.5V4h-3.5v.5zM8.75 8a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0V8zm3 0a.75.75 0 011.5 0v5a.75.75 0 01-1.5 0V8z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title="Validacion y Fechas"
            description="Informacion sobre la validez del certificado medico"
            icon={sectionIcons.validation}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Fecha de Emision
                </label>
                <input
                  type="date"
                  value={formValues.issueDate}
                  onChange={handleInputChange("issueDate")}
                  className={inputClasses}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Fecha de Validez
                </label>
                <input
                  type="date"
                  value={formValues.validityDate}
                  onChange={handleInputChange("validityDate")}
                  className={inputClasses}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Institucion Medica
                </label>
                <input
                  type="text"
                  value={formValues.institution}
                  onChange={handleInputChange("institution")}
                  placeholder="Hospital Central, Clinica San Jose, etc."
                  className={inputClasses}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Observaciones del Validador
                </label>
                <textarea
                  rows={3}
                  value={formValues.notes}
                  onChange={handleInputChange("notes")}
                  placeholder="Comentarios sobre la validacion del certificado..."
                  className={textareaClasses}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Estado y Acciones"
            description="Estado actual del certificado y acciones disponibles"
            icon={sectionIcons.status}
          >
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Estado del certificado
                  </label>
                  <DropdownSelect
                    name="status"
                    value={formValues.status}
                    onChange={handleSelectChange("status")}
                    options={statusOptions}
                    placeholder="Seleccionar estado"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Ultima actualizacion
                  </label>
                  <input
                    type="text"
                    value="04/07/2024 16:40 hs"
                    readOnly
                    className={`${inputClasses} bg-slate-50 dark:bg-slate-900/80`}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-xs text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200">
                <span className="font-semibold">Validacion Pendiente:</span> El
                certificado esta siendo revisado por el equipo medico. Este
                proceso puede demorar hasta 48 horas habiles.
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3"
                    >
                      <path d="M4 3a2 2 0 0 0-2 2v10.5A1.5 1.5 0 0 0 3.5 17h13a1.5 1.5 0 0 0 1.5-1.5V8.414a2 2 0 0 0-.586-1.414l-3.414-3.414A2 2 0 0 0 12.586 3H4Z" />
                      <path d="M10.5 4.5h2.086c.133 0 .26.053.354.146l2.414 2.414A.5.5 0 0 1 15.5 7.5h-5V4.5Z" />
                    </svg>
                  </span>
                  Guardar Borrador
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-slate-500/30 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-white dark:text-slate-900 dark:shadow-slate-900/30 dark:hover:bg-slate-100"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-900 dark:bg-slate-900 dark:text-white">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3"
                    >
                      <path d="M2.94 2.94a1.5 1.5 0 0 1 1.527-.381l12.5 4.167a1.5 1.5 0 0 1 .125 2.831l-5.185 2.26-2.26 5.185a1.5 1.5 0 0 1-2.83-.125l-4.168-12.5a1.5 1.5 0 0 1 .291-1.437Z" />
                    </svg>
                  </span>
                  Solicitar Revision
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-slate-100"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-3 w-3"
                    >
                      <path d="M4 4a2 2 0 012-2h8a2 2 0 012 2v10.5l-4-2-4 2V4H4z" />
                    </svg>
                  </span>
                  Generar Reporte
                </button>
              </div>
            </div>
          </SectionCard>
        </section>
      </main>
    </div>
  );
}

export default MedicalCertificate;
