// SPEC-PWA-SW-UPDATE-REBUILD-01: prompt策略。autoUpdate強制reload廃止。
// SPEC-PWA-SW-GENERATION-SWAP-FIX-01: r.update()で新SW検知->waiting乗せ。
// updateSW(true) は loginVersionCheck.js checkAndReloadIfStale から発火するのみ。
// それ以外の自動reload経路(triggerUpdate/setupPeriodicUpdate/skipWaiting強制)は全廃。
import { registerSW } from 'virtual:pwa-register'

export const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(swUrl, r) {
    // r.update()で新SWを検知しwaitingに乗せる(公式issue#601/#896パターン)。
    // waiting->active遷移はloginVersionCheck.checkAndReloadIfStaleのupdateSW(true)が担う。
    // DIAG-PWA-SW-OTA-REGRESSION-01 Q5: registration state at onRegisteredSW
    // eslint-disable-next-line no-console
    console.warn(`[DIAG-OTA-Q5] onRegisteredSW: r=${!!r} installing=${!!r?.installing} waiting=${!!r?.waiting} active=${!!r?.active}`)
    if (r) {
      Promise.resolve(r.update()).then(() => {
        // eslint-disable-next-line no-console
        console.warn(`[DIAG-OTA-Q5] r.update() resolved: installing=${!!r.installing} waiting=${!!r.waiting}`)
      }).catch(e => {
        // eslint-disable-next-line no-console
        console.warn(`[DIAG-OTA-Q5] r.update() rejected: ${e?.message}`)
      })
    }
  },
})
