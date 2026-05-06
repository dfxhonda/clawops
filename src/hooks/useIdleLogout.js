import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const IDLE_MS = 15 * 60 * 1000      // 15分
const WARN_BEFORE_MS = 60 * 1000    // 14分目に警告（残り60秒）

const EVENTS = ['click', 'touchstart', 'scroll', 'keydown', 'pointerdown']

/**
 * 無操作自動ログアウト
 * enabled=true の間だけタイマーを動かす（ログイン中のみ）
 *
 * - 14分無操作: showWarning=true（警告バナー表示）
 * - 15分無操作: signOut() → /login
 * - タップ/スクロール/キー: タイマーリセット、バナー非表示
 */
export function useIdleLogout(enabled = true) {
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const [showWarning, setShowWarning] = useState(false)
  const warnTimer = useRef(null)
  const logoutTimer = useRef(null)

  const clearTimers = useCallback(() => {
    clearTimeout(warnTimer.current)
    clearTimeout(logoutTimer.current)
  }, [])

  const reset = useCallback(() => {
    setShowWarning(false)
    clearTimers()
    if (!enabled) return
    warnTimer.current = setTimeout(
      () => setShowWarning(true),
      IDLE_MS - WARN_BEFORE_MS,
    )
    logoutTimer.current = setTimeout(async () => {
      setShowWarning(false)
      await supabase.auth.signOut()
      navigateRef.current('/login', { replace: true })
    }, IDLE_MS)
  }, [enabled, clearTimers])

  useEffect(() => {
    if (!enabled) {
      clearTimers()
      setShowWarning(false)
      return
    }
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, reset))
      clearTimers()
    }
  }, [enabled, reset, clearTimers])

  return { showWarning, reset }
}
