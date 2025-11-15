import { useEffect, useMemo, useRef, useState } from 'react'

function DropdownSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar',
  name,
  className = '',
  disabled = false,
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef(null)

  const selected = useMemo(
    () => options.find((option) => option.value === value) ?? null,
    [options, value],
  )

  useEffect(() => {
    if (!open) return
    const handleClick = (event) => {
      if (!containerRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const handleToggle = () => {
    if (!disabled) {
      setOpen((prev) => !prev)
    }
  }

  const handleSelect = (option) => {
    onChange(option.value)
    setOpen(false)
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        name={name}
        disabled={disabled}
        onClick={handleToggle}
        className={`flex w-full items-center justify-between gap-4 rounded-2xl border border-slate-400 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus-visible:outline-slate-600 ${
          open ? 'ring-4 ring-slate-200/80 dark:ring-slate-800/70' : ''
        }`}
      >
        <span className={selected ? '' : 'text-slate-500 dark:text-slate-500'}>
          {selected ? selected.label : placeholder}
        </span>
        <span
          className={`text-slate-500 transition-transform dark:text-slate-500 ${
            open ? 'rotate-180' : ''
          }`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-4 w-4"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.086l3.71-3.855a.75.75 0 1 1 1.08 1.04l-4.24 4.4a.75.75 0 0 1-1.08 0l-4.24-4.4a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 overflow-hidden rounded-3xl border border-slate-300 bg-white shadow-xl shadow-slate-400/10 dark:border-slate-700 dark:bg-slate-900">
          <ul className="max-h-56 overflow-auto py-2 text-sm text-slate-800 dark:text-slate-200">
            {options.map((option) => {
              const isActive = option.value === value
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(option)}
                    className={`flex w-full items-center justify-between px-5 py-2 text-left transition hover:bg-slate-100 focus:bg-slate-100 dark:hover:bg-slate-800 dark:focus:bg-slate-800 ${
                      isActive ? 'font-semibold text-slate-900 dark:text-white' : ''
                    }`}
                  >
                    <span>{option.label}</span>
                    {isActive ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-4 w-4 text-slate-500 dark:text-slate-400"
                      >
                        <path
                          fillRule="evenodd"
                          d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.25 7.328a1 1 0 0 1-1.438.01L3.29 9.266a1 1 0 0 1 1.42-1.407l3.58 3.613 6.54-6.595a1 1 0 0 1 1.874.413Z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

export default DropdownSelect
