import { useCallback, useEffect, useRef } from 'react'
import { logout } from '../lib/auth/session'

// SPEC-AUTH-TIMEOUT-LOGOUT-S1-01: 無操作5分アイドル → logout (lock廃止)
// SPEC-AUTH-TIMEOUT-REALTIME-RESUME-FIX-01: setInterval実時間検算 + 戻りイベント(visibilitychange/focus/pageshow)網羅
// iOS はバックグラウンドで setTimeout を suspend するため、単発タイマーに依存するとログアウト不発火になる実証あり。
// 対策: 30秒 interval で Date.now() - lastActivity の実時間を検算し、IDLE_MS 超なら即 doLogout。
// 画面に戻る瞬間 (visibilitychange/focus/pageshow) でも同じ実時間検算を走らせ「戻った時点で中断」を保証。
const IDLE_MS = 5 * 60 * 1000
const CHECK_INTERVAL = 30 * 1000 // 実時間検算 polling 間隔
const EVENTS = ['click', 'touchstart', 'scroll', 'keydown', 'pointerdown']

export function useSessionLock(enabled = true) {
  const timerRef = useRef(null)
  const intervalRef = useRef(null)
  const lastActivityRef = useRef(Date.now())

  const doLogout = useCallback(async () => {
    await logout()
    window.location.replace('/login')
  }, [])

  const scheduleTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(doLogout, IDLE_MS)
  }, [doLogout])

  // 実時間検算: setTimeoutの相対カウントを信用せず Date.now()-lastActivity で判定
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
    // 定期実時間検算 (iOS timer suspend 後の次 tick で確実に実時間判定)
    intervalRef.current = setInterval(checkElapsed, CHECK_INTERVAL)

    // 活動イベント: lastActivity 更新 + タイマー再スケジュール
    EVENTS.forEach(e => window.addEventListener(e, resetActivity, { passive: true }))

    // 戻りイベント網羅: 実時間 >= IDLE_MS なら即 doLogout (「戻った時点で中断」仕様)
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      checkElapsed()
    }
    const handleReturn = () => checkElapsed()

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleReturn)
    window.addEventListener('pageshow', handleReturn)

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetActivity))
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleReturn)
      window.removeEventListener('pageshow', handleReturn)
      clearTimeout(timerRef.current)
      clearInterval(intervalRef.current)
    }
  }, [enabled, resetActivity, scheduleTimer, checkElapsed])
}
