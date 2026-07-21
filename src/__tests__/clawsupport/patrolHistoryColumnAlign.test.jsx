// @vitest-environment happy-dom
// SPEC-PATROL-HISTORY-COLUMN-ALIGN / CROSS-FREEZE-02 (D-110): table 化後の tabular-nums / セル整列確認。
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
import BoothFlatRows from '../../clawsupport/components/MachineRowExpandedBoothList'

const D10 = [null, null, null, null, null, null, 10, 20, 30, 40]
const D10_OUT = [null, null, null, null, null, null, 1, 2, 3, 4]

const DIFF_MAP = {
  'M001': { inDiffs: D10, outDiffs: D10_OUT, daily: D10, days: Array(10).fill(null).fill(2, 6) },
}

const MACHINE = {
  machine_code: 'M001',
  machine_name: 'テスト機',
  store_code: 'TST01',
  booths: [
    { booth_code: 'B01', booth_number: 1, machine_code: 'M001' },
    { booth_code: 'B02', booth_number: 2, machine_code: 'M001' },
  ],
}

const inTable = (node) => <MemoryRouter><table><tbody>{node}</tbody></table></MemoryRouter>

describe('D-110 table tabular-nums / セル整列', () => {
  it('StoreTotalsHeader: 日付ラベル/合計セルが tabular-nums (table th)', () => {
    render(<MemoryRouter><table>{<StoreTotalsHeader diffMap={DIFF_MAP} mode="IN" />}</table></MemoryRouter>)
    expect(screen.getByTestId('store-label-0').className).toContain('tabular-nums')
    expect(screen.getByTestId('store-value-0').className).toContain('tabular-nums')
    // th 要素 (table 化)
    expect(screen.getByTestId('store-value-0').tagName).toBe('TH')
  })

  it('MachineRow: 数値セルが tabular-nums (td) + 行は tr', () => {
    render(inTable(
      <MachineRow machine={MACHINE} diffMap={DIFF_MAP} todayMap={{}} rankMap={{}} mode="IN" />
    ))
    const cell = screen.getByTestId('machine-cell-M001-9')
    expect(cell.className).toContain('tabular-nums')
    expect(cell.tagName).toBe('TD')
    expect(screen.getByTestId('machine-row-M001').tagName).toBe('TR')
  })

  it('BoothFlatRows: ブース数値セルが tabular-nums (td)', () => {
    const BOOTH_SUMMARIES = {
      B01: { inDiffs: D10, outDiffs: D10_OUT, daily: D10, days: Array(10).fill(null).fill(2, 6) },
    }
    const entries = [{ booth: MACHINE.booths[0], machine: MACHINE }]
    render(inTable(
      <BoothFlatRows entries={entries} diffMap={BOOTH_SUMMARIES} todayMap={{}} mode="IN" onBoothClick={vi.fn()} />
    ))
    const boothCell = screen.getByTestId('booth-cell-B01-0')
    expect(boothCell.className).toContain('tabular-nums')
    expect(boothCell.tagName).toBe('TD')
  })
})
