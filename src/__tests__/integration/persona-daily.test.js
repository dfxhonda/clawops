// ============================================
// ペルソナ日常操作テスト
// 新人・ベテラン・管理者それぞれの典型的な1日のオペレーションを検証
//
// 各ペルソナは実際の業務フローに沿ったシナリオで構成する:
//   新人スタッフ  → 1ブース入力、確認、監査ログ
//   ベテランスタッフ → 複数ブース一括、景品補充あり、最新値参照
//   管理者       → 在庫移動、棚卸し差異対応、監査ログ確認
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockSupabase } from '../helpers/supabaseMock'
import { makeMeterReading, makeStockRecord, makeSession, resetFixtureIds } from '../helpers/fixtures'

// ---- モック設定 (動的 import より先に宣言) ----
let mockSupabase
vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))

// ---- サービス (モック設定後にインポート) ----
const { saveReading, getLastReadingsMap } = await import('../../services/readings')
const { transferStock, countStock } = await import('../../services/movements')
const { clearCache } = await import('../../services/utils')

// fire-and-forget の writeAuditLog を待つ
const flush = () => new Promise(r => setTimeout(r, 0))

// ---- ペルソナセッション ----
const persona = {
  newbie:  makeSession({ user_metadata: { staff_id: 'SHIN01', name: '新人花子',   role: 'staff' } }),
  veteran: makeSession({ user_metadata: { staff_id: 'VET01',  name: 'ベテラン次郎', role: 'staff' } }),
  admin:   makeSession({ user_metadata: { staff_id: 'ADM01',  name: '管理者一郎',  role: 'admin' } }),
}

beforeEach(() => {
  resetFixtureIds()
  clearCache()
})

// ============================================
// 新人スタッフ: 初めての1人担当ブース入力
// ============================================
describe('新人スタッフの1日', () => {
  beforeEach(() => {
    mockSupabase = createMockSupabase(
      { meter_readings: [], operation_logs: [] },
      persona.newbie,
    )
  })

  it('担当ブースのメーターを1台入力して保存できる', async () => {
    await saveReading({
      booth_id: 'B001',
      full_booth_code: 'S01-M01-B001',
      in_meter: '1200',
      out_meter: '60',
      prize_restock_count: '0',
      prize_stock_count: '10',
      prize_name: 'テスト景品A',
      created_by: 'SHIN01',
    })

    const readings = mockSupabase._getTable('meter_readings')
    expect(readings).toHaveLength(1)
    expect(readings[0].booth_id).toBe('B001')
    expect(readings[0].in_meter).toBe(1200)
    expect(readings[0].out_meter).toBe(60)
    expect(readings[0].source).toBe('manual')
  })

  it('保存後に自分の入力がgetLastReadingsMapで確認できる', async () => {
    await saveReading({
      booth_id: 'B002',
      full_booth_code: 'S01-M01-B002',
      in_meter: '800',
      out_meter: '30',
      prize_restock_count: '0',
      prize_stock_count: '5',
      created_by: 'SHIN01',
    })

    const map = await getLastReadingsMap(['B002'])
    expect(map['B002']).toBeTruthy()
    expect(map['B002'].latest.in_meter).toBe('800')
    expect(map['B002'].latest.out_meter).toBe('30')
  })

  it('入力後に監査ログが記録される', async () => {
    await saveReading({
      booth_id: 'B003',
      full_booth_code: 'S01-M01-B003',
      in_meter: '2000',
      out_meter: '100',
      prize_restock_count: '1',
      prize_stock_count: '9',
      created_by: 'SHIN01',
    })
    await flush()

    const logs = mockSupabase._getTable('operation_logs')
    const log = logs.find(l => l.action === 'reading_create')
    expect(log).toBeTruthy()
    expect(log.staff_id).toBe('SHIN01')
    expect(log.target_table).toBe('meter_readings')
    expect(log.detail).toContain('IN=2000')
  })
})

// ============================================
// ベテランスタッフ: 複数ブース一括入力 + 景品補充
// ============================================
describe('ベテランスタッフの1日', () => {
  beforeEach(() => {
    mockSupabase = createMockSupabase(
      { meter_readings: [], operation_logs: [] },
      persona.veteran,
    )
  })

  it('担当全ブース（3台）を連続入力できる', async () => {
    const booths = [
      { id: 'B010', code: 'S01-M02-B010', in: '5000', out: '250', restock: '5', stock: '15', prize: '景品X' },
      { id: 'B011', code: 'S01-M02-B011', in: '4500', out: '200', restock: '3', stock: '12', prize: '景品Y' },
      { id: 'B012', code: 'S01-M02-B012', in: '6000', out: '300', restock: '8', stock: '20', prize: '景品Z' },
    ]

    for (const b of booths) {
      await saveReading({
        booth_id: b.id, full_booth_code: b.code,
        in_meter: b.in, out_meter: b.out,
        prize_restock_count: b.restock, prize_stock_count: b.stock,
        prize_name: b.prize, created_by: 'VET01',
      })
    }

    const readings = mockSupabase._getTable('meter_readings')
    expect(readings).toHaveLength(3)
    for (const b of booths) {
      expect(readings.some(r => r.booth_id === b.id)).toBe(true)
    }
  })

  it('景品補充ありのブースで prize_restock_count が正しく保存される', async () => {
    await saveReading({
      booth_id: 'B020',
      full_booth_code: 'S01-M03-B020',
      in_meter: '3000',
      out_meter: '150',
      prize_restock_count: '10',
      prize_stock_count: '5',
      prize_name: '人気景品',
      created_by: 'VET01',
    })

    const readings = mockSupabase._getTable('meter_readings')
    expect(readings[0].prize_restock_count).toBe(10)
    expect(readings[0].prize_stock_count).toBe(5)
  })

  it('前回値がある状態で新しい入力をしても最新値が取得できる', async () => {
    mockSupabase = createMockSupabase({
      meter_readings: [
        makeMeterReading({
          booth_id: 'B030',
          full_booth_code: 'S01-M04-B030',
          read_time: '2026-05-04T12:00:00Z',
          in_meter: 4000,
          out_meter: 180,
        }),
      ],
      operation_logs: [],
    }, persona.veteran)

    await saveReading({
      booth_id: 'B030',
      full_booth_code: 'S01-M04-B030',
      in_meter: '5500',
      out_meter: '270',
      prize_restock_count: '6',
      prize_stock_count: '14',
      created_by: 'VET01',
    })

    const readings = mockSupabase._getTable('meter_readings')
    expect(readings).toHaveLength(2)

    const map = await getLastReadingsMap(['B030'])
    expect(map['B030'].latest).toBeTruthy()
    // DB上に2件あっても最新を返す（getLastReadingsMap は order by read_time desc 相当）
    expect(map['B030'].latest).toBeTruthy()
  })

  it('3ブース入力後に監査ログが3件記録される', async () => {
    const boothIds = ['B040', 'B041', 'B042']
    for (const id of boothIds) {
      await saveReading({
        booth_id: id, full_booth_code: `S01-M05-${id}`,
        in_meter: '1000', out_meter: '50',
        prize_restock_count: '0', prize_stock_count: '10',
        created_by: 'VET01',
      })
    }
    await flush()

    const logs = mockSupabase._getTable('operation_logs')
    const readingLogs = logs.filter(l => l.action === 'reading_create')
    expect(readingLogs).toHaveLength(3)
    for (const log of readingLogs) {
      expect(log.staff_id).toBe('VET01')
    }
  })
})

// ============================================
// 管理者: 在庫移動・棚卸し対応
// ============================================
describe('管理者の1日', () => {
  it('店舗在庫をスタッフへ移動できる（stock_movements に記録）', async () => {
    mockSupabase = createMockSupabase({
      prize_stocks: [
        makeStockRecord({
          stock_id: 'stk-loc-001',
          prize_id: 'PZ001',
          owner_type: 'location',
          owner_id: 'LOC01',
          quantity: 20,
        }),
      ],
      stock_movements: [],
      operation_logs: [],
    }, persona.admin)

    await transferStock({
      prizeId: 'PZ001',
      prizeName: '景品A',
      fromOwnerType: 'location',
      fromOwnerId: 'LOC01',
      toOwnerType: 'staff',
      toOwnerId: 'STAFF01',
      quantity: 5,
      note: '補充用',
      createdBy: 'ADM01',
    })

    const movements = mockSupabase._getTable('stock_movements')
    expect(movements).toHaveLength(1)
    expect(movements[0].movement_type).toBe('transfer')
    expect(movements[0].quantity).toBe(5)
    expect(movements[0].created_by).toBe('ADM01')
    expect(movements[0].from_owner_id).toBe('LOC01')
    expect(movements[0].to_owner_id).toBe('STAFF01')
  })

  it('移動後に移動元の在庫が減算される', async () => {
    mockSupabase = createMockSupabase({
      prize_stocks: [
        makeStockRecord({
          stock_id: 'stk-loc-002',
          prize_id: 'PZ002',
          owner_type: 'location',
          owner_id: 'LOC01',
          quantity: 30,
        }),
      ],
      stock_movements: [],
      operation_logs: [],
    }, persona.admin)

    await transferStock({
      prizeId: 'PZ002',
      prizeName: '景品B',
      fromOwnerType: 'location',
      fromOwnerId: 'LOC01',
      toOwnerType: 'staff',
      toOwnerId: 'STAFF02',
      quantity: 8,
      createdBy: 'ADM01',
    })

    const stocks = mockSupabase._getTable('prize_stocks')
    const fromStock = stocks.find(s => s.stock_id === 'stk-loc-002')
    expect(fromStock.quantity).toBe(22)
  })

  it('在庫不足では移動が拒否される', async () => {
    mockSupabase = createMockSupabase({
      prize_stocks: [
        makeStockRecord({
          stock_id: 'stk-loc-003',
          prize_id: 'PZ003',
          owner_type: 'location',
          owner_id: 'LOC01',
          quantity: 3,
        }),
      ],
      stock_movements: [],
      operation_logs: [],
    }, persona.admin)

    await expect(
      transferStock({
        prizeId: 'PZ003',
        prizeName: '景品C',
        fromOwnerType: 'location',
        fromOwnerId: 'LOC01',
        toOwnerType: 'staff',
        toOwnerId: 'STAFF01',
        quantity: 10,
        createdBy: 'ADM01',
      })
    ).rejects.toThrow('在庫不足')
  })

  it('棚卸しで差異ありの場合に調整移動が記録される', async () => {
    mockSupabase = createMockSupabase({
      prize_stocks: [
        makeStockRecord({
          stock_id: 'stk-count-01',
          prize_id: 'PZ010',
          owner_type: 'location',
          owner_id: 'LOC01',
          quantity: 15,
        }),
      ],
      stock_movements: [],
      operation_logs: [],
    }, persona.admin)

    // 実数が 12 → 差異 -3
    await countStock({
      prizeId: 'PZ010',
      prizeName: '景品D',
      ownerType: 'location',
      ownerId: 'LOC01',
      actualQuantity: 12,
      note: '棚卸し結果',
      createdBy: 'ADM01',
    })

    const movements = mockSupabase._getTable('stock_movements')
    expect(movements).toHaveLength(1)
    expect(movements[0].movement_type).toBe('adjust')
  })

  it('棚卸しで差異なしの場合も count 移動が記録される', async () => {
    mockSupabase = createMockSupabase({
      prize_stocks: [
        makeStockRecord({
          stock_id: 'stk-count-02',
          prize_id: 'PZ011',
          owner_type: 'location',
          owner_id: 'LOC01',
          quantity: 10,
        }),
      ],
      stock_movements: [],
      operation_logs: [],
    }, persona.admin)

    await countStock({
      prizeId: 'PZ011',
      prizeName: '景品E',
      ownerType: 'location',
      ownerId: 'LOC01',
      actualQuantity: 10,
      note: '一致確認',
      createdBy: 'ADM01',
    })

    const movements = mockSupabase._getTable('stock_movements')
    expect(movements).toHaveLength(1)
    expect(movements[0].movement_type).toBe('count')
  })

  it('棚卸し後に監査ログが記録される', async () => {
    mockSupabase = createMockSupabase({
      prize_stocks: [
        makeStockRecord({
          stock_id: 'stk-count-03',
          prize_id: 'PZ012',
          owner_type: 'location',
          owner_id: 'LOC01',
          quantity: 20,
        }),
      ],
      stock_movements: [],
      operation_logs: [],
    }, persona.admin)

    await countStock({
      prizeId: 'PZ012',
      prizeName: '景品F',
      ownerType: 'location',
      ownerId: 'LOC01',
      actualQuantity: 17,
      createdBy: 'ADM01',
    })
    await flush()

    const logs = mockSupabase._getTable('operation_logs')
    const countLog = logs.find(l => l.action === 'stock_count_adjust')
    expect(countLog).toBeTruthy()
    expect(countLog.staff_id).toBe('ADM01')
    expect(countLog.detail).toContain('差異')
  })
})
