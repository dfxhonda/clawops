// SPEC-IDLE-LOGOUT-SENTRY-AUTODETECT-01
// doLogout() の await 中に version-reload / SW-controllerchange が割り込んだかを Sentry で自動検知。
// 副作用ゼロ (タイマー/イベント/ロジック変更なし)。dev/test では Sentry 未 init → try/catch で no-op。
import { Sentry } from './sentry'

let logoutInFlight = false
let startTs = 0

export function markLogoutStart() {
  logoutInFlight = true
  startTs = Date.now()
  try { Sentry.addBreadcrumb({ category: 'idle-logout', message: 'logout-start', level: 'info' }) } catch {}
}

export function markLogoutReplaced() {
  logoutInFlight = false
  try { Sentry.addBreadcrumb({ category: 'idle-logout', message: 'logout-replaced', level: 'info' }) } catch {}
}

export function reportInterrupt(source) {
  if (!logoutInFlight) return
  const elapsed = Date.now() - startTs
  logoutInFlight = false  // 多重 capture 防止 (try/catch 外で先に false 化)
  try {
    Sentry.captureMessage(`IDLE-LOGOUT-ABORTED-BY-${source}`, {
      level: 'error',
      tags: { interrupt_source: source, elapsed_ms_since_logout_start: String(elapsed) },
    })
  } catch {}
}
