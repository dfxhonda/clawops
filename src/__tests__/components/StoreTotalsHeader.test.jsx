// @vitest-environment happy-dom
// SPEC-PATROL-HISTORY-HEATMAP-01: 10列ヘッダ「9前/.../前回/今回」+ IN/日売/OUT モード切替
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import StoreTotalsHeader from '../../clawsupport/components/StoreTotalsHeader'

// Helper: 10-element null array with values at rightmost positions
function fill10(values) {
  const arr = Array(10).fill(null)
  for (let i = 0; i < values.length; i++) arr[10 - values.length + i] = values[i]
  return arr
}

// 共通 diffMap fixture (booth_code 2 件、10 列ヒストリ形式)
const diffMap = {
  'A-1': {
    inDiffs:  fill10([10, 20, 30, 40]),
    outDiffs: fill10([ 1,  2,  3,  4]),
    daily:    fill10([5.0, 10.0, 15.0, 20.0]),
    days:     fill10([2, 2, 2, 2]),
  },
  'A-2': {
    inDiffs:  fill10([ 5, 10, 15, 20]),
    outDiffs: fill10([ 1,  1,  1,  1]),
    daily:    fill10([2.5, 5.0, 7.5, 10.0]),
    days:     fill10([2, 2, 2, 2]),
  },
}

describe('StoreTotalsHeader (SPEC-02)', () => {
  it('column_labels_are_10_9前_to_今回_regardless_of_mode', () => {
    const { rerender } = render(<StoreTotalsHeader diffMap={diffMap} mode="IN" />)
    expect(screen.getByTestId('store-label-0').textContent).toBe('9前')
    expect(screen.getByTestId('store-label-8').textContent).toBe('前回')
    expect(screen.getByTestId('store-label-9').textContent).toBe('今回')
    rerender(<StoreTotalsHeader diffMap={diffMap} mode="OUT" />)
    expect(screen.getByTestId('store-label-9').textContent).toBe('今回')
    rerender(<StoreTotalsHeader diffMap={diffMap} mode="DAILY" />)
    expect(screen.getByTestId('store-label-9').textContent).toBe('今回')
  })

  it('IN_mode_renders_summed_inDiffs_at_correct_indices', () => {
    render(<StoreTotalsHeader diffMap={diffMap} mode="IN" />)
    // indices 6-9 have values, 0-5 are null
    expect(screen.getByTestId('store-value-5').textContent).toBe('−')
    expect(screen.getByTestId('store-value-6').textContent).toBe('15')
    expect(screen.getByTestId('store-value-7').textContent).toBe('30')
    expect(screen.getByTestId('store-value-8').textContent).toBe('45')
    expect(screen.getByTestId('store-value-9').textContent).toBe('60')
  })

  it('OUT_mode_renders_summed_outDiffs', () => {
    render(<StoreTotalsHeader diffMap={diffMap} mode="OUT" />)
    expect(screen.getByTestId('store-value-6').textContent).toBe('2')
    expect(screen.getByTestId('store-value-9').textContent).toBe('5')
  })

  it('DAILY_mode_renders_weighted_avg_1dp', () => {
    // SUM(inDiffs[9]) = 40+20 = 60, SUM(days[9]) = 2+2 = 4 → 15.0
    // SUM(inDiffs[6]) = 10+5  = 15, SUM(days[6]) = 2+2 = 4 → 3.8
    render(<StoreTotalsHeader diffMap={diffMap} mode="DAILY" />)
    expect(screen.getByTestId('store-value-6').textContent).toBe('3.8')
    expect(screen.getByTestId('store-value-9').textContent).toBe('15.0')
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
    expect(screen.getByTestId('store-value-9').textContent).toBe('−')
  })

  it('when_onExpandAllToggle_provided_should_render_expand_toggle', () => {
    const toggle = vi.fn()
    render(<StoreTotalsHeader diffMap={diffMap} mode="IN" onModeChange={() => {}} onExpandAllToggle={toggle} allExpanded={false} />)
    const btn = screen.getByTestId('expand-all-toggle')
    expect(btn.textContent).toBe('全開')
    fireEvent.click(btn)
    expect(toggle).toHaveBeenCalledTimes(1)
  })

  it('when_allExpanded_true_should_show_全閉', () => {
    render(<StoreTotalsHeader diffMap={diffMap} mode="IN" onModeChange={() => {}} onExpandAllToggle={() => {}} allExpanded={true} />)
    expect(screen.getByTestId('expand-all-toggle').textContent).toBe('全閉')
  })
})
