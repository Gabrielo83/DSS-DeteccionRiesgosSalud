import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockHistory = {
  'EMP-1': [
    {
      id: 'CM-001',
      employee: 'Ana Gomez',
      employeeId: 'EMP-1',
      sector: 'Produccion',
      status: 'Validado',
      riskScore: 6.5,
      issued: '2025-11-05T00:00:00.000Z',
      startDate: '2025-11-05',
      endDate: '2025-11-10',
      title: 'Certificado Medico - Enfermedad',
      detailedReason: 'Lumbalgia',
      pathologyCategory: 'musculoskeletal',
    },
  ],
}

const mockQueue = [
  {
    reference: 'CM-QUEUE-1',
    employeeId: 'EMP-1',
    employee: 'Ana Gomez',
    sector: 'Produccion',
    status: 'pendiente',
    priority: 'alta',
    riskScoreValue: 6.5,
    submitted: '2025-11-06T00:00:00.000Z',
    detailedReason: 'Lumbalgia',
    pathologyCategory: 'musculoskeletal',
  },
]

vi.mock('../../utils/historyStorage.js', () => ({
  readAllHistory: vi.fn(() => mockHistory),
  readEmployeeHistory: vi.fn((id) => mockHistory[id] || []),
  saveHistory: vi.fn(),
  syncFromIndexedDb: vi.fn(),
}))

vi.mock('../../utils/validationStorage.js', () => ({
  readValidationQueue: vi.fn(() => mockQueue),
  saveValidationQueue: vi.fn(),
  syncFromIndexedDb: vi.fn(),
}))

vi.mock('../../utils/planStorage.js', () => ({
  readAllPlans: vi.fn(() => ({})),
  syncFromIndexedDb: vi.fn(),
}))

vi.mock('../../data/mockEmployees.js', () => ({
  __esModule: true,
  default: [
    {
      employeeId: 'EMP-1',
      fullName: 'Ana Gomez',
      sector: 'Produccion',
      active: true,
      hireDate: '2023-01-01',
      terminationDate: null,
    },
    {
      employeeId: 'EMP-2',
      fullName: 'Luis Perez',
      sector: 'Ventas',
      active: true,
      hireDate: '2023-02-01',
      terminationDate: null,
    },
  ],
  mockEmployees: [
    {
      employeeId: 'EMP-1',
      fullName: 'Ana Gomez',
      sector: 'Produccion',
      active: true,
      hireDate: '2023-01-01',
      terminationDate: null,
    },
    {
      employeeId: 'EMP-2',
      fullName: 'Luis Perez',
      sector: 'Ventas',
      active: true,
      hireDate: '2023-02-01',
      terminationDate: null,
    },
  ],
}))

vi.mock('../../data/pathologyCategories.js', () => ({
  __esModule: true,
  pathologyCategories: [
    { value: 'musculoskeletal', label: 'Musculoesqueleticas' },
    { value: 'respiratory', label: 'Respiratorias' },
  ],
  default: [
    { value: 'musculoskeletal', label: 'Musculoesqueleticas' },
    { value: 'respiratory', label: 'Respiratorias' },
  ],
}))

import App from '../../App.jsx'
import { MOCK_USERS } from '../../data/mockUsers.js'

const renderWithRole = (initialPath, role = 'superAdmin') => {
  const user = MOCK_USERS.find((item) => item.role === role) ?? MOCK_USERS[0]
  localStorage.setItem('sessionRole', role)
  localStorage.setItem('sessionEmail', user.email)
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  )
}

const renderDashboard = (role = 'superAdmin') => renderWithRole('/dashboard', role)

describe('Funcionalidad del Dashboard', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.className = ''
  })

  const setPeriodoNoviembre2025 = async () => {
    const user = userEvent.setup()
    const selects = screen.getAllByRole('combobox')
    // asume orden: Mes, Año
    if (selects[0]) {
      await user.selectOptions(selects[0], ['10']) // 0-based, 10 -> noviembre
    }
    if (selects[1]) {
      await user.selectOptions(selects[1], ['2025'])
    }
  }

  it('muestra el header con la navegacion y badge solo en Validacion Medica', () => {
    renderDashboard()

    const navItems = ['Panel de Control', 'Registro Ausencia', 'Validacion Medica', 'Legajos Medicos']
    navItems.forEach((label) => expect(screen.getAllByRole('link', { name: new RegExp(label, 'i') }).length).toBeGreaterThan(0))

    // Hay 1 alerta mock en validacion medica
    expect(screen.queryAllByLabelText(/Validacion Medica badge/i)).toHaveLength(1)
    expect(screen.queryAllByLabelText(/Panel de Control badge/i)).toHaveLength(0)
    expect(screen.queryAllByLabelText(/Registro Ausencia badge/i)).toHaveLength(0)
    expect(screen.queryAllByLabelText(/Legajos Medicos badge/i)).toHaveLength(0)
  })

  it('permite alternar el tema desde el dashboard y persiste la preferencia', async () => {
    const user = userEvent.setup()
    renderDashboard()

    const darkButtons = await screen.findAllByRole('button', { name: /Cambiar a modo oscuro/i })
    await user.click(darkButtons[0])

    expect(localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    const lightButtons = await screen.findAllByRole('button', { name: /Cambiar a modo claro/i })
    await user.click(lightButtons[0])

    expect(localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  }, 10000)

  it('muestra las tres tarjetas de metricas principales con sus valores del periodo', () => {
    renderDashboard()
    // no requiere setear periodo; usamos valores por defecto del mock

    const ausentismoCard = screen.getByText('Tasa de Ausentismo').closest('article')
    expect(ausentismoCard).not.toBeNull()
    expect(within(ausentismoCard).getAllByText(/%/).length).toBeGreaterThan(0)

    const riesgoLabels = screen.getAllByText(/Riesgo Promedio/i)
    expect(riesgoLabels.length).toBeGreaterThan(0)
    expect(
      within(riesgoLabels[0].closest('article') || document.body).getAllByText(
        (text) => /\d+(\.\d+)?/.test(text),
      ).length,
    ).toBeGreaterThan(0)

    expect(screen.getByText('Alertas Activas')).toBeInTheDocument()
    const alertasCard = screen.getByText('Alertas Activas').closest('article')
    expect(alertasCard).not.toBeNull()
    expect(
      within(alertasCard || document.body).getAllByText(/1/).length,
    ).toBeGreaterThan(0)
  })

  it('renderiza el mapa de calor con datos del sector y alertas', () => {
    renderDashboard()

    const heatmapHeading = screen.getByRole('heading', { name: /Mapa de calor por sector/i })
    const heatmapSection = heatmapHeading.closest('article')
    expect(heatmapSection).not.toBeNull()

    const scoped = within(heatmapSection)
    expect(scoped.getByText(/Produccion/i)).toBeInTheDocument()
    expect(scoped.getByText(/Alertas: 1/i)).toBeInTheDocument()
    expect(scoped.getAllByText(/Tasa:/i).length).toBeGreaterThan(0)
  })

  it('muestra la card de tendencia de riesgo con su descripcion', () => {
    renderDashboard()

    expect(screen.getByRole('heading', { name: /Evolucion del riesgo promedio/i })).toBeInTheDocument()
    expect(screen.getByText(/Tendencia del riesgo promedio del personal en los ultimos 12 meses/i)).toBeInTheDocument()
  })

  it('presenta la tabla de riesgo con encabezados y muestra mensaje sin datos', () => {
    renderDashboard()

    ;['Nombre', 'Sector', 'Patologia mas recurrente', 'Puntuacion de riesgo', 'Nivel', 'Acciones'].forEach((header) => {
      expect(screen.getByRole('columnheader', { name: new RegExp(header, 'i') })).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Aun no hay empleados con riesgo individual/i),
    ).toBeInTheDocument()
  })

  it('abre y cierra el menu de navegacion movil', async () => {
    const user = userEvent.setup()
    renderDashboard()

    const toggleButton = screen.getByRole('button', { name: /Abrir menu/i })
    expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument()

    await user.click(toggleButton)
    const mobileNav = await screen.findByTestId('mobile-nav', {}, { timeout: 3000 })
    expect(within(mobileNav).getByText(/Registro Ausencia/i)).toBeInTheDocument()

    await user.click(toggleButton)
    expect(screen.queryByTestId('mobile-nav')).not.toBeInTheDocument()
  }, 10000)

  it('limita la navegacion visible para el rol gerente', () => {
    renderDashboard('gerente')

    expect(screen.getByRole('link', { name: /Panel de Control/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Legajos Medicos/i })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Registro Ausencia/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Certificados Medicos/i })).toBeNull()
    expect(screen.queryByRole('link', { name: /Validacion Medica/i })).toBeNull()
  })

  it('bloquea la ruta de validacion medica para un rol administrativo', async () => {
    renderWithRole('/validacion-medica', 'administrativo')

    await screen.findByRole('heading', { name: /Panel de Control/i }, { timeout: 8000 })
    expect(screen.queryByRole('heading', { name: /Validacion Medica/i })).not.toBeInTheDocument()
  }, 10000)
})
