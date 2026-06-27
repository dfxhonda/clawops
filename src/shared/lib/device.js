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

// SPEC-OCR-MODAL-KEYBOARD-SHIFT-FIX-01: OSキーボードによる fixed モーダル上パン根絶のため
//   内蔵テンキー(NumpadFooterPanel)を復活。isCustomNumpadEnabled()=true で NumpadField が
//   <input readOnly inputMode="none"> になり、iOS仮想キーボードが出なくなる。
//   zone_bottom 高さは confirming 側で currentField 連動に変更済(未選択時 h-0 = 必要時のみ展開)。
//   window.__USE_CUSTOM_NUMPAD__ override は将来のトライアル切替用に維持。
export function isCustomNumpadEnabled() {
  if (typeof window !== 'undefined' && typeof window.__USE_CUSTOM_NUMPAD__ !== 'undefined') {
    return !!window.__USE_CUSTOM_NUMPAD__
  }
  return true
}
