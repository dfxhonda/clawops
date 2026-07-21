// SPEC-PWA-SW-STRIP-PHASE1-01: savepoint。カスタムSW更新層全廃。phase2でautoUpdate化予定。
// SPEC-SW-UPDATE-TRIGGER-01: iOSはPWAプロセスを任意タイミングでkillするため、SW更新の"発見"を
// フルページロードのみに依存させない。visibilitychange復帰時 + 15分間隔でregistration.update()を
// 呼び、直近60秒以内のチェックは両トリガー共有でスキップ。offline等のupdate()失敗はsilent
// (console.warnのみ、UIバナーなし)。
// SPEC-PWA-SW-UPDATE-FIX-A-01 (D-109): registerType='prompt' を正しく完成。skipWaiting/clientsClaim(層3)を撤去し
// (vite.config)、onNeedRefresh で「更新ありフラグ→控えめバナー→タップで updateSW(true)」の prompt 本道を実装。
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

// SPEC-PWA-SW-UPDATE-FIX-A-01 (D-109): 「更新ありフラグ」の購読可能ストア。
// 新SW waiting検知 (onNeedRefresh) でフラグを立て、控えめトースト常駐バナー (SwUpdateBanner) に伝える。
// 自動 reload は絶対にしない。適用はスタッフが安全なタイミングで明示タップした時のみ (applyUpdate=updateSW(true))。
let _needRefresh = false
const _listeners = new Set()
function _emitNeedRefresh() {
  for (const cb of _listeners) cb(_needRefresh)
}

// 現在値で即コールバック + 変化時に通知。unsubscribe を返す。
export function subscribeNeedRefresh(cb) {
  _listeners.add(cb)
  cb(_needRefresh)
  return () => _listeners.delete(cb)
}

export function getNeedRefresh() {
  return _needRefresh
}

function markNeedRefresh() {
  _needRefresh = true
  _emitNeedRefresh()
}

export const updateSW = registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    setupPeriodicUpdateCheck(registration)
  },
  // SPEC-PWA-SW-UPDATE-FIX-A-01 (D-109): 筋A。新SW waiting検知で「更新ありフラグ」を立てバナー表示するのみ。
  // 自動 reload / updateSW(true) の自動呼び出しは絶対にしない (autoUpdate相当の暴発=穴1 再現になる)。
  // 適用はユーザーがバナーを明示タップした時だけ (applyUpdate)。updateSW(true) が controllerchange待ち→reload を内蔵。
  onNeedRefresh() {
    markNeedRefresh()
  },
})

// バナータップ時に1回だけ呼ぶ更新適用。updateSW(true) = skipWaiting相当 + controllerchange待ち + reload を内蔵。
// 自前の多段 reload 待ちは不要 (層1 versionReload は保険として残置、競合相手の層3 skipWaiting が消えたので単独で綺麗に効く)。
export function applyUpdate() {
  return updateSW(true)
}
