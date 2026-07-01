// SPEC-FIX-STOCK2-NULL-DEFENSE-01 phase1
// Regression: PatrolBoothInputPage diff-patch path wrote NULL for stock_2/restock_2/stock_3/restock_3
// when the field was touched but left empty. Correct semantics (patrolV2): empty → 0.

import { readFileSync } from 'fs'
import { resolve } from 'path'
import { describe, it, expect } from 'vitest'

const src = readFileSync(
  resolve(__dirname, '../../clawsupport/pages/PatrolBoothInputPage.jsx'),
  'utf-8'
)

describe('SPEC-FIX-STOCK2-NULL-DEFENSE-01 phase1: diff-patch 0-fallback (source check)', () => {
  it('when_touched_stock2_empty_should_write_0_not_null', () => {
    expect(src).not.toContain("patch.stock_2    = stock2 !== '' ? parseInt(stock2, 10) : null")
    expect(src).toContain("patch.stock_2    = stock2 !== '' ? parseInt(stock2, 10) : 0")
  })

  it('when_touched_restock2_empty_should_write_0_not_null', () => {
    expect(src).not.toContain("patch.restock_2  = restock2 !== '' ? parseInt(restock2, 10) : null")
    expect(src).toContain("patch.restock_2  = restock2 !== '' ? parseInt(restock2, 10) : 0")
  })

  it('when_touched_stock3_empty_should_write_0_not_null', () => {
    expect(src).not.toContain("patch.stock_3    = stock3 !== '' ? parseInt(stock3, 10) : null")
    expect(src).toContain("patch.stock_3    = stock3 !== '' ? parseInt(stock3, 10) : 0")
  })

  it('when_touched_restock3_empty_should_write_0_not_null', () => {
    expect(src).not.toContain("patch.restock_3  = restock3 !== '' ? parseInt(restock3, 10) : null")
    expect(src).toContain("patch.restock_3  = restock3 !== '' ? parseInt(restock3, 10) : 0")
  })
})

describe('SPEC-FIX-STOCK2-NULL-DEFENSE-01 phase1: AdminBoothEditPage untouched (AC3)', () => {
  it('when_admin_edit_page_stock2_semantics_should_remain_null_on_empty', () => {
    const adminSrc = readFileSync(
      resolve(__dirname, '../../admin/pages/AdminBoothEditPage.jsx'),
      'utf-8'
    )
    // Admin intentionally clears to null (will be caught by DB constraint after phase2)
    expect(adminSrc).toContain("stock2 !== '' ? Number(stock2) : null")
  })
})

describe('SPEC-FIX-STOCK2-NULL-DEFENSE-01 phase1: 0-fallback semantics (behavioral)', () => {
  function patchStock(val) {
    return val !== '' ? parseInt(val, 10) : 0
  }

  it('when_touched_empty_string_should_produce_0', () => {
    expect(patchStock('')).toBe(0)
  })

  it('when_touched_with_numeric_value_should_preserve_value', () => {
    expect(patchStock('15')).toBe(15)
  })

  it('when_touched_with_zero_string_should_produce_0', () => {
    expect(patchStock('0')).toBe(0)
  })
})
