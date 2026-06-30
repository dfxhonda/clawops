// @vitest-environment happy-dom
// DIAG-NUMPAD-VIEWPORT-LIVE-MEASURE-01: ViewportMeasureOverlay unit tests
// AC5: 本体レイアウトclass未変更は git diff で別途確認
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import ViewportMeasureOverlay from '../../admin/components/ViewportMeasureOverlay'

// rAFはuseEffect内で即時コールバックを呼ぶモックに差し替え
let rafCallbacks = []
vi.stubGlobal('requestAnimationFrame', vi.fn(cb => {
  rafCallbacks.push(cb)
  return rafCallbacks.length
}))
vi.stubGlobal('cancelAnimationFrame', vi.fn())

// visualViewport未実装環境向け
if (!window.visualViewport) {
  Object.defineProperty(window, 'visualViewport', {
    value: { height: 844, addEventListener: vi.fn(), removeEventListener: vi.fn() },
    writable: true,
  })
}

beforeEach(() => {
  rafCallbacks = []
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('ViewportMeasureOverlay', () => {
  it('when_rendered_in_DEV_should_show_overlay_testid', async () => {
    // import.meta.env.DEV=true in vitest → showGate=true
    render(<ViewportMeasureOverlay />)
    await waitFor(() => {
      expect(screen.getByTestId('viewport-measure-overlay')).toBeTruthy()
    })
  })

  it('when_overlay_shown_should_display_innerH_label', async () => {
    render(<ViewportMeasureOverlay />)
    await waitFor(() => {
      const overlay = screen.getByTestId('viewport-measure-overlay')
      expect(overlay.textContent).toContain('innerH')
    })
  })

  it('when_overlay_shown_should_display_all_9_measurement_labels', async () => {
    render(<ViewportMeasureOverlay />)
    await waitFor(() => {
      const overlay = screen.getByTestId('viewport-measure-overlay')
      const text = overlay.textContent
      expect(text).toContain('innerH')
      expect(text).toContain('vvH')
      expect(text).toContain('clientH')
      expect(text).toContain('100vh')
      expect(text).toContain('100svh')
      expect(text).toContain('100dvh')
      expect(text).toContain('root.h')
      expect(text).toContain('npm.btm')
    })
  })

  it('when_numpad_bottom_lte_innerHeight_should_show_checkmark', async () => {
    // happy-dom: getBoundingClientRect().bottom=0 < innerHeight → not overflow
    render(<ViewportMeasureOverlay />)
    await waitFor(() => {
      const overlay = screen.getByTestId('viewport-measure-overlay')
      // overflow = 0 - 844 = -844 → isOver=false → shows ✓
      expect(overlay.textContent).toContain('✓')
    })
  })

  it('when_overlay_has_fixed_position_should_be_pointer_events_none', async () => {
    render(<ViewportMeasureOverlay />)
    await waitFor(() => {
      const overlay = screen.getByTestId('viewport-measure-overlay')
      expect(overlay.style.position).toBe('fixed')
      expect(overlay.style.pointerEvents).toBe('none')
    })
  })

  it('when_overlay_has_high_zIndex_should_be_above_all_elements', async () => {
    render(<ViewportMeasureOverlay />)
    await waitFor(() => {
      const overlay = screen.getByTestId('viewport-measure-overlay')
      expect(Number(overlay.style.zIndex)).toBeGreaterThanOrEqual(9000)
    })
  })
})
