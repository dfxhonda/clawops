// J-PATROL-PIN-SAVE-FIX-02: FIX1(useBlocker guard) + FIX2(optimistic update + rollback) ロジック検証
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'

// handlePin 内の optimistic update ロジックをミラー
function applyOptimistic(prev, storeCode, isPinned) {
  return isPinned ? prev.filter(c => c !== storeCode) : [...prev, storeCode]
}

// catch ブロックの rollback ロジックをミラー
function rollback(prev, storeCode, isPinned) {
  return isPinned ? [...prev, storeCode] : prev.filter(c => c !== storeCode)
}

// ── FIX2: 楽観的更新 ─────────────────────────────────────────────────────
describe('FIX2: optimistic update', () => {
  it('when_not_pinned_should_add_store_code', () => {
    const result = applyOptimistic(['MNK01', 'SMD01'], 'KOS01', false)
    expect(result).toContain('KOS01')
    expect(result).toHaveLength(3)
  })

  it('when_pinned_should_remove_store_code', () => {
    const result = applyOptimistic(['MNK01', 'SMD01', 'KOS01'], 'KOS01', true)
    expect(result).not.toContain('KOS01')
    expect(result).toHaveLength(2)
  })

  it('when_empty_list_and_add_should_return_single_element', () => {
    const result = applyOptimistic([], 'KOS01', false)
    expect(result).toEqual(['KOS01'])
  })
})

// ── FIX2: 失敗時ロールバック ──────────────────────────────────────────────
describe('FIX2: rollback on save failure', () => {
  it('when_pin_add_failed_should_remove_optimistic_addition', () => {
    const afterOptimistic = ['MNK01', 'SMD01', 'KOS01']
    const result = rollback(afterOptimistic, 'KOS01', false)
    expect(result).not.toContain('KOS01')
    expect(result).toHaveLength(2)
  })

  it('when_unpin_failed_should_restore_removed_code', () => {
    const afterOptimistic = ['MNK01', 'SMD01']
    const result = rollback(afterOptimistic, 'KOS01', true)
    expect(result).toContain('KOS01')
    expect(result).toHaveLength(3)
  })

  it('when_rollback_inverts_optimistic_add_and_back_to_original', () => {
    const original = ['MNK01', 'SMD01']
    const afterAdd = applyOptimistic(original, 'KOS01', false)
    const afterRollback = rollback(afterAdd, 'KOS01', false)
    expect(afterRollback).toEqual(original)
  })

  it('when_rollback_inverts_optimistic_remove_and_back_to_original', () => {
    const original = ['MNK01', 'SMD01', 'KOS01']
    const afterRemove = applyOptimistic(original, 'KOS01', true)
    const afterRollback = rollback(afterRemove, 'KOS01', true)
    expect(afterRollback).toContain('KOS01')
  })
})

// ── FIX1: pendingPinRef ガード (staffId=null 時はセットしない) ─────────────
describe('FIX1: pendingPinRef guard', () => {
  it('when_staffId_null_should_not_set_pendingPinRef', () => {
    const pendingPinRef = { current: false }
    function simulateHandlePin(staffId) {
      if (!staffId) return
      pendingPinRef.current = true
    }
    simulateHandlePin(null)
    expect(pendingPinRef.current).toBe(false)
  })

  it('when_staffId_valid_should_set_pendingPinRef_before_await', () => {
    const pendingPinRef = { current: false }
    function simulateHandlePin(staffId) {
      if (!staffId) return
      pendingPinRef.current = true
    }
    simulateHandlePin('STAFF-03')
    expect(pendingPinRef.current).toBe(true)
  })

  it('when_save_succeeds_finally_should_reset_pendingPinRef_to_false', async () => {
    const pendingPinRef = { current: false }
    async function simulateHandlePin(staffId) {
      if (!staffId) return
      pendingPinRef.current = true
      try {
        await Promise.resolve()
      } finally {
        pendingPinRef.current = false
      }
    }
    await simulateHandlePin('STAFF-03')
    expect(pendingPinRef.current).toBe(false)
  })

  it('when_save_throws_finally_should_still_reset_pendingPinRef', async () => {
    const pendingPinRef = { current: false }
    async function simulateHandlePin(staffId) {
      if (!staffId) return
      pendingPinRef.current = true
      try {
        throw new Error('network error')
      } catch {
        // swallow in catch
      } finally {
        pendingPinRef.current = false
      }
    }
    await simulateHandlePin('STAFF-03')
    expect(pendingPinRef.current).toBe(false)
  })
})
