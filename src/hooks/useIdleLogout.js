import { useCallback, useEffect, useRef, useState } from 'react'
import { logout } from '../lib/auth/session'
import { markLogoutStart, markLogoutReplaced, reportInterrupt } from '../lib/idleLogoutProbe'

// SPEC-AUTH-TIMEOUT-LOGOUT-S1-01: 無操作30分アイドル → logout
//   (ヒロ指示 2026-07-07: 15分→30分変更。2026-06-23の5分→15分を更新)
// SPEC-AUTH-TIMEOUT-REALTIME-RESUME-FIX-01: setInterval実時間検算 + 戻りイベント網羅
// SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: hiddenAtRef で離席実時間を計測。
//   visible/pageshow 復帰時は lastActivityRef でなく hiddenAt 基準で判定し、
//   戻り際タッチ → resetActivity 競合を根本排除 (Page Visibility API 標準パターン)。
// SPEC-AUTH-TIMEOUT-LOCKSCREEN-01: hide-on-hide/decide-on-return。hidden 化した瞬間に
//   isLocked=true (最後に描画されるフレームをカバーにする) → 復帰時に window 内なら
//   isLocked=false で即座に元画面へ、window 超過なら doLogout。前画面のフラッシュを構造的に排除。
const IDLE_MS = 30 * 60 * 1000
const CHECK_INTERVAL = 30 * 1000 // 実時間検算 polling 間隔
const EVENTS = ['click', 'touchstart', 'scroll', 'keydown', 'pointerdown']

export function useSessionLock(enabled = true) {
  const timerRef = useRef(null)
  const intervalRef = useRef(null)
  const lastActivityRef = useRef(Date.now()) // 前面での操作タイムスタンプ (フォアグラウンドidle用)
  const hiddenAtRef = useRef(null)           // hidden になった時刻 (離席実時間計測用)
  // SPEC-AUTH-TIMEOUT-LOCKSCREEN-01: hidden 中はカバーを被せる。UI 専用フラグ (logout 判定には非関与)。
  const [isLocked, setIsLocked] = useState(false)

  const doLogout = useCallback(async () => {
    markLogoutStart()
    await logout()
    markLogoutReplaced()
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
      // SPEC-AUTH-TIMEOUT-LOCKSCREEN-01: hidden と同じ同期 tick でカバーを立てる (復帰時に
      // 前画面が先に描画されないよう、backgrounding 完了前の最後のフレームをカバーにする)。
      setIsLocked(true)
    }

    // SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: visible 復帰時は hiddenAt 基準で離席実時間を判定。
    //   戻り際に touchstart が先に走っても hiddenAt は操作で変化しないため競合排除。
    //   hiddenAt がなければ (フォアグラウンドでの focus 等) スキップ。
    const handleVisibleReturn = () => {
      if (hiddenAtRef.current === null) return
      if (Date.now() - hiddenAtRef.current >= IDLE_MS) {
        // window 超過: doLogout() は window.location.replace('/login') で全 state を破棄する
        // ため、カバーは張ったまま (isLocked=false にしない) → リダイレクトまで前画面を出さない。
        doLogout()
      } else {
        hiddenAtRef.current = null
        setIsLocked(false) // window 内: カバーを外し、離れた画面をそのまま即復帰 (remount なし)。
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

    const handlePageshow = () => handleVisibleReturn()
    const handleFocus    = () => handleVisibleReturn()

    // SW controllerchange 観測 (reportInterrupt probe、恒常運用)
    let _swCleanup = null
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const onControllerChange = () => {
        reportInterrupt('SWCHANGE')
      }
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
      _swCleanup = () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange)
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('pagehide', handleHide)
    window.addEventListener('pageshow', handlePageshow)
    window.addEventListener('focus', handleFocus)

    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, resetActivity))
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('pagehide', handleHide)
      window.removeEventListener('pageshow', handlePageshow)
      window.removeEventListener('focus', handleFocus)
      if (_swCleanup) _swCleanup()
      clearTimeout(timerRef.current)
      clearInterval(intervalRef.current)
    }
  }, [enabled, resetActivity, scheduleTimer, checkElapsed, doLogout])

  // SPEC-AUTH-TIMEOUT-LOCKSCREEN-01: App.jsx がカバー表示に使う (既存の値無視 caller は不変)。
  return isLocked
}
