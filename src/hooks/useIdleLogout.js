import { useCallback, useEffect, useRef, useState } from 'react'

// SPEC-AUTH-LOCK-S2-FIX2-BG-ELAPSED-01: 無操作5分アイドル + 裏回り実時間チェック
const IDLE_MS = 5 * 60 * 1000
const EVENTS = ['click', 'touchstart', 'scroll', 'keydown', 'pointerdown']

export function useSessionLock(enabled = true) {
  const [isLocked, setIsLocked] = useState(false)
  const timerRef = useRef(null)
  const isLockedRef = useRef(false)
  const lastActivityRef = useRef(Date.now())

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
    lastActivityRef.current = Date.now()
    scheduleTimer()
  }, [enabled, scheduleTimer])

  // S5で解除処理(session-unlock呼び出し)と結線される入口
  const unlock = useCallback(() => {
    lastActivityRef.current = Date.now()
    syncLock(false)
    scheduleTimer()
  }, [syncLock, scheduleTimer])

  // visible復帰時に実時間5分超なら即ロック (iOSはbackgroundでタイマーsuspendするため)
  useEffect(() => {
    if (!enabled) return
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const elapsed = Date.now() - lastActivityRef.current
      if (elapsed >= IDLE_MS) {
        syncLock(true)
      } else {
        scheduleTimer()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [enabled, syncLock, scheduleTimer])

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
