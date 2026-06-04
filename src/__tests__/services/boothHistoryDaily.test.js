// SPEC-PATROL-VIEW-MODE-SWITCH-02: 4-visit history summary 検証
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

describe('computeBoothDiffSummary (SPEC-02 4-visit history)', () => {
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
    expect(s.inDiffs).toEqual([null, null, null, 500])
    expect(s.outDiffs).toEqual([null, null, null, 100])
    expect(s.daily).toEqual([null, null, null, 100.0]) // 500 / 5 = 100.0
    expect(s.days).toEqual([null, null, null, 5])
  })

  it('when_three_rows_should_fill_today_and_prev_columns', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1750, out_meter: 250 },
      { patrol_date: '2026-05-25', in_meter: 1000, out_meter: 200 },
      { patrol_date: '2026-05-20', in_meter:  500, out_meter:  50 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiffs).toEqual([null, null, 500, 750])
    expect(s.outDiffs).toEqual([null, null, 150, 50])
    expect(s.daily).toEqual([null, null, 100.0, 150.0])
  })

  it('when_five_rows_should_fill_all_four_columns', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1000 },
      { patrol_date: '2026-05-25', in_meter:  500 },
      { patrol_date: '2026-05-20', in_meter:  250 },
      { patrol_date: '2026-05-15', in_meter:  100 },
      { patrol_date: '2026-05-10', in_meter:    0 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiffs).toEqual([100, 150, 250, 500])
    expect(s.daily).toEqual([20.0, 30.0, 50.0, 100.0])
    expect(s.days).toEqual([5, 5, 5, 5])
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
    expect(s.daily).toEqual([10.0, 80.0, 100.0, 100.0])
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
    expect(s.inDiffs[3]).toBe(null)
    expect(s.outDiffs[3]).toBe(50)
    expect(s.daily[3]).toBe(null)
  })

  // SPEC-LF1-HISTORY-FIX-07 AC-03: 4-ago index regression
  // confirmed: 4-ago was rows[3]-rows[5]=145 instead of rows[3]-rows[4]=124
  // KOS01-M02-B02: patrol_dates 2026-06-02..2026-05-12, in_meters as below
  it('when_kos01_5rows_4ago_equals_124_not_rows3_minus_rows5', () => {
    const rows = [
      { patrol_date: '2026-06-02', in_meter: 12187, out_meter: 0, out_meter_2: 0, out_meter_3: 0 },
      { patrol_date: '2026-05-30', in_meter: 12173, out_meter: 0, out_meter_2: 0, out_meter_3: 0 },
      { patrol_date: '2026-05-26', in_meter: 12138, out_meter: 0, out_meter_2: 0, out_meter_3: 0 },
      { patrol_date: '2026-05-23', in_meter: 12098, out_meter: 0, out_meter_2: 0, out_meter_3: 0 },
      { patrol_date: '2026-05-12', in_meter: 11974, out_meter: 0, out_meter_2: 0, out_meter_3: 0 },
    ]
    const s = computeBoothDiffSummary(rows)
    // 4-ago = rows[3]-rows[4] = 12098-11974 = 124, NOT rows[3]-rows[5] = 145
    expect(s.inDiffs[0]).toBe(124)
    // all 4 slots: today=14 prev=35 3ago=40 4ago=124
    expect(s.inDiffs).toEqual([124, 40, 35, 14])
  })
})
