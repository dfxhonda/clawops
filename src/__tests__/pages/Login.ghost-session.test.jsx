// @vitest-environment happy-dom
// SPEC-LOGIN-GHOST-SESSION-VALIDATE-FIX-01: Login init ghost session detection tests
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../../pages/Login'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockGetSession = vi.fn()
const mockGetUser = vi.fn()
const mockSignOut = vi.fn()
const mockFrom = vi.fn()

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      getUser: () => mockGetUser(),
      signOut: () => mockSignOut(),
    },
    from: (table) => mockFrom(table),
  },
}))

vi.mock('../../lib/auth/orgConstants', () => ({ DFX_ORG_ID: 'test-org' }))

const mockCheckAndReloadIfStale = vi.fn()
vi.mock('../../lib/swRegistration', () => ({
  updateSW: vi.fn(),
  triggerUpdate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../services/loginVersionCheck', () => ({
  checkAndReloadIfStale: () => mockCheckAndReloadIfStale(),
}))

vi.mock('../../services/loginHistory', () => ({
  fetchDeviceLoginRows: vi.fn().mockResolvedValue([]),
  upsertLoginHistory: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn(), Toast: () => null }),
}))

vi.mock('../../lib/prefetchCache', () => ({ startPrefetch: vi.fn() }))

vi.mock('../../pages/login/TabBar', () => ({
  default: () => <div data-testid="tab-bar" />,
}))
vi.mock('../../pages/login/StaffList', () => ({
  default: () => <div data-testid="staff-list" />,
}))
vi.mock('../../pages/login/PinSheet', () => ({
  default: () => <div data-testid="pin-sheet" />,
}))

function makeStaffQueryBuilder() {
  const b = { select: () => b, eq: () => b, order: () => b }
  b.then = (resolve) => Promise.resolve({ data: [], error: null }).then(resolve)
  return b
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSignOut.mockResolvedValue({})
  mockCheckAndReloadIfStale.mockResolvedValue(null)
  mockFrom.mockReturnValue(makeStaffQueryBuilder())
})

describe('Login init ghost session detection', () => {
  it('when_getSession_returns_session_and_getUser_fails_calls_signOut_then_loads_staff', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'stale-tok' } } })
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: 'user not found' } })

    render(<MemoryRouter><Login /></MemoryRouter>)

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledOnce())
    expect(mockNavigate).not.toHaveBeenCalledWith('/launcher', expect.anything())
    // SPEC-PWA-SW-ACTIVE-UPDATE-S2-01: mount calls triggerUpdate; checkAndReloadIfStale not called in ghost path
    expect(mockCheckAndReloadIfStale).not.toHaveBeenCalled()
  })

  it('when_getSession_returns_session_and_getUser_succeeds_navigates_to_launcher', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'valid-tok' } } })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null })
    mockCheckAndReloadIfStale.mockResolvedValue(null)

    render(<MemoryRouter><Login /></MemoryRouter>)

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/launcher', { replace: true }))
    expect(mockSignOut).not.toHaveBeenCalled()
  })

  it('when_getSession_returns_null_skips_getUser_and_loads_staff_list', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } })

    render(<MemoryRouter><Login /></MemoryRouter>)

    await waitFor(() => expect(mockFrom).toHaveBeenCalled())
    expect(mockGetUser).not.toHaveBeenCalled()
    expect(mockSignOut).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalledWith('/launcher', expect.anything())
  })

  it('when_getUser_throws_calls_signOut_and_falls_through_to_staff_list', async () => {
    mockGetSession.mockResolvedValue({ data: { session: { access_token: 'bad-tok' } } })
    mockGetUser.mockRejectedValue(new Error('network error'))

    render(<MemoryRouter><Login /></MemoryRouter>)

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledOnce())
    expect(mockNavigate).not.toHaveBeenCalledWith('/launcher', expect.anything())
  })
})
