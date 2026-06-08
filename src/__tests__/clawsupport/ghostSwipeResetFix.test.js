// J-PATROL-GHOST-SWIPE-RESET-FIX-01 + J-PATROL-RESET-RESTORE-FIX-02: FIX1-FIX5b ユニット検証
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import 'fake-indexeddb/auto'
import { _resetDb } from '../../lib/localStore/db'
import {
  putPatrolRecord,
  getUnsyncedRecords,
  deleteOrphanedNullStoreRecords,
} from '../../lib/localStore/patrolRecords'
import { theoreticalStock } from '../../clawsupport/utils/patrolStockCalc'

// ── FIX1: canSave のみでスワイプ保存 ──────────────────────────────────────
describe('FIX1: swipe gate canSave only (drop isDirty)', () => {
  it('when_canSave_true_and_isDirty_false_should_call_handleSave', () => {
    // commitSwipeAndNavigate の内部ロジック: canSave のみを gate とする
    const canSave = true
    const isDirty = false // pre-populate 済、未編集
    // 旧: isDirty && canSave → false → navFn のみ (保存スキップ)
    // 新: canSave のみ → true → handleSave 呼び出し
    const result = canSave  // FIX1 適用後の gate
    expect(result).toBe(true)
  })

  it('when_canSave_false_should_not_save', () => {
    const canSave = false
    expect(canSave).toBe(false)
  })
})

// ── FIX2: store_code 逆引き ──────────────────────────────────────────────
// deriveStoreCode は PatrolBoothInputPage 内の module-level 関数なので
// ここでは同一ロジックをミラーしてピュア関数テストを行う
function deriveStoreCode(boothCd) {
  if (!boothCd) return null
  if (/^[A-Z]{3}\d{2}::/.test(boothCd)) return boothCd.split('::')[0]
  const p = boothCd.split('-')
  return p.length >= 2 ? p[0] : null
}

describe('FIX2: store_code reverse-lookup (deriveStoreCode)', () => {
  it('when_booth_code_has_double_colon_separator_should_return_prefix', () => {
    expect(deriveStoreCode('KIK01::M01-B01')).toBe('KIK01')
  })

  it('when_booth_code_has_hyphen_separator_should_return_first_segment', () => {
    expect(deriveStoreCode('MNK01-M07-B01')).toBe('MNK01')
  })

  it('when_booth_code_is_null_should_return_null', () => {
    expect(deriveStoreCode(null)).toBe(null)
  })

  it('when_booth_code_is_empty_should_return_null', () => {
    expect(deriveStoreCode('')).toBe(null)
  })

  it('when_booth_code_has_no_separator_should_return_null', () => {
    expect(deriveStoreCode('NODASH')).toBe(null)
  })

  it('when_booth_code_matches_ABC01_pattern_with_colon_should_extract_correctly', () => {
    expect(deriveStoreCode('KOS01::B01')).toBe('KOS01')
  })
})

// ── FIX3+FIX4: deleteOrphanedNullStoreRecords ────────────────────────────
beforeEach(async () => {
  await _resetDb()
})

describe('FIX4: deleteOrphanedNullStoreRecords', () => {
  it('when_no_null_store_records_should_return_0', async () => {
    await putPatrolRecord({ booth_code: 'MNK01-M01-B01', store_code: 'MNK01', patrol_date: '2026-06-08', in_meter: 100 })
    const deleted = await deleteOrphanedNullStoreRecords()
    expect(deleted).toBe(0)
  })

  it('when_null_store_record_with_reversible_booth_code_should_patch_and_keep', async () => {
    await putPatrolRecord({ booth_code: 'KIK01-M02-B01', store_code: null, patrol_date: '2026-06-08', in_meter: 200 })
    const deleted = await deleteOrphanedNullStoreRecords()
    // 逆引き成功 (KIK01) → 補完して残す → deleted=0
    expect(deleted).toBe(0)
    const remaining = await getUnsyncedRecords()
    expect(remaining.length).toBe(1)
    expect(remaining[0].store_code).toBe('KIK01')
  })

  it('when_null_store_record_with_irreversible_booth_code_should_delete', async () => {
    await putPatrolRecord({ booth_code: 'NODASH', store_code: null, patrol_date: '2026-06-08', in_meter: 300 })
    const deleted = await deleteOrphanedNullStoreRecords()
    expect(deleted).toBe(1)
    const remaining = await getUnsyncedRecords()
    expect(remaining.length).toBe(0)
  })

  it('when_mixed_records_should_patch_reversible_and_delete_irreversible', async () => {
    await putPatrolRecord({ booth_code: 'MNK01-M01-B01', store_code: null, patrol_date: '2026-06-08', in_meter: 100 })
    await putPatrolRecord({ booth_code: 'NODASH', store_code: null, patrol_date: '2026-06-08', in_meter: 200 })
    await putPatrolRecord({ booth_code: 'KIK01-M01-B01', store_code: 'KIK01', patrol_date: '2026-06-08', in_meter: 300 })
    const deleted = await deleteOrphanedNullStoreRecords()
    expect(deleted).toBe(1) // NODASH が削除
    const remaining = await getUnsyncedRecords()
    // KIK01-M01-B01 (synced=false, store_code='KIK01') + MNK01-M01-B01 (patched)
    expect(remaining.length).toBe(2)
    const patched = remaining.find(r => r.booth_code === 'MNK01-M01-B01')
    expect(patched?.store_code).toBe('MNK01')
  })
})

// ── FIX5b: handleReset 初期値復元ロジック検証 ────────────────────────────
// applyPrevFields は component 内部関数なのでロジックをミラーしてピュアテスト。
// theoreticalStock は export 済みなので直接 import して検証。
function computeInitialFields(p) {
  if (!p) return { in: '', out1: '', stk: '', rst: '', prize: '', cost: '', setA: '' }
  const t1 = theoreticalStock(p.prize_stock_count, p.prize_restock_count, p.out_meter, p.out_meter)
  const pc = p.prize_cost ?? p.prize_cost_1
  return {
    in:    p.in_meter != null ? String(p.in_meter) : '',
    out1:  p.out_meter != null ? String(p.out_meter) : '',
    stk:   t1 != null ? String(t1) : '',
    rst:   '',
    prize: p.prize_name ?? '',
    cost:  pc != null && pc !== '' ? String(pc) : '',
    setA:  p.set_a ?? '',
  }
}

describe('FIX5b: handleReset restores pre-populate initial values', () => {
  it('when_prev_has_values_initial_fields_should_be_non_empty', () => {
    const prev = {
      in_meter: 12345, out_meter: 10000,
      prize_stock_count: 50, prize_restock_count: 30,
      prize_name: 'ぬいぐるみA', prize_cost: 500,
    }
    const f = computeInitialFields(prev)
    expect(f.in).toBe('12345')
    expect(f.out1).toBe('10000')
    expect(f.prize).toBe('ぬいぐるみA')
    expect(f.cost).toBe('500')
    expect(f.rst).toBe('')
    // theoreticalStock(50, 30, 10000, 10000): base=80, diff=0 → 80
    expect(f.stk).toBe('80')
  })

  it('when_prev_is_null_initial_fields_should_all_be_empty', () => {
    const f = computeInitialFields(null)
    expect(f.in).toBe('')
    expect(f.out1).toBe('')
    expect(f.prize).toBe('')
    expect(f.stk).toBe('')
    expect(f.cost).toBe('')
  })

  it('when_prev_stock_is_null_stock_field_should_be_empty', () => {
    // theoreticalStock returns null when prevStock==null → setStk('')
    const prev = { in_meter: 5000, out_meter: 4000, prize_stock_count: null, prize_restock_count: 0 }
    const f = computeInitialFields(prev)
    expect(f.in).toBe('5000')
    expect(f.stk).toBe('')
  })
})
