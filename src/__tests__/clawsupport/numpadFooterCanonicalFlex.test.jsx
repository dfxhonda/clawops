// @vitest-environment happy-dom
// SPEC-NUMPAD-FOOTER-CANONICAL-FLEX-01
// AC6: numpad-sheet gridTemplateRows uses minmax(44px,64px) → keys guaranteed ≥44px
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// isCustomNumpadEnabled must return true for NumpadFooterPanel to render keys
vi.mock('../../shared/lib/device', () => ({
  isCustomNumpadEnabled: () => true,
  isIPhone: () => true,
}))

import { NumpadFooterPanel } from '../../clawsupport/components/NumpadField'

const MOCK_FIELD = {
  dataTabindex: 1,
  label: 'IN',
  valueRef: { current: '12345' },
  caretPosRef: { current: 5 },
  freshRef: { current: false },
  inputRef: { current: null },
  type: 'number',
  allowDecimal: false,
  max: 999999,
  onChange: vi.fn(),
  onClear: vi.fn(),
  onCaretChange: vi.fn(),
}

describe('SPEC-NUMPAD-FOOTER-CANONICAL-FLEX-01 W1: key grid rows ≥44px', () => {
  it('when_numpad_sheet_renders_should_have_minmax_44px_grid_rows', () => {
    const { getByTestId } = render(
      <NumpadFooterPanel currentField={MOCK_FIELD} />
    )
    const sheet = getByTestId('numpad-sheet')
    expect(sheet.style.gridTemplateRows).toContain('minmax(44px')
    expect(sheet.style.gridTemplateRows).not.toContain('repeat(4, 1fr)')
  })

  it('when_numpad_sheet_renders_should_have_64px_upper_limit', () => {
    const { getByTestId } = render(
      <NumpadFooterPanel currentField={MOCK_FIELD} />
    )
    const sheet = getByTestId('numpad-sheet')
    expect(sheet.style.gridTemplateRows).toContain('64px')
  })

  it('when_numpad_sheet_renders_grid_rows_should_not_be_plain_1fr', () => {
    const { getByTestId } = render(
      <NumpadFooterPanel currentField={MOCK_FIELD} />
    )
    const sheet = getByTestId('numpad-sheet')
    expect(sheet.style.gridTemplateRows).not.toBe('repeat(4, 1fr)')
  })
})
