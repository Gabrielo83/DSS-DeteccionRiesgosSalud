import { Link, useNavigate } from "react-router-dom";
import { useContext, useEffect, useMemo, useState } from "react";
import ThemeToggle from "./ThemeToggle.jsx";
import AuthContext from "../context/AuthContext.jsx";
import { readValidationQueue } from "../utils/validationStorage.js";
import {
  MEDICAL_VALIDATIONS_UPDATED_EVENT,
  ABSENCE_DRAFTS_UPDATED_EVENT,
} from "../utils/storageKeys.js";
import { readDrafts } from "../utils/draftStorage.js";

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

const getPendingValidationsCount = () => {
  if (typeof window === "undefined") return 0;
  const queue = readValidationQueue();
  return queue.filter(
    (item) => (item.status || "").toLowerCase() === "pendiente",
  ).length;
};

const roleDisplayMap = {
  superAdmin: "Super Admin",
  medico: "Medico Laboral",
  administrativo: "Administrativo",
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
  const navigate = useNavigate();
  const auth = useContext(AuthContext);
  const [pendingExtras, setPendingExtras] = useState(getPendingValidationsCount);
  const [absenceDraftsCount, setAbsenceDraftsCount] = useState(() => {
    if (typeof window === "undefined") return 0;
    return readDrafts().length;
  });
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
  const validationBadge = BASE_PENDING_VALIDATIONS + pendingExtras;
  const draftsBadge = absenceDraftsCount;

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateExtras = () => {
      setPendingExtras(getPendingValidationsCount());
    };
    const updateDrafts = () => {
      setAbsenceDraftsCount(readDrafts().length);
    };
    window.addEventListener(MEDICAL_VALIDATIONS_UPDATED_EVENT, updateExtras);
    window.addEventListener(ABSENCE_DRAFTS_UPDATED_EVENT, updateDrafts);
    window.addEventListener("storage", updateExtras);
    window.addEventListener("storage", updateDrafts);
    return () => {
      window.removeEventListener(
        MEDICAL_VALIDATIONS_UPDATED_EVENT,
        updateExtras
      );
      window.removeEventListener(
        ABSENCE_DRAFTS_UPDATED_EVENT,
        updateDrafts
      );
      window.removeEventListener("storage", updateExtras);
      window.removeEventListener("storage", updateDrafts);
    };
  }, []);

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
          <button
            type="button"
            className="rounded-full border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600"
            aria-label="Notificaciones"
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
          </button>

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
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white shadow-md shadow-slate-600/40 dark:bg-white dark:text-slate-900 dark:shadow-slate-900/30">
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
