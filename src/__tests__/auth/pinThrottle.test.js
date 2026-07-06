// SPEC-AUTH-VERIFYPIN-TIMELOCK-01: verify-pin throttle helpers (pure)
import { describe, it, expect } from 'vitest'
import { throttleDelaySec, isStaffNotFound, failsSinceLastSuccess, writeAuthLog, updateUserMetaAsync } from '../../../supabase/functions/verify-pin/throttle.ts'
import { vi } from 'vitest'

describe('throttleDelaySec (AC1 curve — 5-attempt start)', () => {
  it('returns 0,0,0,0,4,8,8 for fail counts 1..7', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(throttleDelaySec)).toEqual([0, 0, 0, 0, 4, 8, 8])
  })
  it('caps at 8s for very high fail counts (>=50 backstop)', () => {
    expect(throttleDelaySec(50)).toBe(8)
    expect(throttleDelaySec(1000)).toBe(8)
  })
  it('grace for the first four fails, 4s on the fifth', () => {
    expect([1, 2, 3, 4].map(throttleDelaySec)).toEqual([0, 0, 0, 0])
    expect(throttleDelaySec(5)).toBe(4)
  })
})

describe('updateUserMetaAsync (AC2/AC3: single signIn, non-destructive meta refresh)', () => {
  const meta = { user_metadata: { role: 'admin' }, app_metadata: { role: 'admin' } }

  it('updates meta via updateUserById WITHOUT issuing a new session (fire-and-forget, returns void)', () => {
    const updateUserById = vi.fn().mockResolvedValue({})
    const signInWithPassword = vi.fn()
    const admin = { auth: { admin: { updateUserById }, signInWithPassword } }
    const r = updateUserMetaAsync(admin, 'u1', meta)
    expect(r).toBeUndefined()
    expect(updateUserById).toHaveBeenCalledWith('u1', meta)
    expect(signInWithPassword).not.toHaveBeenCalled() // no second signIn -> single-signIn success path
  })

  it('does not throw and does not break login when updateUserById rejects', async () => {
    const updateUserById = vi.fn().mockRejectedValue(new Error('meta boom'))
    const admin = { auth: { admin: { updateUserById } } }
    expect(() => updateUserMetaAsync(admin, 'u1', meta)).not.toThrow()
    await new Promise(r => setTimeout(r, 0)) // let the .then/.catch microtasks run
    expect(updateUserById).toHaveBeenCalled()
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

// SPEC-AUTH-AUTHLOGS-WAITUNTIL-AWAIT-01
describe('writeAuthLog (awaited, non-destructive)', () => {
  const row = { staff_id: 'S1', action: 'login_success', ip_address: 'x', user_agent: 'y' }

  it('awaits the insert (not fire-and-forget)', async () => {
    let resolveInsert
    const insert = vi.fn(() => new Promise(r => { resolveInsert = r }))
    const db = { from: () => ({ insert }) }
    let done = false
    const p = writeAuthLog(db, row).then(() => { done = true })
    await Promise.resolve()
    expect(insert).toHaveBeenCalledWith(row)
    expect(done).toBe(false) // still pending -> it is awaiting the insert
    resolveInsert({ error: null })
    await p
    expect(done).toBe(true)
  })

  it('swallows a thrown insert error (login not broken)', async () => {
    const db = { from: () => ({ insert: vi.fn().mockRejectedValue(new Error('boom')) }) }
    await expect(writeAuthLog(db, row)).resolves.toBeUndefined()
  })

  it('swallows a returned {error} (login not broken)', async () => {
    const db = { from: () => ({ insert: vi.fn().mockResolvedValue({ error: new Error('rls') }) }) }
    await expect(writeAuthLog(db, { ...row, action: 'login_failed' })).resolves.toBeUndefined()
  })
})
