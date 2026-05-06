import { describe, it, expect } from 'vitest'
import {
  aggregateByMetric,
  aggregateByMonth,
  aggregateByStaff,
  aggregateByLocation,
} from '../../lib/auditAggregations'

// --- Fixtures ---
const makeLogs = () => [
  {
    id: 1, action: 'stock_count_adjust', reason_code: 'COUNT_DIFF',
    staff_id: 'STAFF01', detail: '', created_at: '2026-04-01T10:00:00Z',
  },
  {
    id: 2, action: 'reading_update', reason_code: 'INPUT_FIX',
    staff_id: 'STAFF02', detail: 'メーター修正', created_at: '2026-04-02T10:00:00Z',
  },
  {
    id: 3, action: 'stock_transfer', reason_code: 'TRANSFER',
    staff_id: 'STAFF01', detail: '景品A x5: location/LOC01 → staff/STAFF02',
    created_at: '2026-04-03T10:00:00Z',
  },
  {
    id: 4, action: 'stock_transfer', reason_code: 'TRANSFER',
    staff_id: 'STAFF02', detail: '景品B x2: location/LOC02 → location/LOC01',
    created_at: '2026-04-04T10:00:00Z',
  },
  {
    id: 5, action: 'order_arrived', reason_code: null,
    staff_id: 'STAFF01', detail: '入荷確認', created_at: '2026-04-05T10:00:00Z',
  },
]

describe('aggregateByMetric', () => {
  it('INPUT_FIX reason_code を input_fix としてカウントする', () => {
    const logs = makeLogs()
    const result = aggregateByMetric(logs)
    expect(result.input_fix).toBe(1)
    expect(result.stock_count_adjust).toBe(1)
    expect(result.stock_transfer).toBe(2)
    expect(result.order_arrived).toBe(1)
  })
})

describe('aggregateByMonth', () => {
  it('同月のログがひとつのキーにまとまる', () => {
    const result = aggregateByMonth(makeLogs())
    expect(Object.keys(result)).toEqual(['2026-04'])
  })

  it('月別に各指標が正しくカウントされる', () => {
    const result = aggregateByMonth(makeLogs())
    const apr = result['2026-04']
    expect(apr.stock_count_adjust).toBe(1)
    expect(apr.input_fix).toBe(1)
    expect(apr.stock_transfer).toBe(2)
    expect(apr.order_arrived).toBe(1)
  })

  it('複数月にまたがるログが分割される', () => {
    const logs = [
      { action: 'stock_transfer', reason_code: null, staff_id: 'S1', created_at: '2026-03-31T23:59:00Z' },
      { action: 'stock_transfer', reason_code: null, staff_id: 'S1', created_at: '2026-04-01T00:00:00Z' },
      { action: 'order_arrived',  reason_code: null, staff_id: 'S1', created_at: '2026-05-01T00:00:00Z' },
    ]
    const result = aggregateByMonth(logs)
    expect(result['2026-03'].stock_transfer).toBe(1)
    expect(result['2026-04'].stock_transfer).toBe(1)
    expect(result['2026-05'].order_arrived).toBe(1)
  })

  it('created_at が空のログはスキップされる', () => {
    const logs = [
      { action: 'stock_transfer', reason_code: null, staff_id: 'S1', created_at: '' },
      { action: 'order_arrived',  reason_code: null, staff_id: 'S1', created_at: null },
    ]
    expect(aggregateByMonth(logs)).toEqual({})
  })
})

describe('aggregateByStaff', () => {
  it('担当者ごとに集計される', () => {
    const result = aggregateByStaff(makeLogs())
    const staff01 = result.find(r => r.staffId === 'STAFF01')
    const staff02 = result.find(r => r.staffId === 'STAFF02')
    expect(staff01).toBeDefined()
    expect(staff02).toBeDefined()
    // STAFF01: stock_count_adjust(1) + stock_transfer(1) + order_arrived(1) = 3
    expect(staff01.counts.stock_count_adjust).toBe(1)
    expect(staff01.counts.stock_transfer).toBe(1)
    expect(staff01.counts.order_arrived).toBe(1)
    expect(staff01.total).toBe(3)
    // STAFF02: input_fix(1) + stock_transfer(1) = 2
    expect(staff02.counts.input_fix).toBe(1)
    expect(staff02.counts.stock_transfer).toBe(1)
    expect(staff02.total).toBe(2)
  })

  it('total 降順でソートされる', () => {
    const result = aggregateByStaff(makeLogs())
    expect(result[0].staffId).toBe('STAFF01')
    expect(result[1].staffId).toBe('STAFF02')
  })

  it('staffMap で名前が解決される', () => {
    const staffMap = { STAFF01: '山田太郎', STAFF02: '鈴木花子' }
    const result = aggregateByStaff(makeLogs(), staffMap)
    expect(result.find(r => r.staffId === 'STAFF01').name).toBe('山田太郎')
    expect(result.find(r => r.staffId === 'STAFF02').name).toBe('鈴木花子')
  })

  it('staffMap 未登録の場合は staff_id をそのまま name にする', () => {
    const result = aggregateByStaff(makeLogs(), {})
    expect(result.find(r => r.staffId === 'STAFF01').name).toBe('STAFF01')
  })

  it('staff_id が null のログは unknown バケットに入る', () => {
    const logs = [{ action: 'order_arrived', reason_code: null, staff_id: null, created_at: '2026-04-01T00:00:00Z' }]
    const result = aggregateByStaff(logs)
    expect(result[0].staffId).toBe('unknown')
    expect(result[0].total).toBe(1)
  })
})

describe('aggregateByLocation', () => {
  it('detail の location/ regex を正しくパースする', () => {
    const logs = makeLogs()
    const result = aggregateByLocation(logs)

    // LOC01: id=3 の from + id=4 の to = 2
    const loc01 = result.find(r => r.locationId === 'LOC01')
    expect(loc01).toBeDefined()
    expect(loc01.transfer).toBe(2)

    // LOC02: id=4 の from = 1
    const loc02 = result.find(r => r.locationId === 'LOC02')
    expect(loc02).toBeDefined()
    expect(loc02.transfer).toBe(1)
  })

  it('stock_transfer 以外のログは集計しない', () => {
    const logs = makeLogs()
    const result = aggregateByLocation(logs)
    // stock_count_adjust や reading_update は含まれないこと
    const total = result.reduce((s, r) => s + r.transfer, 0)
    // LOC01(2) + LOC02(1) = 3 件のみ
    expect(total).toBe(3)
  })
})
