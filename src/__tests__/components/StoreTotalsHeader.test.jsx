// @vitest-environment happy-dom
// SPEC-PATROL-VIEW-MODE-SWITCH-02: 固定ヘッダ「4前/3前/前回/今回」+ IN/日売/OUT モード切替
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StoreTotalsHeader from '../../clawsupport/components/StoreTotalsHeader'

// 共通 diffMap fixture (booth_code 2 件、4 列ヒストリ揃った形)
const diffMap = {
  'A-1': {
    inDiffs:  [10, 20, 30, 40],
    outDiffs: [ 1,  2,  3,  4],
    daily:    [5.0, 10.0, 15.0, 20.0],
    days:     [2, 2, 2, 2],
  },
  'A-2': {
    inDiffs:  [ 5, 10, 15, 20],
    outDiffs: [ 1,  1,  1,  1],
    daily:    [2.5, 5.0, 7.5, 10.0],
    days:     [2, 2, 2, 2],
  },
}

describe('StoreTotalsHeader (SPEC-02)', () => {
  it('column_labels_are_always_4前_3前_前回_今回_regardless_of_mode', () => {
    const { rerender } = render(<StoreTotalsHeader diffMap={diffMap} mode="IN" />)
    expect(screen.getByTestId('store-label-0').textContent).toBe('4前')
    expect(screen.getByTestId('store-label-1').textContent).toBe('3前')
    expect(screen.getByTestId('store-label-2').textContent).toBe('前回')
    expect(screen.getByTestId('store-label-3').textContent).toBe('今回')
    rerender(<StoreTotalsHeader diffMap={diffMap} mode="OUT" />)
    expect(screen.getByTestId('store-label-3').textContent).toBe('今回')
    rerender(<StoreTotalsHeader diffMap={diffMap} mode="DAILY" />)
    expect(screen.getByTestId('store-label-3').textContent).toBe('今回')
  })

  it('IN_mode_renders_summed_inDiffs', () => {
    render(<StoreTotalsHeader diffMap={diffMap} mode="IN" />)
    expect(screen.getByTestId('store-value-0').textContent).toBe('15')
    expect(screen.getByTestId('store-value-1').textContent).toBe('30')
    expect(screen.getByTestId('store-value-2').textContent).toBe('45')
    expect(screen.getByTestId('store-value-3').textContent).toBe('60')
  })

  it('OUT_mode_renders_summed_outDiffs', () => {
    render(<StoreTotalsHeader diffMap={diffMap} mode="OUT" />)
    expect(screen.getByTestId('store-value-0').textContent).toBe('2')
    expect(screen.getByTestId('store-value-3').textContent).toBe('5')
  })

  it('DAILY_mode_renders_weighted_avg_1dp', () => {
    // SUM(inDiffs[3]) = 40+20 = 60, SUM(days[3]) = 2+2 = 4 → 15.0
    // SUM(inDiffs[0]) = 10+5  = 15, SUM(days[0]) = 2+2 = 4 → 3.8
    render(<StoreTotalsHeader diffMap={diffMap} mode="DAILY" />)
    expect(screen.getByTestId('store-value-0').textContent).toBe('3.8')
    expect(screen.getByTestId('store-value-3').textContent).toBe('15.0')
  })

  it('when_onModeChange_provided_should_render_3_button_toggle_IN_Ave_OUT', () => {
    const onModeChange = vi.fn()
    render(<StoreTotalsHeader diffMap={diffMap} mode="IN" onModeChange={onModeChange} />)
    expect(screen.getByTestId('patrol-view-mode-toggle')).toBeTruthy()
    expect(screen.getByTestId('patrol-view-mode-btn-IN').textContent).toBe('IN')
    expect(screen.getByTestId('patrol-view-mode-btn-DAILY').textContent).toBe('Ave')
    expect(screen.getByTestId('patrol-view-mode-btn-OUT').textContent).toBe('OUT')
    fireEvent.click(screen.getByTestId('patrol-view-mode-btn-DAILY'))
    expect(onModeChange).toHaveBeenCalledWith('DAILY')
    fireEvent.click(screen.getByTestId('patrol-view-mode-btn-OUT'))
    expect(onModeChange).toHaveBeenCalledWith('OUT')
  })

  it('when_onModeChange_omitted_should_not_render_toggle', () => {
    render(<StoreTotalsHeader diffMap={diffMap} mode="IN" />)
    expect(screen.queryByTestId('patrol-view-mode-toggle')).toBeNull()
  })

  it('when_diffMap_empty_should_render_dash_for_all_cells', () => {
    render(<StoreTotalsHeader diffMap={{}} mode="IN" />)
    expect(screen.getByTestId('store-value-0').textContent).toBe('−')
    expect(screen.getByTestId('store-value-3').textContent).toBe('−')
  })
})
