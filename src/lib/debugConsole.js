// SPEC-DEBUG-ERUDA-INSCREEN-CONSOLE-01 (D-072): モバイル画面内 console (eruda) を gate 付き動的 import。
// static import 禁止 (本番 bundle 非汚染)。gate 真の時のみ code-split された eruda chunk をロードする。
// 用途: ヒロ実機 iPhone 単体で console を採取 (Web Inspector 接続不要)。DIAG-NUMPAD [nplog] の採取基盤。

// gate 有効化条件: URL ?debug=1 OR window.__DEBUG__===true OR localStorage np_debug=1。
// ?debug=0 は明示 OFF (localStorage の永続フラグより優先)。
export function isDebugConsoleEnabled() {
  if (typeof window === 'undefined') return false
  try {
    const q = new URLSearchParams(window.location.search).get('debug')
    if (q === '1') return true
    if (q === '0') return false // 明示 OFF が最優先
    if (window.__DEBUG__ === true) return true
    return localStorage.getItem('np_debug') === '1'
  } catch {
    return false
  }
}

// ?debug=1 を踏んだら localStorage に永続化 (PWA 再起動後も持続、毎回 URL を付けなくて済む)。
// ?debug=0 で永続フラグを解除。
function syncPersist() {
  try {
    const q = new URLSearchParams(window.location.search).get('debug')
    if (q === '1') localStorage.setItem('np_debug', '1')
    else if (q === '0') localStorage.removeItem('np_debug')
  } catch {
    /* localStorage 不可環境は無視 */
  }
}

let initialized = false

// gate 真の時のみ eruda を dynamic import して init。多重初期化を防止。
// eruda 起動に合わせ window.__NUMPAD_LOG__=true も自動セット (?debug=1 一発で eruda + [nplog] 両方有効)。
export async function maybeInitDebugConsole() {
  if (typeof window === 'undefined') return false
  syncPersist()
  if (!isDebugConsoleEnabled()) return false
  if (initialized) return true
  initialized = true
  // numpad 計測 (DIAG-NUMPAD-SLOT-TRANSITION-FIRE-01) も自動 ON
  window.__NUMPAD_LOG__ = true
  try {
    const eruda = (await import('eruda')).default
    eruda.init()
    return true
  } catch (e) {
    // eruda ロード失敗は本体機能に影響させない (計測フラグは立てたまま native console に出す)
    console.warn('[debug] eruda init failed', e)
    return false
  }
}

// テスト用: 初期化フラグをリセット
export function __resetDebugConsoleForTest() {
  initialized = false
}
