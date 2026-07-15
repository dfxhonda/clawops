// @vitest-environment node
// SPEC-CASH-RECONCILE-PAGE-01 (D-067) AC1/AC2: 計算 + owner 表示分岐。
import { describe, it, expect } from 'vitest'
import {
  DENOMINATIONS, denomSubtotal, cashTotal, collectionsTotal, adjustmentsTotal,
  reconcileDifference, canManageAll, visibleReconciliations, canDeleteReconciliation,
} from '../../collection/lib/cashReconcileCalc'

describe('AC1: cash reconcile calc', () => {
  it('DENOMINATIONS = 10種 (10000..1)', () => {
    expect(DENOMINATIONS).toEqual([10000, 5000, 2000, 1000, 500, 100, 50, 10, 5, 1])
  })

  it('denomSubtotal = 額面×枚数、空/nullは0', () => {
    expect(denomSubtotal(10000, 3)).toBe(30000)
    expect(denomSubtotal(500, '4')).toBe(2000)
    expect(denomSubtotal(100, '')).toBe(0)
    expect(denomSubtotal(50, null)).toBe(0)
  })

  it('cashTotal: 全金種入力の境界', () => {
    const denom = { 10000: 2, 5000: 1, 2000: 3, 1000: 4, 500: 5, 100: 6, 50: 7, 10: 8, 5: 9, 1: 10 }
    // 20000+5000+6000+4000+2500+600+350+80+45+10
    expect(cashTotal(denom)).toBe(38585)
    expect(cashTotal({})).toBe(0)
    expect(cashTotal(null)).toBe(0)
  })

  it('collectionsTotal / adjustmentsTotal (調整は負値可)', () => {
    expect(collectionsTotal([{ total: 12000 }, { total: 8000 }])).toBe(20000)
    expect(collectionsTotal([])).toBe(0)
    expect(adjustmentsTotal([{ amount: 500 }, { amount: -1200 }])).toBe(-700)
    expect(adjustmentsTotal(null)).toBe(0)
  })

  it('reconcileDifference = cash - (collections + adjustments)、0/±', () => {
    expect(reconcileDifference(20000, 20000, 0)).toBe(0)       // 一致
    expect(reconcileDifference(20500, 20000, 0)).toBe(500)     // 余剰 +
    expect(reconcileDifference(19000, 20000, 0)).toBe(-1000)   // 不足 -
    expect(reconcileDifference(19000, 20000, -1000)).toBe(0)   // 調整負値で一致
  })
})

describe('AC2: owner visibility', () => {
  const rows = [
    { reconciliation_id: 'r1', created_by: 'S1' },
    { reconciliation_id: 'r2', created_by: 'S2' },
  ]
  it('manager/admin は全件、staff/patrol は本人のみ', () => {
    expect(canManageAll('manager')).toBe(true)
    expect(canManageAll('admin')).toBe(true)
    expect(canManageAll('staff')).toBe(false)
    expect(visibleReconciliations(rows, 'manager', 'S1')).toHaveLength(2)
    expect(visibleReconciliations(rows, 'staff', 'S1')).toEqual([rows[0]])
    expect(visibleReconciliations(rows, 'patrol', 'S2')).toEqual([rows[1]])
  })
  it('削除ボタンは本人の行のみ', () => {
    expect(canDeleteReconciliation(rows[0], 'S1')).toBe(true)
    expect(canDeleteReconciliation(rows[0], 'S2')).toBe(false)
    expect(canDeleteReconciliation(rows[0], null)).toBe(false)
  })
})
