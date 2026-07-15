// @vitest-environment node
// SPEC-CASH-RECONCILE-PAGE-01 (D-067) AC3: insert payload org=CHANGE + created_by。AC2: list role 絞り。
import { describe, it, expect, vi } from 'vitest'

let sb
vi.mock('../../lib/supabase', () => ({ get supabase() { return sb } }))
vi.mock('../../lib/auth/orgConstants', () => ({ CHANGE_ORG_ID: 'CHANGE-org' }))

const { insertReconciliation, listReconciliations } = await import('../../services/cashReconcile')

describe('AC3: insertReconciliation payload', () => {
  it('organization_id=CHANGE + created_by=staffId + 正規化された数値/配列', async () => {
    let captured
    sb = { from: () => ({
      insert: p => { captured = p; return { select: () => ({ single: async () => ({ data: { ...p, reconciliation_id: 'new' }, error: null }) }) } },
    }) }
    await insertReconciliation({
      denominations: { 10000: 2 }, cashTotal: 20000,
      collectionIds: ['c1', 'c2'], collectionsTotal: 20000,
      adjustments: [{ amount: -500, note: '釣銭持出' }], adjustmentsTotal: -500,
      difference: 500, note: 'テスト', staffId: 'STAFF01',
    })
    expect(captured.organization_id).toBe('CHANGE-org')
    expect(captured.created_by).toBe('STAFF01')
    expect(captured.collection_ids).toEqual(['c1', 'c2'])
    expect(captured.cash_total).toBe(20000)
    expect(captured.difference).toBe(500)
    expect(captured.denominations).toEqual({ 10000: 2 })
  })

  it('note 空は null 保存', async () => {
    let captured
    sb = { from: () => ({ insert: p => { captured = p; return { select: () => ({ single: async () => ({ data: p, error: null }) }) } } }) }
    await insertReconciliation({ denominations: {}, cashTotal: 0, collectionIds: [], collectionsTotal: 0, adjustments: [], adjustmentsTotal: 0, difference: 0, note: '', staffId: 'S1' })
    expect(captured.note).toBeNull()
  })
})

describe('AC2: listReconciliations role 絞り', () => {
  function listMock(eqSpy) {
    const chain = {
      select: () => chain, order: () => chain,
      eq: (c, v) => { eqSpy(c, v); return chain },
      then: (res) => res({ data: [], error: null }),
    }
    return { from: () => chain }
  }
  it('staff は created_by で絞る', async () => {
    const eqSpy = vi.fn(); sb = listMock(eqSpy)
    await listReconciliations({ staffRole: 'staff', staffId: 'S1' })
    expect(eqSpy).toHaveBeenCalledWith('created_by', 'S1')
  })
  it('manager は絞らない (全件)', async () => {
    const eqSpy = vi.fn(); sb = listMock(eqSpy)
    await listReconciliations({ staffRole: 'manager', staffId: 'S1' })
    expect(eqSpy).not.toHaveBeenCalled()
  })
})
