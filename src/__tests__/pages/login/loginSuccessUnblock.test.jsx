// @vitest-environment happy-dom
// SPEC-LOGIN-SUCCESS-UNBLOCK-01: navigate先行、upsertLoginHistory/checkAndReloadIfStale fire-and-forget
// AC1: upsertLoginHistory は fire-and-forget (await なし) → navigate がブロックされない
// AC2: checkAndReloadIfStale は navigation をブロックしない
// AC4: setSession は await 維持 (session 確定に必須)
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, waitFor, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import Login from '../../../pages/Login'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

const mockUpsertLoginHistory = vi.fn()
vi.mock('../../../services/loginHistory', () => ({
  fetchDeviceLoginRows: vi.fn().mockResolvedValue([]),
  upsertLoginHistory: (...args) => mockUpsertLoginHistory(...args),
}))

const mockCheckAndReloadIfStale = vi.fn()
vi.mock('../../../services/loginVersionCheck', () => ({
  checkAndReloadIfStale: (...args) => mockCheckAndReloadIfStale(...args),
}))

const mockSetSession = vi.fn()
const mockGetSession = vi.fn()
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: vi.fn().mockResolvedValue({}),
      setSession: (...args) => mockSetSession(...args),
    },
    from: () => {
      const b = { select: () => b, eq: () => b, order: () => b }
      b.then = (resolve) => Promise.resolve({ data: [], error: null }).then(resolve)
      return b
    },
  },
}))

vi.mock('../../../lib/auth/orgConstants', () => ({ DFX_ORG_ID: 'test-org' }))
vi.mock('../../../lib/swRegistration', () => ({ updateSW: vi.fn(), triggerUpdate: vi.fn() }))
vi.mock('../../../hooks/useToast', () => ({
  useToast: () => ({ showToast: vi.fn(), Toast: () => null }),
}))
vi.mock('../../../lib/prefetchCache', () => ({ startPrefetch: vi.fn() }))

const MOCK_STAFF = { staff_id: 'S1', name: 'テスト' }
const MOCK_SESSION = { access_token: 'tok', refresh_token: 'rtok' }

vi.mock('../../../pages/login/TabBar', () => ({ default: () => null }))
vi.mock('../../../pages/login/StaffList', () => ({
  default: ({ onSelect }) => (
    <button data-testid="select-staff" onClick={() => onSelect(MOCK_STAFF)}>select</button>
  ),
}))
vi.mock('../../../pages/login/PinSheet', () => ({
  default: ({ onSuccess }) => (
    <button data-testid="do-login" onClick={() => onSuccess(MOCK_STAFF, MOCK_SESSION)}>login</button>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockGetSession.mockResolvedValue({ data: { session: null } })
  mockSetSession.mockResolvedValue({ data: {}, error: null })
  mockUpsertLoginHistory.mockResolvedValue(null)
  mockCheckAndReloadIfStale.mockResolvedValue({ reloaded: false, reason: 'match' })
})

async function renderAndTriggerSuccess(container) {
  const result = render(<MemoryRouter><Login /></MemoryRouter>)
  await waitFor(() => result.getByTestId('select-staff'))
  fireEvent.click(result.getByTestId('select-staff'))
  await waitFor(() => result.getByTestId('do-login'))
  fireEvent.click(result.getByTestId('do-login'))
  return result
}

describe('SPEC-LOGIN-SUCCESS-UNBLOCK-01: upsertLoginHistory fire-and-forget (AC1)', () => {
  it('when_upsertLoginHistory_never_resolves_should_still_navigate', async () => {
    mockUpsertLoginHistory.mockReturnValue(new Promise(() => {})) // never resolves

    await renderAndTriggerSuccess()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/launcher', { replace: true }))
  })

  it('when_upsertLoginHistory_fails_should_still_navigate', async () => {
    mockUpsertLoginHistory.mockRejectedValue(new Error('db error'))

    await renderAndTriggerSuccess()

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/launcher', { replace: true }))
  })
})

// SPEC-PWA-RELOAD-LOGIN-GATED-01 R1: checkAndReloadIfStale は navigate 前に await。
// UNBLOCK-01 R2(non-blocking navigate) は撤回済み。
describe('SPEC-PWA-RELOAD-LOGIN-GATED-01: checkAndReloadIfStale gated-await (R1)', () => {
  it('when_checkAndReloadIfStale_never_resolves_navigate_is_blocked', async () => {
    mockCheckAndReloadIfStale.mockReturnValue(new Promise(() => {})) // never resolves

    const { getByTestId } = render(<MemoryRouter><Login /></MemoryRouter>)
    await waitFor(() => getByTestId('select-staff'))
    fireEvent.click(getByTestId('select-staff'))
    await waitFor(() => getByTestId('do-login'))
    fireEvent.click(getByTestId('do-login'))

    // flush microtasks — navigate should be blocked waiting for version check
    await new Promise(r => setTimeout(r, 0))
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('when_checkAndReloadIfStale_returns_reloaded_false_should_navigate', async () => {
    // default mock: { reloaded: false, reason: 'match' }
    await renderAndTriggerSuccess()
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/launcher', { replace: true }))
  })

  it('when_checkAndReloadIfStale_returns_reloaded_true_should_NOT_navigate', async () => {
    mockCheckAndReloadIfStale.mockResolvedValue({ reloaded: true, reason: 'mismatch' })

    const { getByTestId } = render(<MemoryRouter><Login /></MemoryRouter>)
    await waitFor(() => getByTestId('select-staff'))
    fireEvent.click(getByTestId('select-staff'))
    await waitFor(() => getByTestId('do-login'))
    fireEvent.click(getByTestId('do-login'))

    await new Promise(r => setTimeout(r, 50))
    expect(mockNavigate).not.toHaveBeenCalled()
  })
})

describe('SPEC-PWA-RELOAD-LOGIN-GATED-01 R2: versionChecking spinner overlay', () => {
  it('when_version_checking_pending_should_show_updating_overlay', async () => {
    let resolveCheck
    mockCheckAndReloadIfStale.mockReturnValue(new Promise(r => { resolveCheck = r }))

    const { getByTestId, queryByTestId } = render(<MemoryRouter><Login /></MemoryRouter>)
    await waitFor(() => getByTestId('select-staff'))
    fireEvent.click(getByTestId('select-staff'))
    await waitFor(() => getByTestId('do-login'))
    fireEvent.click(getByTestId('do-login'))

    await waitFor(() => expect(queryByTestId('version-checking-overlay')).toBeTruthy())

    // resolve → overlay disappears → navigate fires
    resolveCheck({ reloaded: false, reason: 'match' })
    await waitFor(() => expect(queryByTestId('version-checking-overlay')).toBeFalsy())
    expect(mockNavigate).toHaveBeenCalledWith('/launcher', { replace: true })
  })
})

describe('SPEC-LOGIN-SUCCESS-UNBLOCK-01: setSession await 維持 (AC4)', () => {
  it('when_setSession_pending_should_not_navigate_yet', async () => {
    let resolve
    mockSetSession.mockReturnValue(new Promise(r => { resolve = r }))

    const { getByTestId } = render(<MemoryRouter><Login /></MemoryRouter>)
    await waitFor(() => getByTestId('select-staff'))
    fireEvent.click(getByTestId('select-staff'))
    await waitFor(() => getByTestId('do-login'))
    fireEvent.click(getByTestId('do-login'))

    // navigate should NOT be called yet — setSession is still pending
    expect(mockNavigate).not.toHaveBeenCalled()

    // resolve setSession
    resolve({ data: {}, error: null })

    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/launcher', { replace: true }))
  })
})
