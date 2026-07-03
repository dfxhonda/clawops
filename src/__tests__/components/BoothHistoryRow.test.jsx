// @vitest-environment happy-dom
// SPEC-PATROL-BOOTHUI-3FIXES-01 AC6/AC7: BoothHistoryRow phantom highlight fix

import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => vi.fn() }
})

import BoothHistoryRow from '../../clawsupport/components/BoothHistoryRow'

const BASE_ROW = {
  patrol_date: '2026-07-02',
  entry_type: 'patrol',
  prize_name: null,
  in_diff: 100,
  out_diff: 50,
  revenue: null,
  profit: null,
}

function wrap(node) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

describe('SPEC-PATROL-BOOTHUI-3FIXES-01 AC6/AC7: BoothHistoryRow phantom highlight fix', () => {
  it('AC6: when_reading_id_undefined_and_isSelected_true_should_not_show_ring', () => {
    const { getByTestId } = wrap(
      <BoothHistoryRow
        row={{ ...BASE_ROW, reading_id: undefined }}
        isSelected={true}
        boothCode="A-1"
        storeCode="S1"
      />
    )
    const el = getByTestId('history-row')
    expect(el.className).not.toContain('ring-2')
    expect(el.className).not.toContain('ring-blue-500')
  })

  it('AC7: when_reading_id_defined_and_isSelected_true_should_show_ring', () => {
    const { getByTestId } = wrap(
      <BoothHistoryRow
        row={{ ...BASE_ROW, reading_id: 'abc-123' }}
        isSelected={true}
        boothCode="A-1"
        storeCode="S1"
      />
    )
    const el = getByTestId('history-row')
    expect(el.className).toContain('ring-2')
    expect(el.className).toContain('ring-blue-500')
  })
})
