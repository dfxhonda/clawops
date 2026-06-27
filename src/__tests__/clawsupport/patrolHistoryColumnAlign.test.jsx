// @vitest-environment happy-dom
// SPEC-PATROL-HISTORY-HEATMAP-02: tabular-nums クラス存在確認 (mr-[17px] は F2 統合スクロール廃止済)
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }),
    }),
  },
}))

vi.mock('../../services/patrol', () => ({
  getPatrolMachines: vi.fn().mockResolvedValue([]),
}))

import StoreTotalsHeader from '../../clawsupport/components/StoreTotalsHeader'
import MachineRow from '../../clawsupport/components/MachineRow'
import MachineRowExpandedBoothList from '../../clawsupport/components/MachineRowExpandedBoothList'

// 10-element arrays (SPEC-PATROL-HISTORY-HEATMAP-01)
const D10 = [null, null, null, null, null, null, 10, 20, 30, 40]
const D10_OUT = [null, null, null, null, null, null, 1, 2, 3, 4]

const DIFF_MAP = {
  'M001': { inDiffs: D10, outDiffs: D10_OUT, daily: D10, days: Array(10).fill(null).fill(2, 6) },
}

const MACHINE = {
  machine_code: 'M001',
  machine_name: 'テスト機',
  store_code: 'TST01',
  machine_types: { category: 'crane', locker_slots: 0 },
  machine_models: { out_meter_count: 1 },
  booths: [
    { booth_code: 'B01', booth_number: 1, play_price: 100, meter_in_number: 1, meter_out_number: 1, is_active: true, machine_code: 'M001' },
    { booth_code: 'B02', booth_number: 2, play_price: 100, meter_in_number: 1, meter_out_number: 1, is_active: true, machine_code: 'M001' },
  ],
  machine_lockers: [],
}

describe('SPEC-PATROL-HISTORY-COLUMN-ALIGN tabular-nums', () => {
  it('when_StoreTotalsHeader_rendered_should_have_tabular-nums_on_both_grid_containers', () => {
    render(<StoreTotalsHeader diffMap={DIFF_MAP} mode="IN" />)
    const labelGrid = screen.getByTestId('store-label-0').parentElement
    const valueGrid = screen.getByTestId('store-value-0').parentElement
    expect(labelGrid.className).toContain('tabular-nums')
    expect(valueGrid.className).toContain('tabular-nums')
  })

  it('when_MachineRow_rendered_should_have_tabular-nums_on_grid', () => {
    render(
      <MemoryRouter>
        <MachineRow
          machine={MACHINE}
          diffMap={DIFF_MAP}
          todayMap={{}}
          rankMap={{}}
          mode="IN"
          storeCode="TST01"
        />
      </MemoryRouter>
    )
    const grid = screen.getByTestId('machine-totals-M001')
    expect(grid.className).toContain('tabular-nums')
  })

  it('when_MachineRowExpandedBoothList_rendered_should_have_tabular-nums_on_booth_grid', () => {
    const BOOTH_SUMMARIES = {
      B01: { inDiffs: D10, outDiffs: D10_OUT, daily: D10, days: Array(10).fill(null).fill(2, 6) },
    }
    render(
      <MemoryRouter>
        <MachineRowExpandedBoothList
          booths={MACHINE.booths}
          diffMap={BOOTH_SUMMARIES}
          todayMap={{}}
          mode="IN"
        />
      </MemoryRouter>
    )
    const boothGrid = screen.getByTestId('booth-cell-B01-0').parentElement
    expect(boothGrid.className).toContain('tabular-nums')
  })
})
