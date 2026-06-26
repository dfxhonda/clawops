// J-PWA-AUTO-VERSION-RELOAD-01 (司令塔Opus spec):
// 起動時1回 + 15分アイドル経過後の初回visible復帰 で /version.json を no-store fetch、
// BUILD_SHA と異なれば一瞬トースト後 location.reload() で現場操作ゼロ。
// SPEC-PWA-VERSION-CHECK-UPDATE-01: 照合キーをcommit SHA化。
//   常時5分interval/毎回visibilitychange発火 → 「起動時+15分アイドル復帰のみ」に絞る。
//   作業中(15分以内に操作継続)はreloadが割り込まない。
//
// loop guard: 直近5分以内に既にfire済なら再reload抑制 (version.json配信遅延の無限ループ防止)。
// オフライン / fetch fail 時は LOG-SPEC-01 準拠で console.warn 'ERR-PWA-VERSION-FETCH ...' を出力。
import { useEffect, useState } from 'react'
import { BUILD_SHA } from '../../lib/buildInfo'
import { reportInterrupt } from '../../lib/idleLogoutProbe'

const RELOAD_DELAY_MS = 700           // トーストを一瞬見せてから reload
// IDLE_MS: useIdleLogout と同値 (045936b)。import循環を避けるため定数複製。
const IDLE_MS = 15 * 60 * 1000
// SPEC-PWA-VERSION-CHECK-FIX-01: timestamp-keyed loop guard (5分窓)
const STORAGE_KEY = 'version_check_last_fired'
const SUPPRESS_WINDOW_MS = 5 * 60 * 1000
const LOG_TAG = 'ERR-PWA-VERSION-FETCH'

// dev / pre-prod (BUILD_SHA='local') ではスキップして hot-reload と衝突しない。
function isDevMode() {
  return !BUILD_SHA || BUILD_SHA === 'local'
}

function logFetchFail(err) {
  // LOG-SPEC-01: 失敗は ERR-CODE 付き console.warn
  // eslint-disable-next-line no-console
  console.warn(`[${LOG_TAG}]`, err?.message || String(err))
}

// --- INVESTIGATE-IDLE-LOGOUT-PWA-01 T1: 一時計装 (調査後 revert) ---
// vitest では console.warn spy が calls[0] をチェックするテストがあるため無効化
// eslint-disable-next-line no-console
const _dbgV = import.meta.env.MODE === 'test' ? () => {} : (msg) => console.warn(`[DBG-VER] ${msg}`)
// --- /T1 ---

export function useVersionCheck({ now = Date.now, reload, getStorage } = {}) {
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    if (isDevMode()) return

    const storage = (getStorage ?? defaultStorage)()
    const doReload = reload ?? (() => {
      _dbgV(`doReload enter t=${Date.now()} perf=${Math.round(performance.now())}`)
      window.location.reload()
    })

    let cancelled = false
    let timeoutId = null

    async function check(trigger) {
      _dbgV(`check entry trigger=${trigger ?? 'startup'} t=${Date.now()} BUILD_SHA=${BUILD_SHA}`)
      try {
        const ts = typeof now === 'function' ? now() : Date.now()
        const res = await fetch(`/version.json?t=${ts}`, { cache: 'no-store' })
        if (!res.ok) {
          logFetchFail(new Error(`HTTP ${res.status}`))
          return
        }
        const data = await res.json()
        _dbgV(`check sha fetched=${data.sha} BUILD_SHA=${BUILD_SHA} match=${data.sha === BUILD_SHA} t=${Date.now()}`)
        if (!data.sha || data.sha === BUILD_SHA) return  // 一致 or SHA不明 = 何もしない

        // SPEC-PWA-VERSION-CHECK-FIX-01: timestamp ベース loop guard。
        const tsNow = typeof now === 'function' ? now() : Date.now()
        const lastFired = Number(storage?.getItem(STORAGE_KEY) ?? 0)
        const suppressed = !!(lastFired && tsNow - lastFired < SUPPRESS_WINDOW_MS)
        _dbgV(`check loop-guard lastFired=${lastFired} suppressed=${suppressed} t=${Date.now()}`)
        if (suppressed) return

        storage?.setItem(STORAGE_KEY, String(tsNow))
        if (cancelled) return
        _dbgV(`check scheduling doReload in ${RELOAD_DELAY_MS}ms t=${Date.now()}`)
        setReloading(true)
        timeoutId = setTimeout(() => {
          if (!cancelled) {
            _dbgV(`doReload firing t=${Date.now()} perf=${Math.round(performance.now())}`)
            reportInterrupt('RELOAD')
            doReload()
          }
        }, RELOAD_DELAY_MS)
      } catch (err) {
        logFetchFail(err)
      }
    }

    // 起動時1回
    check('startup')

    // 15分アイドル復帰時のみ check (useIdleLogout の hiddenAtRef パターン踏襲 045936b)
    let hiddenAt = null

    function handleHide() {
      hiddenAt = typeof now === 'function' ? now() : Date.now()
    }

    // T1: source 引数追加 (ログ識別用、ロジック変更なし)
    function handleVisibleReturn(source) {
      if (hiddenAt === null) {
        _dbgV(`handleVisibleReturn source=${source} t=${Date.now()} hiddenAt=null skip`)
        return
      }
      const elapsed = (typeof now === 'function' ? now() : Date.now()) - hiddenAt
      const willCheck = elapsed >= IDLE_MS
      _dbgV(`handleVisibleReturn source=${source} t=${Date.now()} perf=${Math.round(performance.now())} hiddenAt=${hiddenAt} elapsed=${elapsed} IDLE_MS=${IDLE_MS} willCheck=${willCheck}`)
      hiddenAt = null
      if (willCheck) check(source)
    }

    function handleVisibility() {
      if (document.visibilityState === 'hidden') handleHide()
      else handleVisibleReturn('visibilitychange')
    }

    // T1: source 識別用 wrapper (ロジック変更なし)
    const handlePageshow = () => handleVisibleReturn('pageshow')
    const handleFocus    = () => handleVisibleReturn('focus')

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handleHide)
    window.addEventListener('pageshow', handlePageshow)
    window.addEventListener('focus', handleFocus)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handleHide)
      window.removeEventListener('pageshow', handlePageshow)
      window.removeEventListener('focus', handleFocus)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { reloading }
}

function defaultStorage() {
  try { return window.sessionStorage } catch { return null }
}
