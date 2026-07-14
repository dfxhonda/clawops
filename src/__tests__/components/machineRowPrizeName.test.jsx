// @vitest-environment happy-dom
// SPEC-PATROL-HEATMAP-PRIZE-NAME-01 (D-060): 機械名の下 / ブース行に現在景品名 (latestPrizeName) 表示。
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MachineRow from '../../clawsupport/components/MachineRow'
import MachineRowExpandedBoothList from '../../clawsupport/components/MachineRowExpandedBoothList'

function makeMachine(boothCodes) {
  return {
    machine_code: 'M01',
    machine_name: 'テスト機械',
    booths: boothCodes.map((code, i) => ({ booth_code: code, booth_number: i + 1 })),
  }
}

const rowProps = {
  todayMap: {}, rankMap: {}, mode: 'IN', expanded: false,
  onToggleExpand: vi.fn(), onBoothClick: vi.fn(),
}

describe('MachineRow prize name (D-060)', () => {
  it('AC1: single-booth machine shows latestPrizeName under machine name', () => {
    const machine = makeMachine(['B01'])
    const diffMap = { B01: { latestPrizeName: 'ミルクスクイーズ' } }
    render(<MachineRow machine={machine} diffMap={diffMap} {...rowProps} />)
    expect(screen.getByTestId('machine-row-prize-M01').textContent).toBe('ミルクスクイーズ')
  })

  it('AC2: multi-booth machine does NOT show prize on the machine row', () => {
    const machine = makeMachine(['B01', 'B02'])
    const diffMap = {
      B01: { latestPrizeName: 'ジャグラー' },
      B02: { latestPrizeName: 'ミルク' },
    }
    render(<MachineRow machine={machine} diffMap={diffMap} {...rowProps} />)
    expect(screen.queryByTestId('machine-row-prize-M01')).toBeNull()
  })

  it('AC4: single-booth with null latestPrizeName renders no prize row', () => {
    const machine = makeMachine(['B01'])
    const diffMap = { B01: { latestPrizeName: null } }
    render(<MachineRow machine={machine} diffMap={diffMap} {...rowProps} />)
    expect(screen.queryByTestId('machine-row-prize-M01')).toBeNull()
  })
})

describe('MachineRowExpandedBoothList prize name (D-060)', () => {
  it('AC3: each expanded booth row shows its own latestPrizeName', () => {
    const booths = [
      { booth_code: 'B01', booth_number: 1 },
      { booth_code: 'B02', booth_number: 2 },
    ]
    const diffMap = {
      B01: { latestPrizeName: 'ジャグラー' },
      B02: { latestPrizeName: 'ミルク' },
    }
    render(<MachineRowExpandedBoothList booths={booths} diffMap={diffMap} todayMap={{}} onBoothClick={vi.fn()} />)
    expect(screen.getByTestId('booth-row-prize-B01').textContent).toBe('ジャグラー')
    expect(screen.getByTestId('booth-row-prize-B02').textContent).toBe('ミルク')
  })

  it('AC4: booth with null latestPrizeName renders no prize row', () => {
    const booths = [{ booth_code: 'B01', booth_number: 1 }]
    const diffMap = { B01: { latestPrizeName: null } }
    render(<MachineRowExpandedBoothList booths={booths} diffMap={diffMap} todayMap={{}} onBoothClick={vi.fn()} />)
    expect(screen.queryByTestId('booth-row-prize-B01')).toBeNull()
  })
})
