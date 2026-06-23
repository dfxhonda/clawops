// SPEC-PATROL-HISTORY-HEATMAP-01: aggregateSummaries / formatCell / VIEW_MODES shape 検証 (10列)
// SPEC-PATROL-HISTORY-HEATMAP-02: computeColumnDates / mapSummaryToDateAxis / aggregateSummaries dateAxis
import { describe, it, expect } from 'vitest'
import {
  aggregateSummaries,
  formatCell,
  sourceArrayFor,
  VIEW_MODES,
  VIEW_MODE_ORDER,
  COLUMN_HEADERS,
  COLUMN_COUNT,
  computeColumnDates,
  mapSummaryToDateAxis,
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

// SPEC-PATROL-HISTORY-HEATMAP-02 F1 新規テスト
describe('computeColumnDates (HEATMAP-02 F1)', () => {
  it('empty_diffMap_returns_10_nulls', () => {
    expect(computeColumnDates({})).toEqual(Array(10).fill(null))
    expect(computeColumnDates(null)).toEqual(Array(10).fill(null))
  })

  it('returns_dates_appearing_in_at_least_50pct_of_booths', () => {
    // 3 booths. threshold=1.5 → dates appearing >=2 are qualified.
    const diffMap = {
      B1: { dates: [null, null, null, null, null, null, null, '2026-06-10', '2026-06-15', '2026-06-20'] },
      B2: { dates: [null, null, null, null, null, null, null, '2026-06-10', '2026-06-15', '2026-06-20'] },
      B3: { dates: [null, null, null, null, null, null, null, null,          '2026-06-15', '2026-06-20'] },
    }
    const axis = computeColumnDates(diffMap)
    // 6/20=3/3=100%, 6/15=3/3=100%, 6/10=2/3=67% → all 3 qualify
    expect(axis[9]).toBe('2026-06-20')  // newest at index 9
    expect(axis[8]).toBe('2026-06-15')
    expect(axis[7]).toBe('2026-06-10')
    // older positions are null
    expect(axis[0]).toBeNull()
  })

  it('excludes_dates_below_50pct_threshold', () => {
    // 4 booths. threshold=2. date '2026-06-01' appears in only 1 booth → excluded.
    const diffMap = {
      B1: { dates: fill10(['2026-06-01', '2026-06-10', '2026-06-20']) },
      B2: { dates: fill10(['2026-06-10', '2026-06-20']) },
      B3: { dates: fill10(['2026-06-10', '2026-06-20']) },
      B4: { dates: fill10(['2026-06-10', '2026-06-20']) },
    }
    const axis = computeColumnDates(diffMap)
    expect(axis).not.toContain('2026-06-01')
    expect(axis[9]).toBe('2026-06-20')
    expect(axis[8]).toBe('2026-06-10')
  })

  it('returns_newest_first_at_index_9', () => {
    // 2 booths with 3 shared dates
    const diffMap = {
      B1: { dates: fill10(['2026-05-01', '2026-05-15', '2026-06-01']) },
      B2: { dates: fill10(['2026-05-01', '2026-05-15', '2026-06-01']) },
    }
    const axis = computeColumnDates(diffMap)
    expect(axis[9]).toBe('2026-06-01')   // newest
    expect(axis[8]).toBe('2026-05-15')
    expect(axis[7]).toBe('2026-05-01')   // oldest of 3
  })

  it('caps_at_COLUMN_COUNT_most_recent_dates', () => {
    // 1 booth with 12 dates → only 10 most recent kept
    const dates = Array.from({ length: 12 }, (_, i) => `2026-0${String(i + 1).padStart(2, '0')}-01`).reverse()
    // dates[0]=2026-12-01 (newest), dates[11]=2026-01-01 (oldest)
    const all10 = Array(10).fill(null)
    for (let i = 0; i < 10; i++) all10[i] = dates[i + 2]  // positions 0..9
    const diffMap = {
      B1: { dates: Array(10).fill(null).map((_, i) => dates[i] ?? null) },
    }
    const axis = computeColumnDates(diffMap)
    expect(axis.filter(d => d != null).length).toBeLessThanOrEqual(10)
  })

  it('does_not_double_count_same_date_from_one_booth', () => {
    // B1 has the same date repeated (edge case) → should count as 1 occurrence per booth
    const diffMap = {
      B1: { dates: ['2026-06-01', '2026-06-01', null, null, null, null, null, null, null, null] },
      B2: { dates: [null, null, null, null, null, null, null, null, null, '2026-06-20'] },
    }
    // 2 booths, threshold=1. B1 has 6/01 (1 occurrence), B2 has 6/20 (1 occurrence). Both qualify.
    const axis = computeColumnDates(diffMap)
    expect(axis).toContain('2026-06-20')
    expect(axis).toContain('2026-06-01')
  })
})

describe('mapSummaryToDateAxis (HEATMAP-02 F1)', () => {
  it('null_summary_or_null_axis_returns_null', () => {
    expect(mapSummaryToDateAxis(null, Array(10).fill(null))).toBeNull()
    expect(mapSummaryToDateAxis({}, null)).toBeNull()
  })

  it('maps_values_to_correct_axis_positions', () => {
    // Booth has data at dates: 6/10 (idx 8), 6/20 (idx 9)
    const summary = {
      dates:    [null, null, null, null, null, null, null, null, '2026-06-10', '2026-06-20'],
      inDiffs:  [null, null, null, null, null, null, null, null, 100,          200         ],
      outDiffs: [null, null, null, null, null, null, null, null, 10,           20          ],
      daily:    [null, null, null, null, null, null, null, null, 5.0,          10.0        ],
      days:     [null, null, null, null, null, null, null, null, 2,            2           ],
      entryTypes:[null, null, null, null, null, null, null, null,'patrol',     'patrol'    ],
    }
    // Axis puts 6/10 at index 7, 6/20 at index 9 (one gap at 8)
    const axis = [null, null, null, null, null, null, null, '2026-06-10', null, '2026-06-20']
    const mapped = mapSummaryToDateAxis(summary, axis)
    expect(mapped.inDiffs[7]).toBe(100)   // 6/10 → axis[7]
    expect(mapped.inDiffs[8]).toBeNull()  // gap
    expect(mapped.inDiffs[9]).toBe(200)   // 6/20 → axis[9]
    expect(mapped.dates).toEqual(axis)
  })

  it('returns_null_for_dates_not_in_booth_history', () => {
    const summary = {
      dates:   [null, null, null, null, null, null, null, null, null, '2026-06-20'],
      inDiffs: [null, null, null, null, null, null, null, null, null, 500],
    }
    // Axis includes a date the booth didn't visit (6/15)
    const axis = [null, null, null, null, null, null, null, null, '2026-06-15', '2026-06-20']
    const mapped = mapSummaryToDateAxis(summary, axis)
    expect(mapped.inDiffs[8]).toBeNull()  // booth never visited 6/15
    expect(mapped.inDiffs[9]).toBe(500)   // booth visited 6/20
  })

  it('aggregateSummaries_with_dateAxis_remaps_before_summing', () => {
    // Booth A: dates at 6/15 (idx 8), 6/20 (idx 9) → inDiffs [100, 200]
    // Booth B: dates at 6/20 (idx 9) only           → inDiffs [null, 300]
    // Axis: 6/15 at col 7, 6/20 at col 9 (col 8 = null gap)
    const axis = Array(10).fill(null)
    axis[7] = '2026-06-15'
    axis[9] = '2026-06-20'

    const sA = {
      dates:   [null, null, null, null, null, null, null, null, '2026-06-15', '2026-06-20'],
      inDiffs: [null, null, null, null, null, null, null, null, 100,          200         ],
    }
    const sB = {
      dates:   [null, null, null, null, null, null, null, null, null, '2026-06-20'],
      inDiffs: [null, null, null, null, null, null, null, null, null, 300        ],
    }
    const result = aggregateSummaries([sA, sB], 'IN', axis)
    expect(result[7]).toBe(100)   // only A has 6/15
    expect(result[8]).toBeNull()  // gap col
    expect(result[9]).toBe(500)   // A(200) + B(300)
  })
})
