// SPEC-PATROL-ISDIRTY-FIX-01 + SPEC-PATROL-BOOTH-BACK-SAVE-CONFIRM-01 C4
// Regression: isDirty only checked meter fields, ignoring prize/settings touches.
// C4 adds slot-1 stock/restock (was missing, causing back-dialog to skip when stock touched).

import { describe, it, expect } from 'vitest'

// Mirrors the production isDirty expression in PatrolBoothInputPage after the C4 fix.
function computeIsDirty(touched) {
  return !!(
    touched.inMeter    ||
    touched.outMeter1  ||
    touched.outMeter2  ||
    touched.outMeter3  ||
    touched.prizeName  ||
    touched.prizeCost  ||
    touched.setA       ||
    touched.setC       ||
    touched.setL       ||
    touched.setR       ||
    touched.setO       ||
    touched.stock2     ||
    touched.restock2   ||
    touched.prizeName2 ||
    touched.prizeCost2 ||
    touched.stock3     ||
    touched.restock3   ||
    touched.prizeName3 ||
    touched.prizeCost3 ||
    touched.stock      ||
    touched.restock
  )
}

describe('isDirty (PatrolBoothInputPage swipe-save gate)', () => {
  it('when_nothing_touched_should_not_be_dirty', () => {
    expect(computeIsDirty({})).toBe(false)
  })

  it('when_inMeter_touched_should_be_dirty', () => {
    expect(computeIsDirty({ inMeter: true })).toBe(true)
  })

  // Regression cases: before fix these returned false → swipe never saved for 入替/設定変更
  it('when_only_prizeName_touched_should_be_dirty', () => {
    expect(computeIsDirty({ prizeName: true })).toBe(true)
  })

  it('when_only_setA_touched_should_be_dirty', () => {
    expect(computeIsDirty({ setA: true })).toBe(true)
  })

  it('when_only_setC_touched_should_be_dirty', () => {
    expect(computeIsDirty({ setC: true })).toBe(true)
  })

  it('when_only_setL_touched_should_be_dirty', () => {
    expect(computeIsDirty({ setL: true })).toBe(true)
  })

  it('when_only_setR_touched_should_be_dirty', () => {
    expect(computeIsDirty({ setR: true })).toBe(true)
  })

  it('when_only_setO_touched_should_be_dirty', () => {
    expect(computeIsDirty({ setO: true })).toBe(true)
  })

  it('when_prizeName2_touched_should_be_dirty', () => {
    expect(computeIsDirty({ prizeName2: true })).toBe(true)
  })

  it('when_stock3_touched_should_be_dirty', () => {
    expect(computeIsDirty({ stock3: true })).toBe(true)
  })

  // C4 regression cases: slot-1 stock/restock were missing before the fix
  it('when_only_stock_touched_should_be_dirty', () => {
    expect(computeIsDirty({ stock: true })).toBe(true)
  })

  it('when_only_restock_touched_should_be_dirty', () => {
    expect(computeIsDirty({ restock: true })).toBe(true)
  })
})
