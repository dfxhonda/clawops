// ============================================
// 結合テスト: 在庫移動→履歴反映フロー
// transferStock → prize_stocks更新 → stock_movements作成 → 監査ログ
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockSupabase } from '../helpers/supabaseMock'
import { makeStockRecord, makeSession } from '../helpers/fixtures'
import { resetFixtureIds } from '../helpers/fixtures'

let mockSupabase
vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))

const { transferStock } = await import('../../services/movements')
const { clearCache } = await import('../../services/utils')

const flush = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  resetFixtureIds()
  clearCache()
  mockSupabase = createMockSupabase({
    prize_stocks: [
      makeStockRecord({ stock_id: 'FROM-1', prize_id: 'PZ001', owner_type: 'location', owner_id: 'LOC01', quantity: 20 }),
      makeStockRecord({ stock_id: 'TO-1', prize_id: 'PZ001', owner_type: 'staff', owner_id: 'STAFF01', quantity: 3 }),
    ],
    stock_movements: [],
    audit_logs: [],
  }, makeSession())
})

describe('在庫移動→履歴反映フロー', () => {

  it('正常移動: from減少、to増加、movement作成', async () => {
    await transferStock({
      prizeId: 'PZ001', prizeName: 'テスト景品A',
      fromOwnerType: 'location', fromOwnerId: 'LOC01',
      toOwnerType: 'staff', toOwnerId: 'STAFF01',
      quantity: 5, createdBy: 'STAFF01',
    })

    const stocks = mockSupabase._getTable('prize_stocks')
    const from = stocks.find(s => s.stock_id === 'FROM-1')
    const to = stocks.find(s => s.stock_id === 'TO-1')
    expect(from.quantity).toBe(15) // 20 - 5
    expect(to.quantity).toBe(8)    // 3 + 5

    const movements = mockSupabase._getTable('stock_movements')
    expect(movements.length).toBe(1)
    expect(movements[0].movement_type).toBe('transfer')
    expect(movements[0].quantity).toBe(5)
  })

  it('移動先に在庫なし: 新規レコード作成', async () => {
    await transferStock({
      prizeId: 'PZ001', prizeName: 'テスト景品A',
      fromOwnerType: 'location', fromOwnerId: 'LOC01',
      toOwnerType: 'staff', toOwnerId: 'STAFF02',
      quantity: 3, createdBy: 'STAFF01',
    })

    const stocks = mockSupabase._getTable('prize_stocks')
    const from = stocks.find(s => s.stock_id === 'FROM-1')
    expect(from.quantity).toBe(17) // 20 - 3

    // 新規作成された移動先
    const newStock = stocks.find(s => s.owner_id === 'STAFF02')
    expect(newStock).toBeTruthy()
    expect(newStock.quantity).toBe(3)
  })

  it('在庫不足: エラー、DB未変更', async () => {
    await expect(transferStock({
      prizeId: 'PZ001', prizeName: 'テスト景品A',
      fromOwnerType: 'location', fromOwnerId: 'LOC01',
      toOwnerType: 'staff', toOwnerId: 'STAFF01',
      quantity: 25, createdBy: 'STAFF01',
    })).rejects.toThrow('在庫不足')

    // DB未変更
    const stocks = mockSupabase._getTable('prize_stocks')
    expect(stocks.find(s => s.stock_id === 'FROM-1').quantity).toBe(20)
    expect(stocks.find(s => s.stock_id === 'TO-1').quantity).toBe(3)
    expect(mockSupabase._getTable('stock_movements').length).toBe(0)
  })

  it('無効な数量(0): エラー', async () => {
    await expect(transferStock({
      prizeId: 'PZ001', fromOwnerType: 'location', fromOwnerId: 'LOC01',
      toOwnerType: 'staff', toOwnerId: 'STAFF01',
      quantity: 0, createdBy: 'STAFF01',
    })).rejects.toThrow('無効な数量')
  })

  it('無効な数量(負): エラー', async () => {
    await expect(transferStock({
      prizeId: 'PZ001', fromOwnerType: 'location', fromOwnerId: 'LOC01',
      toOwnerType: 'staff', toOwnerId: 'STAFF01',
      quantity: -3, createdBy: 'STAFF01',
    })).rejects.toThrow('無効な数量')
  })

  it('無効な数量(非数値): エラー', async () => {
    await expect(transferStock({
      prizeId: 'PZ001', fromOwnerType: 'location', fromOwnerId: 'LOC01',
      toOwnerType: 'staff', toOwnerId: 'STAFF01',
      quantity: 'abc', createdBy: 'STAFF01',
    })).rejects.toThrow('無効な数量')
  })

  it('movement_type判定: from有→transfer', async () => {
    await transferStock({
      prizeId: 'PZ001', fromOwnerType: 'location', fromOwnerId: 'LOC01',
      toOwnerType: 'staff', toOwnerId: 'STAFF01',
      quantity: 1, createdBy: 'STAFF01',
    })

    const mv = mockSupabase._getTable('stock_movements')[0]
    expect(mv.movement_type).toBe('transfer')
  })

  it('movement_type判定: from無→arrival', async () => {
    await transferStock({
      prizeId: 'PZ001', prizeName: 'テスト景品A',
      fromOwnerType: '', fromOwnerId: '',
      toOwnerType: 'location', toOwnerId: 'LOC01',
      quantity: 10, createdBy: 'STAFF01',
    })

    const mv = mockSupabase._getTable('stock_movements')[0]
    expect(mv.movement_type).toBe('arrival')
  })

  it('監査ログのbefore/after数量が正しい', async () => {
    await transferStock({
      prizeId: 'PZ001', prizeName: 'テスト景品A',
      fromOwnerType: 'location', fromOwnerId: 'LOC01',
      toOwnerType: 'staff', toOwnerId: 'STAFF01',
      quantity: 7, createdBy: 'STAFF01',
    })

    await flush()
    const logs = mockSupabase._getTable('audit_logs')
    const log = logs.find(l => l.action === 'stock_transfer')
    expect(log).toBeTruthy()
    expect(log.before_data.from.quantity).toBe(20)
    expect(log.before_data.to.quantity).toBe(3)
    expect(log.after_data.from.quantity).toBe(13) // 20 - 7
    expect(log.after_data.to.quantity).toBe(10)    // 3 + 7
    expect(log.after_data.transferred).toBe(7)
  })

  it('reason伝播: 監査ログdetailに含まれる', async () => {
    await transferStock({
      prizeId: 'PZ001', prizeName: 'テスト景品A',
      fromOwnerType: 'location', fromOwnerId: 'LOC01',
      toOwnerType: 'staff', toOwnerId: 'STAFF01',
      quantity: 2, createdBy: 'STAFF01',
      reason: '車両補充用',
    })

    await flush()
    const logs = mockSupabase._getTable('audit_logs')
    const log = logs.find(l => l.action === 'stock_transfer')
    expect(log.detail).toContain('車両補充用')
    expect(log.reason).toBe('車両補充用')
  })
})
