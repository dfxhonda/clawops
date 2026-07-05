// SPEC-PWA-SW-STRIP-PHASE1-01: savepoint。カスタムSW更新層全廃。phase2でautoUpdate化予定。
// SPEC-SW-UPDATE-TRIGGER-01: iOSはPWAプロセスを任意タイミングでkillするため、SW更新の"発見"を
// フルページロードのみに依存させない。visibilitychange復帰時 + 15分間隔でregistration.update()を
// 呼び、直近60秒以内のチェックは両トリガー共有でスキップ。offline等のupdate()失敗はsilent
// (console.warnのみ、UIバナーなし)。autoUpdate適用戦略(skipWaiting/clientsClaim)自体は無変更。
import { registerSW } from 'virtual:pwa-register'

export const UPDATE_INTERVAL_MS = 15 * 60 * 1000
export const MIN_CHECK_GAP_MS = 60 * 1000

// テスト用 export: guardロジックを純粋に検証可能にするためファクトリ化
export function createUpdateChecker(registration, now = () => Date.now()) {
  let lastCheckAt = -Infinity // "未チェック"の番兵。0だと小さいタイムスタンプ基準の環境で誤判定しうる
  return function checkForUpdate() {
    const t = now()
    if (t - lastCheckAt < MIN_CHECK_GAP_MS) return false
    lastCheckAt = t
    registration.update().catch(() => {
      // オフライン等でのupdate()失敗は正常系。UIバナーなし、console.errorも出さない。
      console.warn('[ERR-SW-UPDATE-001] SW update check failed (offline?)')
    })
    return true
  }
}

// 戻り値のcleanupはproduction側では未使用(アプリ生存期間中ずっと有効)、テストでの
// リスナー/タイマー後片付け用。
export function setupPeriodicUpdateCheck(registration) {
  if (!registration) return () => {}
  const checkForUpdate = createUpdateChecker(registration)
  const intervalId = setInterval(checkForUpdate, UPDATE_INTERVAL_MS)
  const onVisibilityChange = () => {
    if (document.visibilityState === 'visible') checkForUpdate()
  }
  document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    clearInterval(intervalId)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

export const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    setupPeriodicUpdateCheck(registration)
  },
})
