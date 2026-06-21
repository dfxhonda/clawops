import { useCallback, useEffect, useRef } from 'react'
import { logout } from '../lib/auth/session'

// SPEC-AUTH-TIMEOUT-LOGOUT-S1-01: 無操作5分アイドル → logout (lock廃止)
const IDLE_MS = 5 * 60 * 1000
const EVENTS = ['click', 'touchstart', 'scroll', 'keydown', 'pointerdown']

export function useSessionLock(enabled = true) {
  const timerRef = useRef(null)
  const lastActivityRef = useRef(Date.now())

  const doLogout = useCallback(async () => {
    await logout()
    window.location.replace('/login')
  }, [])

  const scheduleTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(doLogout, IDLE_MS)
  }, [doLogout])

  const resetActivity = useCallback(() => {
    if (!enabled) return
    lastActivityRef.current = Date.now()
    scheduleTimer()
  }, [enabled, scheduleTimer])

  // visible復帰時に実時間5分超なら即logout (iOSはbackgroundでタイマーsuspendするため)
  useEffect(() => {
    if (!enabled) return
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed >= IDLE_MS) {
        doLogout()
      } else {
        scheduleTimer()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [enabled, doLogout, scheduleTimer])

  useEffect(() => {
    if (!enabled) {
      clearTimeout(timerRef.current)
      return
    }
    scheduleTimer()
    EVENTS.forEach(e => window.addEventListener(e, resetActivity, { passive: true }))
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetActivity))
      clearTimeout(timerRef.current)
    }
  }, [enabled, resetActivity, scheduleTimer])
}
