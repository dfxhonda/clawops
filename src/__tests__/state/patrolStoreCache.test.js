// SPEC-PATROL-SAVE-LATENCY-FIX-01: patrolStoreCache module-level Map の挙動検証
import { describe, it, expect, beforeEach } from 'vitest'
import {
  getStoreCache,
  setStoreCache,
  patchBoothSummary,
  patchBoothTodayMap,
  invalidateStoreCache,
  _peekCache,
} from '../../clawsupport/state/patrolStoreCache'

beforeEach(() => {
  invalidateStoreCache() // 全 clear
})

describe('patrolStoreCache', () => {
  it('when_no_entry_should_return_null', () => {
    expect(getStoreCache('MNK01')).toBe(null)
  })

  it('setStoreCache_then_getStoreCache_returns_same_shape', () => {
    setStoreCache('MNK01', {
      storeName: '南熊本店',
      machines: [{ machine_code: 'M01' }],
      todayMap: { 'A-1': { readingId: 'r1', readTime: 't1' } },
      diffMap: { 'A-1': { inDiffs: [null, null, null, 100] } },
    })
    const got = getStoreCache('MNK01')
    expect(got.storeName).toBe('南熊本店')
    expect(got.machines).toEqual([{ machine_code: 'M01' }])
    expect(got.diffMap['A-1'].inDiffs).toEqual([null, null, null, 100])
    expect(typeof got.ts).toBe('number')
  })

  it('patchBoothSummary_updates_only_target_booth_leaves_others', () => {
    setStoreCache('MNK01', {
      storeName: 'x',
      machines: [],
      todayMap: {},
      diffMap: {
        'A-1': { inDiffs: [null, null, null, 100] },
        'A-2': { inDiffs: [null, null, null, 200] },
      },
    })
    patchBoothSummary('MNK01', 'A-1', { inDiffs: [1, 2, 3, 999] })
    const got = getStoreCache('MNK01')
    expect(got.diffMap['A-1'].inDiffs).toEqual([1, 2, 3, 999])
    expect(got.diffMap['A-2'].inDiffs).toEqual([null, null, null, 200])
  })

  it('patchBoothTodayMap_updates_only_target_booth', () => {
    setStoreCache('MNK01', {
      storeName: 'x',
      machines: [],
      todayMap: { 'A-1': { readingId: 'old' } },
      diffMap: {},
    })
    patchBoothTodayMap('MNK01', 'A-1', { readingId: 'new', readTime: 'now' })
    patchBoothTodayMap('MNK01', 'A-2', { readingId: 'r2', readTime: 'now' })
    const got = getStoreCache('MNK01')
    expect(got.todayMap['A-1'].readingId).toBe('new')
    expect(got.todayMap['A-2'].readingId).toBe('r2')
  })

  it('patchBoothSummary_no_entry_is_noop_no_crash', () => {
    expect(() => patchBoothSummary('MISSING', 'X-1', {})).not.toThrow()
    expect(getStoreCache('MISSING')).toBe(null)
  })

  it('patchBoothSummary_creates_new_diffMap_object_for_immutability', () => {
    setStoreCache('MNK01', {
      storeName: 'x',
      machines: [],
      todayMap: {},
      diffMap: { 'A-1': { inDiffs: [null, null, null, 100] } },
    })
    const before = getStoreCache('MNK01').diffMap
    patchBoothSummary('MNK01', 'A-1', { inDiffs: [1, 2, 3, 200] })
    const after = getStoreCache('MNK01').diffMap
    expect(after).not.toBe(before) // 参照が変わる (React state setter 等価検出に効く)
  })

  it('invalidateStoreCache_with_code_removes_only_that_store', () => {
    setStoreCache('MNK01', { storeName: 'x', machines: [], todayMap: {}, diffMap: {} })
    setStoreCache('KOS01', { storeName: 'y', machines: [], todayMap: {}, diffMap: {} })
    invalidateStoreCache('MNK01')
    expect(getStoreCache('MNK01')).toBe(null)
    expect(getStoreCache('KOS01')).not.toBe(null)
  })

  it('invalidateStoreCache_no_arg_clears_all', () => {
    setStoreCache('MNK01', { storeName: 'x', machines: [], todayMap: {}, diffMap: {} })
    setStoreCache('KOS01', { storeName: 'y', machines: [], todayMap: {}, diffMap: {} })
    invalidateStoreCache()
    expect(_peekCache().size).toBe(0)
  })

  it('null_storeCode_to_setStoreCache_is_noop', () => {
    setStoreCache(null, { storeName: 'x' })
    setStoreCache('', { storeName: 'y' })
    expect(_peekCache().size).toBe(0)
  })
})
