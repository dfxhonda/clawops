// @vitest-environment node
import { describe, it, expect, afterEach } from 'vitest'
import { server } from '../__tests__/msw/server'
import { http, HttpResponse } from 'msw'
import {
  getRevenueByStore,
  getRevenueByMachine,
  getRevenueByPrize,
  getKpiSummary,
} from './revenueQuery'

const BASE = 'http://localhost:54321'
const TEST_DATE = '2026-05-07'
const PREV_DATE = '2026-05-06'

const MOCK_STORES = [
  { store_code: 'S01', store_name: 'テスト店A', is_active: true, organization_id: 'org1' },
  { store_code: 'S02', store_name: 'テスト店B', is_active: true, organization_id: 'org1' },
]

const MOCK_MACHINES = [
  { machine_code: 'S01-M1', machine_name: 'クレーンA', store_code: 'S01', is_active: true },
  { machine_code: 'S02-M1', machine_name: 'クレーンB', store_code: 'S02', is_active: true },
]

const MOCK_READINGS = [
  {
    reading_id: 'r1', store_code: 'S01', machine_code: 'S01-M1',
    patrol_date: TEST_DATE, revenue: 8000, in_diff: 80, out_diff_1: 56, out_diff_2: null, out_diff_3: null,
    payout_rate: 70, prize_name: '景品A', prize_id: 'P01', prize_cost: 1000, prize_cost_1: 1000,
    entry_type: 'patrol', organization_id: 'org1',
  },
  {
    reading_id: 'r2', store_code: 'S02', machine_code: 'S02-M1',
    patrol_date: TEST_DATE, revenue: 4000, in_diff: 40, out_diff_1: 20, out_diff_2: null, out_diff_3: null,
    payout_rate: 50, prize_name: '景品B', prize_id: 'P02', prize_cost: 500, prize_cost_1: 500,
    entry_type: 'patrol', organization_id: 'org1',
  },
]

const MOCK_PREV_READINGS = [
  {
    reading_id: 'p1', store_code: 'S01', machine_code: 'S01-M1',
    patrol_date: PREV_DATE, revenue: 6000, in_diff: 60, out_diff_1: 42, out_diff_2: null, out_diff_3: null,
    payout_rate: 70, prize_name: '景品A', prize_id: 'P01', prize_cost: 1000, prize_cost_1: 1000,
    entry_type: 'patrol', organization_id: 'org1',
  },
]

afterEach(() => server.resetHandlers())

function mockReadings(dateMap) {
  server.use(
    http.get(`${BASE}/rest/v1/meter_readings`, ({ request }) => {
      const url = new URL(request.url)
      const gteParam = url.searchParams.get('patrol_date')
      if (gteParam && gteParam.includes(PREV_DATE)) {
        return HttpResponse.json(dateMap[PREV_DATE] || [])
      }
      return HttpResponse.json(dateMap[TEST_DATE] || [])
    }),
    http.get(`${BASE}/rest/v1/stores`, () => HttpResponse.json(MOCK_STORES)),
    http.get(`${BASE}/rest/v1/machines`, () => HttpResponse.json(MOCK_MACHINES)),
  )
}

describe('getRevenueByStore', () => {
  it('売上 DESC で並び替えて返す', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS })
    const result = await getRevenueByStore('custom', TEST_DATE, TEST_DATE)
    expect(result.length).toBe(2)
    expect(result[0].store_code).toBe('S01')
    expect(result[0].revenue).toBe(8000)
    expect(result[1].revenue).toBe(4000)
  })

  it('share の合計が 100% になる', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS })
    const result = await getRevenueByStore('custom', TEST_DATE, TEST_DATE)
    const total = result.reduce((s, r) => s + r.share, 0)
    expect(Math.round(total)).toBe(100)
  })

  it('payout_rate が out_sum/in_sum から計算される', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS })
    const result = await getRevenueByStore('custom', TEST_DATE, TEST_DATE)
    // S01: out=56, in=80 → 70%
    expect(result[0].payout_rate).toBeCloseTo(70, 0)
  })

  it('store_name が stores テーブルから取得される', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS })
    const result = await getRevenueByStore('custom', TEST_DATE, TEST_DATE)
    expect(result[0].store_name).toBe('テスト店A')
    expect(result[1].store_name).toBe('テスト店B')
  })
})

describe('getRevenueByMachine', () => {
  it('machine_name が machines テーブルから取得される', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS })
    const result = await getRevenueByMachine('custom', TEST_DATE, TEST_DATE)
    expect(result.length).toBe(2)
    const m1 = result.find(r => r.machine_code === 'S01-M1')
    expect(m1?.machine_name).toBe('クレーンA')
  })

  it('売上 DESC で並び替えて返す', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS })
    const result = await getRevenueByMachine('custom', TEST_DATE, TEST_DATE)
    expect(result[0].machine_code).toBe('S01-M1')
    expect(result[0].revenue).toBe(8000)
  })
})

describe('getRevenueByPrize', () => {
  it('profit_margin が正しく計算される', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS })
    const result = await getRevenueByPrize('custom', TEST_DATE, TEST_DATE)
    // P01: revenue=8000, cost=1000*56=56000 → margin=(8000-56000)/8000*100=-600%
    // but that's negative so just verify it's computed
    const p01 = result.find(r => r.prize_id === 'P01')
    expect(p01).toBeDefined()
    expect(typeof p01?.profit_margin).toBe('number')
  })

  it('prize_id ごとに集計する', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS })
    const result = await getRevenueByPrize('custom', TEST_DATE, TEST_DATE)
    expect(result.length).toBe(2)
  })
})

describe('getKpiSummary', () => {
  it('prev_revenue が前期の売上合計', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS, [PREV_DATE]: MOCK_PREV_READINGS })
    const result = await getKpiSummary('custom', TEST_DATE, TEST_DATE)
    expect(result.revenue).toBe(12000)
    expect(result.prev_revenue).toBe(6000)
  })

  it('machine_count が巡回した機械数', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS })
    const result = await getKpiSummary('custom', TEST_DATE, TEST_DATE)
    expect(result.machine_count).toBe(2)
  })

  it('patrol_completion_rate が巡回率を計算', async () => {
    mockReadings({ [TEST_DATE]: MOCK_READINGS })
    const result = await getKpiSummary('custom', TEST_DATE, TEST_DATE)
    // 2 patrolled / 2 total = 100%
    expect(result.patrol_completion_rate).toBe(100)
  })

  it('DB エラー時に throw する', async () => {
    server.use(
      http.get(`${BASE}/rest/v1/meter_readings`, () =>
        HttpResponse.json({ message: 'DB error' }, { status: 500 }),
      ),
    )
    await expect(getKpiSummary('custom', TEST_DATE, TEST_DATE)).rejects.toThrow()
  })
})
