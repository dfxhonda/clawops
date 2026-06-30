// @vitest-environment happy-dom
// SPEC-PWA-SW-UPDATE-CONTROLLERCHANGE-01 R3:
// AC10: loginReloadReason sessionStorage値をLogin.jsx初期化時にshowToast表示してremoveItem
// AC11: 更新トーンはsuccess(error扱いしない)。loginAuthErrorと共存し干渉しない
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
vi.mock('../../../lib/swRegistration', () => ({ updateSW: vi.fn() }))
vi.mock('../../../services/loginVersionCheck', () => ({
  checkAndReloadIfStale: vi.fn().mockResolvedValue({ reloaded: false, reason: 'match' }),
}))
vi.mock('../../../services/loginHistory', () => ({
  fetchDeviceLoginRows: vi.fn().mockResolvedValue([]),
  upsertLoginHistory: vi.fn().mockResolvedValue(null),
}))
vi.mock('../../../lib/prefetchCache', () => ({ startPrefetch: vi.fn() }))
vi.mock('../../../pages/login/TabBar', () => ({ default: () => <div data-testid="tab-bar" /> }))
vi.mock('../../../pages/login/StaffList', () => ({ default: () => <div data-testid="staff-list" /> }))
vi.mock('../../../pages/login/PinSheet', () => ({ default: () => <div data-testid="pin-sheet" /> }))
vi.mock('../../../pages/login/pinVerifier', () => ({ warmupVerifyPin: vi.fn() }))

let capturedShowToast = null
vi.mock('../../../hooks/useToast', () => ({
  useToast: () => {
    const showToast = vi.fn()
    capturedShowToast = showToast
    return { showToast, Toast: () => null }
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  capturedShowToast = null
  mockGetSession.mockResolvedValue({ data: { session: null } })
  sessionStorage.clear()
})

describe('SPEC-PWA-SW-UPDATE-CONTROLLERCHANGE-01 R3: loginReloadReason toast (AC10/AC11)', () => {
  // AC10: loginReloadReason を拾いshowToast表示しremoveItem(authErrorと同パターン)
  it('when_loginReloadReason_set_should_showToast_and_removeItem', async () => {
    sessionStorage.setItem('loginReloadReason', '新しいバージョンに更新しました')
    render(<MemoryRouter><Login /></MemoryRouter>)
    await waitFor(() => {
      expect(capturedShowToast).toHaveBeenCalledWith('新しいバージョンに更新しました')
    })
    expect(sessionStorage.getItem('loginReloadReason')).toBeNull()
  })

  // AC11: 更新トーンはsuccess(error扱いしない)
  it('when_loginReloadReason_set_should_not_use_error_tone', async () => {
    sessionStorage.setItem('loginReloadReason', '新しいバージョンに更新しました')
    render(<MemoryRouter><Login /></MemoryRouter>)
    await waitFor(() => expect(capturedShowToast).toHaveBeenCalled())
    const calls = capturedShowToast.mock.calls
    const reasonCall = calls.find(([msg]) => msg === '新しいバージョンに更新しました')
    expect(reasonCall).toBeDefined()
    expect(reasonCall[1]).not.toBe('error')
  })

  // AC11: loginAuthErrorと共存(loginReloadReason不在時はauthError処理に干渉しない)
  it('when_only_loginAuthError_set_should_show_with_error_tone', async () => {
    sessionStorage.setItem('loginAuthError', 'セッションが切れました')
    render(<MemoryRouter><Login /></MemoryRouter>)
    await waitFor(() => expect(capturedShowToast).toHaveBeenCalledWith('セッションが切れました', 'error'))
    expect(sessionStorage.getItem('loginAuthError')).toBeNull()
  })

  // AC11: loginReloadReason不在時はshowToastが更新理由で呼ばれない
  it('when_loginReloadReason_not_set_should_not_showToast_for_reason', async () => {
    render(<MemoryRouter><Login /></MemoryRouter>)
    await waitFor(() => {
      expect(mockGetSession).toHaveBeenCalled()
    })
    // showToastが呼ばれていないか、loginReloadReason文言では呼ばれていない
    if (capturedShowToast?.mock?.calls?.length > 0) {
      const reasonCall = capturedShowToast.mock.calls.find(
        ([msg]) => msg === '新しいバージョンに更新しました'
      )
      expect(reasonCall).toBeUndefined()
    }
  })
})
