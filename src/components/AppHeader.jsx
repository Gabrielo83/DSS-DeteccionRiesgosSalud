import { Link, useNavigate } from "react-router-dom";
import { useContext, useEffect, useMemo, useRef, useState } from "react";
import ThemeToggle from "./ThemeToggle.jsx";
import AuthContext from "../context/AuthContext.jsx";
import { readValidationQueue } from "../utils/validationStorage.js";
import {
  MEDICAL_VALIDATIONS_UPDATED_EVENT,
  ABSENCE_DRAFTS_UPDATED_EVENT,
  AUDIT_LOG_UPDATED_EVENT,
} from "../utils/storageKeys.js";
import { readDrafts } from "../utils/draftStorage.js";
import { readAuditLog } from "../utils/auditLog.js";
import { getDataProvider, DATA_PROVIDERS } from "../services/appMode.js";

const navLinks = [
  {
    key: "dashboard",
    label: "Panel de Control",
    href: "/dashboard",
    icon: DashboardIcon,
  },
  {
    key: "registro",
    label: "Registro Ausencia",
    href: "/registro-ausencia",
    icon: UserIcon,
  },
  {
    key: "validacion",
    label: "Validacion Medica",
    href: "/validacion-medica",
    icon: StethoscopeIcon,
  },
  {
    key: "legajos",
    label: "Legajos Medicos",
    href: "/legajos-medicos",
    icon: FolderIcon,
  },
];

const BASE_PENDING_VALIDATIONS = 0;
const ACKNOWLEDGED_NOTIFICATIONS_KEY = "app_acknowledged_notifications";
const MAX_ACKNOWLEDGED_NOTIFICATIONS = 200;

const notificationToneMap = {
  rose:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100",
  amber:
    "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100",
  sky:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-100",
  slate:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200",
};

const formatNotificationTime = (value) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const readAcknowledgedNotifications = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(ACKNOWLEDGED_NOTIFICATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.warn("No se pudieron leer las notificaciones atendidas:", error);
    return [];
  }
};

const saveAcknowledgedNotifications = (items) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    ACKNOWLEDGED_NOTIFICATIONS_KEY,
    JSON.stringify(items.slice(0, MAX_ACKNOWLEDGED_NOTIFICATIONS)),
  );
};

const buildCertificateDecisionNotification = (event, fallbackHref) => {
  const status = String(event.metadata?.status || "").toLowerCase();
  const reference = event.entityId || event.metadata?.reference || "certificado";
  const ackKey = `audit:${event.id}`;
  if (status.includes("rechaz")) {
    return {
      id: event.id,
      ackKey,
      tone: "rose",
      title: "Certificado rechazado",
      description: `El certificado ${reference} requiere correccion o seguimiento.`,
      meta: formatNotificationTime(event.timestamp),
      href: fallbackHref,
    };
  }
  if (status.includes("revision")) {
    return {
      id: event.id,
      ackKey,
      tone: "amber",
      title: "Certificado en revision",
      description: `El certificado ${reference} quedo pendiente de evaluacion.`,
      meta: formatNotificationTime(event.timestamp),
      href: fallbackHref,
    };
  }
  return {
    id: event.id,
    ackKey,
    tone: "slate",
    title: "Certificado validado",
    description: `Medicina Laboral reviso el certificado ${reference}.`,
    meta: formatNotificationTime(event.timestamp),
    href: fallbackHref,
  };
};

const buildSecurityAuditNotification = (event, fallbackHref) => {
  const ackKey = `audit:${event.id}`;
  if (event.eventType === "route_denied") {
    return {
      id: event.id,
      ackKey,
      tone: "rose",
      title: "Acceso restringido detectado",
      description: "Se registro un intento de acceso fuera de permisos.",
      meta: formatNotificationTime(event.timestamp),
      href: fallbackHref,
    };
  }
  if (event.eventType === "session_expired") {
    return {
      id: event.id,
      ackKey,
      tone: "amber",
      title: "Sesion expirada por inactividad",
      description: "Una sesion fue cerrada automaticamente por seguridad.",
      meta: formatNotificationTime(event.timestamp),
      href: fallbackHref,
    };
  }
  return null;
};

const roleDisplayMap = {
  superAdmin: "Super Admin",
  medico: "Medico Laboral",
  administrativo: "Administrativo",
  administrativoSalud: "Administrativo Salud Ocupacional",
  gerente: "Gerente",
  respRRHH: "Responsable RRHH",
};

function DashboardIcon({ className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`h-4 w-4 ${className}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 6h6v6H4zM4 16h6v4H4zM14 4h6v8h-6zM14 16h6v4h-6z"
      />
    </svg>
  );
}

function UserIcon({ className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`h-4 w-4 ${className}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4.5 20.25a8.25 8.25 0 0115 0"
      />
    </svg>
  );
}

function DocumentIcon({ className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`h-4 w-4 ${className}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 7h6M9 11h6M9 15h4M6 3h8l4 4v14H6z"
      />
    </svg>
  );
}

function StethoscopeIcon({ className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`h-4 w-4 ${className}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 4v6a4 4 0 008 0V4"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 14v4a4 4 0 004 4h1a3 3 0 003-3v-1a3 3 0 00-3-3h-1"
      />
    </svg>
  );
}

function LogoIcon({ className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`h-6 w-6 ${className}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M7 4a1 1 0 011-1h8a1 1 0 011 1v16l-5-2-5 2V4z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6M9 12h4" />
    </svg>
  );
}

function FolderIcon({ className = "" }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      className={`h-4 w-4 ${className}`}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7.5A2.5 2.5 0 015.5 5H9l2 2h7.5A2.5 2.5 0 0121 9.5v8A2.5 2.5 0 0118.5 20h-13A2.5 2.5 0 013 17.5v-10z"
      />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M3 5h14a1 1 0 100-2H3a1 1 0 100 2zm0 6h14a1 1 0 100-2H3a1 1 0 100 2zm0 6h14a1 1 0 100-2H3a1 1 0 100 2z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  )
}

function AppHeader({ active, isDark, onToggleTheme }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const notificationsRef = useRef(null);
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const [validationQueue, setValidationQueue] = useState(() => {
    if (typeof window === "undefined") return [];
    return readValidationQueue();
  });
  const [absenceDrafts, setAbsenceDrafts] = useState(() => {
    if (typeof window === "undefined") return [];
    return readDrafts();
  });
  const [auditEvents, setAuditEvents] = useState(() => {
    if (typeof window === "undefined") return [];
    return readAuditLog();
  });
  const [acknowledgedNotifications, setAcknowledgedNotifications] = useState(
    () => readAcknowledgedNotifications(),
  );
  const allowedKeys =
    auth?.allowedRoutes && auth.allowedRoutes.length > 0
      ? auth.allowedRoutes
      : navLinks.map((link) => link.key);
  const filteredNavLinks = navLinks.filter((link) =>
    allowedKeys.includes(link.key)
  );

  const userName = auth?.user?.fullName ?? "Gabriel Caamano";
  const roleLabel =
    auth?.user?.roleLabel ??
    (auth?.role ? roleDisplayMap[auth.role] ?? auth.role : "Admin RRHH");
  const dataProvider = getDataProvider();
  const isFirebaseMode = dataProvider === DATA_PROVIDERS.firebase;
  const providerRingClass = isFirebaseMode
    ? "ring-2 ring-emerald-400 ring-offset-2 ring-offset-white dark:ring-emerald-300 dark:ring-offset-slate-900"
    : "ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-amber-300 dark:ring-offset-slate-900";

  const initials = useMemo(() => {
    if (!userName) return "GC";
    return userName
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }, [userName]);
  const pendingExtras = useMemo(
    () =>
      validationQueue.filter(
        (item) => (item.status || "").toLowerCase() === "pendiente",
      ).length,
    [validationQueue],
  );
  const validationBadge = BASE_PENDING_VALIDATIONS + pendingExtras;
  const draftsBadge = absenceDrafts.length;

  const notifications = useMemo(() => {
    const items = [];
    const acknowledgedSet = new Set(acknowledgedNotifications);
    const isSuperAdmin = auth?.role === "superAdmin";
    const canValidate = allowedKeys.includes("validacion");
    const canRegister = allowedKeys.includes("registro");
    const canDashboard = allowedKeys.includes("dashboard");
    const certificateDecisionHref = allowedKeys.includes("legajos")
      ? "/legajos-medicos"
      : canDashboard
        ? "/dashboard"
        : filteredNavLinks[0]?.href || "/";
    const securityHref = canDashboard
      ? "/dashboard"
      : filteredNavLinks[0]?.href || "/";
    const validationWork = validationQueue.filter((item) => {
      const status = (item.status || "").toLowerCase();
      return status.includes("pendiente") || status.includes("revision");
    });
    const registerReviewWork = validationQueue.filter((item) => {
      const status = (item.status || "").toLowerCase();
      return status.includes("revision");
    });
    const highPriority = validationWork.filter(
      (item) => (item.priority || "").toLowerCase() === "alta",
    );

    if (canValidate && highPriority.length > 0) {
      items.push({
        id: "high-priority-validations",
        tone: "rose",
        title: "Certificados de prioridad alta",
        description: `${highPriority.length} requieren revision medica prioritaria.`,
        meta: "Motor de riesgo",
        href: "/validacion-medica",
      });
    }

    if (canValidate && validationWork.length > 0) {
      items.push({
        id: "pending-validations",
        tone: "amber",
        title: "Validaciones pendientes",
        description: `${validationWork.length} certificados esperan decision medica.`,
        meta: "Validacion Medica",
        href: "/validacion-medica",
      });
    }

    if (!canValidate && canRegister && registerReviewWork.length > 0) {
      items.push({
        id: "certificate-revisions",
        tone: "amber",
        title: "Certificados para revision",
        description: `${registerReviewWork.length} requieren correccion o seguimiento administrativo.`,
        meta: "Registro de Ausencia",
        href: "/registro-ausencia",
      });
    }

    if (canRegister && absenceDrafts.length > 0) {
      items.push({
        id: "absence-drafts",
        tone: "sky",
        title: "Registros incompletos",
        description: `${absenceDrafts.length} borradores de ausencia guardados.`,
        meta: "Registro de Ausencia",
        href: "/registro-ausencia",
      });
    }

    auditEvents.slice(0, 8).forEach((event) => {
      const ackKey = `audit:${event.id}`;
      if (acknowledgedSet.has(ackKey)) return;
      if (event.eventType === "certificate_decision") {
        items.push(
          buildCertificateDecisionNotification(event, certificateDecisionHref),
        );
        return;
      }
      if (
        isSuperAdmin &&
        (event.eventType === "route_denied" ||
          event.eventType === "session_expired")
      ) {
        const notification = buildSecurityAuditNotification(
          event,
          securityHref,
        );
        if (notification) items.push(notification);
      }
    });

    return items.slice(0, 5);
  }, [
    absenceDrafts,
    acknowledgedNotifications,
    auditEvents,
    allowedKeys,
    auth?.role,
    filteredNavLinks,
    validationQueue,
  ]);

  const notificationsBadge = notifications.length;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateExtras = () => {
      setValidationQueue(readValidationQueue());
    };
    const updateDrafts = () => {
      setAbsenceDrafts(readDrafts());
    };
    const updateAuditEvents = () => {
      setAuditEvents(readAuditLog());
    };
    window.addEventListener(MEDICAL_VALIDATIONS_UPDATED_EVENT, updateExtras);
    window.addEventListener(ABSENCE_DRAFTS_UPDATED_EVENT, updateDrafts);
    window.addEventListener(AUDIT_LOG_UPDATED_EVENT, updateAuditEvents);
    window.addEventListener("storage", updateExtras);
    window.addEventListener("storage", updateDrafts);
    window.addEventListener("storage", updateAuditEvents);
    return () => {
      window.removeEventListener(
        MEDICAL_VALIDATIONS_UPDATED_EVENT,
        updateExtras
      );
      window.removeEventListener(
        ABSENCE_DRAFTS_UPDATED_EVENT,
        updateDrafts
      );
      window.removeEventListener(AUDIT_LOG_UPDATED_EVENT, updateAuditEvents);
      window.removeEventListener("storage", updateExtras);
      window.removeEventListener("storage", updateDrafts);
      window.removeEventListener("storage", updateAuditEvents);
    };
  }, []);

  useEffect(() => {
    if (!notificationsOpen || typeof window === "undefined") return undefined;
    const handleOutsideClick = (event) => {
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target)
      ) {
        setNotificationsOpen(false);
      }
    };
    const handleEsc = (event) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    window.addEventListener("mousedown", handleOutsideClick);
    window.addEventListener("keydown", handleEsc);
    return () => {
      window.removeEventListener("mousedown", handleOutsideClick);
      window.removeEventListener("keydown", handleEsc);
    };
  }, [notificationsOpen]);

  const acknowledgeNotification = (ackKey) => {
    if (!ackKey) return;
    setAcknowledgedNotifications((current) => {
      if (current.includes(ackKey)) return current;
      const next = [ackKey, ...current].slice(
        0,
        MAX_ACKNOWLEDGED_NOTIFICATIONS,
      );
      saveAcknowledgedNotifications(next);
      return next;
    });
  };

  const handleNotificationClick = (notification) => {
    acknowledgeNotification(notification.ackKey);
    setNotificationsOpen(false);
    if (notification.href) navigate(notification.href);
  };

  const handleLogout = () => {
    if (typeof auth?.logout === "function") {
      auth.logout();
    }
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-10 border-b border-slate-200/70 bg-white/95 backdrop-blur-lg dark:border-slate-800/60 dark:bg-slate-950/90">
      <div className="flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-slate-300 bg-white p-2 text-slate-600 shadow-sm transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-600 lg:hidden"
            aria-label="Abrir menu"
            onClick={() => setMobileMenuOpen((value) => !value)}
          >
            {mobileMenuOpen ? <CloseIcon /> : <MenuIcon />}
          </button>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-lg shadow-slate-600/20 ring-1 ring-slate-900/50 dark:bg-white dark:text-slate-900 dark:shadow-slate-900/20 dark:ring-white/10">
            <LogoIcon />
          </div>
          <div>
            <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-900 dark:text-white">
              RRHH Sistema
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gestion de Ausencias
            </p>
          </div>
        </div>

        <nav className="hidden items-center gap-2 text-[12px] font-semibold text-slate-600 dark:text-slate-400 sm:text-[13px] lg:flex">
          {filteredNavLinks.map((link) => {
            const isActive = link.label === active;
            const Icon = link.icon;
            const badgeValue =
              link.key === "validacion"
                ? validationBadge
                : link.key === "registro"
                  ? draftsBadge || link.badge
                  : link.badge;
            const showBadge = badgeValue && badgeValue > 0;
            return (
              <Link
                key={link.label}
                to={link.href}
                className={`group flex items-center gap-2 rounded-full px-4 py-2 transition ${
                  isActive
                    ? "bg-slate-900 text-white shadow-lg shadow-slate-600/30 dark:bg-white dark:text-slate-900"
                    : "hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <Icon
                  className={`transition ${
                    isActive
                      ? "text-white dark:text-slate-900"
                      : "text-slate-400 group-hover:text-slate-900 dark:text-slate-500 dark:group-hover:text-white"
                  }`}
                />
                <span>{link.label}</span>
                {showBadge ? (
                  <span
                    aria-label={`${link.label} badge`}
                    className={`ml-2 inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white shadow-sm shadow-rose-500/40 ${
                      isActive ? "group-hover:bg-rose-500/90" : ""
                    }`}
                  >
                    {badgeValue}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-3">
          <div className="relative" ref={notificationsRef}>
            <button
              type="button"
              className="relative rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:focus:ring-slate-800"
              aria-label="Notificaciones"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((value) => !value)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path d="M10 18a2 2 0 002-2H8a2 2 0 002 2z" />
                <path
                  fillRule="evenodd"
                  d="M10 2a4 4 0 00-4 4c0 1.157-.312 2.202-.812 3.031C4.72 10.157 4.5 10.93 4.5 11.5v.35c0 .694-.391 1.33-1 1.65L3 13.75V15h14v-1.25l-.5-.25c-.609-.32-1-.956-1-1.65v-.35c0-.57-.22-1.343-.688-2.469-.5-.829-.812-1.874-.812-3.031a4 4 0 00-4-4z"
                  clipRule="evenodd"
                />
              </svg>
              {notificationsBadge > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white shadow-sm shadow-rose-500/40">
                  {notificationsBadge > 9 ? "9+" : notificationsBadge}
                </span>
              ) : null}
            </button>

            {notificationsOpen ? (
              <div className="absolute right-0 z-30 mt-3 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-300/40 dark:border-slate-800 dark:bg-slate-950 dark:shadow-black/40">
                <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    Notificaciones
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pendientes operativos y eventos relevantes.
                  </p>
                </div>

                <div className="max-h-[22rem] overflow-y-auto p-2">
                  {notifications.length > 0 ? (
                    <ul className="space-y-2">
                      {notifications.map((notification) => (
                        <li key={notification.id}>
                          <button
                            type="button"
                            onClick={() =>
                              handleNotificationClick(notification)
                            }
                            className="w-full rounded-xl border border-transparent p-3 text-left transition hover:border-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:hover:border-slate-800 dark:hover:bg-slate-900 dark:focus:ring-slate-800"
                          >
                            <div className="flex items-start gap-3">
                              <span
                                className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full border ${
                                  notificationToneMap[notification.tone] ||
                                  notificationToneMap.slate
                                }`}
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-slate-900 dark:text-white">
                                  {notification.title}
                                </span>
                                <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                                  {notification.description}
                                </span>
                                {notification.meta ? (
                                  <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                                    {notification.meta}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                        Sin pendientes
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                        No hay acciones operativas para atender ahora.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <ThemeToggle
            isDark={isDark}
            onToggle={onToggleTheme}
            className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 md:flex"
          />
          <ThemeToggle
            isDark={isDark}
            onToggle={onToggleTheme}
            className="flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 md:hidden"
          />

          <div className="flex items-center gap-3 rounded-full bg-white px-3 py-1.5 text-sm shadow-sm dark:bg-slate-900">
            <div className="hidden text-left leading-tight sm:block">
              <p className="text-xs font-semibold text-slate-900 dark:text-white">
                {userName}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {roleLabel}
              </p>
            </div>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-md shadow-slate-600/40 dark:bg-white dark:text-slate-900 dark:shadow-slate-900/30 ${providerRingClass}`}
              title={isFirebaseMode ? "Modo Firebase" : "Modo Local"}
            >
              <span className="text-xs font-semibold">{initials}</span>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-4 w-4"
              >
                <path
                  fillRule="evenodd"
                  d="M5.22 3.22a.75.75 0 011.06 0L11 7.94l4.72-4.72a.75.75 0 111.06 1.06L12.06 9l4.72 4.72a.75.75 0 11-1.06 1.06L11 10.06l-4.72 4.72a.75.75 0 11-1.06-1.06L9.94 9 5.22 4.28a.75.75 0 010-1.06z"
                  clipRule="evenodd"
                />
              </svg>
              Salir
            </button>
          </div>
        </div>
      </div>
      {mobileMenuOpen ? (
        <div
          data-testid="mobile-nav"
          className="border-t border-slate-200 bg-white px-4 py-4 shadow-inner dark:border-slate-800 dark:bg-slate-950 lg:hidden"
        >
          <div className="flex flex-col gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
          {filteredNavLinks.map((link) => {
            const isActive = link.label === active;
            const Icon = link.icon;
            const badgeValue =
              link.key === "validacion"
                ? validationBadge
                : link.key === "registro"
                  ? draftsBadge || link.badge
                  : link.badge;
              return (
                <Link
                  key={`mobile-${link.label}`}
                  to={link.href}
                  className={`flex items-center justify-between rounded-2xl border px-4 py-2 transition ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                      : "border-slate-200 hover:border-slate-400"
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="flex items-center gap-2">
                    <Icon className={isActive ? "text-white dark:text-slate-900" : "text-slate-400"} />
                    {link.label}
                  </span>
                  {badgeValue ? (
                    <span
                      aria-label={`${link.label} badge`}
                      className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white"
                    >
                      {badgeValue}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </header>
  );
}

export default AppHeader;
