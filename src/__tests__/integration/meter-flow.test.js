// ============================================
// 結合テスト: メーター入力→保存フロー
// saveReading → meter_readings挿入 → 監査ログ → キャッシュ更新
// ============================================
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createMockSupabase } from '../helpers/supabaseMock'
import { makeMeterReading, makeSession } from '../helpers/fixtures'
import { resetFixtureIds } from '../helpers/fixtures'

// モック設定
let mockSupabase
vi.mock('../../lib/supabase', () => ({
  get supabase() { return mockSupabase },
}))

// テスト対象（モック設定後にインポート）
const { saveReading, getAllMeterReadings, getLastReadingsMap } = await import('../../services/readings')
const { clearCache } = await import('../../services/utils')

beforeEach(() => {
  resetFixtureIds()
  clearCache()
  mockSupabase = createMockSupabase({
    meter_readings: [
      makeMeterReading({ reading_id: 'existing-1', booth_id: 'B001', read_time: '2026-04-01T12:00:00Z', in_meter: 500, out_meter: 20 }),
    ],
    audit_logs: [],
  }, makeSession())
})

// microtask flush（fire-and-forget の writeAuditLog を待つ）
const flush = () => new Promise(r => setTimeout(r, 0))

describe('メーター入力→保存フロー', () => {

  it('saveReading → meter_readingsに保存される', async () => {
    await saveReading({
      booth_id: 'B002',
      full_booth_code: 'S01-M01-B002',
      in_meter: '1500',
      out_meter: '80',
      prize_restock_count: '3',
      prize_stock_count: '10',
      prize_name: '新景品',
      created_by: 'STAFF01',
    })

    const readings = mockSupabase._getTable('meter_readings')
    expect(readings.length).toBe(2)
    const inserted = readings.find(r => r.booth_id === 'B002')
    expect(inserted).toBeTruthy()
    expect(inserted.in_meter).toBe(1500)
    expect(inserted.out_meter).toBe(80)
    expect(inserted.prize_name).toBe('新景品')
    expect(inserted.source).toBe('manual')
  })

  it('複数ブースを一括保存', async () => {
    const booths = ['B010', 'B011', 'B012']
    for (const boothId of booths) {
      await saveReading({
        booth_id: boothId,
        full_booth_code: `S01-M01-${boothId}`,
        in_meter: '2000',
        out_meter: '100',
        prize_restock_count: '0',
        prize_stock_count: '0',
        created_by: 'STAFF01',
      })
    }

    const readings = mockSupabase._getTable('meter_readings')
    // 既存1 + 新規3
    expect(readings.length).toBe(4)
    for (const boothId of booths) {
      expect(readings.some(r => r.booth_id === boothId)).toBe(true)
    }
  })

  it('saveReading後にgetAllMeterReadingsが新しい値を返す', async () => {
    await saveReading({
      booth_id: 'B003',
      full_booth_code: 'S01-M01-B003',
      in_meter: '3000',
      out_meter: '150',
      prize_restock_count: '0',
      prize_stock_count: '0',
      created_by: 'STAFF01',
    })

    // キャッシュがクリアされているのでDB再取得
    const all = await getAllMeterReadings(true)
    expect(all.length).toBe(2)
    const newReading = all.find(r => r.booth_id === 'B003')
    expect(newReading).toBeTruthy()
    expect(newReading.in_meter).toBe('3000')
  })

  it('saveReading後にgetLastReadingsMapが最新を返す', async () => {
    // 新しいreadingを保存
    await saveReading({
      booth_id: 'B001',
      full_booth_code: 'S01-M01-B001',
      in_meter: '2000',
      out_meter: '90',
      prize_restock_count: '0',
      prize_stock_count: '0',
      created_by: 'STAFF01',
    })

    const map = await getLastReadingsMap(['B001'])
    expect(map['B001']).toBeTruthy()
    expect(map['B001'].latest).toBeTruthy()
    // 最新のreadingのin_meterが反映されている
    expect(map['B001'].latest.in_meter).toBe('2000')
  })

  it('saveReadingが監査ログを書く', async () => {
    await saveReading({
      booth_id: 'B005',
      full_booth_code: 'S01-M01-B005',
      in_meter: '5000',
      out_meter: '200',
      prize_restock_count: '0',
      prize_stock_count: '0',
      created_by: 'STAFF01',
    })

    await flush()

    const logs = mockSupabase._getTable('audit_logs')
    expect(logs.length).toBeGreaterThanOrEqual(1)
    const log = logs.find(l => l.action === 'reading_create')
    expect(log).toBeTruthy()
    expect(log.target_table).toBe('meter_readings')
    expect(log.target_id).toBe('B005')
    expect(log.staff_id).toBe('STAFF01')
    expect(log.detail).toContain('IN=5000')
    expect(log.detail).toContain('OUT=200')
  })

  it('Supabaseエラー時に例外を投げる', async () => {
    // エラーを返すモックに差し替え
    mockSupabase = createMockSupabase({}, makeSession())
    // insertでエラーを返すよう、テーブルのinsertを上書き
    const origFrom = mockSupabase.from.bind(mockSupabase)
    mockSupabase.from = (table) => {
      const builder = origFrom(table)
      if (table === 'meter_readings') {
        const origInsert = builder.insert.bind(builder)
        builder.insert = () => ({
          then(resolve) { resolve({ data: null, error: { message: 'DB接続エラー' } }) },
        })
      }
      return builder
    }

    await expect(saveReading({
      booth_id: 'B099',
      in_meter: '100',
      out_meter: '5',
      prize_restock_count: '0',
      prize_stock_count: '0',
      created_by: 'STAFF01',
    })).rejects.toThrow('メーター保存エラー')
  })
})
