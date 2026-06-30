// SPEC-PWA-LOGIN-SW-UPDATE-01: version不一致時にupdateSW(true)でSW世代交代+reload。fallback=location.reload()
// SPEC-PWA-LOGIN-VERSION-RELOAD-01:
// ログイン成功 (verify-pin 通過) または session 復元成功時に /version.json を no-store fetch、
// サーバー側 sha とクライアント BUILD_SHA が異なれば session 中 1 回だけ
// location.reload() で最新 bundle に揃える。
//
// SPEC-LOGIN-VERSION-CHECK-SHA-FIX-01: 比較キーを buildNumber → commit SHA に変更。
// main squash promote 運用ではコミット総数(buildNumber)がほぼ固定になり誤判定を起こすため。
// useVersionCheck.js と同じ SHA 基準に統一。version.json は既に sha を保持。
//
// loop guard: sessionStorage 'version_reload_done' = '1' (boolean、build 非依存)。
// 1 度立てば次回ログインまで効かない (ブラウザタブ閉じれば sessionStorage はクリアされ再評価可)。
// SPEC-PWA-VERSION-CHECK-FIX-01 の useVersionCheck (timestamp 5min 抑制) とは独立 storage key で
// 共存、両者が互いを抑制しないよう完全分離する。
//
// 失敗 (network / HTTP error / timeout / JSON 不正) は LOG-SPEC-01 準拠の console.warn のみで、
// reload せず login 処理を続行。dev (BUILD_SHA='local' / 未設定) では check 自体 skip。
//
// SPEC-PWA-SW-UPDATE-CONTROLLERCHANGE-01:
// 定石#3: reloadをcontrollerchange発火に委ねる。updateSW(true)はSKIP_WAITINGトリガーのみ。
// controllerchangeN秒未到達 → fallbackReload保険。iOS PWAでskipWaitingが効かない最悪ケース対策。

import { BUILD_SHA } from '../lib/buildInfo'

const STORAGE_KEY = 'version_reload_done'
const FETCH_TIMEOUT_MS = 3000
const RELOAD_TIMEOUT_MS = 3000
const LOG_TAG = 'ERR-PWA-LOGIN-VERSION'

function isDevMode() {
  return !BUILD_SHA || BUILD_SHA === 'local'
}

function defaultStorage() {
  try { return window.sessionStorage } catch { return null }
}

function logFail(err) {
  // LOG-SPEC-01: 失敗は ERR-CODE 付き console.warn (Sentry 拾い、UI 出さない)。
  // vite production build は console.log/debug/info を pure 化するが warn は残る。
  // eslint-disable-next-line no-console
  console.warn(`[${LOG_TAG}]`, err?.message || String(err))
}

/**
 * /version.json を fetch して BUILD_SHA と比較し、不一致なら 1 回だけ reload。
 * 呼び出し側 (Login.jsx) は await して { reloaded: true } を受けたら以降の navigate を打ち切る。
 * SPEC-PWA-SW-UPDATE-CONTROLLERCHANGE-01: controllerchange発火でreload、updateSW(true)はトリガーのみ。
 *
 * @param {object} [opts]
 * @param {function} [opts.fetch]           テスト時に差し替え可能な fetch (default: global)
 * @param {function} [opts.reload]          テスト時に差し替え可能な reload (default: window.location.reload)
 * @param {function} [opts.updateSW]        vite-plugin-pwa の updateSW(true)
 * @param {function} [opts.getStorage]      テスト時に差し替え可能な storage 取得 (default: sessionStorage)
 * @param {number}   [opts.timeoutMs]       fetch timeout (default: 3000ms)
 * @param {function} [opts.now]             テスト時に差し替え可能な now (default: Date.now)
 * @param {object|null} [opts.swContainer]  テスト注入用 navigator.serviceWorker (undefined=本番自動)
 * @param {number}   [opts.reloadTimeoutMs] controllerchange未到達時のfallbackまでのms (default: 3000ms)
 * @returns {Promise<{reloaded: boolean, reason: string}>}
 */
export async function checkAndReloadIfStale({
  fetch: fetchFn,
  reload,
  updateSW,
  getStorage,
  timeoutMs = FETCH_TIMEOUT_MS,
  now = Date.now,
  swContainer,
  reloadTimeoutMs = RELOAD_TIMEOUT_MS,
} = {}) {
  if (isDevMode()) return { reloaded: false, reason: 'dev' }

  const storage = (getStorage ?? defaultStorage)()
  // SPEC-PWA-SW-GENERATION-SWAP-FIX-01: early-return guard廃止。
  // fetchは毎回走らせ、SHAベースでguard判定する(同SHA→skip、新SHA→reload)。

  const f = fetchFn ?? (typeof fetch === 'function' ? fetch : null)
  if (!f) return { reloaded: false, reason: 'no-fetch' }

  const fallbackReload = reload ?? (() => { window.location.reload() })

  async function doReload() {
    const swFn = updateSW ?? (() => Promise.reject(new Error('no updateSW')))
    // swContainer: undefined=本番(navigator.serviceWorker使用) / null=SW不在縮退
    const sw = swContainer !== undefined
      ? swContainer
      : (typeof navigator !== 'undefined' ? navigator?.serviceWorker ?? null : null)

    let refreshing = false
    const doActualReload = () => {
      if (refreshing) return
      refreshing = true
      fallbackReload()
    }

    if (sw) {
      // 定石#3: controllerchangeを先に登録してからupdateSW(true)でSKIP_WAITINGトリガー
      sw.addEventListener('controllerchange', doActualReload, { once: true })

      const timer = setTimeout(() => {
        sw.removeEventListener('controllerchange', doActualReload)
        doActualReload()
      }, reloadTimeoutMs)

      // updateSW(true)はトリガーのみ。reloadはcontrollerchangeに委ねる
      swFn(true).catch(() => {
        clearTimeout(timer)
        sw.removeEventListener('controllerchange', doActualReload)
        doActualReload()
      })
    } else {
      // navigator.serviceWorker不在(テスト環境含む) → fallbackReload縮退
      try {
        await swFn(true)
      } catch {
        fallbackReload()
      }
    }
  }

  const controller = typeof AbortController === 'function' ? new AbortController() : null
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null

  try {
    const url = `/version.json?t=${typeof now === 'function' ? now() : Date.now()}`
    const res = await f(url, { cache: 'no-store', signal: controller?.signal })
    if (!res?.ok) {
      logFail(new Error(`HTTP ${res?.status ?? '??'}`))
      return { reloaded: false, reason: 'http-error' }
    }
    const data = await res.json()
    const serverSha = data?.sha
    if (!serverSha) return { reloaded: false, reason: 'no-sha' }
    if (serverSha === BUILD_SHA) {
      // SPEC-PWA-SW-UPDATEWIRE-GUARD-CLEAR-01: 一致(新bundle起動成功)でguardをクリア(永久残留解消)
      storage?.removeItem(STORAGE_KEY)
      return { reloaded: false, reason: 'match' }
    }
    // 不一致 → SHA単位guard確認(同SHAへの重複reload防止)
    const currentGuard = storage?.getItem(STORAGE_KEY)
    if (currentGuard === serverSha) {
      return { reloaded: false, reason: 'already-reloaded' }
    }
    storage?.setItem(STORAGE_KEY, serverSha)
    await doReload()
    return { reloaded: true, reason: 'mismatch' }
  } catch (err) {
    logFail(err)
    return { reloaded: false, reason: 'fetch-fail' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
