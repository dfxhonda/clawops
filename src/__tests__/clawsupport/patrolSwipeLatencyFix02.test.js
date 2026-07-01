// SPEC-PATROL-SWIPE-LATENCY-FIX-02
// AC1: HISTORY_SELECT contains all 12 previously-missing columns
// AC2: OUT2 baseline row seeded into buildBoothHistoryFromIdb retains 2nd-system fields
// AC3: single-dispense fields unchanged (regression)
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'
import { buildBoothHistoryFromIdb } from '../../services/boothHistory'

const boothHistorySvc = readFileSync(
  resolve(__dirname, '../../services/boothHistory.js'),
  'utf-8',
)

const ADDED_COLUMNS = [
  'prize_id',
  'prize_name_2',
  'prize_name_3',
  'stock_2',
  'stock_3',
  'restock_2',
  'restock_3',
  'prize_cost_1',
  'prize_cost_2',
  'prize_cost_3',
  'theoretical_stock',
  'payout_rate',
]

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-02: HISTORY_SELECT widened (AC1)', () => {
  for (const col of ADDED_COLUMNS) {
    it(`when_history_select_widened_should_contain_${col}`, () => {
      expect(boothHistorySvc).toContain(col)
    })
  }
})

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-02: OUT2 baseline tier-2 prev fields (AC2)', () => {
  const OUT2_ROW = {
    reading_id: 'r-out2-001',
    booth_code: 'TST01-M04-001',
    store_code: 'TST01',
    patrol_date: '2026-06-30',
    created_at: '2026-06-30T10:00:00Z',
    read_time: '2026-06-30T10:00:00Z',
    in_meter: 1000,
    out_meter: 500,
    out_meter_2: 300,
    prize_name: 'くまちゃん',
    prize_cost: 300,
    prize_cost_1: 300,
    prize_name_2: 'ねこちゃん',
    prize_cost_2: 200,
    stock_2: 10,
    restock_2: 5,
    prize_name_3: null,
    prize_cost_3: null,
    stock_3: null,
    restock_3: null,
    prize_id: 'pid-001',
    prize_stock_count: 20,
    prize_restock_count: 8,
    theoretical_stock: 18,
    payout_rate: null,
    synced: true,
  }

  it('when_out2_baseline_row_seeded_should_return_non_null_history', () => {
    const history = buildBoothHistoryFromIdb([OUT2_ROW], 100, 10)
    expect(history).not.toBeNull()
    expect(history.length).toBe(1)
  })

  it('when_out2_baseline_row_seeded_should_retain_prize_name_2', () => {
    const history = buildBoothHistoryFromIdb([OUT2_ROW], 100, 10)
    expect(history[0].prize_name_2).toBe('ねこちゃん')
  })

  it('when_out2_baseline_row_seeded_should_retain_stock_2_and_restock_2', () => {
    const history = buildBoothHistoryFromIdb([OUT2_ROW], 100, 10)
    expect(history[0].stock_2).toBe(10)
    expect(history[0].restock_2).toBe(5)
  })

  it('when_out2_baseline_row_seeded_should_retain_prize_cost_2', () => {
    const history = buildBoothHistoryFromIdb([OUT2_ROW], 100, 10)
    expect(history[0].prize_cost_2).toBe(200)
  })

  it('when_out2_baseline_row_seeded_should_retain_prize_id_and_prize_cost_1', () => {
    const history = buildBoothHistoryFromIdb([OUT2_ROW], 100, 10)
    expect(history[0].prize_id).toBe('pid-001')
    expect(history[0].prize_cost_1).toBe(300)
  })
})

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-02: single-dispense regression (AC3)', () => {
  it('when_single_dispense_row_seeded_should_retain_in_out_meter_and_prize_fields', () => {
    const row = {
      reading_id: 'r-s1',
      booth_code: 'TST01-M01-001',
      store_code: 'TST01',
      patrol_date: '2026-06-30',
      created_at: '2026-06-30T10:00:00Z',
      in_meter: 2000,
      out_meter: 800,
      prize_name: 'いぬちゃん',
      prize_cost: 250,
      prize_stock_count: 15,
      prize_restock_count: 6,
      synced: true,
    }
    const history = buildBoothHistoryFromIdb([row], 100, 10)
    expect(history).not.toBeNull()
    expect(history[0].in_meter).toBe(2000)
    expect(history[0].out_meter).toBe(800)
    expect(history[0].prize_name).toBe('いぬちゃん')
    expect(history[0].prize_stock_count).toBe(15)
  })
})
