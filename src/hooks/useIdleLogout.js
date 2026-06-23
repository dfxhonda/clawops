import { useCallback, useEffect, useRef } from 'react'
import { logout } from '../lib/auth/session'

// SPEC-AUTH-TIMEOUT-LOGOUT-S1-01: 無操作15分アイドル → logout (ヒロ指示 2026-06-23: 5分→15分変更)
// SPEC-AUTH-TIMEOUT-REALTIME-RESUME-FIX-01: setInterval実時間検算 + 戻りイベント網羅
// SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: hiddenAtRef で離席実時間を計測。
//   visible/pageshow 復帰時は lastActivityRef でなく hiddenAt 基準で判定し、
//   戻り際タッチ → resetActivity 競合を根本排除 (Page Visibility API 標準パターン)。
const IDLE_MS = 15 * 60 * 1000
const CHECK_INTERVAL = 30 * 1000 // 実時間検算 polling 間隔
const EVENTS = ['click', 'touchstart', 'scroll', 'keydown', 'pointerdown']

export function useSessionLock(enabled = true) {
  const timerRef = useRef(null)
  const intervalRef = useRef(null)
  const lastActivityRef = useRef(Date.now()) // 前面での操作タイムスタンプ (フォアグラウンドidle用)
  const hiddenAtRef = useRef(null)           // hidden になった時刻 (離席実時間計測用)

  const doLogout = useCallback(async () => {
    await logout()
    window.location.replace('/login')
  }, [])

  const scheduleTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(doLogout, IDLE_MS)
  }, [doLogout])

  // 前面無操作用: setTimeoutの相対カウントを信用せずDate.now()-lastActivityで判定
  const checkElapsed = useCallback(() => {
    const elapsed = Date.now() - lastActivityRef.current
    if (elapsed >= IDLE_MS) {
      doLogout()
    } else {
      scheduleTimer()
    }
  }, [doLogout, scheduleTimer])

  const resetActivity = useCallback(() => {
    if (!enabled) return
    lastActivityRef.current = Date.now()
    scheduleTimer()
  }, [enabled, scheduleTimer])

  useEffect(() => {
    if (!enabled) {
      clearTimeout(timerRef.current)
      clearInterval(intervalRef.current)
      return
    }

    scheduleTimer()
    // 定期実時間検算 (フォアグラウンド無操作 + iOS timer suspend 後の次 tick 判定)
    intervalRef.current = setInterval(checkElapsed, CHECK_INTERVAL)

    // 活動イベント: lastActivity 更新 + タイマー再スケジュール
    EVENTS.forEach(e => window.addEventListener(e, resetActivity, { passive: true }))

    // SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: hidden 時刻を記録
    // pagehide も記録 (iOS bfcache でvisibilitychange未発火の取りこぼし防止)
    const handleHide = () => {
      hiddenAtRef.current = Date.now()
    }

    // SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: visible 復帰時は hiddenAt 基準で離席実時間を判定。
    //   戻り際に touchstart が先に走っても hiddenAt は操作で変化しないため競合排除。
    //   hiddenAt がなければ (フォアグラウンドでの focus 等) スキップ。
    const handleVisibleReturn = () => {
      if (hiddenAtRef.current === null) return
      if (Date.now() - hiddenAtRef.current >= IDLE_MS) {
        doLogout()
      } else {
        hiddenAtRef.current = null
        scheduleTimer()
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleHide()
      } else if (document.visibilityState === 'visible') {
        handleVisibleReturn()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handleHide)
    window.addEventListener('pageshow', handleVisibleReturn)
    window.addEventListener('focus', handleVisibleReturn)

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handleHide)
      window.removeEventListener('pageshow', handleVisibleReturn)
      window.removeEventListener('focus', handleVisibleReturn)
      clearTimeout(timerRef.current)
      clearInterval(intervalRef.current)
    }
  }, [enabled, resetActivity, scheduleTimer, checkElapsed, doLogout])
}
