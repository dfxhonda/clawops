// @vitest-environment happy-dom
// SPEC-AUTH-TIMEOUT-LOGOUT-S1-01: idle → logout (lock廃止)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../lib/auth/session', () => ({
  logout: vi.fn(async () => {}),
}))

import { useSessionLock } from '../../hooks/useIdleLogout'
import { logout } from '../../lib/auth/session'

const IDLE_MS = 5 * 60 * 1000

let originalLocation

beforeEach(() => {
  vi.useFakeTimers()
  vi.clearAllMocks()
  originalLocation = window.location
  delete window.location
  window.location = { replace: vi.fn() }
})

afterEach(() => {
  vi.useRealTimers()
  window.location = originalLocation
})

describe('useSessionLock SPEC-AUTH-TIMEOUT-LOGOUT-S1-01', () => {
  it('when_idle_5min_should_call_logout_not_lock', async () => {
    // AC1: idle 5分 → logout() 呼ばれる
    renderHook(() => useSessionLock(true))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS)
    })
    expect(logout).toHaveBeenCalled()
  })

  it('when_idle_5min_should_redirect_to_login', async () => {
    // AC1: logout後に /login へリダイレクト
    renderHook(() => useSessionLock(true))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS)
    })
    expect(window.location.replace).toHaveBeenCalledWith('/login')
  })

  it('when_user_active_resets_timer_should_not_logout', async () => {
    // AC1: 操作でタイマーリセット → IDLE_MS未満なら logout しない
    renderHook(() => useSessionLock(true))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS - 1000)
      window.dispatchEvent(new Event('click'))
      await vi.advanceTimersByTimeAsync(IDLE_MS - 1000)
    })
    expect(logout).not.toHaveBeenCalled()
  })

  it('when_disabled_should_not_logout_on_idle', async () => {
    // enabled=false → タイマーなし
    renderHook(() => useSessionLock(false))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS * 2)
    })
    expect(logout).not.toHaveBeenCalled()
  })

  it('when_visibility_restored_after_elapsed_should_logout', async () => {
    // AC2: background >5min → visibilitychange → logout
    renderHook(() => useSessionLock(true))
    await act(async () => {
      // 5分超経過させてから visibility 復帰
      await vi.advanceTimersByTimeAsync(IDLE_MS + 1000)
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible', configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(logout).toHaveBeenCalled()
  })

  it('hook_should_return_nothing_not_isLocked_or_unlock', () => {
    // AC3: isLocked/unlock は返さない (return value undefined)
    const { result } = renderHook(() => useSessionLock(true))
    expect(result.current).toBeUndefined()
  })
})
