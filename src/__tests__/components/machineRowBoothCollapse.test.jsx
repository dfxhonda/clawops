// @vitest-environment happy-dom
// SPEC-MOTION-W2-MACHINEROW-BOOTH-EXPAND-COLLAPSE-01 (D-080):
// ブース展開を条件レンダー → 共有 Collapse 包み (常時mount, open=isExpanded, grid-fr) に置換した検証。
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

const rowProps = {
  todayMap: {}, diffMap: {}, rankMap: {}, mode: 'IN',
  onToggleExpand: vi.fn(), onBoothClick: vi.fn(),
}

describe('AC2/AC3: MachineRow booth expand Collapse (D-080)', () => {
  it('AC2: multi-booth は Collapse を常時mount、open は isExpanded に追従', () => {
    const machine = makeMachine(['B01', 'B02'])
    // collapsed (expanded=false): Collapse は mount されるが open=false (grid 0fr)
    const collapsed = render(<MachineRow machine={machine} {...rowProps} expanded={false} />)
    const c = collapsed.getByTestId('booth-collapse-M01')
    expect(c).toBeTruthy()
    expect(c.style.gridTemplateRows).toBe('0fr')
    // 中身は常時mount (条件レンダー廃止) = 展開リストが DOM に存在
    expect(collapsed.getByTestId('machine-expanded-booth-list')).toBeTruthy()
    collapsed.unmount()

    // expanded=true: open (grid 1fr)
    const expanded = render(<MachineRow machine={machine} {...rowProps} expanded={true} />)
    expect(expanded.getByTestId('booth-collapse-M01').style.gridTemplateRows).toBe('1fr')
  })

  it('AC3: single-booth は展開部を持たない (Collapse も mount しない)', () => {
    const machine = makeMachine(['B01'])
    render(<MachineRow machine={machine} {...rowProps} expanded={true} />)
    expect(screen.queryByTestId('booth-collapse-M01')).toBeNull()
    expect(screen.queryByTestId('machine-expanded-booth-list')).toBeNull()
  })

  it('AC2: 閉時は inert + aria-hidden でタブ到達不可 (Collapse 仕様)', () => {
    const machine = makeMachine(['B01', 'B02'])
    const { getByTestId } = render(<MachineRow machine={machine} {...rowProps} expanded={false} />)
    const inner = getByTestId('booth-collapse-M01-inner')
    expect(inner.hasAttribute('inert')).toBe(true)
    expect(inner.getAttribute('aria-hidden')).toBe('true')
  })
})
