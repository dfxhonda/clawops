// SPEC-PWA-LOGIN-SW-UPDATE-01: version不一致時にupdateSW(true)でSW世代交代+reload。fallback=location.reload()
// SPEC-PWA-LOGIN-VERSION-RELOAD-01:
// ログイン成功 (verify-pin 通過) または session 復元成功時に /version.json を no-store fetch、
// サーバー側 buildNumber とクライアント BUILD_NUMBER が異なれば session 中 1 回だけ
// location.reload() で最新 bundle に揃える。
//
// loop guard: sessionStorage 'version_reload_done' = '1' (boolean、build 非依存)。
// 1 度立てば次回ログインまで効かない (ブラウザタブ閉じれば sessionStorage はクリアされ再評価可)。
// SPEC-PWA-VERSION-CHECK-FIX-01 の useVersionCheck (timestamp 5min 抑制) とは独立 storage key で
// 共存、両者が互いを抑制しないよう完全分離する。
//
// version.json は vite.config.js の version-json plugin で build 時に dist/ へ書き出され、
// 本番では /version.json で配信される (Vercel 既存配信)。"buildNumber" key を持つ
// JSON で SPEC-PWA-VERSION-CHECK-FIX-01 と同形式 (互換維持)。
//
// 失敗 (network / HTTP error / timeout / JSON 不正) は LOG-SPEC-01 準拠の console.warn のみで、
// reload せず login 処理を続行 (AC-03)。dev (BUILD_NUMBER='0' / 'local') では check 自体 skip。

import { BUILD_NUMBER } from '../lib/buildInfo'

const STORAGE_KEY = 'version_reload_done'
const FETCH_TIMEOUT_MS = 3000
const LOG_TAG = 'ERR-PWA-LOGIN-VERSION'

function isDevMode() {
  return !BUILD_NUMBER || BUILD_NUMBER === '0' || BUILD_NUMBER === 'local'
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
 * /version.json を fetch して BUILD_NUMBER と比較し、不一致なら 1 回だけ reload。
 * 呼び出し側 (Login.jsx) は await して { reloaded: true } を受けたら以降の navigate を打ち切る。
 *
 * @param {object} [opts]
 * @param {function} [opts.fetch]      テスト時に差し替え可能な fetch (default: global)
 * @param {function} [opts.reload]     テスト時に差し替え可能な reload (default: window.location.reload)
 * @param {function} [opts.updateSW]   vite-plugin-pwa の updateSW(true) (default: main.jsx export)
 * @param {function} [opts.getStorage] テスト時に差し替え可能な storage 取得 (default: sessionStorage)
 * @param {number}   [opts.timeoutMs]  fetch timeout (default: 3000ms)
 * @param {function} [opts.now]        テスト時に差し替え可能な now (default: Date.now)
 * @returns {Promise<{reloaded: boolean, reason: string}>}
 */
export async function checkAndReloadIfStale({
  fetch: fetchFn,
  reload,
  updateSW,
  getStorage,
  timeoutMs = FETCH_TIMEOUT_MS,
  now = Date.now,
} = {}) {
  if (isDevMode()) return { reloaded: false, reason: 'dev' }

  const storage = (getStorage ?? defaultStorage)()
  // loop guard 最優先 (帯域 + Vercel hit 節約のため fetch も発火させない)
  if (storage?.getItem(STORAGE_KEY)) {
    return { reloaded: false, reason: 'already-reloaded' }
  }

  const f = fetchFn ?? (typeof fetch === 'function' ? fetch : null)
  if (!f) return { reloaded: false, reason: 'no-fetch' }

  const fallbackReload = reload ?? (() => { window.location.reload() })
  // updateSW(true): SW update -> skipWaiting -> reload (公式 vite-plugin-pwa 仕様)
  // 未提供 or 失敗時は fallbackReload に降格
  async function doReload() {
    const swFn = updateSW ?? (() => Promise.reject(new Error('no updateSW')))
    try {
      await swFn(true)
    } catch {
      fallbackReload()
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
    const serverBuild = String(data?.buildNumber ?? '')
    if (!serverBuild) return { reloaded: false, reason: 'no-build' }
    if (serverBuild === String(BUILD_NUMBER)) {
      return { reloaded: false, reason: 'match' }
    }
    // 不一致 → guard 立て → SW世代交代+reload (loop は STORAGE_KEY で物理防止)
    storage?.setItem(STORAGE_KEY, '1')
    await doReload()
    return { reloaded: true, reason: 'mismatch' }
  } catch (err) {
    logFail(err)
    return { reloaded: false, reason: 'fetch-fail' }
  } finally {
    if (timer) clearTimeout(timer)
  }
}
