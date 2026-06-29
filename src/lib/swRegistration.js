// SPEC-PWA-SW-UPDATE-REBUILD-01: prompt策略。autoUpdate強制reload廃止。
// updateSW(true) は loginVersionCheck.js checkAndReloadIfStale から発火するのみ。
// それ以外の自動reload経路(triggerUpdate/setupPeriodicUpdate/skipWaiting強制)は全廃。
import { registerSW } from 'virtual:pwa-register'

export const updateSW = registerSW({
  immediate: true,
  onRegisteredSW() {
    // updateSW(true) は src/services/loginVersionCheck.js checkAndReloadIfStale から発火。
  },
})
