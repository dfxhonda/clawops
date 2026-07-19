// SPEC-PWA-SW-AUTOUPDATE-KILL-RELOAD-LOOP-01 (D-095, P0): vite:preloadError の reload ガード。
// 生 window.location.reload() (穴2: iOS PWA の sessionStorage 揮発で 1回フラグをすり抜け、controllerchange 未待機で
// 即reload=ループ増幅) を、versionReload.js と同水準の堅牢ガードに置換する:
//   - リトライ上限 (最終防波堤。sessionStorage 揮発しても cap で暴走を止める、Vite標準解)
//   - reload 前に controllerchange を待つ (versionReload の waitForController を再利用)
//   - 上限到達時は reload せず console.warn のみ (黒画面のまま無限reload より、静止して手動再訪を促す方が安全)
// 純関数 + 依存注入でテスト可能。

export const PRELOAD_RELOAD_CAP = 3
export const PRELOAD_RELOAD_KEY = 'vite-preload-reload-count'
const CONTROLLERCHANGE_TIMEOUT_MS = 4000

export async function handlePreloadError({
  storage = (typeof sessionStorage !== 'undefined' ? sessionStorage : undefined),
  waitForController,
  reload = () => { if (typeof location !== 'undefined') location.reload() },
  warn = (...a) => { if (typeof console !== 'undefined') console.warn(...a) },
  max = PRELOAD_RELOAD_CAP,
  timeoutMs = CONTROLLERCHANGE_TIMEOUT_MS,
} = {}) {
  let count = 0
  try { count = parseInt(storage?.getItem(PRELOAD_RELOAD_KEY) ?? '0', 10) || 0 } catch { count = 0 }

  // リトライ上限到達: reload しない (無限reload 防止の最終防波堤)。
  if (count >= max) {
    warn(`[vite:preloadError] reload cap (${max}) reached, not reloading (count=${count})`)
    return 'capped'
  }

  try { storage?.setItem(PRELOAD_RELOAD_KEY, String(count + 1)) } catch { /* 揮発は cap が担保 */ }

  // controllerchange を待ってから reload (新 SW が制御を取るのを待つ)。
  if (typeof waitForController === 'function') {
    try { await waitForController(timeoutMs) } catch { /* 待機失敗でも reload は進める */ }
  }

  reload()
  return 'reloaded'
}
