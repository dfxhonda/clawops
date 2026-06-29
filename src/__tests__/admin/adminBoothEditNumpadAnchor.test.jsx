// @vitest-environment happy-dom
// SPEC-ADMIN-METER-EDIT-NUMPAD-ANCHOR-FIX-01: numpad absolute bottom-0 anchor
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

const mockNav = vi.hoisted(() => ({ currentField: null }))

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ state: null }),
  useNavigate: () => vi.fn(),
  useParams: () => ({ boothCode: 'B001' }),
}))
vi.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({ staffId: 'u1', staffRole: 'admin', loading: false }),
}))
vi.mock('../../services/permissions', () => ({ isAdmin: () => true }))
vi.mock('../../shared/ui/PageHeader', () => ({ PageHeader: () => null }))
vi.mock('../../clawsupport/components/NumpadField', () => ({
  default: () => null,
  NumpadFooterPanel: () => <div data-testid="numpad-panel" />,
}))
vi.mock('../../clawsupport/components/BoothInputForm', () => ({ default: () => null, ALL_TOUCHED: {} }))
vi.mock('../../clawsupport/components/LiveCameraView', () => ({ default: () => null }))
vi.mock('../../components/ErrorBanner', () => ({ default: () => null }))
vi.mock('../../clawsupport/hooks/useOCR', () => ({
  useOCR: () => ({ showOcr: false, setShowOcr: vi.fn(), ocrState: 'idle', setOcrState: vi.fn() }),
}))
vi.mock('../../admin/AdminBackContext', () => ({
  useAdminBack: () => ({ current: null }),
  AdminBackContext: { Provider: ({ children }) => children },
}))
vi.mock('../../lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() } }))
vi.mock('../../lib/auth/orgConstants', () => ({ DFX_ORG_ID: 'org1' }))
vi.mock('../../services/adminMeterEdit', () => ({
  getFullReading: vi.fn(() => Promise.resolve(null)),
  updateMeterReading: vi.fn(() => Promise.resolve()),
  deleteMeterReading: vi.fn(() => Promise.resolve()),
  insertAuditLog: vi.fn(() => Promise.resolve()),
  insertPastDateReading: vi.fn(() => Promise.resolve()),
  fetchAdminBoothHistory: vi.fn(() => Promise.resolve([])),
  getPrevReadingBeforeDate: vi.fn(() => Promise.resolve(null)),
}))
vi.mock('../../clawsupport/hooks/useFieldNavigation', () => ({
  useFieldNavigation: () => ({
    navigateNext: vi.fn(),
    currentField: mockNav.currentField,
    registerField: vi.fn(),
    clearField: vi.fn(),
  }),
}))

import AdminBoothEditPage from '../../admin/pages/AdminBoothEditPage'

beforeEach(() => {
  mockNav.currentField = null
  cleanup()
})

describe('SPEC-ADMIN-METER-EDIT-NUMPAD-ANCHOR-FIX-01 R1: numpad anchor', () => {
  it('when_currentField_null_numpad_container_should_be_hidden', () => {
    mockNav.currentField = null
    const { getByTestId } = render(<AdminBoothEditPage />)
    const anchor = getByTestId('numpad-anchor')
    expect(anchor.className).toContain('hidden')
    expect(anchor.className).not.toContain('flex-none')
  })

  it('when_currentField_set_numpad_container_should_have_absolute_bottom_0', () => {
    mockNav.currentField = { dataTabindex: 1, label: 'IN' }
    const { getByTestId } = render(<AdminBoothEditPage />)
    const anchor = getByTestId('numpad-anchor')
    expect(anchor.className).toContain('absolute')
    expect(anchor.className).toContain('bottom-0')
    expect(anchor.className).toContain('left-0')
    expect(anchor.className).toContain('right-0')
    expect(anchor.className).toContain('h-[30dvh]')
    expect(anchor.className).not.toContain('flex-none')
  })

  it('when_page_renders_outer_container_should_have_relative_class', () => {
    mockNav.currentField = null
    const { getByTestId } = render(<AdminBoothEditPage />)
    expect(getByTestId('page-root').className).toContain('relative')
  })
})
