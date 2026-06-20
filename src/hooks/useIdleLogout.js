import { useCallback, useEffect, useRef, useState } from 'react'

// SPEC-AUTH-LOCK-S2: 30分累積非操作でロック (ログアウトしない、staffセッション保持)
const IDLE_MS = 30 * 60 * 1000
const LS_KEY = 'session_last_activity'
const EVENTS = ['click', 'touchstart', 'scroll', 'keydown', 'pointerdown']

export function useSessionLock(enabled = true) {
  const [isLocked, setIsLocked] = useState(false)
  const timerRef = useRef(null)
  // refでロック状態を同期追跡(イベントハンドラ内のクロージャ陳腐化回避)
  const isLockedRef = useRef(false)

  const syncLock = useCallback((val) => {
    isLockedRef.current = val
    setIsLocked(val)
  }, [])

  const touchActivity = useCallback(() => {
    localStorage.setItem(LS_KEY, Date.now().toString())
  }, [])

  const scheduleTimer = useCallback((remainingMs = IDLE_MS) => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => syncLock(true), remainingMs)
  }, [syncLock])

  // ロック中は操作イベントを無視
  const resetActivity = useCallback(() => {
    if (isLockedRef.current || !enabled) return
    touchActivity()
    scheduleTimer()
  }, [enabled, touchActivity, scheduleTimer])

  // S5で解除処理(session-unlock呼び出し)と結線される入口
  const unlock = useCallback(() => {
    syncLock(false)
    touchActivity()
    scheduleTimer()
  }, [syncLock, touchActivity, scheduleTimer])

  // visibilitychange: 裏回り/画面オフを非操作累積に算入
  // visible復帰時に now()-last_activity で実経過を判定(iOSバックグラウンドthrottle耐性)
  useEffect(() => {
    if (!enabled) return
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible') return
      const last = parseInt(localStorage.getItem(LS_KEY) || '0', 10)
      const elapsed = last ? Date.now() - last : IDLE_MS
      if (elapsed >= IDLE_MS) {
        syncLock(true)
      } else {
        scheduleTimer(IDLE_MS - elapsed)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [enabled, syncLock, scheduleTimer])

  // ユーザー操作イベント登録 + 初回タイマー起動
  useEffect(() => {
    if (!enabled) {
      clearTimeout(timerRef.current)
      return
    }
    touchActivity()
    scheduleTimer()
    EVENTS.forEach(e => window.addEventListener(e, resetActivity, { passive: true }))
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetActivity))
      clearTimeout(timerRef.current)
    }
  }, [enabled, resetActivity, touchActivity, scheduleTimer])

  return { isLocked, unlock }
}
