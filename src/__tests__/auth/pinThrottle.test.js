// SPEC-AUTH-VERIFYPIN-TIMELOCK-01: verify-pin throttle helpers (pure)
import { describe, it, expect } from 'vitest'
import { throttleDelaySec, isStaffNotFound, failsSinceLastSuccess } from '../../../supabase/functions/verify-pin/throttle.ts'

describe('throttleDelaySec (AC1 curve)', () => {
  it('returns 0,0,1,2,4,8,8 for fail counts 1..7', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(throttleDelaySec)).toEqual([0, 0, 1, 2, 4, 8, 8])
  })
  it('caps at 8s for very high fail counts (>=50 backstop)', () => {
    expect(throttleDelaySec(50)).toBe(8)
    expect(throttleDelaySec(1000)).toBe(8)
  })
  it('grace for the first two fails', () => {
    expect(throttleDelaySec(1)).toBe(0)
    expect(throttleDelaySec(2)).toBe(0)
  })
})

describe('isStaffNotFound (AC5 enumeration safety)', () => {
  it('true only for the not-found message', () => {
    expect(isStaffNotFound('スタッフが見つかりません')).toBe(true)
    expect(isStaffNotFound('暗証番号が違います')).toBe(false)
    expect(isStaffNotFound(null)).toBe(false)
    expect(isStaffNotFound(undefined)).toBe(false)
    expect(isStaffNotFound('')).toBe(false)
  })
})

describe('failsSinceLastSuccess (reset-on-success + rolling window)', () => {
  const desc = (...actions) => actions.map(a => ({ action: a }))
  it('counts consecutive recent fails (desc order)', () => {
    expect(failsSinceLastSuccess(desc('login_failed', 'login_failed', 'login_failed'))).toBe(3)
  })
  it('stops counting at the most recent login_success (reset point)', () => {
    // most recent first: 2 fails, then a success -> older fails do NOT count
    expect(failsSinceLastSuccess(desc('login_failed', 'login_failed', 'login_success', 'login_failed', 'login_failed'))).toBe(2)
  })
  it('returns 0 when the most recent event is a success', () => {
    expect(failsSinceLastSuccess(desc('login_success', 'login_failed', 'login_failed'))).toBe(0)
  })
  it('returns 0 for no rows', () => {
    expect(failsSinceLastSuccess([])).toBe(0)
  })
})
