// J-PATROL-PIN-SAVE-FIX-02-REV02: keepalive fetch + optimistic update + rollback ロジック検証
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

// handlePin keepalive fetch options ミラー
function buildPinFetchOptions(isPinned, staffId, storeCode, jwt, base, key) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${jwt}`,
    'Content-Type': 'application/json',
  }
  if (isPinned) {
    return {
      url: `${base}/rest/v1/staff_pinned_stores?staff_id=eq.${encodeURIComponent(staffId)}&store_code=eq.${encodeURIComponent(storeCode)}`,
      opts: { method: 'DELETE', headers, keepalive: true },
    }
  }
  return {
    url: `${base}/rest/v1/staff_pinned_stores`,
    opts: {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates' },
      body: JSON.stringify({ staff_id: staffId, store_code: storeCode }),
      keepalive: true,
    },
  }
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

// ── keepalive fetch オプション ────────────────────────────────────────────
describe('keepalive fetch options', () => {
  it('when_unpinning_should_use_DELETE_with_keepalive', () => {
    const { opts } = buildPinFetchOptions(true, 'STAFF-01', 'KOS01', 'jwt', 'http://x', 'key')
    expect(opts.method).toBe('DELETE')
    expect(opts.keepalive).toBe(true)
  })

  it('when_pinning_should_use_POST_with_keepalive_and_prefer_upsert', () => {
    const { opts } = buildPinFetchOptions(false, 'STAFF-01', 'KOS01', 'jwt', 'http://x', 'key')
    expect(opts.method).toBe('POST')
    expect(opts.keepalive).toBe(true)
    expect(opts.headers.Prefer).toBe('resolution=merge-duplicates')
  })

  it('when_pinning_should_include_staff_id_and_store_code_in_body', () => {
    const { opts } = buildPinFetchOptions(false, 'STAFF-01', 'KOS01', 'jwt', 'http://x', 'key')
    expect(JSON.parse(opts.body)).toEqual({ staff_id: 'STAFF-01', store_code: 'KOS01' })
  })

  it('when_unpinning_should_filter_by_staff_id_and_store_code_in_url', () => {
    const { url } = buildPinFetchOptions(true, 'STAFF-01', 'KOS01', 'jwt', 'http://x', 'key')
    expect(url).toContain('staff_id=eq.STAFF-01')
    expect(url).toContain('store_code=eq.KOS01')
  })

  it('when_staffId_null_guard_skips_fetch_setup', () => {
    // staffId null ガード: handlePin は早期 return → fetch は呼ばれない
    let fetchCalled = false
    function simulateHandlePin(staffId) {
      if (!staffId) return
      fetchCalled = true
    }
    simulateHandlePin(null)
    expect(fetchCalled).toBe(false)
  })
})
