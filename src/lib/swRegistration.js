// SPEC-PWA-LOGIN-SW-UPDATE-01 / SPEC-PWA-SW-UPDATEWIRE-GUARD-CLEAR-01
// main.jsxからの循環依存を避けてLogin.jsx等が参照できるよう分離
// SPEC-PWA-SW-ACTIVE-UPDATE-S2-01: triggerUpdate export
// SPEC-PWA-VERSION-CHECK-UPDATE-01: prompt系撤去 → autoUpdate化。
//   onNeedRefresh/pwa-need-refresh/30分periodic/visibilitychange→triggerUpdate 全撤去。
//   reload経路はuseVersionCheck(15分アイドル復帰)に一本化。
//   triggerUpdate/setupPeriodicUpdate定義は残置(未使用)。
import { registerSW } from 'virtual:pwa-register'

const INTERVAL_MS = 30 * 60 * 1000 // 30分 (setupPeriodicUpdate用、未使用)
const TRIGGER_COOLDOWN_MS = 5 * 1000 // 5秒: 連続発火抑制

let _r = null
let _swUrl = null
let _lastTriggerTs = 0

/**
 * SPEC-PWA-SW-ACTIVE-UPDATE-S2-01
 * SW更新チェックを能動発火。installing中/offline時はskip。
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
 * SPEC-PWA-SW-PERIODIC-UPDATE-01 (残置・未使用)
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
  setTimeout(check, startupDelayMs)
  return setInterval(check, intervalMs)
}

export const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(swUrl, r) {
    _r = r
    _swUrl = swUrl
    // setupPeriodicUpdate呼出撤去 (SPEC-PWA-VERSION-CHECK-UPDATE-01)
  },
})
