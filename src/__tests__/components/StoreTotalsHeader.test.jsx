// @vitest-environment happy-dom
// SPEC-PATROL-HISTORY-HEATMAP-01: 10列ヘッダ + IN/日売/OUT モード切替
// SPEC-PATROL-HISTORY-HEATMAP-02: dateAxis prop、mode toggle / expand toggle は PatrolStorePage に移動
// SPEC-PATROL-HISTORY-HEATMAP-03: COLUMN_HEADERS フォールバック廃止。dateAxis null列は空文字
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
  it('column_labels_are_empty_when_no_dateAxis', () => {
    // HEATMAP-03: COLUMN_HEADERS フォールバック廃止。dateAxis なし時は空文字
    const { rerender } = render(<StoreTotalsHeader diffMap={diffMap} mode="IN" />)
    expect(screen.getByTestId('store-label-0').textContent).toBe('')
    expect(screen.getByTestId('store-label-8').textContent).toBe('')
    expect(screen.getByTestId('store-label-9').textContent).toBe('')
    rerender(<StoreTotalsHeader diffMap={diffMap} mode="OUT" />)
    expect(screen.getByTestId('store-label-9').textContent).toBe('')
    rerender(<StoreTotalsHeader diffMap={diffMap} mode="DAILY" />)
    expect(screen.getByTestId('store-label-9').textContent).toBe('')
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

  it('when_diffMap_empty_should_render_dash_for_all_cells', () => {
    render(<StoreTotalsHeader diffMap={{}} mode="IN" />)
    expect(screen.getByTestId('store-value-0').textContent).toBe('−')
    expect(screen.getByTestId('store-value-9').textContent).toBe('−')
  })

  it('when_dateAxis_provided_labels_show_M_D_format', () => {
    const axis = Array(10).fill(null)
    axis[8] = '2026-06-15'
    axis[9] = '2026-06-20'
    render(<StoreTotalsHeader diffMap={diffMap} mode="IN" dateAxis={axis} />)
    expect(screen.getByTestId('store-label-8').textContent).toBe('6/15')
    expect(screen.getByTestId('store-label-9').textContent).toBe('6/20')
    // HEATMAP-03: null slots show empty string (no COLUMN_HEADERS fallback)
    expect(screen.getByTestId('store-label-0').textContent).toBe('')
  })
})
