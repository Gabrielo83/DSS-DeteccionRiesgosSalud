import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle.jsx";
import { MOCK_USERS } from "../data/mockUsers.js";
import { isFirebaseProvider } from "../services/appMode.js";
import { appendAuditLog } from "../utils/auditLog.js";
import {
  clearLoginFailures,
  formatLockRemaining,
  getLoginLockStatus,
  registerLoginFailure,
  validatePasswordPolicy,
} from "../utils/passwordPolicy.js";

function Login({
  isDark,
  onToggleTheme,
  onLoginSuccess,
  isAuthenticated,
  isAuthReady,
  userRole,
  roleMissing,
}) {
  const navigate = useNavigate();
  const [formValues, setFormValues] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isFirebaseEnabled = isFirebaseProvider();
  const passwordValidation = validatePasswordPolicy(formValues.password);

  const registerFailedAttempt = (email, metadata = {}) => {
    const lockStatus = registerLoginFailure(email);
    appendAuditLog("login_failure", {
      user: email,
      metadata: {
        ...metadata,
        failedAttempts: lockStatus.attempts,
        locked: lockStatus.locked,
      },
    });

    if (lockStatus.locked) {
      setError(
        `Acceso bloqueado temporalmente por intentos reiterados. Intenta nuevamente en ${formatLockRemaining(
          lockStatus.lockedUntil,
        )}.`,
      );
      return;
    }

    setError(
      `Credenciales invalidas. Intentos restantes antes del bloqueo: ${lockStatus.remainingAttempts}.`,
    );
  };

  useEffect(() => {
    if (isAuthenticated && userRole) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAuthenticated, navigate, userRole]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (isSubmitting) return;
    const email = formValues.email.trim();
    const password = formValues.password;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !password) {
      setError("Completa el correo y la contrasena para continuar.");
      return;
    }

    if (!emailPattern.test(email)) {
      setError("Ingresa un correo valido (ej: superadmin@empresa.com).");
      return;
    }

    const lockStatus = getLoginLockStatus(email);

    if (lockStatus.locked) {
      setError(
        `Acceso bloqueado temporalmente por intentos reiterados. Intenta nuevamente en ${formatLockRemaining(
          lockStatus.lockedUntil,
        )}.`,
      );
      appendAuditLog("login_blocked", {
        user: email,
        metadata: {
          reason: "too-many-failed-attempts",
          lockedUntil: new Date(lockStatus.lockedUntil).toISOString(),
        },
      });
      return;
    }

    if (!passwordValidation.isValid) {
      setError(
        "La contrasena debe tener al menos 8 caracteres, incluir mayusculas, minusculas, numeros y simbolos.",
      );
      return;
    }

    if (isFirebaseEnabled) {
      setIsSubmitting(true);
      import("../utils/firebaseAuth.js")
        .then(({ signInWithEmail }) => signInWithEmail(email, password))
        .then(() => {
          clearLoginFailures(email);
          setError("");
          appendAuditLog("login_success", {
            user: email,
            role: "firebase-pendiente",
          });
        })
        .catch((authError) => {
          const message =
            authError?.code === "auth/invalid-credential"
              ? "Credenciales invalidas."
              : "No se pudo iniciar sesion. Verifica tus datos.";
          registerFailedAttempt(email, {
            code: authError?.code || "firebase-auth-error",
            provider: "firebase",
          });
          if (authError?.code !== "auth/invalid-credential") {
            setError(message);
          }
        })
        .finally(() => {
          setIsSubmitting(false);
        });
      return;
    }

    const matchedUser = MOCK_USERS.find(
      (user) =>
        user.email.toLowerCase() === email.toLowerCase() &&
        user.password === password,
    );

    if (!matchedUser) {
      registerFailedAttempt(email, {
        mode: "local",
      });
      return;
    }

    clearLoginFailures(email);
    setError("");
    setIsSubmitting(true);
    if (typeof onLoginSuccess === "function") {
      onLoginSuccess(matchedUser);
    }
    navigate("/dashboard");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-100 to-slate-200 px-4 py-6 transition dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 md:py-4">
      <ThemeToggle
        isDark={isDark}
        onToggle={onToggleTheme}
        className="absolute right-4 top-4 md:right-6 md:top-6"
      />

      <main className="relative flex w-full max-w-md flex-col items-center gap-6 text-center sm:max-w-lg md:gap-5">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-900 text-white shadow-lg shadow-slate-400/40 ring ring-white/10 dark:bg-slate-200 dark:text-slate-900 dark:shadow-slate-900/30 md:h-18 md:w-18">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            className="h-9 w-9 md:h-9 md:w-9"
            role="img"
            aria-label="Icono sistema"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16l-6-3-6 3V4z"
            />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 11h6" />
          </svg>
        </div>

        <section className="space-y-1">
          <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100 md:text-2xl">
            Sistema de Gestion de Riesgos de Salud
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-300 md:text-base">
            Inicia sesion para acceder al sistema
          </p>
        </section>

        <section className="w-full rounded-3xl bg-white px-6 py-8 text-left shadow-2xl shadow-slate-300/40 ring-1 ring-black/5 transition dark:bg-slate-950/80 dark:shadow-black/40 dark:ring-white/10 sm:px-8 sm:py-9 md:py-10">
          <div className="space-y-4 md:space-y-8">
            <header className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white md:text-xl">
                Iniciar Sesion
              </h2>
              <p className="text-sm text-slate-500 dark:text-slate-300">
                Ingresa tus credenciales para continuar
              </p>
            </header>

            <form
              className="space-y-5 md:space-y-6"
              onSubmit={handleSubmit}
              noValidate
            >
              <div className="space-y-2">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-slate-900 dark:text-slate-200"
                >
                  Correo Electronico
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21.75 6.75v10.5A2.25 2.25 0 0 1 19.5 19.5h-15A2.25 2.25 0 0 1 2.25 17.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15A2.25 2.25 0 0 0 2.25 6.75m19.5 0L12 13.5 2.25 6.75"
                      />
                    </svg>
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    placeholder="usuario@empresa.com"
                    value={formValues.email}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-400 bg-white px-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:bg-slate-950"
                  />
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300">
                  <p className="mb-1 font-semibold text-slate-700 dark:text-slate-200">
                    Politica de contrasena
                  </p>
                  <ul className="grid gap-1 sm:grid-cols-2">
                    {passwordValidation.requirements.map((requirement) => (
                      <li
                        key={requirement.id}
                        className={
                          requirement.passed
                            ? "text-emerald-600 dark:text-emerald-300"
                            : "text-slate-500 dark:text-slate-400"
                        }
                      >
                        <span aria-hidden="true">
                          {requirement.passed ? "OK" : "-"}
                        </span>{" "}
                        {requirement.label}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="password"
                  className="text-sm font-medium text-slate-900 dark:text-slate-200"
                >
                  {"Contrase\u00f1a"}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400 dark:text-slate-500">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0V10.5M3.75 10.5h16.5A1.5 1.5 0 0121.75 12v7.5a1.5 1.5 0 01-1.5 1.5H3.75a1.5 1.5 0 01-1.5-1.5V12a1.5 1.5 0 011.5-1.5z"
                      />
                    </svg>
                  </span>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    aria-label="Contrasena"
                    placeholder="Ingresa tu contrasena"
                    value={formValues.password}
                    onChange={handleChange}
                    className="w-full rounded-2xl border border-slate-400 bg-white px-11 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus:border-sky-500 dark:focus:bg-slate-950"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-2xl bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white shadow-lg shadow-slate-400/40 transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:shadow-slate-900/40 dark:hover:bg-white"
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-flex h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white dark:border-slate-900/40 dark:border-t-slate-900" />
                    Ingresando...
                  </span>
                ) : (
                  "Ingresar al Sistema"
                )}
              </button>

              {error ? (
                <p className="text-xs font-medium text-rose-500">{error}</p>
              ) : null}
              {!isAuthReady ? (
                <p className="text-xs font-medium text-slate-500 dark:text-slate-300">
                  Conectando...
                </p>
              ) : null}
              {roleMissing ? (
                <p className="text-xs font-medium text-amber-600 dark:text-amber-300">
                  No se encontro un rol habilitado para este usuario.
                </p>
              ) : null}
            </form>

            <div className="space-y-3 text-sm">
              {/* 
              <div className="rounded-2xl bg-slate-50 px-4 py-3 text-left text-xs text-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
                <p className="mb-1 font-semibold text-slate-900 dark:text-white">
                  Usuarios demo disponibles
                </p>
                <ul className="space-y-1">
                  {MOCK_USERS.map((user) => (
                    <li key={user.role}>
                      <span className="font-semibold">{user.roleLabel}:</span>{" "}
                      <span className="font-mono text-[11px]">
                        {user.email}
                      </span>{" "}
                      /{" "}
                      <span className="font-mono text-[11px]">
                        {user.password}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            */}
              <a
                href="#"
                className="font-medium text-slate-500 underline-offset-4 transition hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
              >
                Olvidaste tu contrasena?
              </a>
            </div>
          </div>
        </section>

        <footer className="text-xs text-slate-500 dark:text-slate-300">
          2025 Sistema de Gestion Ausentismos
        </footer>
      </main>
    </div>
  );
}

export default Login;
