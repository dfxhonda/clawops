// SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) F1: motion トークン 1箇所定義。
// prefers-reduced-motion: reduce 時は duration 0 相当 ('none') にフォールバック。
export const MOTION_DURATION_MS = 200
export const MOTION_EASING = 'ease-out'

/** OS の「視差効果を減らす」設定を尊重。SSR/非対応環境は false。 */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches === true
  )
}

/** inline style 用 transition 文字列。reduced-motion 時は 'none' (即時)。 */
export function motionTransition(prop = 'all', ms = MOTION_DURATION_MS, easing = MOTION_EASING) {
  return prefersReducedMotion() ? 'none' : `${prop} ${ms}ms ${easing}`
}
