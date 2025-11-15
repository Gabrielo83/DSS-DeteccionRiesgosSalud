function ThemeToggle({ isDark, onToggle, className = '' }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white shadow-sm transition hover:border-slate-400 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 dark:border-slate-600 dark:bg-slate-900/80 dark:hover:border-slate-500 ${className}`}
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-amber-500">
      <path d="M10 14.5a4.5 4.5 0 100-9 4.5 4.5 0 000 9z" />
      <path
        fillRule="evenodd"
        d="M10 0a.75.75 0 01.75.75v2.5a.75.75 0 01-1.5 0v-2.5A.75.75 0 0110 0zm0 16.75a.75.75 0 01.75.75v2.5a.75.75 0 01-1.5 0v-2.5a.75.75 0 01.75-.75zM3.22 3.22a.75.75 0 011.06 0l1.77 1.77a.75.75 0 11-1.06 1.06L3.22 4.28a.75.75 0 010-1.06zm10.75 10.75a.75.75 0 011.06 0l1.77 1.77a.75.75 0 01-1.06 1.06l-1.77-1.77a.75.75 0 010-1.06zM0 10a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5A.75.75 0 010 10zm16.75 0a.75.75 0 01.75-.75h2.5a.75.75 0 010 1.5h-2.5a.75.75 0 01-.75-.75zM3.22 16.78a.75.75 0 000-1.06l-1.77-1.77a.75.75 0 10-1.06 1.06l1.77 1.77a.75.75 0 001.06 0zm10.56-10.56a.75.75 0 001.06 0l1.77-1.77a.75.75 0 10-1.06-1.06l-1.77 1.77a.75.75 0 000 1.06z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 text-slate-500">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a.75.75 0 00-1.299-.495 8.5 8.5 0 1011.38 11.38.75.75 0 00-.495-1.299z" />
    </svg>
  )
}

export default ThemeToggle
