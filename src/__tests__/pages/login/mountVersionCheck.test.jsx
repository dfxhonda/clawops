// @vitest-environment happy-dom
// SPEC-PWA-SW-ACTIVE-UPDATE-S2-01: Login mount-time triggerUpdate call (replaces S1-01 checkAndReloadIfStale)
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

const mockTriggerUpdate = vi.fn()
vi.mock('../../../lib/swRegistration', () => ({
  updateSW: vi.fn(),
  triggerUpdate: () => mockTriggerUpdate(),
}))

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
  mockTriggerUpdate.mockResolvedValue(undefined)
  mockCheckAndReloadIfStale.mockResolvedValue({ reloaded: false, reason: 'match' })
})

describe('SPEC-PWA-SW-ACTIVE-UPDATE-S2-01: mount triggerUpdate', () => {
  it('when_login_mounts_should_call_triggerUpdate', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>)

    await waitFor(() => expect(mockTriggerUpdate).toHaveBeenCalledOnce())
  })

  it('when_login_mounts_should_not_navigate_to_launcher', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>)

    await waitFor(() => expect(mockTriggerUpdate).toHaveBeenCalled())
    expect(mockNavigate).not.toHaveBeenCalledWith('/launcher', expect.anything())
  })

  it('when_login_mounts_should_not_call_checkAndReloadIfStale_from_mount', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>)

    await waitFor(() => expect(mockTriggerUpdate).toHaveBeenCalled())
    // mount no longer calls checkAndReloadIfStale (triggerUpdate replaced it)
    expect(mockCheckAndReloadIfStale).not.toHaveBeenCalled()
  })
})
