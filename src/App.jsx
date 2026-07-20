import { Navigate, Route, Routes } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import Dashboard from "./pages/Dashboard.jsx";
import Login from "./pages/Login.jsx";
import RegisterAbsence from "./pages/RegisterAbsence.jsx";
import MedicalCertificate from "./pages/MedicalCertificate.jsx";
import MedicalValidation from "./pages/MedicalValidation.jsx";
import MedicalRecords from "./pages/MedicalRecords.jsx";
import AuthContext from "./context/AuthContext.jsx";
import { MOCK_USERS } from "./data/mockUsers.js";
import { startQueueSync } from "./utils/operationQueue.js";
import { appendAuditLog } from "./utils/auditLog.js";
import { isFirebaseProvider } from "./services/appMode.js";
import { initializePerformanceMonitoring } from "./services/observability.js";
import { clearSensitiveOperationalCache } from "./utils/sensitiveCache.js";
import { registerOfflineShell } from "./services/offlineShell.js";
import { DASHBOARD_SYNC_INTERVAL_MS } from "./utils/syncStatus.js";

const SESSION_TIMEOUT_MS = 20 * 60 * 1000;
const SESSION_LAST_ACTIVITY_KEY = "sessionLastActivityAt";

const ROLE_PERMISSIONS = {
  superAdmin: ["dashboard", "registro", "certificados", "validacion", "legajos"],
  medico: ["dashboard", "registro", "certificados", "validacion", "legajos"],
  administrativo: ["dashboard", "registro", "certificados"],
  administrativoSalud: ["dashboard", "registro", "certificados", "legajos"],
  gerente: ["dashboard"],
  respRRHH: ["dashboard", "registro"],
};

const ROUTE_ACCESS = {
  dashboard: [
    "superAdmin",
    "medico",
    "administrativo",
    "administrativoSalud",
    "gerente",
    "respRRHH",
  ],
  registro: [
    "superAdmin",
    "medico",
    "administrativo",
    "administrativoSalud",
    "respRRHH",
  ],
  certificados: ["superAdmin", "medico", "administrativo", "administrativoSalud"],
  validacion: ["superAdmin", "medico"],
  legajos: ["superAdmin", "medico", "administrativoSalud"],
};

const clearStoredSession = () => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem("sessionRole");
  window.localStorage.removeItem("sessionEmail");
  window.localStorage.removeItem(SESSION_LAST_ACTIVITY_KEY);
};

const isStoredSessionExpired = () => {
  if (typeof window === "undefined") return false;
  const raw = Number(window.localStorage.getItem(SESSION_LAST_ACTIVITY_KEY));
  if (!Number.isFinite(raw) || raw <= 0) return false;
  return Date.now() - raw > SESSION_TIMEOUT_MS;
};

const AuthRestoreScreen = () => (
  <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-blue-100 to-slate-200 transition dark:from-slate-950 dark:via-slate-900 dark:to-slate-900">
    <span
      role="status"
      aria-label="Restaurando sesion"
      className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400/40 border-t-slate-900 dark:border-slate-500/40 dark:border-t-slate-100"
    />
  </div>
);

function App() {
  const isFirebaseEnabled = isFirebaseProvider();
  const initialUser =
    !isFirebaseEnabled && typeof window !== "undefined"
      ? (() => {
          if (isStoredSessionExpired()) {
            const expiredEmail = window.localStorage.getItem("sessionEmail");
            appendAuditLog("session_expired", {
              user: expiredEmail || "sesion-local",
            });
            clearStoredSession();
            return null;
          }
          const email = window.localStorage.getItem("sessionEmail");
          if (!email) return null;
          return MOCK_USERS.find((user) => user.email === email) ?? null;
        })()
      : null;

  const [isDark, setIsDark] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("theme") === "dark";
  });
  const [currentUser, setCurrentUser] = useState(initialUser);
  const [userRole, setUserRole] = useState(initialUser?.role ?? null);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(initialUser));
  const [isAuthReady, setIsAuthReady] = useState(!isFirebaseEnabled);
  const [roleMissing, setRoleMissing] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
      window.localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      window.localStorage.setItem("theme", "light");
    }
  }, [isDark]);

  const toggleTheme = () => setIsDark((value) => !value);

  const handleLoginSuccess = (user) => {
    if (isFirebaseEnabled) return;
    setCurrentUser(user);
    setUserRole(user.role);
    setIsAuthenticated(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("sessionRole", user.role);
      window.localStorage.setItem("sessionEmail", user.email);
      window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
    }
    appendAuditLog("login_success", {
      user: user.email,
      role: user.role,
    });
  };

  useEffect(() => {
    if (!isAuthenticated || !currentUser) return undefined;
    const ownerIds = [currentUser.uid, currentUser.email].filter(Boolean);
    const stop = startQueueSync(undefined, { ownerIds });
    return () => {
      if (typeof stop === "function") stop();
    };
  }, [currentUser, isAuthenticated]);

  useEffect(() => {
    if (!isFirebaseEnabled) return;
    initializePerformanceMonitoring();
    registerOfflineShell().catch((error) => {
      console.warn("No se pudo registrar el shell offline:", error);
    });
  }, [isFirebaseEnabled]);

  useEffect(() => {
    if (!isFirebaseEnabled) return undefined;
    let unsubscribe;
    let isCancelled = false;
    import("./utils/firebaseAuth.js")
      .then(({ onAuthChange }) => {
        if (isCancelled) return;
        unsubscribe = onAuthChange((user) => {
          setCurrentUser(user);
          setUserRole(user?.role ?? null);
          setIsAuthenticated(Boolean(user));
          setIsAuthReady(true);
          setRoleMissing(Boolean(user) && !user?.role);
          if (user && !user.role) {
            appendAuditLog("user_role_missing", {
              user: user.email,
              role: "sin-rol",
              entityId: user.uid,
            });
          }
        });
      })
      .catch((error) => {
        console.warn("No se pudo iniciar la autenticacion remota:", error);
        if (!isCancelled) {
          setIsAuthReady(true);
          setRoleMissing(false);
        }
      });
    return () => {
      isCancelled = true;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [isFirebaseEnabled]);

  useEffect(() => {
    if (!isFirebaseEnabled || !isAuthenticated || !userRole) return undefined;
    let cancelled = false;
    let unsubscribeRealtime;
    let hydrationTimeoutId;
    let hydrating = false;
    const hydrate = () => {
      if (cancelled || hydrating) return;
      window.clearTimeout(hydrationTimeoutId);
      hydrating = true;
      import("./services/firebase/firestoreHydration.js")
        .then(({ hydrateFirebaseData }) =>
          hydrateFirebaseData({ user: currentUser, role: userRole }),
        )
        .catch((error) => {
          if (cancelled) return;
          appendAuditLog("firebase_hydration_failed", {
            user: currentUser?.email,
            role: userRole,
            metadata: { error: error?.message || "Error desconocido" },
          });
        })
        .finally(() => {
          hydrating = false;
          if (!cancelled) {
            hydrationTimeoutId = window.setTimeout(
              hydrate,
              DASHBOARD_SYNC_INTERVAL_MS,
            );
          }
        });
    };
    const onlineHandler = () => hydrate();
    hydrate();
    window.addEventListener("online", onlineHandler);
    import("./services/firebase/firestoreHydration.js")
      .then(({ startFirebaseRealtimeSync }) => {
        if (cancelled) return;
        unsubscribeRealtime = startFirebaseRealtimeSync({
          user: currentUser,
          role: userRole,
        });
      })
      .catch((error) => {
        if (cancelled) return;
        appendAuditLog("firebase_realtime_sync_failed", {
          user: currentUser?.email,
          role: userRole,
          metadata: { error: error?.message || "Error desconocido" },
        });
      });
    return () => {
      cancelled = true;
      if (typeof unsubscribeRealtime === "function") {
        unsubscribeRealtime();
      }
      window.removeEventListener("online", onlineHandler);
      window.clearTimeout(hydrationTimeoutId);
    };
  }, [currentUser, isAuthenticated, isFirebaseEnabled, userRole]);

  const handleLogout = useCallback(
    (reason = "manual") => {
      const previousUser = currentUser;
      const previousRole = userRole;

      if (isFirebaseEnabled) {
        import("./utils/firebaseAuth.js")
          .then(({ signOutUser }) => signOutUser())
          .catch((error) => {
            console.warn("No se pudo cerrar la sesion remota:", error);
          });
      }

      setCurrentUser(null);
      setUserRole(null);
      setIsAuthenticated(false);
      setRoleMissing(false);
      clearStoredSession();
      if (isFirebaseEnabled) clearSensitiveOperationalCache();
      appendAuditLog(reason === "timeout" ? "session_expired" : "logout", {
        user: previousUser?.email || "sesion-local",
        role: previousRole || "sin-rol",
        metadata: { reason },
      });
    },
    [currentUser, isFirebaseEnabled, userRole],
  );

  const ProtectedRoute = ({ children, allowedRoles }) => {
    if (!isAuthReady) {
      return <AuthRestoreScreen />;
    }
    if (!isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    if (!userRole) return <Navigate to="/" replace />;
    if (allowedRoles && !allowedRoles.includes(userRole)) {
      appendAuditLog("route_denied", {
        user: currentUser?.email,
        role: userRole,
        metadata: { allowedRoles },
      });
      return <Navigate to="/dashboard" replace />;
    }
    return children;
  };

  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated) return undefined;

    const markActivity = () => {
      window.localStorage.setItem(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
    };
    const validateSession = () => {
      if (isStoredSessionExpired()) {
        handleLogout("timeout");
      }
    };
    const events = ["click", "keydown", "mousemove", "focus"];
    events.forEach((eventName) =>
      window.addEventListener(eventName, markActivity),
    );
    markActivity();
    const intervalId = window.setInterval(validateSession, 60 * 1000);

    return () => {
      events.forEach((eventName) =>
        window.removeEventListener(eventName, markActivity),
      );
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, handleLogout]);

  const renderProtected = (Component, accessKey) => (
    <ProtectedRoute allowedRoles={ROUTE_ACCESS[accessKey]}>
      <Component isDark={isDark} onToggleTheme={toggleTheme} />
    </ProtectedRoute>
  );

  const authValue = {
    role: userRole,
    user: currentUser,
    isAuthenticated,
    allowedRoutes: userRole ? ROLE_PERMISSIONS[userRole] ?? [] : [],
    logout: handleLogout,
  };

  return (
    <AuthContext.Provider value={authValue}>
      <Routes>
        <Route
          path="/"
          element={
            <Login
              isDark={isDark}
              onToggleTheme={toggleTheme}
              onLoginSuccess={handleLoginSuccess}
              isAuthenticated={isAuthenticated}
              isAuthReady={isAuthReady}
              userRole={userRole}
              roleMissing={roleMissing}
            />
          }
        />
        <Route
          path="/dashboard"
          element={renderProtected(Dashboard, "dashboard")}
        />
        <Route
          path="/registro-ausencia"
          element={renderProtected(RegisterAbsence, "registro")}
        />
        <Route
          path="/certificados-medicos"
          element={renderProtected(MedicalCertificate, "certificados")}
        />
        <Route
          path="/validacion-medica"
          element={renderProtected(MedicalValidation, "validacion")}
        />
        <Route
          path="/legajos-medicos"
          element={renderProtected(MedicalRecords, "legajos")}
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthContext.Provider>
  );
}

export default App;
