// デバイス判定。カスタムテンキー(bottom sheet)を出すのは iPhone のみ。
// iPhone以外 (iPad / PC) は native input に任せる:
//   - iPad … OSがシステム数字キーボードを自動表示
//   - PC  … 物理キーボード前提、画面キーボードは出ない
// iPadOS13+ は UA上 Mac を名乗るため iPad は明示判定せず「iPhone か否か」だけで分岐すれば
// iPad/PC の区別は native input の挙動として OS 任せにできる。
export function isIPhone() {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPod/i.test(navigator.userAgent || '')
}

// J-COLLECTION-12 派生 ad-hoc (Hiro Discord 2026-05-29 03:08):
//   「キーボードデカすぎたw一回標準キーボード試したい」
//   → カスタムテンキー(bottom sheet)を一時的に無効化し、iPhone でも native input (OS 標準数字キー) を使う。
//   E2E では旧 UX 回帰防止のため、test 側で `window.__USE_CUSTOM_NUMPAD__ = true` を addInitScript すれば
//   従来の custom numpad 経路に切替可能 (production runtime では window フラグ未設定 → false)。
//   トライアル結果に応じて本関数を `return isIPhone()` に 1 行差し戻すだけで元に戻せる。
export function isCustomNumpadEnabled() {
  if (typeof window !== 'undefined' && typeof window.__USE_CUSTOM_NUMPAD__ !== 'undefined') {
    return !!window.__USE_CUSTOM_NUMPAD__
  }
  return false // trial: iPhone も native OS キーボード
}
