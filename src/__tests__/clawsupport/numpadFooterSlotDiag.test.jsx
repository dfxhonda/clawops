// @vitest-environment happy-dom
// DIAG-NUMPAD-SLOT-TRANSITION-FIRE-01 (D-071) AC2: __NUMPAD_LOG__ gate。
// gate 無効時は [nplog] を出さず transition listener も登録しない (本番影響 nil)。
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

// panel を stub 化し、Slot 外段 div (計測対象) の listener のみを観測する
// (実 NumpadFooterPanel は自身の transition listener を張るため、gate 判定の切り分けにはノイズになる)
vi.mock('../../clawsupport/components/NumpadField', () => ({
  default: () => null,
  NumpadFooterPanel: () => <div data-testid="numpad-footer" />,
}))

import NumpadFooterSlot from '../../clawsupport/components/NumpadFooterSlot'

const field = () => ({
  dataTabindex: 1, label: 'IN', testId: 'denom-input-x',
  valueRef: { current: '1' }, caretPosRef: { current: 1 }, freshRef: { current: false },
  inputRef: { current: { scrollIntoView: vi.fn() } },
  allowDecimal: false, max: 999999, onChange: vi.fn(), onClear: vi.fn(), onCaretChange: vi.fn(),
})

beforeEach(() => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete window.__NUMPAD_LOG__
})

describe('AC2: DIAG numpad log gate', () => {
  it('gate 無効 (flag未設定) → [nplog] を console.log しない', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    render(<NumpadFooterSlot currentField={field()} />)
    const nplog = spy.mock.calls.filter((c) => String(c[0]).includes('[nplog]'))
    expect(nplog.length).toBe(0)
  })

  it('gate 無効 → slot への transitionrun でも [nplog] を出さない (listener 未登録)', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { getByTestId } = render(<NumpadFooterSlot currentField={field()} />)
    getByTestId('numpad-slot').dispatchEvent(new Event('transitionrun'))
    const nplog = spy.mock.calls.filter((c) => String(c[0]).includes('[nplog]'))
    expect(nplog.length).toBe(0)
  })

  it('gate 有効 (window.__NUMPAD_LOG__=true) → mount [nplog] + 各 transition event で [nplog]', () => {
    window.__NUMPAD_LOG__ = true
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const { getByTestId } = render(<NumpadFooterSlot currentField={field()} />)
    // mount 時に computed transition/gridTemplateRows を 1 行採取
    expect(spy.mock.calls.some((c) => String(c[0]).includes('[nplog] mount'))).toBe(true)
    // 4 種 transition event を dispatch → それぞれ [nplog] <type> を出す (listener が張られている証明)
    const slot = getByTestId('numpad-slot')
    for (const t of ['transitionrun', 'transitionstart', 'transitionend', 'transitioncancel']) {
      slot.dispatchEvent(new Event(t))
      expect(spy.mock.calls.some((c) => String(c[0]).includes(`[nplog] ${t}`))).toBe(true)
    }
  })

  it('gate 無効 → unmount してもエラーなし (cleanup 早期 return)', () => {
    const { unmount } = render(<NumpadFooterSlot currentField={field()} />)
    expect(() => unmount()).not.toThrow()
  })
})
