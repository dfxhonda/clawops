// J-PWA-AUTO-VERSION-RELOAD-01 (司令塔Opus spec):
// 起動時 + setInterval 5 分 + visibilitychange (foreground 復帰) で /version.json を no-store fetch、
// __BUILD_NUMBER__ と異なれば一瞬トースト後 location.reload() で現場操作ゼロ。
//
// loop guard: 同 buildNumber で既に reload 済なら再 reload しない (version.json 配信遅延時の無限ループ防止)。
// オフライン / fetch fail 時は LOG-SPEC-01 準拠で console.warn 'ERR-PWA-VERSION-FETCH ...' を出力
// (silent swallow は spec で禁止)。クラッシュさせない。
import { useEffect, useState } from 'react'
import { BUILD_NUMBER } from '../../lib/buildInfo'

const INTERVAL_MS = 5 * 60 * 1000     // 5 分 (spec triggers)
const RELOAD_DELAY_MS = 700           // トーストを一瞬見せてから reload
const STORAGE_KEY = 'reloaded_for_build'
const LOG_TAG = 'ERR-PWA-VERSION-FETCH'

// dev / pre-prod (BUILD_NUMBER='0' = git unavailable / 'local' = dev) ではスキップして
// hot-reload と衝突しないようにする。production / preview build で git rev-list count が
// 入っていれば '0' でなくなるので、本番系で自動 reload が有効化される。
function isDevMode() {
  return !BUILD_NUMBER || BUILD_NUMBER === '0' || BUILD_NUMBER === 'local'
}

function logFetchFail(err) {
  // LOG-SPEC-01: 失敗は ERR-CODE 付き console.warn (Sentry に拾わせる前提、UI には出さない)。
  // vite production build は console.log/debug/info を pure 化するが warn は残る。
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
        const fetchedBuild = String(data?.buildNumber ?? '')
        if (!fetchedBuild) return
        if (fetchedBuild === String(BUILD_NUMBER)) return // 一致 = 最新、何もしない

        // 同 buildNumber に対して既に reload 済なら ループ防止
        if (storage?.getItem(STORAGE_KEY) === fetchedBuild) return

        // ガード記録 → トースト表示 → 短い猶予後 reload
        storage?.setItem(STORAGE_KEY, fetchedBuild)
        if (cancelled) return
        setReloading(true)
        timeoutId = setTimeout(() => { if (!cancelled) doReload() }, RELOAD_DELAY_MS)
      } catch (err) {
        // オフライン / タイムアウト / JSON parse 失敗 → ログのみ、クラッシュしない
        logFetchFail(err)
      }
    }

    check()
    const intervalId = setInterval(check, INTERVAL_MS)

    function handleVisibility() {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      cancelled = true
      clearInterval(intervalId)
      if (timeoutId) clearTimeout(timeoutId)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { reloading }
}

function defaultStorage() {
  try { return window.sessionStorage } catch { return null }
}
