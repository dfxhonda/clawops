// SPEC-PATROL-HISTORY-HEATMAP-01: 10-visit history summary 検証 (4→10列拡張)
import { describe, it, expect } from 'vitest'
import { computeBoothDiffSummary, diffPatrolDays } from '../../services/boothHistory'

describe('diffPatrolDays (JST)', () => {
  it('when_consecutive_days_should_return_1', () => {
    expect(diffPatrolDays('2026-05-29', '2026-05-30')).toBe(1)
  })
  it('when_5_day_gap_should_return_5', () => {
    expect(diffPatrolDays('2026-05-25', '2026-05-30')).toBe(5)
  })
  it('when_same_day_should_return_null', () => {
    expect(diffPatrolDays('2026-05-30', '2026-05-30')).toBe(null)
  })
  it('when_either_missing_should_return_null', () => {
    expect(diffPatrolDays(null, '2026-05-30')).toBe(null)
    expect(diffPatrolDays('2026-05-30', null)).toBe(null)
  })
})

// Helper: 10-element null array with values at rightmost positions (newest = index 9)
function fill10(values) {
  const arr = Array(10).fill(null)
  for (let i = 0; i < values.length; i++) arr[10 - values.length + i] = values[i]
  return arr
}

describe('computeBoothDiffSummary (SPEC-PATROL-HISTORY-HEATMAP-01 10-visit history)', () => {
  it('when_only_one_row_should_return_null', () => {
    const rows = [{ patrol_date: '2026-05-30', in_meter: 1000 }]
    expect(computeBoothDiffSummary(rows)).toBe(null)
  })

  it('when_two_rows_should_fill_only_today_column_others_null', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1500, out_meter: 200 },
      { patrol_date: '2026-05-25', in_meter: 1000, out_meter: 100 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiffs).toEqual(fill10([500]))
    expect(s.outDiffs).toEqual(fill10([100]))
    expect(s.daily).toEqual(fill10([100.0])) // 500 / 5 = 100.0
    expect(s.days).toEqual(fill10([5]))
  })

  it('when_three_rows_should_fill_today_and_prev_columns', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1750, out_meter: 250 },
      { patrol_date: '2026-05-25', in_meter: 1000, out_meter: 200 },
      { patrol_date: '2026-05-20', in_meter:  500, out_meter:  50 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiffs).toEqual(fill10([500, 750]))
    expect(s.outDiffs).toEqual(fill10([150, 50]))
    expect(s.daily).toEqual(fill10([100.0, 150.0]))
  })

  it('when_five_rows_should_fill_rightmost_four_columns', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1000 },
      { patrol_date: '2026-05-25', in_meter:  500 },
      { patrol_date: '2026-05-20', in_meter:  250 },
      { patrol_date: '2026-05-15', in_meter:  100 },
      { patrol_date: '2026-05-10', in_meter:    0 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiffs).toEqual(fill10([100, 150, 250, 500]))
    expect(s.daily).toEqual(fill10([20.0, 30.0, 50.0, 100.0]))
    expect(s.days).toEqual(fill10([5, 5, 5, 5]))
  })

  it('when_intervals_vary_daily_uses_each_pair_interval', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1000 },
      { patrol_date: '2026-05-29', in_meter:  900 },  // 1 day gap → 100/1 = 100.0
      { patrol_date: '2026-05-25', in_meter:  500 },  // 4 day gap → 400/4 = 100.0
      { patrol_date: '2026-05-20', in_meter:  100 },  // 5 day gap → 400/5 = 80.0
      { patrol_date: '2026-05-10', in_meter:    0 },  // 10 day gap → 100/10 = 10.0
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.daily).toEqual(fill10([10.0, 80.0, 100.0, 100.0]))
  })

  it('preserves_backwards_compatible_inDiff_outDiff_currIn_prevIn', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1500, out_meter: 200 },
      { patrol_date: '2026-05-25', in_meter: 1000, out_meter: 100 },
      { patrol_date: '2026-05-20', in_meter:  600, out_meter:  50 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiff).toBe(500)
    expect(s.outDiff).toBe(100)
    expect(s.currIn).toBe(500)
    expect(s.prevIn).toBe(400)
  })

  it('when_in_meter_missing_on_pair_inDiff_null_outDiff_still_computed', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1000, out_meter: 200 },
      { patrol_date: '2026-05-25', in_meter: null, out_meter: 150 },
    ]
    const s = computeBoothDiffSummary(rows)
    // newest column is index 9
    expect(s.inDiffs[9]).toBe(null)
    expect(s.outDiffs[9]).toBe(50)
    expect(s.daily[9]).toBe(null)
  })

  // SPEC-LF1-HISTORY-FIX-07 AC-03: 4-ago index regression
  // In 10-col array, 5 rows → diffs at indices 6-9 (rightmost 4 slots)
  it('when_kos01_5rows_4ago_equals_124_not_rows3_minus_rows5', () => {
    const rows = [
      { patrol_date: '2026-06-02', in_meter: 12187, out_meter: 0, out_meter_2: 0, out_meter_3: 0 },
      { patrol_date: '2026-05-30', in_meter: 12173, out_meter: 0, out_meter_2: 0, out_meter_3: 0 },
      { patrol_date: '2026-05-26', in_meter: 12138, out_meter: 0, out_meter_2: 0, out_meter_3: 0 },
      { patrol_date: '2026-05-23', in_meter: 12098, out_meter: 0, out_meter_2: 0, out_meter_3: 0 },
      { patrol_date: '2026-05-12', in_meter: 11974, out_meter: 0, out_meter_2: 0, out_meter_3: 0 },
    ]
    const s = computeBoothDiffSummary(rows)
    // 4-ago = rows[3]-rows[4] = 12098-11974 = 124 at display index 6 (d = 9 - 3 = 6)
    expect(s.inDiffs[6]).toBe(124)
    // slots 0-5 null, 6=124, 7=40, 8=35, 9=14
    expect(s.inDiffs).toEqual([null, null, null, null, null, null, 124, 40, 35, 14])
  })

  it('when_two_rows_should_populate_dates_and_entryTypes', () => {
    const rows = [
      { patrol_date: '2026-06-20', in_meter: 1500, entry_type: 'patrol' },
      { patrol_date: '2026-06-15', in_meter: 1000, entry_type: 'patrol' },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.dates[9]).toBe('2026-06-20')
    expect(s.entryTypes[9]).toBe('patrol')
    expect(s.dates[8]).toBe(null)
  })

  it('when_replace_entry_should_appear_in_entryTypes', () => {
    const rows = [
      { patrol_date: '2026-06-21', in_meter: 200, entry_type: 'replace' },
      { patrol_date: '2026-06-20', in_meter: 1500, entry_type: 'patrol' },
      { patrol_date: '2026-06-15', in_meter: 1000, entry_type: 'patrol' },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.entryTypes[9]).toBe('replace')
    expect(s.entryTypes[8]).toBe('patrol')
  })
})

// SPEC-PATROL-HEATMAP-PRIZE-NAME-01 (D-060): 最新行の景品名を latestPrizeName で公開
describe('computeBoothDiffSummary latestPrizeName (D-060)', () => {
  it('when_newest_row_has_prize_name_should_expose_it', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1500, out_meter: 200, prize_name: 'ミルクスクイーズ' },
      { patrol_date: '2026-05-25', in_meter: 1000, out_meter: 100, prize_name: '旧景品' },
    ]
    expect(computeBoothDiffSummary(rows).latestPrizeName).toBe('ミルクスクイーズ')
  })

  it('when_newest_row_prize_name_missing_should_be_null', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1500, out_meter: 200 },
      { patrol_date: '2026-05-25', in_meter: 1000, out_meter: 100, prize_name: '旧景品' },
    ]
    expect(computeBoothDiffSummary(rows).latestPrizeName).toBeNull()
  })
})
