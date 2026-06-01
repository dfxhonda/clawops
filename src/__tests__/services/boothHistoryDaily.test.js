// J-PATROL-IN-DAILY-fix-01: computeBoothDiffSummary の per-day 計算をユニット検証
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

describe('computeBoothDiffSummary', () => {
  it('when_only_one_row_should_return_null', () => {
    const rows = [{ patrol_date: '2026-05-30', in_meter: 1000 }]
    expect(computeBoothDiffSummary(rows)).toBe(null)
  })

  it('when_two_rows_with_5_day_gap_should_compute_currIn_and_currPerDay', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1500 },
      { patrol_date: '2026-05-25', in_meter: 1000 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.currIn).toBe(500)
    expect(s.currDays).toBe(5)
    expect(s.currPerDay).toBe(100.0)
    expect(s.prevIn).toBe(null)   // no 3rd row
    expect(s.prevPerDay).toBe(null)
  })

  it('when_three_rows_should_compute_both_prev_and_curr_per_day_rounded_1dp', () => {
    // 2026-05-20 → 2026-05-25 (5日 +500 = 100.0/日)
    // 2026-05-25 → 2026-05-30 (5日 +750 = 150.0/日)
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1750 },
      { patrol_date: '2026-05-25', in_meter: 1000 },
      { patrol_date: '2026-05-20', in_meter: 500 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.currIn).toBe(750)
    expect(s.currPerDay).toBe(150.0)
    expect(s.prevIn).toBe(500)
    expect(s.prevPerDay).toBe(100.0)
  })

  it('when_3day_gap_with_in_diff_100_should_round_to_33.3', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 100 },
      { patrol_date: '2026-05-27', in_meter: 0 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.currPerDay).toBe(33.3)
  })

  it('when_same_date_should_return_null_perDay', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 100 },
      { patrol_date: '2026-05-30', in_meter: 50 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.currIn).toBe(50)
    expect(s.currDays).toBe(null)
    expect(s.currPerDay).toBe(null)
  })

  it('preserves_backwards_compatible_inDiff_outDiff', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1500, out_meter: 200 },
      { patrol_date: '2026-05-25', in_meter: 1000, out_meter: 100 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.inDiff).toBe(500)
    expect(s.outDiff).toBe(100)
  })

  // SPEC-PATROL-VIEW-MODE-SWITCH-01: OUT mode (per-booth prev/curr diff + payout %)
  it('when_three_rows_should_compute_prev_and_curr_out_diff', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 2000, out_meter: 300 },
      { patrol_date: '2026-05-25', in_meter: 1500, out_meter: 200 },
      { patrol_date: '2026-05-20', in_meter: 1000, out_meter:  50 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.currOut).toBe(100)  // 300 - 200
    expect(s.prevOut).toBe(150)  // 200 - 50
  })

  it('when_three_rows_should_compute_prev_and_curr_payout_rate_1dp', () => {
    // curr: in=500, out=100 → 20.0%
    // prev: in=500, out=250 → 50.0%
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 2000, out_meter: 350 },
      { patrol_date: '2026-05-25', in_meter: 1500, out_meter: 250 },
      { patrol_date: '2026-05-20', in_meter: 1000, out_meter:   0 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.currPayout).toBe(20.0)
    expect(s.prevPayout).toBe(50.0)
  })

  it('when_in_diff_zero_should_return_null_payout', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 1000, out_meter: 100 },
      { patrol_date: '2026-05-25', in_meter: 1000, out_meter:  50 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.currIn).toBe(0)
    expect(s.currPayout).toBe(null)
  })

  // SPEC-PATROL-VIEW-MODE-SWITCH-01: stock mode (snapshot per record)
  it('when_two_rows_should_expose_stock_and_restock_snapshots', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 100, prize_stock_count: 80, prize_restock_count: 20 },
      { patrol_date: '2026-05-25', in_meter:  50, prize_stock_count: 60, prize_restock_count: 10 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.currStock).toBe(80)
    expect(s.prevStock).toBe(60)
    expect(s.currRestock).toBe(20)
    expect(s.prevRestock).toBe(10)
  })

  it('when_stock_columns_missing_should_return_null', () => {
    const rows = [
      { patrol_date: '2026-05-30', in_meter: 100 },
      { patrol_date: '2026-05-25', in_meter:  50 },
    ]
    const s = computeBoothDiffSummary(rows)
    expect(s.currStock).toBe(null)
    expect(s.prevStock).toBe(null)
    expect(s.currRestock).toBe(null)
    expect(s.prevRestock).toBe(null)
  })
})
