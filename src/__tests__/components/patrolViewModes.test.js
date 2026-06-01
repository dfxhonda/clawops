// SPEC-PATROL-VIEW-MODE-SWITCH-01: aggregateSummaries / formatCell の挙動検証
import { describe, it, expect } from 'vitest'
import { aggregateSummaries, formatCell, VIEW_MODES } from '../../clawsupport/components/patrolViewModes'

describe('aggregateSummaries', () => {
  it('when_mode_IN_should_sum_each_column', () => {
    const summaries = [
      { prevIn: 100, currIn: 200, prevPerDay: 10, currPerDay: 20 },
      { prevIn: 50,  currIn: 80,  prevPerDay: 5,  currPerDay: 8  },
    ]
    expect(aggregateSummaries(summaries, 'IN')).toEqual({
      prevIn: 150, currIn: 280, prevPerDay: 15, currPerDay: 28,
    })
  })

  it('when_mode_OUT_should_sum_out_and_compute_weighted_avg_payout', () => {
    // SUM(prevOut)=300, SUM(prevIn)=1000 → 30.0%
    // SUM(currOut)=150, SUM(currIn)=1500 → 10.0%
    const summaries = [
      { prevOut: 200, currOut: 100, prevIn: 500, currIn: 1000 },
      { prevOut: 100, currOut:  50, prevIn: 500, currIn:  500 },
    ]
    expect(aggregateSummaries(summaries, 'OUT')).toEqual({
      prevOut: 300, currOut: 150, prevPayout: 30.0, currPayout: 10.0,
    })
  })

  it('when_mode_OUT_with_currIn_zero_should_return_null_currPayout', () => {
    const summaries = [
      { prevOut: 0, currOut: 0, prevIn: 0, currIn: 0 },
    ]
    const r = aggregateSummaries(summaries, 'OUT')
    expect(r.currPayout).toBe(null)
    expect(r.prevPayout).toBe(null)
  })

  it('when_mode_STOCK_should_sum_each_column', () => {
    const summaries = [
      { prevStock: 60, currStock: 80, prevRestock: 10, currRestock: 20 },
      { prevStock: 40, currStock: 30, prevRestock:  5, currRestock: 15 },
    ]
    expect(aggregateSummaries(summaries, 'STOCK')).toEqual({
      prevStock: 100, currStock: 110, prevRestock: 15, currRestock: 35,
    })
  })

  it('when_summaries_contain_null_or_undefined_should_skip_them', () => {
    const summaries = [null, { prevIn: 100 }, undefined, { prevIn: null }, { prevIn: 50 }]
    expect(aggregateSummaries(summaries, 'IN').prevIn).toBe(150)
  })
})

describe('formatCell', () => {
  it('null_should_render_dash', () => {
    expect(formatCell(null, 'count')).toBe('−')
    expect(formatCell(null, 'percent')).toBe('−')
    expect(formatCell(null, 'perDay')).toBe('−')
  })
  it('count_should_use_locale_separator', () => {
    expect(formatCell(1234, 'count')).toBe('1,234')
  })
  it('perDay_should_render_1_decimal', () => {
    expect(formatCell(33.333, 'perDay')).toBe('33.3')
  })
  it('percent_should_render_1_decimal_with_percent_sign', () => {
    expect(formatCell(20, 'percent')).toBe('20.0%')
  })
})

describe('VIEW_MODES shape', () => {
  it('IN_OUT_STOCK_all_have_4_columns', () => {
    expect(VIEW_MODES.IN.cols).toHaveLength(4)
    expect(VIEW_MODES.OUT.cols).toHaveLength(4)
    expect(VIEW_MODES.STOCK.cols).toHaveLength(4)
  })
  it('IN_OUT_STOCK_label_shorthand_for_toggle', () => {
    expect(VIEW_MODES.IN.label).toBe('IN')
    expect(VIEW_MODES.OUT.label).toBe('OUT')
    expect(VIEW_MODES.STOCK.label).toBe('在庫')
  })
})
