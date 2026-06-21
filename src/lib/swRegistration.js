// SPEC-PWA-LOGIN-SW-UPDATE-01 / SPEC-PWA-SW-UPDATEWIRE-GUARD-CLEAR-01
// main.jsxからの循環依存を避けてLogin.jsx等が参照できるよう分離
// SPEC-PWA-SW-PERIODIC-UPDATE-01: onRegisteredSW定期update + cleanupOutdatedCaches
import { registerSW } from 'virtual:pwa-register'

const INTERVAL_MS = 30 * 60 * 1000 // 30分

/**
 * SPEC-PWA-SW-PERIODIC-UPDATE-01
 * SW定期更新スケジューラ。swUrl を 30分ごとに no-store fetch し、200なら r.update()。
 * installing中・オフライン時はskip。ページ強制reloadしない(フォームデータ保護)。
 * @param {string} swUrl
 * @param {ServiceWorkerRegistration} r
 * @param {{ intervalMs?: number, startupDelayMs?: number }} [opts]
 * @returns {ReturnType<typeof setInterval>}
 */
export function setupPeriodicUpdate(swUrl, r, {
  intervalMs = INTERVAL_MS,
  startupDelayMs = 2000,
  fetchFn = (typeof fetch === 'function' ? fetch : null),
} = {}) {
  const check = async () => {
    if (r.installing) return
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    if (!fetchFn) return
    try {
      const res = await fetchFn(swUrl, { cache: 'no-store' })
      if (res?.ok) await r.update()
    } catch { /* silent: offline / network error */ }
  }
  // AC2: 起動直後に一度チェック
  setTimeout(check, startupDelayMs)
  // AC1: 30分間隔で定期チェック
  return setInterval(check, intervalMs)
}

export const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(swUrl, r) {
    setupPeriodicUpdate(swUrl, r)
  },
})
