// SPEC-PATROL-SWIPE-ANIM-01 C2: ブース間 navigate を跨いで「次の画面はどちら側から入ってくるか」
// を渡すための module-level state。Router state / sessionStorage を避け、即時 in-memory で
// 1 回限りの consume。次画面の useLayoutEffect で読み取り、translateX(±100%) で初期描画 →
// 次フレームで translateX(0) へ CSS transition、enter アニメを成立させる。
//
// Race condition は許容: navigate → mount は同 task tick で連鎖、別 tab/iframe からの
// 干渉は想定しない。

let pendingEnterFrom = null  // 'left' | 'right' | null

/**
 * 次にマウントされるブース画面の入場方向を予約する。
 * - 'right': 左スワイプで遷移 → 次画面が右側から入る
 * - 'left':  右スワイプで遷移 → 前画面が左側から入る
 */
export function setPendingEnterFrom(dir) {
  pendingEnterFrom = dir
}

/**
 * 1 回限り読み取って null クリア。次画面の mount で 1 度だけ呼ぶ。
 */
export function consumePendingEnterFrom() {
  const v = pendingEnterFrom
  pendingEnterFrom = null
  return v
}

// テスト/リセット用 (vitest beforeEach 等)
export function _resetSwipeTransition() {
  pendingEnterFrom = null
}
