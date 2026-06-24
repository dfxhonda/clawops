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

export function useVersionCheck({ now = Date.now, reload, getStorage } = {}) {
  const [reloading, setReloading] = useState(false)

  useEffect(() => {
    if (isDevMode()) return

    const storage = (getStorage ?? defaultStorage)()
    const doReload = reload ?? (() => { window.location.reload() })

    let cancelled = false
    let timeoutId = null

    async function check() {
      try {
        const ts = typeof now === 'function' ? now() : Date.now()
        const res = await fetch(`/version.json?t=${ts}`, { cache: 'no-store' })
        if (!res.ok) {
          logFetchFail(new Error(`HTTP ${res.status}`))
          return
        }
        const data = await res.json()
        if (!data.sha || data.sha === BUILD_SHA) return  // 一致 or SHA不明 = 何もしない

        // SPEC-PWA-VERSION-CHECK-FIX-01: timestamp ベース loop guard。
        const tsNow = typeof now === 'function' ? now() : Date.now()
        const lastFired = Number(storage?.getItem(STORAGE_KEY) ?? 0)
        if (lastFired && tsNow - lastFired < SUPPRESS_WINDOW_MS) return

        storage?.setItem(STORAGE_KEY, String(tsNow))
        if (cancelled) return
        setReloading(true)
        timeoutId = setTimeout(() => { if (!cancelled) doReload() }, RELOAD_DELAY_MS)
      } catch (err) {
        logFetchFail(err)
      }
    }

    // 起動時1回
    check()

    // 15分アイドル復帰時のみ check (useIdleLogout の hiddenAtRef パターン踏襲 045936b)
    let hiddenAt = null

    function handleHide() {
      hiddenAt = typeof now === 'function' ? now() : Date.now()
    }

    function handleVisibleReturn() {
      if (hiddenAt === null) return
      const elapsed = (typeof now === 'function' ? now() : Date.now()) - hiddenAt
      hiddenAt = null
      if (elapsed >= IDLE_MS) check()
    }

    function handleVisibility() {
      if (document.visibilityState === 'hidden') handleHide()
      else handleVisibleReturn()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('pagehide', handleHide)
    window.addEventListener('pageshow', handleVisibleReturn)
    window.addEventListener('focus', handleVisibleReturn)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('pagehide', handleHide)
      window.removeEventListener('pageshow', handleVisibleReturn)
      window.removeEventListener('focus', handleVisibleReturn)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { reloading }
}

function defaultStorage() {
  try { return window.sessionStorage } catch { return null }
}
