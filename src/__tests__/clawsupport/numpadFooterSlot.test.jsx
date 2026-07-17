// @vitest-environment happy-dom
// SPEC-MOTION-W1-COLLAPSE-AND-NUMPAD-01 (D-069) AC2: NumpadFooterSlot transition + scrollIntoView。
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'

vi.mock('../../shared/lib/device', () => ({ isCustomNumpadEnabled: () => true, isIPhone: () => true }))

import NumpadFooterSlot from '../../clawsupport/components/NumpadFooterSlot'

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

function stubReducedMotion(matches) {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
}

const field = (over = {}) => ({
  dataTabindex: 1, label: 'IN', testId: 'denom-input-x',
  valueRef: { current: '123' }, caretPosRef: { current: 3 }, freshRef: { current: false },
  inputRef: { current: { scrollIntoView: vi.fn() } },
  allowDecimal: false, max: 999999, onChange: vi.fn(), onClear: vi.fn(), onCaretChange: vi.fn(),
  ...over,
})

describe('AC2: NumpadFooterSlot', () => {
  it('currentField あり → grid-template-rows 1fr + panel 描画', () => {
    stubReducedMotion(false)
    const { getByTestId } = render(<NumpadFooterSlot currentField={field()} />)
    expect(getByTestId('numpad-slot').style.gridTemplateRows).toBe('1fr')
    expect(getByTestId('numpad-footer')).toBeTruthy() // canonical panel が中に居る
  })

  it('currentField null → grid-template-rows 0fr (閉)', () => {
    stubReducedMotion(false)
    const { getByTestId } = render(<NumpadFooterSlot currentField={null} />)
    expect(getByTestId('numpad-slot').style.gridTemplateRows).toBe('0fr')
  })

  it('開時にアクティブフィールドを scrollIntoView({block:nearest}) で追従', () => {
    stubReducedMotion(false)
    const f = field()
    render(<NumpadFooterSlot currentField={f} />)
    expect(f.inputRef.current.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
  })

  it('transition は grid-template-rows 200ms (reduced-motion 時は none)', () => {
    stubReducedMotion(false)
    const a = render(<NumpadFooterSlot currentField={field()} />)
    expect(a.getByTestId('numpad-slot').style.transition).toContain('grid-template-rows')
    cleanup()
    stubReducedMotion(true)
    const b = render(<NumpadFooterSlot currentField={field()} />)
    expect(b.getByTestId('numpad-slot').style.transition).toBe('none')
  })
})
