// @vitest-environment happy-dom
// J-NUMPAD-CARET-FRESH-fix-01: caretL/caretRがfreshRefをクリアすることを検証
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { NumpadFooterPanel } from '../../clawsupport/components/NumpadField'

function makeField(overrides = {}) {
  return {
    label: 'テスト',
    allowDecimal: false,
    max: 999999,
    dataTabindex: 1,
    freshRef: { current: true },
    valueRef: { current: '12345' },
    caretPosRef: { current: 5 },
    inputRef: { current: { setSelectionRange: vi.fn() } },
    onChange: vi.fn(),
    onCaretChange: vi.fn(),
    onClear: vi.fn(),
    ...overrides,
  }
}

function pressKey(keyId) {
  const btn = screen.getByRole('button', { name: undefined, hidden: true })
    || document.querySelector(`[data-numpad-key="${keyId}"]`)
  const el = document.querySelector(`[data-numpad-key="${keyId}"]`)
  fireEvent.pointerDown(el)
}

describe('J-NUMPAD-CARET-FRESH-fix-01: caretL/caretR freshRefクリア', () => {
  it('when_caretL_pressed_with_freshRef_true_should_clear_freshRef', () => {
    const field = makeField()
    render(<NumpadFooterPanel currentField={field} />)

    fireEvent.pointerDown(document.querySelector('[data-numpad-key="caretL"]'))

    expect(field.freshRef.current).toBe(false)
  })

  it('when_caretR_pressed_with_freshRef_true_should_clear_freshRef', () => {
    const field = makeField()
    render(<NumpadFooterPanel currentField={field} />)

    fireEvent.pointerDown(document.querySelector('[data-numpad-key="caretR"]'))

    expect(field.freshRef.current).toBe(false)
  })

  it('when_caretR_then_digit_should_insert_at_caret_not_clear_value', () => {
    // freshRef=true + value='12345', caret=5 (末尾)
    // caretR → caret移動のみ(末尾なので5のまま)、freshRef=false
    // digit '9' → val=freshRefがfalseなので '12345', caret=5 → '123459'
    const field = makeField({ caretPosRef: { current: 3 } })
    // caret at 3: '123|45'
    // caretR → caret=4, freshRef=false
    // digit '9' → insert at 4: '1234|45' -> '12349|45' → '123495' wait...
    // val='12345', caret was 3, after caretR caret=4
    // digit '9' at caret 4: '1234' + '9' + '5' = '123495'
    render(<NumpadFooterPanel currentField={field} />)

    fireEvent.pointerDown(document.querySelector('[data-numpad-key="caretR"]'))
    expect(field.freshRef.current).toBe(false)
    expect(field.caretPosRef.current).toBe(4)

    fireEvent.pointerDown(document.querySelector('[data-numpad-key="9"]'))

    expect(field.onChange).toHaveBeenCalledWith('123495')
  })

  it('when_caretL_then_digit_should_insert_at_caret_not_clear_value', () => {
    // freshRef=true + value='12345', caret=5 (末尾)
    // caretL → caret=4, freshRef=false
    // digit '9' → insert at 4: '1234' + '9' + '5' = '123495'
    const field = makeField()
    render(<NumpadFooterPanel currentField={field} />)

    fireEvent.pointerDown(document.querySelector('[data-numpad-key="caretL"]'))
    expect(field.freshRef.current).toBe(false)
    expect(field.caretPosRef.current).toBe(4)

    fireEvent.pointerDown(document.querySelector('[data-numpad-key="9"]'))

    expect(field.onChange).toHaveBeenCalledWith('123495')
  })
})
