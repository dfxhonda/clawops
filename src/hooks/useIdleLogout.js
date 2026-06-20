import { useCallback, useEffect, useRef, useState } from 'react'

// SPEC-AUTH-LOCK-S2-FIX-IDLE5MIN-01: 無操作5分アイドルのみでロック (visibilitychange撤去)
const IDLE_MS = 5 * 60 * 1000
const EVENTS = ['click', 'touchstart', 'scroll', 'keydown', 'pointerdown']

export function useSessionLock(enabled = true) {
  const [isLocked, setIsLocked] = useState(false)
  const timerRef = useRef(null)
  const isLockedRef = useRef(false)

  const syncLock = useCallback((val) => {
    isLockedRef.current = val
    setIsLocked(val)
  }, [])

  const scheduleTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => syncLock(true), IDLE_MS)
  }, [syncLock])

  const resetActivity = useCallback(() => {
    if (isLockedRef.current || !enabled) return
    scheduleTimer()
  }, [enabled, scheduleTimer])

  // S5で解除処理(session-unlock呼び出し)と結線される入口
  const unlock = useCallback(() => {
    syncLock(false)
    scheduleTimer()
  }, [syncLock, scheduleTimer])

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

  return { isLocked, unlock }
}
