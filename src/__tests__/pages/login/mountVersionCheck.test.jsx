// @vitest-environment happy-dom
// SPEC-PWA-SW-LOGINMOUNT-UPDATE-S1-01: Login mount-time version check
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../../../pages/Login'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockGetSession = vi.fn()
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({}),
    },
    from: () => {
      const b = { select: () => b, eq: () => b, order: () => b }
      b.then = (resolve) => Promise.resolve({ data: [], error: null }).then(resolve)
      return b
    },
  },
}))

vi.mock('../../../lib/auth/orgConstants', () => ({ DFX_ORG_ID: 'test-org' }))

const mockCheckAndReloadIfStale = vi.fn()
vi.mock('../../../services/loginVersionCheck', () => ({
  checkAndReloadIfStale: (...args) => mockCheckAndReloadIfStale(...args),
}))

vi.mock('../../../services/loginHistory', () => ({
  fetchDeviceLoginRows: vi.fn().mockResolvedValue([]),
  upsertLoginHistory: vi.fn().mockResolvedValue(null),
}))

vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn(), Toast: () => null }),
}))

vi.mock('../../../lib/prefetchCache', () => ({ startPrefetch: vi.fn() }))

vi.mock('../../../pages/login/TabBar', () => ({ default: () => <div data-testid="tab-bar" /> }))
vi.mock('../../../pages/login/StaffList', () => ({ default: () => <div data-testid="staff-list" /> }))
vi.mock('../../../pages/login/PinSheet', () => ({ default: () => <div data-testid="pin-sheet" /> }))

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: null } })
  mockCheckAndReloadIfStale.mockResolvedValue({ reloaded: false, reason: 'match' })
})

describe('SPEC-PWA-SW-LOGINMOUNT-UPDATE-S1-01: mount version check', () => {
  it('when_login_mounts_calls_checkAndReloadIfStale_with_updateSW', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>)

    await waitFor(() => expect(mockCheckAndReloadIfStale).toHaveBeenCalled())
    const [opts] = mockCheckAndReloadIfStale.mock.calls[0]
    expect(opts).toMatchObject({ updateSW: expect.any(Function) })
  })

  it('when_mount_check_returns_reloaded_true_does_not_navigate_to_launcher', async () => {
    mockCheckAndReloadIfStale.mockResolvedValue({ reloaded: true, reason: 'mismatch' })

    render(<MemoryRouter><Login /></MemoryRouter>)

    await waitFor(() => expect(mockCheckAndReloadIfStale).toHaveBeenCalled())
    expect(mockNavigate).not.toHaveBeenCalledWith('/launcher', expect.anything())
  })

  it('when_mount_check_returns_reloaded_false_login_screen_continues_normally', async () => {
    mockCheckAndReloadIfStale.mockResolvedValue({ reloaded: false, reason: 'match' })

    render(<MemoryRouter><Login /></MemoryRouter>)

    await waitFor(() => expect(mockCheckAndReloadIfStale).toHaveBeenCalled())
    // no redirect → staff list loads normally
    expect(mockNavigate).not.toHaveBeenCalledWith('/launcher', expect.anything())
  })
})
