// ============================================
// 結合テスト: 棚卸し→差分確認→確定フロー
// countStock → prize_stocks更新 → stock_movements作成 → 監査ログ
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockSupabase } from '../helpers/supabaseMock'
import { makeStockRecord, makeSession } from '../helpers/fixtures'
import { resetFixtureIds } from '../helpers/fixtures'

let mockSupabase
vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))

const { countStock } = await import('../../services/movements')
const { clearCache } = await import('../../services/utils')

const flush = () => new Promise(r => setTimeout(r, 0))

beforeEach(() => {
  resetFixtureIds()
  clearCache()
  mockSupabase = createMockSupabase({
    prize_stocks: [
      makeStockRecord({ stock_id: 'STK-A', prize_id: 'PZ001', owner_type: 'location', owner_id: 'LOC01', quantity: 10 }),
      makeStockRecord({ stock_id: 'STK-B', prize_id: 'PZ002', owner_type: 'staff', owner_id: 'STAFF01', quantity: 5 }),
    ],
    stock_movements: [],
    audit_logs: [],
  }, makeSession())
})

describe('棚卸し→差分確認→確定フロー', () => {

  it('差異あり（実数>理論値）: 正のdiff', async () => {
    const result = await countStock({
      prizeId: 'PZ001', prizeName: 'テスト景品A',
      ownerType: 'location', ownerId: 'LOC01',
      actualQuantity: 15, createdBy: 'STAFF01',
    })

    expect(result.previousQuantity).toBe(10)
    expect(result.actualQuantity).toBe(15)
    expect(result.diff).toBe(5)

    // prize_stocks更新
    const stock = mockSupabase._getTable('prize_stocks').find(s => s.stock_id === 'STK-A')
    expect(stock.quantity).toBe(15)

    // stock_movements
    const movements = mockSupabase._getTable('stock_movements')
    expect(movements.length).toBe(1)
    expect(movements[0].movement_type).toBe('adjust')
    expect(movements[0].quantity).toBe(5)

    // 監査ログ
    await flush()
    const logs = mockSupabase._getTable('audit_logs')
    const log = logs.find(l => l.action === 'stock_count_adjust')
    expect(log).toBeTruthy()
    expect(log.detail).toContain('差異+5')
  })

  it('差異あり（実数<理論値）: 負のdiff', async () => {
    const result = await countStock({
      prizeId: 'PZ002', prizeName: 'テスト景品B',
      ownerType: 'staff', ownerId: 'STAFF01',
      actualQuantity: 2, createdBy: 'STAFF01',
    })

    expect(result.previousQuantity).toBe(5)
    expect(result.actualQuantity).toBe(2)
    expect(result.diff).toBe(-3)

    const movements = mockSupabase._getTable('stock_movements')
    expect(movements[0].quantity).toBe(-3)
    expect(movements[0].movement_type).toBe('adjust')
  })

  it('一致: diff=0, movement_type=count', async () => {
    const result = await countStock({
      prizeId: 'PZ001', prizeName: 'テスト景品A',
      ownerType: 'location', ownerId: 'LOC01',
      actualQuantity: 10, createdBy: 'STAFF01',
    })

    expect(result.diff).toBe(0)

    const movements = mockSupabase._getTable('stock_movements')
    expect(movements[0].movement_type).toBe('count')

    await flush()
    const logs = mockSupabase._getTable('audit_logs')
    const log = logs.find(l => l.action === 'stock_count_match')
    expect(log).toBeTruthy()
    expect(log.detail).toContain('一致')
  })

  it('在庫レコード未存在: 新規作成', async () => {
    const result = await countStock({
      prizeId: 'PZ-NEW', prizeName: '新景品',
      ownerType: 'location', ownerId: 'LOC02',
      actualQuantity: 8, createdBy: 'STAFF01',
    })

    expect(result.previousQuantity).toBe(0)
    expect(result.actualQuantity).toBe(8)
    expect(result.diff).toBe(8)

    // 新しいprize_stocksレコード
    const stocks = mockSupabase._getTable('prize_stocks')
    const newStock = stocks.find(s => s.prize_id === 'PZ-NEW' && s.owner_id === 'LOC02')
    expect(newStock).toBeTruthy()
    expect(newStock.quantity).toBe(8)
  })

  it('無効な数量: エラー', async () => {
    await expect(countStock({
      prizeId: 'PZ001', ownerType: 'location', ownerId: 'LOC01',
      actualQuantity: -5, createdBy: 'STAFF01',
    })).rejects.toThrow('無効な数量')

    await expect(countStock({
      prizeId: 'PZ001', ownerType: 'location', ownerId: 'LOC01',
      actualQuantity: 'abc', createdBy: 'STAFF01',
    })).rejects.toThrow('無効な数量')
  })

  it('監査ログのbefore/after構造が正しい', async () => {
    await countStock({
      prizeId: 'PZ001', prizeName: 'テスト景品A',
      ownerType: 'location', ownerId: 'LOC01',
      actualQuantity: 7, createdBy: 'STAFF01',
      reason: '破損廃棄3個',
    })

    await flush()
    const logs = mockSupabase._getTable('audit_logs')
    const log = logs.find(l => l.action === 'stock_count_adjust')
    expect(log).toBeTruthy()
    expect(log.before_data).toEqual(expect.objectContaining({
      quantity: 10,
      prize_id: 'PZ001',
      owner_type: 'location',
    }))
    expect(log.after_data).toEqual(expect.objectContaining({
      quantity: 7,
      diff: -3,
    }))
    expect(log.reason).toBe('破損廃棄3個')
  })
})
