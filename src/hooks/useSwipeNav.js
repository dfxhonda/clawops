// SPEC-PATROL-SWIPE-NAV-01: 横スワイプで前/次ブースへ遷移するための touch ハンドラ。
// 外部ライブラリ不使用、touchstart/touchmove/touchend をネイティブで処理する。
//
// 動作原則 (C1):
// - 閾値: 40px 横方向 + 速度 0.3px/ms 以上
// - 軸ロック: 横方向意図 (|dx| > |dy| * 1.5) を確定したら、その touch シーケンスは
//   touchmove で e.preventDefault() を呼んで縦スクロールを抑止する。
// - 縦方向意図が確定したら横スワイプは発火しない (= 通常スクロール継続)。
// - 軸未確定 (両方 < 10px) 段階では preventDefault しない (タップ判定温存)。
// - 単一指のみ受け付け (multi-touch / pinch は無視)。
import { useEffect, useRef } from 'react'

export const SWIPE_THRESHOLD_PX = 40
export const SWIPE_MIN_VELOCITY = 0.3  // px / ms
export const SWIPE_AXIS_LOCK_RATIO = 1.5
const NOISE_PX = 10  // この範囲内は軸未確定

/**
 * 純粋関数: dx / dy / dt から swipe 種別を判定。
 * Returns 'left' | 'right' | null (条件未達)。
 * テスト用に export、touch event なしで logic 検証可能にする。
 */
export function classifySwipe(args) {
  const {
    dx, dy, dt,
    thresholdPx = SWIPE_THRESHOLD_PX,
    minVelocity = SWIPE_MIN_VELOCITY,
    axisLockRatio = SWIPE_AXIS_LOCK_RATIO,
  } = args
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  // 軸ロック判定: 横が縦の axisLockRatio 倍以上で横ロック確定
  if (absDx < absDy * axisLockRatio) return null
  if (absDx < thresholdPx) return null
  const velocity = absDx / Math.max(1, dt)
  if (velocity < minVelocity) return null
  return dx < 0 ? 'left' : 'right'
}

/**
 * 軸判定 (touchmove 中の preventDefault 用)。
 * 'horizontal' | 'vertical' | null (未確定)。
 */
export function detectAxis(dx, dy, axisLockRatio = SWIPE_AXIS_LOCK_RATIO) {
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)
  if (absDx < NOISE_PX && absDy < NOISE_PX) return null
  if (absDx > absDy * axisLockRatio) return 'horizontal'
  if (absDy > absDx * axisLockRatio) return 'vertical'
  return null
}

/**
 * @param {Object} args
 * @param {() => void} [args.onSwipeLeft]
 * @param {() => void} [args.onSwipeRight]
 * @param {boolean} [args.enabled=true]
 * @returns {React.RefObject} 対象要素に attach する ref
 */
export function useSwipeNav({ onSwipeLeft, onSwipeRight, enabled = true } = {}) {
  const ref = useRef(null)
  // 最新の callback を ref で保持 (再 attach 不要にして touchmove passive 切替コストを避ける)
  const cbRef = useRef({ onSwipeLeft, onSwipeRight })
  cbRef.current = { onSwipeLeft, onSwipeRight }

  useEffect(() => {
    if (!enabled) return undefined
    const el = ref.current
    if (!el) return undefined

    const state = {
      startX: 0, startY: 0, startTime: 0,
      axis: null,  // 'horizontal' | 'vertical' | null
      active: false,
    }

    function onTouchStart(e) {
      if (e.touches.length !== 1) { state.active = false; return }
      const t = e.touches[0]
      state.startX = t.clientX
      state.startY = t.clientY
      state.startTime = Date.now()
      state.axis = null
      state.active = true
    }

    function onTouchMove(e) {
      if (!state.active) return
      if (e.touches.length !== 1) { state.active = false; return }
      const t = e.touches[0]
      const dx = t.clientX - state.startX
      const dy = t.clientY - state.startY
      if (state.axis == null) {
        state.axis = detectAxis(dx, dy)
      }
      if (state.axis === 'horizontal' && e.cancelable) {
        // 横スワイプ確定: スクロールを抑止 (AC-05 scroll separation)
        e.preventDefault()
      }
    }

    function onTouchEnd(e) {
      if (!state.active) return
      state.active = false
      if (state.axis !== 'horizontal') return
      const t = e.changedTouches?.[0]
      if (!t) return
      const dx = t.clientX - state.startX
      const dy = t.clientY - state.startY
      const dt = Math.max(1, Date.now() - state.startTime)
      const kind = classifySwipe({ dx, dy, dt })
      if (kind === 'left') cbRef.current.onSwipeLeft?.()
      else if (kind === 'right') cbRef.current.onSwipeRight?.()
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    // touchmove は preventDefault するため passive: false 必須
    el.addEventListener('touchmove',  onTouchMove,  { passive: false })
    el.addEventListener('touchend',   onTouchEnd,   { passive: true })
    el.addEventListener('touchcancel', onTouchEnd,  { passive: true })

    return () => {
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove',  onTouchMove)
      el.removeEventListener('touchend',   onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [enabled])

  return ref
}
