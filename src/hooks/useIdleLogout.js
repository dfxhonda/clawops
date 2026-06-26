import { useCallback, useEffect, useRef } from 'react'
import { logout } from '../lib/auth/session'
import { markLogoutStart, markLogoutReplaced, reportInterrupt } from '../lib/idleLogoutProbe'

// SPEC-AUTH-TIMEOUT-LOGOUT-S1-01: 無操作15分アイドル → logout (ヒロ指示 2026-06-23: 5分→15分変更)
// SPEC-AUTH-TIMEOUT-REALTIME-RESUME-FIX-01: setInterval実時間検算 + 戻りイベント網羅
// SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: hiddenAtRef で離席実時間を計測。
//   visible/pageshow 復帰時は lastActivityRef でなく hiddenAt 基準で判定し、
//   戻り際タッチ → resetActivity 競合を根本排除 (Page Visibility API 標準パターン)。
const IDLE_MS = 15 * 60 * 1000
const CHECK_INTERVAL = 30 * 1000 // 実時間検算 polling 間隔
const EVENTS = ['click', 'touchstart', 'scroll', 'keydown', 'pointerdown']

// --- INVESTIGATE-IDLE-LOGOUT-PWA-01 T1: 一時計装 (調査後 revert) ---
// note: production build で console.info は esbuild.pure で消えるため console.warn を使用
// eslint-disable-next-line no-console
const _dbg = (msg) => console.warn(`[DBG-IDLE] ${msg}`)
// --- /T1 ---

export function useSessionLock(enabled = true) {
  const timerRef = useRef(null)
  const intervalRef = useRef(null)
  const lastActivityRef = useRef(Date.now()) // 前面での操作タイムスタンプ (フォアグラウンドidle用)
  const hiddenAtRef = useRef(null)           // hidden になった時刻 (離席実時間計測用)

  const doLogout = useCallback(async () => {
    markLogoutStart()
    _dbg(`doLogout enter t=${Date.now()} perf=${Math.round(performance.now())}`)
    await logout()
    _dbg(`doLogout after-logout t=${Date.now()} perf=${Math.round(performance.now())}`)
    markLogoutReplaced()
    window.location.replace('/login')
    _dbg(`doLogout after-replace t=${Date.now()} perf=${Math.round(performance.now())}`)
  }, [])

  const scheduleTimer = useCallback(() => {
    const elapsed = Date.now() - lastActivityRef.current
    _dbg(`scheduleTimer t=${Date.now()} elapsed=${elapsed}`)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(doLogout, IDLE_MS)
  }, [doLogout])

  // 前面無操作用: setTimeoutの相対カウントを信用せずDate.now()-lastActivityで判定
  const checkElapsed = useCallback(() => {
    const elapsed = Date.now() - lastActivityRef.current
    const result = elapsed >= IDLE_MS ? 'logout' : 'reschedule'
    _dbg(`checkElapsed t=${Date.now()} elapsed=${elapsed} IDLE_MS=${IDLE_MS} result=${result}`)
    if (elapsed >= IDLE_MS) {
      doLogout()
    } else {
      scheduleTimer()
    }
  }, [doLogout, scheduleTimer])

  const resetActivity = useCallback((e) => {
    if (!enabled) return
    _dbg(`resetActivity t=${Date.now()} event=${e?.type}`)
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
      _dbg(`handleHide t=${Date.now()} perf=${Math.round(performance.now())}`)
      hiddenAtRef.current = Date.now()
    }

    // SPEC-AUTH-TIMEOUT-HIDDEN-TIMESTAMP-FIX-01: visible 復帰時は hiddenAt 基準で離席実時間を判定。
    //   戻り際に touchstart が先に走っても hiddenAt は操作で変化しないため競合排除。
    //   hiddenAt がなければ (フォアグラウンドでの focus 等) スキップ。
    // T1: source 引数追加 (ログ識別用、ロジック変更なし)
    const handleVisibleReturn = (source) => {
      const elapsed = hiddenAtRef.current !== null ? Date.now() - hiddenAtRef.current : -1
      const result = hiddenAtRef.current === null ? 'skip(hiddenAt=null)'
        : elapsed >= IDLE_MS ? 'will-logout'
        : 'reschedule'
      _dbg(`handleVisibleReturn source=${source} t=${Date.now()} perf=${Math.round(performance.now())} hiddenAt=${hiddenAtRef.current} elapsed=${elapsed} result=${result}`)
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
        handleVisibleReturn('visibilitychange')
      }
    }

    // T1: source 識別用 wrapper (ロジック変更なし)
    const handlePageshow = () => handleVisibleReturn('pageshow')
    const handleFocus    = () => handleVisibleReturn('focus')

    // T3: iOS PWA resume でのイベント発火回数実測
    const _t3 = { pageshow: 0, focus: 0, visibilitychange: 0 }
    const t3Pageshow = () => {
      _t3.pageshow++
      _dbg(`T3 pageshow #${_t3.pageshow} t=${Date.now()} persisted=${window.event?.persisted ?? '?'}`)
    }
    const t3Focus = () => {
      _t3.focus++
      _dbg(`T3 focus #${_t3.focus} t=${Date.now()}`)
    }
    const t3Vis = () => {
      _t3.visibilitychange++
      _dbg(`T3 visibilitychange #${_t3.visibilitychange} state=${document.visibilityState} t=${Date.now()}`)
    }
    window.addEventListener('pageshow', t3Pageshow)
    window.addEventListener('focus', t3Focus)
    document.addEventListener('visibilitychange', t3Vis)

    // T4: SW controllerchange 観測
    let _swCleanup = null
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const onControllerChange = () => {
        _dbg(`T4 controllerchange t=${Date.now()} perf=${Math.round(performance.now())}`)
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
      window.removeEventListener('pageshow', t3Pageshow)
      window.removeEventListener('focus', t3Focus)
      document.removeEventListener('visibilitychange', t3Vis)
      if (_swCleanup) _swCleanup()
      clearTimeout(timerRef.current)
      clearInterval(intervalRef.current)
    }
  }, [enabled, resetActivity, scheduleTimer, checkElapsed, doLogout])
}
