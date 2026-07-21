// @vitest-environment happy-dom
// SPEC-PATROL-HEATMAP-PRIZE-NAME-01 (D-060): 機械名の下 / ブース行に現在景品名 (latestPrizeName) 表示。
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MachineRow from '../../clawsupport/components/MachineRow'
import BoothFlatRows from '../../clawsupport/components/MachineRowExpandedBoothList'

function makeMachine(boothCodes) {
  return {
    machine_code: 'M01',
    machine_name: 'テスト機械',
    booths: boothCodes.map((code, i) => ({ booth_code: code, booth_number: i + 1 })),
  }
}

const rowProps = {
  todayMap: {}, rankMap: {}, mode: 'IN',
  onBoothClick: vi.fn(),
}

const inTable = (node) => <table><tbody>{node}</tbody></table>

describe('MachineRow prize name (D-060, table化)', () => {
  it('AC1: single-booth machine shows latestPrizeName under machine name', () => {
    const machine = makeMachine(['B01'])
    const diffMap = { B01: { latestPrizeName: 'ミルクスクイーズ' } }
    render(inTable(<MachineRow machine={machine} diffMap={diffMap} {...rowProps} />))
    expect(screen.getByTestId('machine-row-prize-M01').textContent).toBe('ミルクスクイーズ')
  })

  it('AC2: multi-booth machine does NOT show prize on the machine row', () => {
    const machine = makeMachine(['B01', 'B02'])
    const diffMap = {
      B01: { latestPrizeName: 'ジャグラー' },
      B02: { latestPrizeName: 'ミルク' },
    }
    render(inTable(<MachineRow machine={machine} diffMap={diffMap} {...rowProps} />))
    expect(screen.queryByTestId('machine-row-prize-M01')).toBeNull()
  })

  it('AC4: single-booth with null latestPrizeName renders no prize row', () => {
    const machine = makeMachine(['B01'])
    const diffMap = { B01: { latestPrizeName: null } }
    render(inTable(<MachineRow machine={machine} diffMap={diffMap} {...rowProps} />))
    expect(screen.queryByTestId('machine-row-prize-M01')).toBeNull()
  })
})

describe('BoothFlatRows prize name (D-060, ブースビューフラット行)', () => {
  const machine = makeMachine(['B01', 'B02'])
  const entriesOf = (codes) => codes.map(c => ({ booth: machine.booths.find(b => b.booth_code === c), machine }))

  it('AC3: each flat booth row shows its own latestPrizeName', () => {
    const diffMap = {
      B01: { latestPrizeName: 'ジャグラー' },
      B02: { latestPrizeName: 'ミルク' },
    }
    render(inTable(<BoothFlatRows entries={entriesOf(['B01', 'B02'])} diffMap={diffMap} todayMap={{}} onBoothClick={vi.fn()} />))
    expect(screen.getByTestId('booth-row-prize-B01').textContent).toBe('ジャグラー')
    expect(screen.getByTestId('booth-row-prize-B02').textContent).toBe('ミルク')
  })

  it('AC4: booth with null latestPrizeName renders no prize row', () => {
    const diffMap = { B01: { latestPrizeName: null } }
    render(inTable(<BoothFlatRows entries={entriesOf(['B01'])} diffMap={diffMap} todayMap={{}} onBoothClick={vi.fn()} />))
    expect(screen.queryByTestId('booth-row-prize-B01')).toBeNull()
  })
})
