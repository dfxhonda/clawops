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
