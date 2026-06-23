// SPEC-PATROL-HISTORY-HEATMAP-01: aggregateSummaries / formatCell / VIEW_MODES shape 検証 (10列)
import { describe, it, expect } from 'vitest'
import {
  aggregateSummaries,
  formatCell,
  sourceArrayFor,
  VIEW_MODES,
  VIEW_MODE_ORDER,
  COLUMN_HEADERS,
  COLUMN_COUNT,
} from '../../clawsupport/components/patrolViewModes'

describe('VIEW_MODES shape (SPEC-02)', () => {
  it('order_is_IN_DAILY_OUT', () => {
    expect(VIEW_MODE_ORDER).toEqual(['IN', 'DAILY', 'OUT'])
  })
  it('IN_label_is_IN', () => {
    expect(VIEW_MODES.IN.label).toBe('IN')
    expect(VIEW_MODES.IN.sourceKey).toBe('inDiffs')
    expect(VIEW_MODES.IN.type).toBe('count')
  })
  it('DAILY_label_is_Ave', () => {
    expect(VIEW_MODES.DAILY.label).toBe('Ave')
    expect(VIEW_MODES.DAILY.sourceKey).toBe('daily')
    expect(VIEW_MODES.DAILY.type).toBe('perDay')
  })
  it('OUT_label_is_OUT', () => {
    expect(VIEW_MODES.OUT.label).toBe('OUT')
    expect(VIEW_MODES.OUT.sourceKey).toBe('outDiffs')
    expect(VIEW_MODES.OUT.type).toBe('count')
  })
  it('column_count_is_10', () => {
    expect(COLUMN_COUNT).toBe(10)
  })
  it('column_headers_are_10_oldest_to_newest', () => {
    expect(COLUMN_HEADERS).toEqual(['9前', '8前', '7前', '6前', '5前', '4前', '3前', '2前', '前回', '今回'])
  })
})

describe('sourceArrayFor', () => {
  it('IN_returns_inDiffs', () => {
    const s = { inDiffs: [1, 2, 3, 4], outDiffs: [5, 6, 7, 8] }
    expect(sourceArrayFor(s, 'IN')).toEqual([1, 2, 3, 4])
  })
  it('DAILY_returns_daily', () => {
    const s = { daily: [1.1, 2.2, 3.3, 4.4] }
    expect(sourceArrayFor(s, 'DAILY')).toEqual([1.1, 2.2, 3.3, 4.4])
  })
  it('OUT_returns_outDiffs', () => {
    const s = { outDiffs: [10, 20, 30, 40] }
    expect(sourceArrayFor(s, 'OUT')).toEqual([10, 20, 30, 40])
  })
  it('null_summary_returns_10_nulls', () => {
    expect(sourceArrayFor(null, 'IN')).toEqual(Array(10).fill(null))
  })
})

// Helper: 10-element null array with values at rightmost positions
function fill10(values) {
  const arr = Array(10).fill(null)
  for (let i = 0; i < values.length; i++) arr[10 - values.length + i] = values[i]
  return arr
}

describe('aggregateSummaries IN/OUT (column-wise SUM)', () => {
  it('IN_sums_each_column_across_booths', () => {
    const summaries = [
      { inDiffs: fill10([10, 20, 30, 40]), days: fill10([1, 1, 1, 1]) },
      { inDiffs: fill10([ 1,  2,  3,  4]), days: fill10([1, 1, 1, 1]) },
    ]
    expect(aggregateSummaries(summaries, 'IN')).toEqual(fill10([11, 22, 33, 44]))
  })

  it('OUT_sums_each_column_across_booths', () => {
    const summaries = [
      { outDiffs: fill10([100, 200, 300, 400]) },
      { outDiffs: fill10([ 10,  20,  30,  40]) },
    ]
    expect(aggregateSummaries(summaries, 'OUT')).toEqual(fill10([110, 220, 330, 440]))
  })

  it('IN_treats_null_entries_as_skip_not_zero', () => {
    const summaries = [
      { inDiffs: fill10([null, 100, 200, 300]) },
      { inDiffs: fill10([null,  50, null, 100]) },
    ]
    expect(aggregateSummaries(summaries, 'IN')).toEqual(fill10([null, 150, 200, 400]))
  })

  it('null_or_empty_summaries_returns_10_nulls', () => {
    expect(aggregateSummaries([], 'IN')).toEqual(Array(10).fill(null))
    expect(aggregateSummaries(null, 'OUT')).toEqual(Array(10).fill(null))
  })
})

describe('aggregateSummaries DAILY (weighted avg)', () => {
  it('weighted_avg_uses_SUM_in_over_SUM_days', () => {
    // booth A col 9: in=100, days=5 → 20.0
    // booth B col 9: in=200, days=5 → 40.0
    // aggregate col 9 = (100+200) / (5+5) = 30.0
    const summaries = [
      { inDiffs: fill10([100]), days: fill10([5]) },
      { inDiffs: fill10([200]), days: fill10([5]) },
    ]
    const out = aggregateSummaries(summaries, 'DAILY')
    expect(out[9]).toBe(30.0)
    expect(out[8]).toBe(null)
  })

  it('DAILY_with_unequal_intervals_correctly_weights', () => {
    // booth A col 9: in=100, days=1
    // booth B col 9: in=100, days=10
    // aggregate col 9 = (100+100) / (1+10) = 18.2
    const summaries = [
      { inDiffs: fill10([100]), days: fill10([1]) },
      { inDiffs: fill10([100]), days: fill10([10]) },
    ]
    expect(aggregateSummaries(summaries, 'DAILY')[9]).toBeCloseTo(18.2, 1)
  })

  it('DAILY_col_with_zero_days_sum_returns_null', () => {
    const summaries = [
      { inDiffs: fill10([100]), days: fill10([0]) },
    ]
    expect(aggregateSummaries(summaries, 'DAILY')[9]).toBe(null)
  })
})

describe('formatCell', () => {
  it('null_should_render_dash', () => {
    expect(formatCell(null, 'count')).toBe('−')
    expect(formatCell(null, 'perDay')).toBe('−')
  })
  it('count_should_use_locale_separator', () => {
    expect(formatCell(1234, 'count')).toBe('1,234')
  })
  it('perDay_should_render_1_decimal', () => {
    expect(formatCell(33.333, 'perDay')).toBe('33.3')
  })
})
