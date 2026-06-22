// SPEC-PWA-LOGIN-SW-UPDATE-01 / SPEC-PWA-SW-UPDATEWIRE-GUARD-CLEAR-01
// main.jsxからの循環依存を避けてLogin.jsx等が参照できるよう分離
// SPEC-PWA-SW-PERIODIC-UPDATE-01: onRegisteredSW定期update + cleanupOutdatedCaches
// SPEC-PWA-SW-ACTIVE-UPDATE-S2-01: triggerUpdate export + visibilitychange
import { registerSW } from 'virtual:pwa-register'

const INTERVAL_MS = 30 * 60 * 1000 // 30分
const TRIGGER_COOLDOWN_MS = 5 * 1000 // 5秒: 連続発火抑制 (visibilitychange guard)

let _r = null
let _swUrl = null
let _lastTriggerTs = 0

/**
 * SPEC-PWA-SW-ACTIVE-UPDATE-S2-01
 * SW更新チェックを能動発火。installing中/offline時はskip。
 * reloadは register.js activatedイベントに委譲(二重reload防止)。
 * 5秒以内の連続呼出はno-op。
 */
export async function triggerUpdate() {
  const now = Date.now()
  if (now - _lastTriggerTs < TRIGGER_COOLDOWN_MS) return
  _lastTriggerTs = now
  if (!_r || !_swUrl) return
  if (_r.installing) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) return
  try {
    const res = await fetch(_swUrl, { cache: 'no-store' })
    if (res?.ok) await _r.update()
  } catch { /* silent: offline / network error */ }
}

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
    _r = r
    _swUrl = swUrl
    setupPeriodicUpdate(swUrl, r)
  },
})

// SPEC-PWA-SW-ACTIVE-UPDATE-S2-01 R2: visibilitychange → triggerUpdate
// PWAをフォアグラウンドに戻した瞬間にSW更新チェックを能動発火
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      triggerUpdate()
    }
  })
}
