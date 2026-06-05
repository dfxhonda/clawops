// @vitest-environment happy-dom
// SPEC-PATROL-UI-CLEANUP-02 task_2
// MachineRow parent row shows ✓ when all booths have today's meter_reading

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

const defaultProps = {
  diffMap: {},
  rankMap: {},
  mode: 'IN',
  expanded: false,
  onToggleExpand: vi.fn(),
  onBoothClick: vi.fn(),
}

describe('MachineRow allDone checkmark (SPEC-PATROL-UI-CLEANUP-02)', () => {
  it('when_all_booths_in_todayMap_should_show_checkmark', () => {
    const machine = makeMachine(['B01', 'B02', 'B03'])
    const todayMap = { B01: {}, B02: {}, B03: {} }
    render(<MachineRow machine={machine} todayMap={todayMap} {...defaultProps} />)
    expect(screen.getByTestId('machine-row-allDone-M01')).toBeTruthy()
  })

  it('when_some_booths_missing_from_todayMap_should_not_show_checkmark', () => {
    const machine = makeMachine(['B01', 'B02', 'B03'])
    const todayMap = { B01: {}, B02: {} } // B03 missing
    render(<MachineRow machine={machine} todayMap={todayMap} {...defaultProps} />)
    expect(screen.queryByTestId('machine-row-allDone-M01')).toBeNull()
  })

  it('when_no_booths_in_todayMap_should_not_show_checkmark', () => {
    const machine = makeMachine(['B01', 'B02'])
    const todayMap = {}
    render(<MachineRow machine={machine} todayMap={todayMap} {...defaultProps} />)
    expect(screen.queryByTestId('machine-row-allDone-M01')).toBeNull()
  })

  it('when_single_booth_done_should_show_checkmark', () => {
    const machine = makeMachine(['B01'])
    const todayMap = { B01: {} }
    render(<MachineRow machine={machine} todayMap={todayMap} {...defaultProps} />)
    expect(screen.getByTestId('machine-row-allDone-M01')).toBeTruthy()
  })
})
