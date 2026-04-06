import { describe, it, expect } from 'vitest'
import {
  aggregateByMetric,
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
