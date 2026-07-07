// @vitest-environment happy-dom
// SPEC-AUTH-TIMEOUT-LOGOUT-S1-01: idle 30分 → logout
// SPEC-AUTH-TIMEOUT-REALTIME-RESUME-FIX-01: setInterval実時間検算 + 戻りイベント網羅
// SPEC-AUTH-TIMEOUT-LOCKSCREEN-01: IDLE_MS 30分化 + hidden中 isLocked カバー
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'

vi.mock('../../lib/auth/session', () => ({
  logout: vi.fn(async () => {}),
}))

import { useSessionLock } from '../../hooks/useIdleLogout'
import { logout } from '../../lib/auth/session'

const IDLE_MS = 30 * 60 * 1000

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
  it('when_idle_15min_should_call_logout_not_lock', async () => {
    // AC1: idle 15分 → logout() 呼ばれる
    renderHook(() => useSessionLock(true))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS)
    })
    expect(logout).toHaveBeenCalled()
  })

  it('when_idle_15min_should_redirect_to_login', async () => {
    // AC1: logout後に /login へリダイレクト
    renderHook(() => useSessionLock(true))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS)
    })
    expect(window.location.replace).toHaveBeenCalledWith('/login')
  })

  it('when_user_active_resets_timer_should_not_logout', async () => {
    // AC5: 操作でタイマーリセット → IDLE_MS未満なら logout しない
    renderHook(() => useSessionLock(true))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS - 1000)
      window.dispatchEvent(new Event('click'))
      await vi.advanceTimersByTimeAsync(IDLE_MS - 1000)
    })
    expect(logout).not.toHaveBeenCalled()
  })

  it('when_disabled_should_not_logout_on_idle', async () => {
    // AC6: enabled=false → タイマーなし
    renderHook(() => useSessionLock(false))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(IDLE_MS * 2)
    })
    expect(logout).not.toHaveBeenCalled()
  })

  it('when_visibility_restored_after_elapsed_should_logout', async () => {
    // AC2: visibilitychange(visible) かつ hiddenAt >= IDLE_MS → logout
    // SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: hidden記録が必要
    renderHook(() => useSessionLock(true))
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange')) // hiddenAt 記録
      vi.setSystemTime(Date.now() + IDLE_MS + 1000)
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(logout).toHaveBeenCalled()
  })

})

describe('useSessionLock SPEC-AUTH-TIMEOUT-LOCKSCREEN-01', () => {
  it('AC1_IDLE_MS_is_30_minutes', async () => {
    // 30分未満では logout せず、30分ちょうどで logout する = IDLE_MS===30*60*1000
    renderHook(() => useSessionLock(true))
    await act(async () => { await vi.advanceTimersByTimeAsync(30 * 60 * 1000 - 1000) })
    expect(logout).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(1000) })
    expect(logout).toHaveBeenCalled()
  })

  it('AC2_returns_boolean_initial_false', () => {
    const { result } = renderHook(() => useSessionLock(true))
    expect(typeof result.current).toBe('boolean')
    expect(result.current).toBe(false)
  })

  it('AC3_hidden_sets_isLocked_true_synchronously', () => {
    const { result } = renderHook(() => useSessionLock(true))
    act(() => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(true)
  })

  it('AC4_return_within_idle_unlocks_and_does_not_logout', async () => {
    const { result } = renderHook(() => useSessionLock(true))
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(true)
    await act(async () => {
      vi.setSystemTime(Date.now() + IDLE_MS - 1000) // 30分未満
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(result.current).toBe(false)
    expect(logout).not.toHaveBeenCalled()
  })

  it('AC5_return_after_idle_logs_out_and_keeps_isLocked_true', async () => {
    const { result } = renderHook(() => useSessionLock(true))
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await act(async () => {
      vi.setSystemTime(Date.now() + IDLE_MS + 1000) // 30分超過
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(logout).toHaveBeenCalled()
    // カバーはリダイレクトまで張ったまま (false にしない)
    expect(result.current).toBe(true)
  })
})

describe('useSessionLock SPEC-AUTH-TIMEOUT-REALTIME-RESUME-FIX-01', () => {
  it('when_interval_fires_at_elapsed_should_logout_via_realtime_check', async () => {
    // AC1: setInterval 30秒 tick が IDLE_MS 時点で実時間 >= IDLE_MS を検出して doLogout
    // (setTimeoutがiOSでsuspendされても interval の実時間検算でログアウト)
    renderHook(() => useSessionLock(true))
    await act(async () => {
      // IDLE_MS まで進める: interval が IDLE_MS 時点で elapsed >= IDLE_MS → doLogout
      await vi.advanceTimersByTimeAsync(IDLE_MS)
    })
    expect(logout).toHaveBeenCalled()
    expect(window.location.replace).toHaveBeenCalledWith('/login')
  })

  it('when_focus_event_after_elapsed_should_logout_immediately', async () => {
    // AC3: window focus 時に hiddenAt >= IDLE_MS なら即 doLogout
    // SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: pagehideでhiddenAt記録が必要
    renderHook(() => useSessionLock(true))
    await act(async () => {
      window.dispatchEvent(new Event('pagehide')) // hiddenAt 記録
      vi.setSystemTime(Date.now() + IDLE_MS + 1000)
      window.dispatchEvent(new Event('focus'))
    })
    expect(logout).toHaveBeenCalled()
  })

  it('when_pageshow_event_after_elapsed_should_logout_immediately', async () => {
    // AC3: pageshow 時に hiddenAt >= IDLE_MS なら即 doLogout
    // SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: pagehideでhiddenAt記録が必要
    renderHook(() => useSessionLock(true))
    await act(async () => {
      window.dispatchEvent(new Event('pagehide')) // hiddenAt 記録
      vi.setSystemTime(Date.now() + IDLE_MS + 1000)
      window.dispatchEvent(new Event('pageshow'))
    })
    expect(logout).toHaveBeenCalled()
  })

  it('when_return_event_under_idle_limit_should_not_logout', async () => {
    // AC4: hiddenAt < IDLE_MS で focus/pageshow → logout しない
    // SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: hiddenAt記録後に判定
    renderHook(() => useSessionLock(true))
    await act(async () => {
      window.dispatchEvent(new Event('pagehide')) // hiddenAt 記録
      vi.setSystemTime(Date.now() + IDLE_MS - 1000)
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('pageshow'))
    })
    expect(logout).not.toHaveBeenCalled()
  })

  it('when_visibility_under_limit_should_not_logout', async () => {
    // AC4: hiddenAt < IDLE_MS で visibilitychange visible → logout しない
    // SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: hidden→visible の流れで判定
    renderHook(() => useSessionLock(true))
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange')) // hiddenAt 記録
      vi.setSystemTime(Date.now() + IDLE_MS - 1000)
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(logout).not.toHaveBeenCalled()
  })

  it('when_activity_resets_lastActivity_focus_within_limit_should_not_logout', async () => {
    // AC5: 操作でlastActivity更新 → その後IDLE_MS未満でfocusしてもlogoutしない
    renderHook(() => useSessionLock(true))
    await act(async () => {
      // 4分経過後にクリック → lastActivity 更新
      vi.setSystemTime(Date.now() + IDLE_MS - 60000)
      window.dispatchEvent(new Event('click'))
      // 1分後に focus (最終操作から60秒 < IDLE_MS)
      vi.setSystemTime(Date.now() + 60000)
      window.dispatchEvent(new Event('focus'))
    })
    expect(logout).not.toHaveBeenCalled()
  })

  it('when_unmount_should_clear_interval_and_all_return_listeners', async () => {
    // AC6: unmount後はinterval・戻りイベントリスナーが全て除去され、ログアウトしない
    // SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: pagehide/pageshow も含めて全解除確認
    const { unmount } = renderHook(() => useSessionLock(true))
    unmount()
    await act(async () => {
      vi.setSystemTime(Date.now() + IDLE_MS + 1000)
      window.dispatchEvent(new Event('pagehide'))
      window.dispatchEvent(new Event('focus'))
      window.dispatchEvent(new Event('pageshow'))
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible', configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(IDLE_MS)
    })
    expect(logout).not.toHaveBeenCalled()
  })

  it('when_visibilitychange_not_visible_should_not_logout', async () => {
    // visibilitychange が 'hidden' のままなら logout しない (hiddenAt 記録のみ)
    renderHook(() => useSessionLock(true))
    await act(async () => {
      vi.setSystemTime(Date.now() + IDLE_MS + 1000)
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden', configurable: true,
      })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(logout).not.toHaveBeenCalled()
  })
})

describe('useSessionLock SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01', () => {
  it('when_hidden_elapsed_visible_return_with_touch_should_logout', async () => {
    // AC1: 戻り際タッチ競合でも hiddenAt 基準なのでログアウト発火
    // 旧実装: touchstart → resetActivity → lastActivity=now → checkElapsed sees <5min → 失敗
    // 新実装: hiddenAt は操作で変化しない → 競合排除
    renderHook(() => useSessionLock(true))
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange')) // hiddenAt 記録
      vi.setSystemTime(Date.now() + IDLE_MS + 1000)
      window.dispatchEvent(new Event('touchstart')) // 戻り際タッチ (lastActivity を now にリセット)
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange')) // hiddenAt 基準で判定 → logout
    })
    expect(logout).toHaveBeenCalled()
  })

  it('when_hidden_under_limit_visible_return_should_not_logout_and_clear_hiddenAt', async () => {
    // AC2: hidden < IDLE_MS → logout なし、hiddenAt クリア、タイマー継続
    renderHook(() => useSessionLock(true))
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
      document.dispatchEvent(new Event('visibilitychange')) // hiddenAt 記録
      vi.setSystemTime(Date.now() + IDLE_MS - 1000)       // IDLE_MS 未満
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    expect(logout).not.toHaveBeenCalled()
  })

  it('when_pagehide_records_and_pageshow_judges_logout', async () => {
    // AC4: iOS bfcache 取りこぼし防止: pagehide で記録 / pageshow で判定
    renderHook(() => useSessionLock(true))
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'))  // hiddenAt 記録
      vi.setSystemTime(Date.now() + IDLE_MS + 1000)
      window.dispatchEvent(new Event('pageshow'))  // hiddenAt 基準で logout
    })
    expect(logout).toHaveBeenCalled()
  })

  it('when_no_hidden_event_focus_should_skip_check', async () => {
    // AC1 裏面: hidden イベントなしの focus (デスクトップ window switch 等) は hiddenAt=null でスキップ
    renderHook(() => useSessionLock(true))
    await act(async () => {
      vi.setSystemTime(Date.now() + IDLE_MS + 1000) // 時間は過ぎているが
      window.dispatchEvent(new Event('focus'))       // hiddenAt=null → early return
    })
    expect(logout).not.toHaveBeenCalled()
  })
})
