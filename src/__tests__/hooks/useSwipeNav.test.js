// SPEC-PATROL-SWIPE-NAV-01: useSwipeNav の判定ロジック単体検証 (純粋関数 + 軸判定)。
// touch event 統合テストは Playwright gate_4 で確認 (AC-07)、ここでは classification のみ。
import { describe, it, expect } from 'vitest'
import { classifySwipe, detectAxis, SWIPE_THRESHOLD_PX } from '../../hooks/useSwipeNav'

describe('classifySwipe (SPEC-PATROL-SWIPE-NAV-01)', () => {
  it('returns_left_when_dx_negative_threshold_met_velocity_ok', () => {
    expect(classifySwipe({ dx: -80, dy: 5, dt: 200 })).toBe('left')
  })

  it('returns_right_when_dx_positive_threshold_met_velocity_ok', () => {
    expect(classifySwipe({ dx: 60, dy: 5, dt: 150 })).toBe('right')
  })

  it('returns_null_when_below_threshold_40px', () => {
    expect(classifySwipe({ dx: -30, dy: 2, dt: 100 })).toBe(null)
    expect(classifySwipe({ dx: SWIPE_THRESHOLD_PX - 1, dy: 0, dt: 100 })).toBe(null)
  })

  it('returns_null_when_velocity_below_0_3_px_per_ms', () => {
    // 50px / 200ms = 0.25 < 0.3
    expect(classifySwipe({ dx: 50, dy: 5, dt: 200 })).toBe(null)
  })

  it('returns_null_when_dominant_vertical_motion', () => {
    // dy/dx 比が 1.5 倍超 (縦優位) → 横スワイプとして無効
    expect(classifySwipe({ dx: 50, dy: 100, dt: 100 })).toBe(null)
  })

  it('returns_left_at_exact_threshold_with_fast_velocity', () => {
    expect(classifySwipe({ dx: -40, dy: 0, dt: 50 })).toBe('left')
  })
})

describe('detectAxis (touchmove 中の preventDefault 判定)', () => {
  it('returns_null_when_motion_below_noise_floor', () => {
    expect(detectAxis(5, 5)).toBe(null)
    expect(detectAxis(0, 0)).toBe(null)
  })

  it('returns_horizontal_when_dx_dominant', () => {
    expect(detectAxis(30, 5)).toBe('horizontal')
    expect(detectAxis(-30, 5)).toBe('horizontal')
  })

  it('returns_vertical_when_dy_dominant', () => {
    expect(detectAxis(5, 30)).toBe('vertical')
    expect(detectAxis(5, -30)).toBe('vertical')
  })

  it('returns_null_when_diagonal_no_clear_dominance', () => {
    // dx と dy がほぼ同等 → 軸未確定
    expect(detectAxis(30, 25)).toBe(null)
  })
})
