// @vitest-environment happy-dom
// DIAG-ADMIN-METER-EDIT-NUMPAD-3FIX-01 F2: AdminBreadcrumb 戻る2段階override
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { useRef } from 'react'
import { AdminBackContext } from '../../admin/AdminBackContext'

const mockNavigate = vi.fn()

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/admin/audit/booth-edit/BOOTH01' }),
  useNavigate: () => mockNavigate,
}))

vi.mock('../../shared/ui/moduleColors', () => ({ MODULE_COLORS: { admin: '#000' } }))

import AdminBreadcrumb from '../../admin/AdminBreadcrumb'

function Wrapper({ backFn }) {
  const ref = useRef(backFn ?? null)
  return (
    <AdminBackContext.Provider value={ref}>
      <AdminBreadcrumb />
    </AdminBackContext.Provider>
  )
}

beforeEach(() => { mockNavigate.mockReset() })
afterEach(() => cleanup())

describe('AdminBreadcrumb back override (DIAG-ADMIN-METER-EDIT-NUMPAD-3FIX-01 F2)', () => {
  it('when_backRef_null_should_call_navigate_minus1', () => {
    render(<Wrapper />)
    fireEvent.click(screen.getByTestId('admin-nav-back'))
    expect(mockNavigate).toHaveBeenCalledWith(-1)
  })

  it('when_backRef_has_fn_should_call_fn_instead_of_navigate', () => {
    const overrideFn = vi.fn()
    render(<Wrapper backFn={overrideFn} />)
    fireEvent.click(screen.getByTestId('admin-nav-back'))
    expect(overrideFn).toHaveBeenCalledTimes(1)
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})
