// SPEC-PWA-LOGIN-VERSIONJSON-RELOAD-02 (D-062): ログイン画面マウント時に deploy 世代を決定的に検知し、
// 単発 reload で新 bundle へ揃える保険層。workbox-window の activated イベント配送に依存しない。
// /login 限定で呼ぶため、現場入力中の reload 事故は構造的に不可能 (DOUBLE-LOGOUT-01 教訓)。
//
// SPEC-PWA-SW-UPDATE-FIX-A-01 (D-109): 位置づけを「主経路 → 保険」に降格 (ロジックは無変更)。
//   更新適用の主経路は D-109 の prompt バナー (onNeedRefresh→バナー→タップ→updateSW(true))。
//   本層は iOS が PWA を kill してバナーを取り逃した場合の /login catch-up 保険として残す。
//   D-108実測で判明した「層1(本層) と 層3(workbox skipWaiting) の login 画面での競合」は、層3 撤去により解消。
//   競合相手が消えたため本層は単独で綺麗に効く (同一 sha 1回ガード + controllerchange 待ちで入力中 reload 不能は不変)。
//
// 純関数 + 副作用は依存注入で分離しテスト可能に。production 呼び出しはデフォルト引数を使う。
import { BUILD_SHA } from './buildInfo'

const GUARD_PREFIX = 'pwa-vreload:'
const CONTROLLERCHANGE_TIMEOUT_MS = 4000

function defaultGetRegistration() {
  if (typeof navigator === 'undefined' || !navigator.serviceWorker) return Promise.resolve(null)
  return navigator.serviceWorker.getRegistration()
}

// step4 の controllerchange レース: SW が新世代に切り替わるのを最大 timeoutMs 待つ。
// addEventListener(once) と timeout のどちらでも先に進む。テストでは差し替え可能。
// SPEC-PWA-SW-AUTOUPDATE-KILL-RELOAD-LOOP-01 (D-095): main.jsx の preloadError ガードから再利用するため export
// (checkVersionAndReload のガードロジックは無変更)。
export function defaultWaitForController(timeoutMs) {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) { resolve(); return }
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      navigator.serviceWorker.removeEventListener('controllerchange', finish)
      resolve()
    }
    navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true })
    setTimeout(finish, timeoutMs)
  })
}

/**
 * @returns {'match'|'reloaded'|'guarded'|'error'} テスト検証用
 */
export async function checkVersionAndReload({
  fetchImpl = (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : undefined),
  storage = (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined),
  reload = () => { if (typeof location !== 'undefined') location.reload() },
  getRegistration = defaultGetRegistration,
  currentSha = BUILD_SHA,
  waitForController = defaultWaitForController,
} = {}) {
  if (!fetchImpl || !storage) return 'error'

  let sha
  try {
    // version.json は precache 非対象 + no-store で常に最新世代を取得
    const res = await fetchImpl('/version.json', { cache: 'no-store' })
    const data = await res.json()
    sha = data?.sha
    if (!sha) throw new Error('no sha field')
  } catch (e) {
    // offline 正常系: silent no-op (ERR-PWA-VER-001)
    if (typeof console !== 'undefined') console.warn('ERR-PWA-VER-001 version.json fetch/parse failed:', e?.message)
    return 'error'
  }

  const guardKey = GUARD_PREFIX + sha

  // 一致 = 最新世代。ガードキーを掃除して no-op。
  if (sha === currentSha) {
    storage.removeItem(guardKey)
    return 'match'
  }

  // 同一 sha への reload は寿命 1 回 (ループ物理的不能)。
  if (storage.getItem(guardKey)) return 'guarded'
  storage.setItem(guardKey, '1')

  try {
    const reg = await getRegistration()
    await reg?.update?.()
  } catch { /* silent: update 失敗でも reload は進める */ }

  await waitForController(CONTROLLERCHANGE_TIMEOUT_MS)
  reload()
  return 'reloaded'
}
