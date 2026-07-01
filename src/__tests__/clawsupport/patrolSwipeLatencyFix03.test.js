// SPEC-PATROL-SWIPE-LATENCY-FIX-03
// AC1: patrolPrevHold.js module shape mirrors swipeTransition.js
// AC2: setPrevHold / getPrevHold basic behavior
// AC5: unsynced wins — latestUnsynced check comes before getPrevHold in fetchPrev (CRITICAL)
// AC6: clearPrevHold removes entries for that store
// AC7: getPrevHold miss returns null (falls through to tier-2/3)
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect, beforeEach } from 'vitest'
import {
  setPrevHold,
  getPrevHold,
  clearPrevHold,
  _resetPrevHold,
} from '../../clawsupport/state/patrolPrevHold'

const holdSrc = readFileSync(
  resolve(__dirname, '../../clawsupport/state/patrolPrevHold.js'),
  'utf-8',
)
const patrolInputSrc = readFileSync(
  resolve(__dirname, '../../clawsupport/pages/PatrolBoothInputPage.jsx'),
  'utf-8',
)
const storePageSrc = readFileSync(
  resolve(__dirname, '../../clawsupport/pages/PatrolStorePage.jsx'),
  'utf-8',
)

beforeEach(() => {
  _resetPrevHold()
})

const PREV_ROW = {
  reading_id: 'r-001',
  booth_code: 'TST01-M04-001',
  patrol_date: '2026-06-30',
  in_meter: 1000,
  out_meter: 500,
  prize_name: 'くまちゃん',
  prize_name_2: 'ねこちゃん',
  stock_2: 10,
  restock_2: 5,
  synced: true,
}

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-03: patrolPrevHold module shape (AC1)', () => {
  it('when_module_created_should_export_setPrevHold', () => {
    expect(holdSrc).toContain('export function setPrevHold')
  })
  it('when_module_created_should_export_getPrevHold', () => {
    expect(holdSrc).toContain('export function getPrevHold')
  })
  it('when_module_created_should_export_clearPrevHold', () => {
    expect(holdSrc).toContain('export function clearPrevHold')
  })
  it('when_module_created_should_export_resetPrevHold', () => {
    expect(holdSrc).toContain('export function _resetPrevHold')
  })
  it('when_module_created_should_use_module_level_Map', () => {
    expect(holdSrc).toContain('new Map()')
  })
})

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-03: setPrevHold / getPrevHold (AC2)', () => {
  it('when_hold_populated_should_return_prev_row_for_known_booth', () => {
    setPrevHold('TST01', { 'TST01-M04-001': PREV_ROW })
    expect(getPrevHold('TST01-M04-001')).toEqual(PREV_ROW)
  })

  it('when_hold_populated_should_carry_out2_fields', () => {
    setPrevHold('TST01', { 'TST01-M04-001': PREV_ROW })
    const held = getPrevHold('TST01-M04-001')
    expect(held.prize_name_2).toBe('ねこちゃん')
    expect(held.stock_2).toBe(10)
    expect(held.restock_2).toBe(5)
  })

  it('when_hold_set_for_new_store_should_replace_previous_store_entries', () => {
    setPrevHold('TST01', { 'TST01-M01-001': PREV_ROW })
    setPrevHold('KKY01', { 'KKY01-M01-001': { ...PREV_ROW, booth_code: 'KKY01-M01-001' } })
    expect(getPrevHold('TST01-M01-001')).toBeNull()
    expect(getPrevHold('KKY01-M01-001')).not.toBeNull()
  })
})

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-03: unsynced wins over hold (AC5 CRITICAL)', () => {
  it('when_fetchPrev_source_latestUnsynced_check_must_precede_getPrevHold_call', () => {
    const unsyncedPos = patrolInputSrc.indexOf('latestUnsynced')
    const holdPos = patrolInputSrc.indexOf('getPrevHold(boothCode)')
    expect(unsyncedPos).toBeGreaterThan(-1)
    expect(holdPos).toBeGreaterThan(-1)
    expect(unsyncedPos).toBeLessThan(holdPos)
  })

  it('when_fetchPrev_source_tier0_should_only_trigger_when_no_unsynced_record', () => {
    // tier-0 must be inside the else/fallthrough after the unsynced tier-1 return
    // Verify: the return after latestUnsynced appears before getPrevHold in source
    const tier1ReturnPos = patrolInputSrc.indexOf('if (latestUnsynced)')
    const holdPos = patrolInputSrc.indexOf('getPrevHold(boothCode)')
    expect(tier1ReturnPos).toBeGreaterThan(-1)
    expect(holdPos).toBeGreaterThan(-1)
    expect(tier1ReturnPos).toBeLessThan(holdPos)
  })
})

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-03: clearPrevHold (AC6)', () => {
  it('when_clearPrevHold_called_with_matching_store_should_remove_all_entries', () => {
    setPrevHold('TST01', { 'TST01-M01-001': PREV_ROW })
    clearPrevHold('TST01')
    expect(getPrevHold('TST01-M01-001')).toBeNull()
  })

  it('when_clearPrevHold_called_with_null_should_clear_regardless_of_store', () => {
    setPrevHold('TST01', { 'TST01-M01-001': PREV_ROW })
    clearPrevHold(null)
    expect(getPrevHold('TST01-M01-001')).toBeNull()
  })
})

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-03: getPrevHold miss = null (AC7)', () => {
  it('when_hold_empty_should_return_null_for_any_booth', () => {
    expect(getPrevHold('TST01-M99-001')).toBeNull()
  })

  it('when_booth_not_in_hold_should_return_null', () => {
    setPrevHold('TST01', { 'TST01-M01-001': PREV_ROW })
    expect(getPrevHold('TST01-M99-999')).toBeNull()
  })
})

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-03: PatrolStorePage wires hold (integration source check)', () => {
  it('when_storepage_should_import_setPrevHold', () => {
    expect(storePageSrc).toContain('setPrevHold')
  })
  it('when_storepage_should_import_clearPrevHold', () => {
    expect(storePageSrc).toContain('clearPrevHold')
  })
  it('when_storepage_should_call_setPrevHold_after_putBaselineRows', () => {
    const putPos = storePageSrc.indexOf('putBaselineRows(rows)')
    const setPosAll = storePageSrc.indexOf('setPrevHold(storeCode')
    expect(putPos).toBeGreaterThan(-1)
    expect(setPosAll).toBeGreaterThan(-1)
    expect(setPosAll).toBeGreaterThan(putPos)
  })
})

describe('SPEC-PATROL-SWIPE-LATENCY-FIX-03: PatrolBoothInputPage wires tier-0 (source check)', () => {
  it('when_fetchPrev_should_import_getPrevHold', () => {
    expect(patrolInputSrc).toContain('getPrevHold')
  })
  it('when_tier0_hit_should_call_setPrev_with_held_value', () => {
    expect(patrolInputSrc).toContain('setPrev(held)')
  })
})
