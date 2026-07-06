// @vitest-environment happy-dom
// SPEC-SEC-PINHASH-ANON-PATH-CLEANUP-01 R1/AC2: the anon staff-picker select must expose
// has_pin but NEVER pin_hash (the value was residue; pin verify is server-side via verify-pin).
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})
vi.mock('../../../services/loginHistory', () => ({
  fetchDeviceLoginRows: vi.fn().mockResolvedValue([]),
  upsertLoginHistory: vi.fn(),
}))

const selectSpy = vi.fn()
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({}),
      setSession: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    from: () => {
      const b = { select: (cols) => { selectSpy(cols); return b }, eq: () => b, order: () => b }
      b.then = (resolve) => Promise.resolve({ data: [], error: null }).then(resolve)
      return b
    },
  },
}))
vi.mock('../../../lib/auth/orgConstants', () => ({ DFX_ORG_ID: 'test-org' }))
vi.mock('../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn(), Toast: () => null }) }))
vi.mock('../../../lib/prefetchCache', () => ({ startPrefetch: vi.fn() }))
vi.mock('../../../pages/login/TabBar', () => ({ default: () => null }))
vi.mock('../../../pages/login/StaffList', () => ({ default: () => null }))
vi.mock('../../../pages/login/PinSheet', () => ({ default: () => null }))

import Login from '../../../pages/Login'

beforeEach(() => vi.clearAllMocks())

describe('SPEC-SEC-PINHASH-ANON-PATH-CLEANUP-01: staff picker select column contract', () => {
  it('selects has_pin and never pin_hash', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    await waitFor(() => expect(selectSpy).toHaveBeenCalled())
    const staffSelect = selectSpy.mock.calls
      .map(c => c[0])
      .find(c => typeof c === 'string' && c.includes('staff_id'))
    expect(staffSelect).toBeTruthy()
    expect(staffSelect).toContain('has_pin')
    expect(staffSelect).not.toContain('pin_hash')
  })
})
