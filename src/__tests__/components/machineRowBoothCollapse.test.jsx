// @vitest-environment happy-dom
// SPEC-PATROL-HISTORY-CROSS-FREEZE-02 (D-110): D-080 のブース展開アコーディオン(Collapse)を廃止。
// 機械ビューは集約のみ = MachineRow に Collapse / 展開リストは存在しない (ブース詳細はブースビューへ)。
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import MachineRow from '../../clawsupport/components/MachineRow'

function makeMachine(boothCodes) {
  return {
    machine_code: 'M01',
    machine_name: 'テスト機械',
    booths: boothCodes.map((code, i) => ({ booth_code: code, booth_number: i + 1 })),
  }
}

const rowProps = { todayMap: {}, diffMap: {}, rankMap: {}, mode: 'IN', onBoothClick: vi.fn() }
const inTable = (node) => <table><tbody>{node}</tbody></table>

describe('D-110: MachineRow アコーディオン廃止 (機械ビュー集約のみ)', () => {
  it('multi-booth でも Collapse / 展開ブースリストを mount しない', () => {
    render(inTable(<MachineRow machine={makeMachine(['B01', 'B02'])} {...rowProps} />))
    expect(screen.queryByTestId('booth-collapse-M01')).toBeNull()
    expect(screen.queryByTestId('machine-expanded-booth-list')).toBeNull()
  })

  it('single-booth も展開部を持たない', () => {
    render(inTable(<MachineRow machine={makeMachine(['B01'])} {...rowProps} />))
    expect(screen.queryByTestId('booth-collapse-M01')).toBeNull()
  })

  it('機械行は <tr> で描画される (table 化)', () => {
    render(inTable(<MachineRow machine={makeMachine(['B01', 'B02'])} {...rowProps} />))
    expect(screen.getByTestId('machine-row-M01').tagName).toBe('TR')
  })
})
